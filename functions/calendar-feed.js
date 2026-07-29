// ============================================================
//  特自・車検管理  カレンダー自動配信（Cloudflare Pages Function）
//
//  置き場所： リポジトリ内の  functions/calendar-feed.js
//  配信URL ： https://<公開ドメイン>/calendar-feed
//
//  下の SB_KEY に anon public キーを貼るか、Cloudflare Pages の
//  「環境変数」に SUPABASE_ANON_KEY を設定してください。
// ============================================================

const SB_URL_DEFAULT = "https://cfvppxqwdtwwucnaurtb.supabase.co";
const SB_KEY = "sb_publishable_Ib5hD2wXpa7iuQkSvpyExQ_owiHvngd";

export async function onRequestGet(context) {
  const url = context.env.SUPABASE_URL || SB_URL_DEFAULT;
  const key = context.env.SUPABASE_ANON_KEY || SB_KEY;

  let vehicles = [];
  try {
    const res = await fetch(`${url}/rest/v1/kensa_vehicles?select=data`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const rows = await res.json();
    if (Array.isArray(rows)) vehicles = rows.map((r) => r.data).filter(Boolean);
  } catch (e) {}

  const ics = buildICS(vehicles);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="tokuji-shaken.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function pad(n) { return String(n).padStart(2, "0"); }
function ymd(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }
function parseD(s) { if (!s) return null; const [y, m, da] = s.split("-").map(Number); return new Date(y, m - 1, da); }
function fmtJ(d) { return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; }
function addMonths(d, m) { const x = new Date(d); const day = x.getDate(); x.setMonth(x.getMonth() + m); if (x.getDate() < day) x.setDate(0); return x; }
function esc(s) { return String(s == null ? "" : s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); }
function stamp() { const d = new Date(); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; }

function ev(L, uid, start, summary, desc) {
  const end = new Date(start); end.setDate(end.getDate() + 1);
  L.push(
    "BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp(),
    "DTSTART;VALUE=DATE:" + ymd(start), "DTEND;VALUE=DATE:" + ymd(end),
    "SUMMARY:" + esc(summary), "DESCRIPTION:" + esc(desc), "TRANSP:TRANSPARENT",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc(summary), "TRIGGER:PT9H", "END:VALARM",
    "END:VEVENT"
  );
}

function buildICS(vehicles) {
  const L = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Toyooka-gumi//Kensa//JA",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:特自・車検管理", "X-WR-TIMEZONE:Asia/Tokyo",
  ];
  for (const v of vehicles) {
    if (!v) continue;
    const items = [];
    if (v.tokTarget && v.tokLast) items.push(["特定自主検査", addMonths(parseD(v.tokLast), v.tokInt || 12)]);
    if (v.shkTarget && v.shkExp) items.push(["車検満了", parseD(v.shkExp)]);
    for (const [label, dt] of items) {
      if (!dt) continue;
      const lead = label.includes("車検") ? 3 : 1;
      const nm = v.name || v.maker || "";
      const info = `${v.maker || ""}${v.kanri ? " / " + v.kanri : ""}${v.bangou ? " / " + v.bangou : ""}`;
      ev(L, `${v.id}-${label}-r-${ymd(dt)}@toyooka`, addMonths(dt, -lead),
        `🔔【${lead}か月前】${label}：${nm}`, `${label}の期限は ${fmtJ(dt)} です。（${info}）`);
      ev(L, `${v.id}-${label}-d-${ymd(dt)}@toyooka`, dt,
        `⚠️【${label}期限】${nm}`, `本日が ${label} の期限です。（${info}）`);
    }
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}
