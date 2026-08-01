// デッキをシャッフルして各プレイヤーに役職を配布し、余り2枚を予備カードに保持
function assignRoles(): void {
    const deckTemplate = roleDecks[players.length];
    if (!deckTemplate) {
        console.error("未対応の人数です: " + players.length);
        return;
    }
    // コピーしてシャッフル（Fisher-Yates）
    const deck = deckTemplate.slice();
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = deck[i];
        deck[i] = deck[j];
        deck[j] = tmp;
    }
    // 先頭からプレイヤー人数分を配布
    for (let i = 0; i < players.length; i++) {
        players[i].roleId = deck[i];
    }
    // 残り2枚を順番付きで予備カードに保持
    spareCards = deck.slice(players.length);
    debugLog("assignRoles players:", players);
    debugLog("assignRoles spareCards:", spareCards);

    // 各プレイヤーに自分の役職と配列番号を通知
    for (let i = 0; i < players.length; i++) {
        sendDirectMessage(players[i].socketId, {
            action: "ASSIGN_ROLE",
            roleId: players[i].roleId,
            playerIndex: i
        });
    }
}

// 受信処理（ここを編集してゲーム作成）
(function() {
    window.receiveMessage = function(arr: RecvMessage): void {
        console.log("recv(master):", arr);
        debugLog("recv(master):", arr);
        switch (arr.action) {
            case "START_GAME":
                assignRoles();
                // ゲーム開始したのでサーバーからゲームコードを削除（以降の新規参加を締め切る）
                socket.emit("delete_code", { gameCode: gameCode });
                hideMessages();
                document.getElementById("waitingRoom")!.style.display = "none";
                document.getElementById("gameScreen")!.style.display = "block";
                document.getElementById("debugArea")!.style.display = "block";
                showGameCards();
                break;
            case "ASSIGN_ROLE":
                player.roleId = arr.roleId;
                player.playerIndex = arr.playerIndex;
                console.log("roleId:", player.roleId, "playerIndex:", player.playerIndex);
                showGameCards(); // 自分の役職をカード横に反映
                break;
        }
    };
})();
