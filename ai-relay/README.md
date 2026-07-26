# からだログ「AI推定」用 中継ワーカーの設定手順

からだログの「✦ AI推定」を使えるようにするための、APIキー中継ワーカーです。
ブラウザから直接AnthropicのAPIを叩くとキーが丸見えになるため、キーを預かって
中継するこのワーカーを1個用意します。

## 前提

- **Anthropic の API キー**が必要です（`sk-ant-...` で始まる文字列）。
  - 取得先: https://console.anthropic.com/ → API Keys
  - 従量課金（使った分だけ請求）。1回のAI推定はごく少額ですが、支払い設定が必要です。
- 上記はコード担当（Claude）では代行できません。キーの入力・課金設定はオーナーが行ってください。

## 設定手順（Cloudflareダッシュボード）

1. https://dash.cloudflare.com/ にログイン
2. 左メニュー **Workers & Pages** → **Create application** → **Create Worker**
3. 名前を入力（例: `toyooka-ai-relay`）→ **Deploy**
4. **Edit code** を開き、既定のコードを全部消して、`worker.js` の中身を貼り付け → **Deploy**
5. そのワーカーの **Settings（設定）→ Variables and Secrets（変数とシークレット）**
   - **Add** → Type を **Secret** にする
   - Name: `ANTHROPIC_API_KEY`
   - Value: 自分のAPIキー（`sk-ant-...`）
   - **Deploy** で保存
6. ワーカーのURL（例 `https://toyooka-ai-relay.<アカウント名>.workers.dev`）をコピー

## アプリ側の設定

からだログを開く → **設定 → AI推定の接続先 → APIエンドポイント URL** に、
上でコピーしたワーカーのURLを貼り付けて「設定を保存」。

これで食事タブの「✦ AI推定」が使えます（端末ごとに1回だけ入力が必要）。

## 補足

- `worker.js` の `ALLOWED_ORIGINS` で、からだログが動く場所以外からの利用を弾いています
  （APIキーの勝手な使用＝勝手な課金を防ぐため）。
- モデルはアプリの設定で変更できます（既定: `claude-sonnet-4-6`）。
- 使いすぎ防止に `MAX_TOKENS_CAP`（1回あたりの上限）を設けてあります。
