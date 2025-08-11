// 受信処理（ここを編集してゲーム作成）
(function() {
    window.receiveMessage = function(arr: RecvMessage): void {
        console.log("recv(master):", arr);
        switch (arr.action) {
            case "START_GAME":
                document.getElementById("waitingRoom")!.style.display = "none";
                document.getElementById("gameScreen")!.style.display = "block";
                break;
        }
    };
})();
