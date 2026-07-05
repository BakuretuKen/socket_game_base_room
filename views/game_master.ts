// 受信処理（ここを編集してゲーム作成）
(function() {
    window.receiveMessage = function(arr: RecvMessage): void {
        console.log("recv(master):", arr);
        debugLog("recv(master):", arr);
        switch (arr.action) {
            case "START_GAME":
                // ゲーム開始したのでサーバーからゲームコードを削除（以降の新規参加を締め切る）
                socket.emit("delete_code", { gameCode: gameCode });
                hideMessages();
                document.getElementById("waitingRoom")!.style.display = "none";
                document.getElementById("gameScreen")!.style.display = "block";
                document.getElementById("debugArea")!.style.display = "block";
                break;
        }
    };
})();
