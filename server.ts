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
const roomList: { [roomCode: string]: number } = {};

const KEEP_ROOM_CODE_SEC = 300; // ルームコード保持期間(秒)
const CLEAR_INTERVAL_SEC = 120; // 変数定期クリアインターバル(秒)

setInterval(() => {
    const nowUnixTime = Math.floor((new Date()).getTime() / 1000);
    for (const roomCode in roomList) {
        if (roomList[roomCode] + KEEP_ROOM_CODE_SEC > nowUnixTime) {
            continue;
        }
        console.log("Room Delete [" + roomCode + "] " + roomList[roomCode]);
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
    // @return 送信者: make { "status": true, "gameCode": "ゲームCODE" }
    socket.on('make', () => {
        for (let i = 0; i < 10; i++) {
            // ランダムな数字8桁作成
            let gameCode = Math.floor(Math.random() * 1000000).toString().padStart(8, '0');
            // ランダムな英数字8桁作成
            // let gameCode = Math.random().toString(36).substring(2, 10).replace(/[1l]/g, '7') // 1とlを7に置換
            if (typeof roomList[gameCode] === "undefined") {
                // Socket Room 入室
                socket.join(gameCode);
                roomList[gameCode] = Math.floor((new Date()).getTime() / 1000);
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
    // @return 全員: join { "status": true, "gameCode": "ゲームCODE", "userName": "ユーザー名" }
    socket.on('join', (arr: JoinSocketRequest) => {
        if (typeof arr["gameCode"] === "undefined" || typeof arr["userName"] === "undefined") {
            const errorResponse: JoinResponse = { "status": false, "userName": "", "socketId": socket.id };
            io.to(socket.id).emit("join", errorResponse);
            return;
        }
        if (typeof roomList[arr["gameCode"]] === "undefined") {
            const errorResponse: JoinResponse = { "status": false, "userName": "", "socketId": socket.id };
            io.to(socket.id).emit("join", errorResponse);
            return;
        }

        const gameCode = arr["gameCode"];
        // Socket Room 入室
        socket.join(gameCode);
        // ROOM全員に通知
        const masterResponse: JoinResponse = { "status": true, "userName": arr["userName"], "socketId": socket.id };
        io.to(gameCode).emit('join', masterResponse);
        console.log("join: " + gameCode + " by " + socket.id);
    });

    // メッセージ送信
    // @params { to: 送信先ソケットID, action: アクション(オプション), ・・・ }
    // @return 全員: recv　{ "status": true, "action": アクション(オプション), ・・・ }
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
