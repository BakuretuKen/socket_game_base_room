// 受信処理（ここを編集してゲーム作成）
(function() {
    window.receiveMessage = function(arr: RecvMessage): void {
        console.log("recv(player):", arr);
        debugLog("recv(player):", arr);
        switch (arr.action) {
            case "START_GAME":
                // マスターから送られた全プレイヤー情報を保持（roleId は含まれない）
                if (arr.players) {
                    players = arr.players;
                }
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
