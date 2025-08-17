/**
 * Socket.IO通信用のグローバル型定義
 * ブラウザとサーバーで共有される型定義
 */

declare global {
    interface MakeResponse {
        status: boolean;
        gameCode: string;
        socketId: string;
    }

    interface JoinResponse {
        status: boolean;
        userName: string;
        socketId: string;
        masterId: string;
    }

    interface RecvMessage {
        status: boolean;
        socketId: string;
        action?: string;
        [key: string]: any; // 任意のデータ
    }

    interface Window {
        receiveMessage: (arr: RecvMessage) => void;
    }
}

export {};
