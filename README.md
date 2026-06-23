# 空き家候補情報収集アプリ

一般社団法人北九州未来づくりラボが、地域巡回中に確認された「空き家と思われる建物」の一次情報を収集するための、モバイルファーストWebアプリです。

このアプリは空き家を確定・公開するものではありません。報告者がスマートフォンから写真、GPS、住所、建物状況、危険度などを入力し、Google Apps Script（GAS）経由でGoogle SpreadsheetとGoogle Driveへ保存する構成を想定しています。

## ファイル構成

```text
/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ app.js
│  ├─ api.js
│  ├─ camera.js
│  └─ config.example.js
├─ assets/
│  └─ README.md
├─ README.md
└─ .gitignore
```

外部フレームワーク、依存パッケージ、ビルド処理は使用していません。

## 主な機能

- 報告者情報の入力と「その他」団体名の条件表示
- Geolocation APIによる高精度GPS取得
- GPS精度の3段階評価とGoogleマップ確認リンク
- GASまたはモックAPIによる住所逆引き
- 住所の手動補正と補正有無の記録
- 写真1〜3枚の選択、プレビュー、削除
- Canvasによる長辺1600px・JPEG品質0.75の画像縮小
- 建物状況の複数選択と「その他」の条件表示
- 危険度「高」選択時の注意表示
- 自由記入欄の入力済み・残り文字数表示
- 必須項目の検証、項目別エラー、自動スクロール
- 送信前の確認ダイアログ
- 二重送信防止、送信状態、受付番号の表示
- キーボード操作、フォーカス表示、`aria-live`への配慮

## ローカルで確認する

位置情報やカメラ機能は、セキュアコンテキスト（HTTPSまたは`localhost`）で確認してください。ファイルを直接開くのではなく、このディレクトリで簡易Webサーバーを起動します。

Python 3がある場合：

