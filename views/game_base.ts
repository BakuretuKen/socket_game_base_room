// Socket.IO型定義
declare const io: any;
// グローバル型定義 (types/socket-types.ts) を使用

// Socket.IO接続
const socket = io();
const maxUserNameLength = 8; // ユーザー名最大文字数
const minUserCount = 3; // ゲーム開始に必要な最小ユーザー数
const maxUserCount = 7; // 最大ユーザー数

// 役職定義（全プレイヤー共通） key=役職ID
const roles: { [key: number]: { name: string; code: string } } = {
    0: { name: "村人", code: "citizen" },
    1: { name: "占い師", code: "seer" },
    2: { name: "怪盗", code: "thief" },
    10: { name: "人狼", code: "werewolf" },
};

// 人数別の役職デッキ（プレイヤー数 + 予備2枚）
const roleDecks: { [playerCount: number]: number[] } = {
    3: [0, 1, 2, 10, 10],             // 村人、占い師、怪盗、人狼、人狼
    4: [0, 0, 1, 2, 10, 10],          // 村人×2、占い師、怪盗、人狼×2
    5: [0, 0, 0, 1, 2, 10, 10],       // 村人×3、占い師、怪盗、人狼×2
    6: [0, 0, 0, 0, 1, 2, 10, 10],    // 村人×4、占い師、怪盗、人狼×2
    7: [0, 0, 0, 0, 1, 2, 10, 10, 10], // 村人×4、占い師、怪盗、人狼×3
};

let gameCode: string;
let isMaster: boolean;
let playerName: string;
let player: {
    roleId?: number; // 自分に配られた役職ID
    playerIndex?: number; // players 配列内の自分の番号
} = {};
let players: {
    socketId: string;
    userName: string;
    roleId?: number; // 配布された役職ID（ゲーム開始後・マスターが保持）
}[] = [];
let spareCards: number[] = []; // 予備カード2枚（順番付き・マスターが保持）

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

// ゲーム開始（マスター用・roleId を除いた players を全員に送る）
function startGame(): void {
    sendMessage({
        action: "START_GAME",
        players: players.map(function(p) {
            return {
                socketId: p.socketId,
                userName: p.userName
            };
        })
    });
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
    updateStartGameButton();
}

// 3〜7名のときだけ「ゲーム開始」を有効化（マスターのみ）
function updateStartGameButton(): void {
    const startButton = document.getElementById("startGameButton") as HTMLButtonElement | null;
    if (!startButton) {
        return;
    }
    const count = players.length;
    startButton.disabled = count < minUserCount || count > maxUserCount;
}

// ゲーム画面にカードを裏面で表示（予備2枚＋プレイヤー分）
function showGameCards(): void {
    const spareArea = document.getElementById("spareCardsArea");
    const playerArea = document.getElementById("playerCardsArea");
    if (!spareArea || !playerArea) {
        return;
    }

    // 予備カード2枚を横並び
    spareArea.innerHTML = "";
    for (let i = 0; i < 2; i++) {
        const card = document.createElement("div");
        card.className = "card";
        card.textContent = "🂠";
        spareArea.appendChild(card);
    }

    // プレイヤー分のカードを縦並び（右に名前・自分のみ役職も表示）
    playerArea.innerHTML = "";
    players.forEach(function(p, index) {
        const row = document.createElement("div");
        row.className = "player-card-row";

        const card = document.createElement("div");
        card.className = "card";
        card.textContent = "🂠";

        const name = document.createElement("span");
        name.className = "player-name";
        let nameText = p.userName;
        // 自分のカードのみ役職を名前の右に表示
        if (player.playerIndex === index && player.roleId !== undefined && roles[player.roleId]) {
            nameText += "（" + roles[player.roleId].name + "）";
        }
        name.textContent = nameText;

        row.appendChild(card);
        row.appendChild(name);
        playerArea.appendChild(row);
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
