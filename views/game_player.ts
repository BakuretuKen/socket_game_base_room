// 受信処理（ここを編集してゲーム作成）
(function() {
    window.receiveMessage = function(arr: RecvMessage): void {
        console.log("recv(player):", arr);
    };
})();