```sh
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開きます。初期設定はモックAPIのため、GASがなくても住所取得と送信完了まで確認できます。

## 設定ファイル

初期状態では`index.html`が`js/config.example.js`を読み込みます。

本番用には次の手順で設定します。

1. `js/config.example.js`を`js/config.js`へコピーする
2. `js/config.js`を編集する
3. `index.html`末尾の読み込み元を`js/config.example.js`から`js/config.js`へ変更する

```javascript
window.APP_CONFIG = {
  GAS_WEB_APP_URL: 'https://script.google.com/macros/s/デプロイID/exec',
  USE_MOCK_API: false,
  APP_VERSION: '0.1.0'
};
```

`js/config.js`は`.gitignore`に登録済みです。ただしGitHub Pagesで利用する設定ファイルは、最終的にはブラウザから閲覧できます。GAS URLだけに依存した認証は行わず、必要に応じて利用コードや認証機構をGAS側へ追加してください。

## モックAPIと本番API

- `USE_MOCK_API: true`：開発用の仮住所と受付番号を返す
- `USE_MOCK_API: false`：`GAS_WEB_APP_URL`へ実際に送信する

本番切替前に、GASのデプロイURL、実行ユーザー、アクセス権限、CORS・リダイレクト動作を実端末で確認してください。

## GAS側APIの想定

通信処理は`js/api.js`に分離しています。`application/x-www-form-urlencoded`形式で、`payload`パラメーターにJSON文字列を格納してPOSTします。

GAS側の基本的な受信例：

```javascript
function doPost(e) {
  const payload = JSON.parse(e.parameter.payload);

  if (payload.action === 'reverseGeocode') {
    return jsonResponse(reverseGeocode(payload));
  }

  if (payload.action === 'submitReport') {
    return jsonResponse(saveReport(payload));
  }

  return jsonResponse({ success: false, message: '不明な操作です' });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 住所取得

送信：

```json
{
  "action": "reverseGeocode",
  "latitude": 33.0,
  "longitude": 130.0
}
```

成功応答：

```json
{
  "success": true,
  "address": "福岡県北九州市八幡西区...",
  "prefecture": "福岡県",
  "city": "北九州市",
  "ward": "八幡西区",
  "areaClassification": "北九州市／八幡西区"
}
```

### 報告送信

`action: "submitReport"`と入力情報、同意状態、Base64化した写真配列を送信します。

成功応答：

```json
{
  "success": true,
  "recordId": "AKI-20260623-0001",
  "message": "報告を受け付けました"
}
```

失敗応答：

```json
{
  "success": false,
  "message": "登録に失敗しました"
}
```

GAS側では、写真枚数・画像形式・デコード後サイズ・全入力値を再検証してください。受付番号は同時実行でも重複しない方法で採番してください。

## GitHub Pagesで公開する

1. この一式をGitHubリポジトリへ登録する
2. リポジトリの **Settings > Pages** を開く
3. **Build and deployment** のSourceを **Deploy from a branch** にする
4. 公開ブランチと`/(root)`を選択して保存する
5. 表示されたHTTPS URLへスマートフォンでアクセスする
6. 位置情報・カメラ・GAS送信を実端末で確認する

公開前に本番設定を反映する方法を決めてください。公開リポジトリへ含めた値は秘密にできません。

## セキュリティとプライバシー

- GitHub Pages側へ秘密鍵やAPIキーを保存しない
- クライアント側検証だけを信用せず、GAS側でも入力を再検証する
- GAS側で文字数、列挙値、写真枚数、MIMEタイプ、サイズを制限する
- 画面への再表示は`textContent`を使用し、入力値をHTMLとして解釈しない
- 写真や正確な位置情報をGitHubリポジトリへ保存しない
- SpreadsheetとGoogle Driveを一般公開しない
- 空き家候補情報を一般公開地図として表示しない
- 個人情報や居住支援対象者情報をこの画面で扱わない
- 報告者が他の投稿を閲覧できる機能を設けない
- GAS URLの秘匿だけをアクセス制御として扱わない
- レート制限、不正投稿対策、監査ログ、保存期間をGAS側で設計する

## 制約

- HEIC/HEIFのデコード可否はブラウザに依存します。処理できない場合はJPEGでの撮影・選択を案内します。
- GPS精度は端末、屋内外、周辺環境に左右されます。
- Canvas変換時に画像のEXIF情報は原則引き継ぎません。
- 大きなBase64画像はGASのリクエスト・実行時間・保存容量の制約を受けます。実運用データで上限を検証してください。
- オフライン保存、PWA、ログイン、報告履歴、重複地点判定は未実装です。

## 手動テスト項目

- 幅320px、一般的なスマートフォン幅、PC幅で横スクロールが発生しない
- iOS Safari、Android Chromeで位置情報許可・拒否・タイムアウトを確認する
- GPS精度が30m、80mの境界で正しく評価される
- GPS再取得時に座標・住所・地図リンクが更新される
- 住所取得失敗後に手動入力できる
- 「その他」の団体名・建物状況欄が正しく表示・必須化される
- JPEG、PNG、端末で対応可能なHEICを選択できる
- 4枚以上選択した場合に3枚へ制限される
- 縮小後の寸法・容量・プレビュー・削除が正しい
- 写真0枚では確認へ進めない
- 各必須項目の近くにエラーが表示され、最初の不備へ移動する
- 危険度「高」で緊急連絡の注意が表示される
- 500文字の上限と文字数表示が一致する
- 同意が1項目でも欠けると確認へ進めない
- 確認画面に入力値が文字として安全に表示される
- 送信中にボタンが無効化され、連打しても二重送信されない
- モック送信後に受付番号と地図リンクが表示される
- 本番GASで成功・業務エラー・HTTPエラー・通信切断を確認する
- キーボードだけで全項目とダイアログを操作できる
- スクリーンリーダーでGPS取得・送信状態が通知される

## 今後の拡張候補

- ログイン・利用者認証、団体ごとの利用コード
- 報告履歴、AppSheet審査画面
- 重複地点の判定、地図上での位置補正
- オフライン一時保存、PWA化
- Google Chat通知、緊急度に応じた通知先振り分け
- 写真への自動ぼかし処理
