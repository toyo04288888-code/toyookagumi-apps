// ============================================================
//  Cloudflare Workers エントリ
//  ・/calendar-feed だけ動的に処理（特自・車検のカレンダー配信）
//  ・それ以外は これまで通り 静的アセット（*.html 等）を配信
// ============================================================
import { onRequestGet } from "./functions/calendar-feed.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/calendar-feed") {
      return onRequestGet({ request, env });
    }
    // 静的アセット（index.html / tokuji-shaken.html など）へフォールバック
    return env.ASSETS.fetch(request);
  },
};
