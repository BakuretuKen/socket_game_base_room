/**
 * Socket.IO通信用のグローバル型定義
 * ブラウザとサーバーで共有される型定義
 */

declare global {
    interface MakeResponse {
        status: boolean;
        gameCode: string;
    }

    interface JoinResponse {
        status: boolean;
        userName: string;
    }

    interface RecvMessage {
        status: boolean;
        action?: string;
        [key: string]: any; // 任意のデータ
    }

    interface Window {
        receiveMessage: (arr: RecvMessage) => void;
    }
}

export {};
