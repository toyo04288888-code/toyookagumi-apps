// からだログ「AI推定」用の中継ワーカー
// -----------------------------------------------------------------------------
// 役割：ブラウザ（からだログアプリ）からのリクエストを受け取り、Anthropic の
//       APIキーを付け足して本家APIへ転送する。APIキーはこのワーカーの
//       「環境変数（シークレット）」に保存し、ブラウザには一切出さない。
//
// 使い方（Cloudflareダッシュボードで）：
//   1. このファイルの中身を丸ごと貼り付けて新規ワーカーを作成
//   2. 変数とシークレット に  ANTHROPIC_API_KEY = sk-ant-...  を追加（シークレット）
//   3. デプロイ → できたURL（https://xxxx.workers.dev）を
//      からだログアプリの「設定 → AI推定の接続先 → APIエンドポイント URL」に入力
// -----------------------------------------------------------------------------

// 悪用防止：からだログアプリが動いている場所だけ許可する。
// 別のサイトから勝手にAPIキーを使われる（＝勝手に課金される）のを防ぐ。
const ALLOWED_ORIGINS = [
  "https://toyookagumi-apps.toyo-04288888.workers.dev",
  "null", // スマホにインストールしたPWA / ローカルの file:// 用
];

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS_CAP = 800; // 1回あたりの上限（コスト暴走を防ぐ）

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    const cors = {
      "Access-Control-Allow-Origin": allow,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    // ブラウザの事前確認（プリフライト）
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "POSTのみ対応しています" }, 405, cors);
    }
    // 許可されていない場所からのアクセスは拒否
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: "許可されていない接続元です" }, 403, cors);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "サーバーにAPIキーが設定されていません" }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "リクエストの形式が不正です" }, 400, cors);
    }

    // アプリから来た内容のうち、必要な項目だけを転送する
    const payload = {
      model: typeof body.model === "string" && body.model ? body.model : "claude-sonnet-4-6",
      max_tokens: Math.min(Number(body.max_tokens) || 400, MAX_TOKENS_CAP),
      messages: Array.isArray(body.messages) ? body.messages : [],
    };

    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      return new Response(text, {
        status: res.status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (err) {
      return json({ error: "本家APIへの転送に失敗しました: " + err.message }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
