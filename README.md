# Socket Game Base Room

リアルタイム多人数参加型ゲーム開発のためのTypeScript基盤（Socket.IO Room使用）

## 概要

[ブラウザで「ワンナイト人狼」](https://oj.bakuretuken.com/)（現在は終了）で使用していたプレイヤー間の通信部分を Socket.IO room機能で作り直したプログラムです。<br />

Socket Game Base Roomは、Socket.IOを使用したリアルタイム多人数参加型ゲームを構築するためのベースプログラムです。 <br />
マスター/クライアント型のアーキテクチャを採用し、1人のプレイヤー（マスター）がゲームルームを作成し、他のプレイヤーが6桁のゲームコード（英大文字＋数字）を使って参加する仕組みになっています。

同じゲームに接続したあとは、`sendMessage()`関数でプレイヤー全員にメッセージを送信できます。Socket.IOのroom機能を利用しています。<br />
また、`sendDirectMessage()`関数で特定のプレイヤーにダイレクトメッセージも送信可能です。<br />
開発者はユーザー名とSocket IDでプレイヤーを管理し、柔軟な通信ゲーム開発ができます。

### 解説ブログ

https://bakuretuken.com/socket_game_base/

### ライブデモ (Live Demo)

公開プログラムがそのまま動いています

https://socketgamecode.fly.dev/

## 特徴

- **リアルタイム通信**: Socket.IOによる双方向通信
- **ルーム型システム**: 6桁ゲームコード（英大文字＋数字、重複チェック機能付き）によるルーム管理
- **コード付きURL**: `http://localhost:8000/PRJWSG` のようにコードを付けたURLで参加フォームにコードを自動入力
- **ワンクリックコピー**: マスター画面のゲームコードパネルをクリックでクリップボードにコピー
- **自動クリーンアップ**: 指定秒後の自動ルーム削除
- **参加締め切り**: ゲーム開始時にコードを削除し、以降の新規参加を締め切り
- **プレイヤー管理**: 指定人数プレイヤー制限（Socket ID付きプレイヤー管理）・同名ユーザーの参加拒否
- **ダイレクトメッセージ**: 特定プレイヤーへの個別メッセージ送信
- **ユーザー名の保存**: 入力したユーザー名を localStorage に保存し次回自動入力
- **切断・離脱対応**: ネットワーク切断検知とページ離脱時の警告
- **デバッグUI**: ゲーム開始後に受信ログ・送信テスト用のデバッグエリアを表示
- **簡単セットアップ**: Makefileによる開発環境構築

## 必要環境

- Node.js (v16以上推奨)
- npm
- TypeScript

## インストール・セットアップ

```bash
# 依存関係をインストール
make init

# ビルド（distディレクトリ作成）
make build
```

## 開発

### 開発サーバー起動

```bash
# TypeScript開発サーバー（ホットリロード）
make dev
```

ウォッチモード

```bash
# ファイル変更監視でコンパイル
make watch
```

### ビルド・本番実行

```bash
# TypeScriptビルド
make build
# または
npm run build

# 本番サーバー起動
make up
# または
npm start
```

## ゲーム作成・参加手順

### 1. ゲーム作成（マスター）
   - `http://localhost:8000` にアクセス
   - ユーザー名（最大8文字）を入力
   - 「ゲーム作成」をクリック
   - 6桁のゲームコードが表示される（パネルをクリックするとコードをコピー）

![](images/master01.jpg) ![](images/master02.jpg)

### 2. ゲーム参加（クライアント）
   - 同じURLにアクセス
   - 6桁ゲームコードとユーザー名を入力
   - 「ゲーム参加」をクリック
   - `http://localhost:8000/PRJWSG` のようにコード付きURLを開くと、ゲームコードが自動入力される

![](images/player01.jpg) ![](images/player02.jpg)

### 3. 参加者確認（マスター）
 - 待機ルームに接続されたプレイヤーが表示

![](images/master03.jpg)

### 4. ゲーム開始

- 「ゲーム開始」ボタンを押すと、ゲームが開始されます。

![](images/master04.jpg)

 - 「players」ボタンを押すと、playersオブジェクトがコンソールに表示（マスターのみ）

![](images/master05.jpg)


## ゲーム開発方法

ゲーム固有のロジックを以下のファイルで実装：

- `views/game_master.ts` - マスター用ゲームロジック
- `views/game_player.ts` - クライアント用ゲームロジック

両ファイルで `window.receiveMessage(arr: RecvMessage)` 関数を実装してください。<br />
初期実装として、「ゲーム開始」ボタン押下で送信される `START_GAME` アクションの受信処理（待機ルームを隠してゲーム画面・デバッグエリアを表示。マスター側は `delete_code` でコードを削除）が含まれています。

## アーキテクチャ

### サーバーサイド構成

**メインコンポーネント（server.ts）**:
- Express.js Webサーバー（ポート8000）
- Socket.IOリアルタイム通信
- EJSテンプレートエンジン
- ルーム自動クリーンアップシステム

**HTTPエンドポイント**:
- `GET /` - ランディングページ（index.html）
- `GET /:gameCode` - 6桁コード付きURL。ランディングページを表示し、参加フォームにコードを自動入力（形式不正は404）
- `POST /new` - ゲーム作成、マスター用ページ（game.ejs）をレンダリング
- `POST /join` - ゲーム参加、クライアント用ページ（game.ejs）をレンダリング

**Socket.IOイベント（サーバー受信 → 送信）**:
- `make` - 6桁ゲームコード生成・ルーム作成 → 送信元に `make` を返信
- `join` - ゲームコードでルーム参加 → ルーム全員に `join` を通知（マスターのSocket IDを含む）
- `delete_code` - ゲームコード削除（マスターのみ実行可、ゲーム開始時に呼び出して新規参加を締め切る）
- `send` - ルーム内全員にメッセージ送信 → ルーム全員に `recv` を通知
- `send_direct` - 特定ソケットへのダイレクトメッセージ → 対象に `recv` を通知
- `recv` - メッセージ受信（クライアント側で受信）

### クライアントサイド構成

**共通ロジック（game_base.ts）**:
- Socket.IO接続・切断処理（切断時のネットワークエラー表示）
- プレイヤー管理（同名ユーザー拒否・人数上限チェック）
- メッセージ送受信ヘルパー関数（`sendMessage` / `sendDirectMessage`）
- 待機室UI更新・ゲームコードパネルのコピー処理
- 受信ログ出力（`debugLog`）・ページ離脱警告

参加拒否通知（`JOIN_REJECTED`）とネットワーク切断は game_base.ts 側で処理され、各ゲームの `receiveMessage` には渡されません。

**ゲーム固有ロジック**:
- `game_master.ts` - マスター用実装
- `game_player.ts` - クライアント用実装

### ディレクトリ構造

```
socket_game_base_room/
├── server.ts                 # メインサーバー（Express + Socket.IO）
├── game.ejs                  # ゲームページテンプレート
├── package.json             # 依存関係・スクリプト定義
├── tsconfig.json            # TypeScript設定
├── Makefile                 # 開発用コマンド
├── nodemon.json             # 開発サーバー設定
├── views/
│   ├── index.html           # ランディングページ
│   ├── style.css            # 画面スタイル
│   ├── game_base.ts         # 共通Socket.IOロジック
│   ├── game_master.ts       # マスター用ゲームロジック
│   └── game_player.ts       # クライアント用ゲームロジック
├── types/
│   └── socket-types.ts      # Socket.IO型定義
└── dist/                    # TypeScriptビルド出力
```

## API仕様

### Socket.IO型定義

```typescript
// ゲームコード生成レスポンス
interface MakeResponse {
    status: boolean;
    gameCode: string;
    socketId: string;
}

// ルーム参加レスポンス
interface JoinResponse {
    status: boolean;
    userName: string;
    socketId: string;
    masterId: string; // ルーム作成者（マスター）のSocket ID
}

// メッセージ送受信
interface RecvMessage {
    status: boolean;
    socketId: string;
    action?: string;
    [key: string]: any; // 任意のデータ
}

// ブラウザ用のWindowインターフェース拡張
interface Window {
    receiveMessage: (arr: RecvMessage) => void;
}
```

### ヘルパー関数

```typescript
// ルーム内全員へのメッセージ送信（gameCode は自動付与、送信者にも届く）
function sendMessage(params: { [key: string]: any }): void

// 特定のユーザーへのダイレクトメッセージ送信
function sendDirectMessage(socketId: string, params: { [key: string]: any }): void

// 受信ログをデバッグエリアに出力
function debugLog(label: string, data?: any): void

// メッセージ受信処理（要実装）
window.receiveMessage = function(arr: RecvMessage): void {
    // ゲーム固有のロジックを実装
    if (arr.action === 'your_action') {
        // 処理を実装
    }
}
```

## 設定・制限事項

### 環境変数
- `PORT` - サーバーポート（デフォルト: 8000）

### システム制限（変更可能）
- **ゲームコード**: 6桁（英大文字＋数字）、生成時に重複チェック
- **ゲームコード保持期間**: 300秒（5分）
- **クリーンアップ間隔**: 120秒（2分）
- **最大プレイヤー数**: 8名
- **ユーザー名最大長**: 8文字
- **データ永続化**: なし（メモリ上のみ）

## 開発ワークフロー

1. `make dev` で開発サーバー起動。`make watch`でウォッチモードON
2. TypeScriptファイル編集（自動再コンパイル）
3. ブラウザでテスト（http://localhost:8000）
4. `make build` で本番用ビルド。その際はindex.html等の配置は必要

## ライセンス

MIT
