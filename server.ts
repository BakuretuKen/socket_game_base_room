/**
 * 汎用ソケットサーバー ROOM利用
 */

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import './types/socket-types';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 8000;

// ------ グローバル変数 ------
const roomList: { [roomCode: string]: { socketId: string, time: number } } = {};

const KEEP_ROOM_CODE_SEC = 300; // ルームコード保持期間(秒)
const CLEAR_INTERVAL_SEC = 120; // 変数定期クリアインターバル(秒)

const GAME_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // ゲームコード使用文字（大文字英字 + 数字）
const GAME_CODE_LENGTH = 6; // ゲームコード桁数

function generateGameCode(): string {
    let code = '';
    for (let i = 0; i < GAME_CODE_LENGTH; i++) {
        code += GAME_CODE_CHARS[Math.floor(Math.random() * GAME_CODE_CHARS.length)];
    }
    return code;
}

setInterval(() => {
    const nowUnixTime = Math.floor((new Date()).getTime() / 1000);
    for (const roomCode in roomList) {
        if (roomList[roomCode].time + KEEP_ROOM_CODE_SEC > nowUnixTime) {
            continue;
        }
        console.log("Room Delete [" + roomCode + "] " + roomList[roomCode].socketId + " " + roomList[roomCode].time);
        delete roomList[roomCode];
    }
}, CLEAR_INTERVAL_SEC * 1000);

// ------ サーバー ------
const server = createServer(app);
const io = new SocketIOServer(server);

server.listen(port, () => {
    console.log('Listening to PORT:' + port);
});

// ------ HTTP ------
app.set('view engine', 'ejs');

// CSS、JS 静的ファイル読み込み設定
app.use('/', express.static(__dirname + '/views'));
app.use('/dist', express.static(__dirname + '/dist'));

app.get('/', (req: Request, res: Response) => {
    res.sendFile(__dirname + '/views/index.html');
});

// ゲームコード付きURL（例: /PRJWSG）でもトップページを表示（コードは index.html 側で初期値に設定）
app.get('/:gameCode', (req: Request, res: Response, next) => {
    if (!/^[A-Za-z0-9]{6}$/.test(req.params.gameCode)) {
        next(); // 形式不正は 404 へ
        return;
    }
    res.sendFile(__dirname + '/views/index.html');
});

interface NewGameRequest {
    userName: string;
}

interface JoinGameRequest {
    userName: string;
    gameCode: string;
}

app.post('/new', (req: Request, res: Response) => {
    const { userName }: NewGameRequest = req.body;
    if (typeof userName === "undefined") {
        res.status(400);
        res.end('400 BAD REQUEST');
        return;
    }
    res.render(__dirname + '/game', { userName: userName, gameCode: 'new', master: '1' });
});

app.post('/join', (req: Request, res: Response) => {
    const { userName, gameCode }: JoinGameRequest = req.body;
    if (typeof userName === "undefined" || typeof gameCode === "undefined") {
        res.status(400);
        res.end('400 BAD REQUEST');
        return;
    }
    res.render(__dirname + '/game', { userName: userName, gameCode: gameCode, master: '0' });
});

app.use((req: Request, res: Response) => {
    res.status(404).send('404 NOT FOUND');
});

interface JoinSocketRequest {
    gameCode: string;
    userName: string;
}

interface DeleteCodeRequest {
    gameCode: string;
}

interface SendRequest {
    to: string;
    action?: string;
    from?: string;
    [key: string]: any;
}

