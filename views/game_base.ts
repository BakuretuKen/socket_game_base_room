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
    // POST /new・/join で遷移してきてもアドレスバーの URL は / のままにする
    history.replaceState(null, "", "/");

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
                // ゲームコードを正規化して保持（大文字英数字6桁）
                gameCode = gameCodeElement.value.trim().toUpperCase();
                socket.emit("join", {
                    gameCode: gameCode,
                    userName: userNameElement.value
                });
            }
        });

        socket.on("disconnect", function() {
            console.log("Disconnect");
            networkErrorMessage();
        });
    } catch (e) {
        console.log("Socket Connection Error: " + e);
        showError("Socket Connection Error");
        return;
    }

    socket.on("make", makeMessage);
    socket.on("join", joinMessage);
    socket.on("recv", function(arr: RecvMessage) {
        // 参加拒否通知は共通処理で受ける（ゲーム側 receiveMessage には渡さない）
        if (!isMaster && arr.action === "JOIN_REJECTED") {
            joinRejectedMessage(arr);
            return;
        }
        window.receiveMessage(arr);
    });
});

// デバッグ用テキストエリアに受信情報を出力
function debugLog(label: string, data?: any): void {
    const textarea = document.getElementById("debugLog") as HTMLTextAreaElement;
    if (!textarea) {
        return;
    }
    const line = data !== undefined ? label + " " + JSON.stringify(data) : label;
    textarea.value += line + "\n\n"; // 各情報の後に空行を入れて見やすくする
    textarea.scrollTop = textarea.scrollHeight; // 最新行までスクロール
}

function makeMessage(arr: MakeResponse): void {
    console.log("make:", arr);
    debugLog("make:", arr);
    // ゲームコードを保持
    gameCode = arr.gameCode;
    if (arr.gameCode) {
        showGameCodePanel(arr.gameCode);
    }

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
    debugLog("join:", arr);
    if (isMaster) {
        console.log("Add User: " + arr.userName);
        // 同じユーザー名がいたら本人に拒否を通知
        for (let i = 0; i < players.length; i++) {
            if (players[i].userName === arr.userName.slice(0, maxUserNameLength)) {
                sendDirectMessage(arr.socketId, {
                    action: "JOIN_REJECTED",
                    reason: "同じ名前のユーザーがいるため参加できません。"
                });
                return;
            }
        }
        // ユーザー上限チェック
        if (players.length >= maxUserCount) {
            showError("ユーザーが上限に達しました: " + arr.userName.slice(0, maxUserNameLength));
            sendDirectMessage(arr.socketId, {
                action: "JOIN_REJECTED",
                reason: "参加人数が上限に達しているため参加できません。"
            });
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
            console.log("Master Socket ID: " + arr.masterId); // 必要であれば保持する
        } else {
            // ゲームコードが見つからないので待機ルームを隠してトップページへ戻るボタンを表示
            showError("ゲームが見つかりません。");
            const waitingRoom = document.getElementById("waitingRoom");
            if (waitingRoom) {
                waitingRoom.style.display = "none";
            }
            const backToTop = document.getElementById("backToTop");
            if (backToTop) {
                backToTop.style.display = "block";
            }
        }
    }
}

// サーバーとの接続が切れたのでエラーを表示してトップページへ戻るボタンを表示
function networkErrorMessage(): void {
    socket.disconnect(); // 自動再接続を止める（再接続すると socketId が変わり整合が取れないため）
    showError("ネットワークエラーが発生しました");
    const waitingRoom = document.getElementById("waitingRoom");
    if (waitingRoom) {
        waitingRoom.style.display = "none";
    }
    const gameScreen = document.getElementById("gameScreen");
    if (gameScreen) {
        gameScreen.style.display = "none";
    }
    const backToTop = document.getElementById("backToTop");
    if (backToTop) {
        backToTop.style.display = "block";
    }
}

// マスターから参加を拒否されたので待機ルームを隠してトップページへ戻るボタンを表示
function joinRejectedMessage(arr: RecvMessage): void {
    console.log("recv:", arr);
    debugLog("recv:", arr);
    showError(arr.reason || "参加できません。");
    const waitingRoom = document.getElementById("waitingRoom");
    if (waitingRoom) {
        waitingRoom.style.display = "none";
    }
    const backToTop = document.getElementById("backToTop");
    if (backToTop) {
        backToTop.style.display = "block";
    }
}

// ゲームコードパネル表示（マスター用・クリックでコピー）
function showGameCodePanel(code: string): void {
    const panel = document.getElementById("gameCodePanel");
    const value = document.getElementById("gameCodeValue");
    if (!panel || !value) {
        return;
    }
    value.textContent = code;
    panel.style.display = "flex";
    panel.addEventListener("click", copyGameCode);
}

// ゲームコードをクリップボードにコピーして背景を光らせる
function copyGameCode(): void {
    if (!gameCode) {
        return;
    }
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(gameCode).then(flashGameCodePanel);
    } else {
        // 非セキュアコンテキスト（HTTP）用フォールバック
        const textarea = document.createElement("textarea");
        textarea.value = gameCode;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        flashGameCodePanel();
    }
}

function flashGameCodePanel(): void {
    const panel = document.getElementById("gameCodePanel");
    if (!panel) {
        return;
    }
    panel.classList.remove("copied");
    void panel.offsetWidth; // reflowを挟んでアニメーションを再トリガー
    panel.classList.add("copied");
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
const beforeUnloadHandler = (event: BeforeUnloadEvent): string => {
    event.preventDefault();
    return '';
};
window.addEventListener('beforeunload', beforeUnloadHandler);

// トップページへ戻る（離脱警告を出さずに遷移）
function goToTop(): void {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    window.location.href = "/";
}
