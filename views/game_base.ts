// Socket.IO型定義
declare const io: any;
// グローバル型定義 (types/socket-types.ts) を使用

// Socket.IO接続
const socket = io();
const maxUserNameLength = 8; // ユーザー名最大文字数
const maxUserCount = 8; // 最大ユーザー数
let gameCode: string;
let isMaster: boolean;
let playerName: string;
let players: {
    socketId: string;
    userName: string;
}[] = [];

document.addEventListener('DOMContentLoaded', function() {
    try {
        socket.on("connect", function() {
            console.log("Connect: " + socket.id);
            const masterElement = document.getElementById("master") as HTMLInputElement;
            const gameCodeElement = document.getElementById("gameCode") as HTMLInputElement;
            const userNameElement = document.getElementById("userName") as HTMLInputElement;
            // ユーザー名を保持
            playerName = userNameElement.value.slice(0, maxUserNameLength); // ユーザー名数を制限

            if (masterElement && masterElement.value == "1" && userNameElement) {
                isMaster = true;
                socket.emit("make", {
                    userName: userNameElement.value
                });
            }
            if (masterElement && masterElement.value == "0" && gameCodeElement && userNameElement) {
                isMaster = false;
                socket.emit("join", {
                    gameCode: gameCodeElement.value,
                    userName: userNameElement.value
                });
                // ゲームコードを保持
                gameCode = gameCodeElement.value;
            }
        });

        socket.on("disconnect", function() {
            console.log("Disconnect");
        });
    } catch (e) {
        console.log("Socket Connection Error: " + e);
        showError("Socket Connection Error");
        return;
    }

    socket.on("make", makeMessage);
    socket.on("join", joinMessage);
    socket.on("recv", window.receiveMessage);
});

function makeMessage(arr: MakeResponse): void {
    console.log("make:", arr);
    if (arr.gameCode) {
        showMessage("ゲームコード：" + arr.gameCode);
    }
    // ゲームコードを保持
    gameCode = arr.gameCode;

    if (players.length !== 0) {
        return;
    }
    const userNameElement = document.getElementById("userName") as HTMLInputElement;
    if (userNameElement) {
        players.push({
            socketId: arr.socketId,
            userName: userNameElement.value.slice(0, maxUserNameLength)
        });
        updateWaitingRoom();
    }
}

function joinMessage(arr: JoinResponse): void {
    console.log("join:", arr);
    if (isMaster) {
        console.log("Add User: " + arr.userName);
        // 同じユーザー名がいたらなにもしない
        for (let i = 0; i < players.length; i++) {
            if (players[i].userName === arr.userName.slice(0, maxUserNameLength)) {
                // 必要であればここで sendDirectMessage で arr.socketId (プレイヤー) に向けてメッセージを送る
                return;
            }
        }
        // ユーザー上限チェック
        if (players.length >= maxUserCount) {
            showError("ユーザーが上限に達しました: " + arr.userName.slice(0, maxUserNameLength));
            // 必要であればここで sendDirectMessage で arr.socketId (プレイヤー) に向けてメッセージを送る
            return;
        }
        // ユーザー追加
        players.push({
            socketId: arr.socketId,
            userName: arr.userName.slice(0, maxUserNameLength)
        });
        updateWaitingRoom();
    } else {
        if (arr.status) {
            showMessage('ゲーム開始までお待ちください。');
        } else {
            showError("ゲームが見つかりません。");
        }
    }
}

// room全員にメッセージを送る（送信者も含む）
function sendMessage(params: { [key: string]: any }): void {
    socket.emit("send", {
        gameCode: gameCode,
        ...params
    });
}

// 送信者にメッセージを送る
function sendDirectMessage(socketId: string, params: { [key: string]: any }): void {
    socket.emit("send_direct", {
        to: socketId,
        ...params
    });
}

function updateWaitingRoom(): void {
    // playersを ol#waitingRoomList に反映
    const waitingRoomList = document.getElementById("waitingRoomList");
    if (!waitingRoomList) {
        return;
    }
    // 子要素削除
    while (waitingRoomList.firstChild) {
        waitingRoomList.removeChild(waitingRoomList.firstChild);
    }
    // 子要素追加
    players.forEach(player => {
        const li = document.createElement("li");
        li.textContent = player.userName;
        waitingRoomList.appendChild(li);
    });
}

// メッセージ表示
function showMessage(message: string): void {
    hideMessages();
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.style.display = 'block';
    }
}
// エラーメッセージ表示
function showError(message: string): void {
    hideMessages();
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}
function hideMessages(): void {
    const messageDiv = document.getElementById('message');
    const errorDiv = document.getElementById('errorMessage');
    if (messageDiv) {
        messageDiv.style.display = 'none';
    }
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// ページ離れたら警告を表示
window.addEventListener('beforeunload', (event) => {
    event.preventDefault();
    return '';
});