// ------ SOCKET ------
io.on('connection', (socket) => {
    // ゲームルーム作成
    // @params {}
    // @return 送信者: make { "status": true, "gameCode": "ゲームCODE", "socketId": 送信者ソケットID }
    socket.on('make', () => {
        for (let i = 0; i < 10; i++) {
            // ランダムな英数字6桁作成（大文字英字 + 数字）
            let gameCode = generateGameCode();
            if (typeof roomList[gameCode] === "undefined") {
                // Socket Room 入室
                socket.join(gameCode);
                roomList[gameCode] = {
                    socketId: socket.id,
                    time: Math.floor((new Date()).getTime() / 1000)
                };
                // 送信元への通知
                const response: MakeResponse = { "status": true, "gameCode": gameCode, "socketId": socket.id };
                io.to(socket.id).emit('make', response);
                console.log("make: " + gameCode + " by " + socket.id);
                return;
            }
        }
        // エラー通知
        const errorResponse: MakeResponse = { "status": false, "gameCode": "", "socketId": socket.id };
        io.to(socket.id).emit('make', errorResponse);
    });

    // ゲーム接続
    // @params { gameCode: ゲームCODE, userName: ユーザー名 }
    // @return 全員: join { "status": true, "gameCode": "ゲームCODE", "userName": "ユーザー名", "socketId": 送信者ソケットID, "masterId": マスターソケットID }
    socket.on('join', (arr: JoinSocketRequest) => {
        if (typeof arr["gameCode"] === "undefined" || typeof arr["userName"] === "undefined") {
            const errorResponse: JoinResponse = { "status": false, "userName": "", "socketId": "", masterId: "" };
            io.to(socket.id).emit("join", errorResponse);
            return;
        }
        if (typeof roomList[arr["gameCode"]] === "undefined") {
            const errorResponse: JoinResponse = { "status": false, "userName": "", "socketId": "", masterId: "" };
            io.to(socket.id).emit("join", errorResponse);
            return;
        }

        const gameCode = arr["gameCode"];
        // Socket Room 入室
        socket.join(gameCode);
        // ROOM全員に通知
        const masterResponse: JoinResponse = { "status": true, "userName": arr["userName"], "socketId": socket.id, masterId: roomList[gameCode].socketId };
        io.to(gameCode).emit('join', masterResponse);
        console.log("join: " + gameCode + " by " + socket.id);
    });

    // ゲームコード削除（ゲーム開始時にマスターから呼び出し、以降の新規参加を締め切る）
    // @params { gameCode: ゲームCODE }
    socket.on('delete_code', (arr: DeleteCodeRequest) => {
        if (typeof arr["gameCode"] === "undefined") {
            return;
        }
        const gameCode = arr["gameCode"];
        // マスター（ルーム作成者）以外からの削除は受け付けない
        if (typeof roomList[gameCode] === "undefined" || roomList[gameCode].socketId !== socket.id) {
            return;
        }
        delete roomList[gameCode];
        console.log("delete_code: " + gameCode + " by " + socket.id);
    });

    // メッセージ送信
    // @params { to: 送信先ソケットID, action: アクション(オプション), ・・・ }
    // @return 全員: recv　{ "status": true, "action": アクション(オプション), ・・・, "socketId": 送信者ソケットID }
    socket.on('send', (arr: SendRequest) => {
        if (typeof arr["gameCode"] === "undefined") {
            const errorResponse: RecvMessage = { "status": false, "action": "GAME CODE ERROR", "socketId": socket.id };
            io.to(socket.id).emit("recv", errorResponse);
            return;
        }
        const gameCode = arr["gameCode"];

        arr["status"] = true;
        arr["socketId"] = socket.id;
        if (typeof arr["action"] !== "undefined") {
            console.log("send: " + arr["action"] + ' by ' + socket.id);
        }
        // ROOM全員に通知
        console.log("send: [" + gameCode + ']', socket.rooms);
        io.to(gameCode).emit('recv', arr);
    });

    socket.on('send_direct', (arr: SendRequest) => {
        if (typeof arr["to"] === "undefined") {
            const errorResponse: RecvMessage = { "status": false, "action": "SOCKET ID ERROR", "socketId": socket.id };
            io.to(socket.id).emit("recv", errorResponse);
            return;
        }

        arr["status"] = true;
        if (typeof arr["action"] !== "undefined") {
            console.log("send_direct: " + arr["action"] + ' by ' + socket.id);
        }
        // 送信先に通知
        arr["socketId"] = socket.id;
        console.log("send_direct: [" + arr["to"] + ']', socket.rooms);
        io.to(arr["to"]).emit('recv', arr);
    });
});
