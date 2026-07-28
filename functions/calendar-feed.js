// Cloudflare Pages Function: /calendar-feed
// 特定自主検査・車検の期限を .ics カレンダーフィードとして配信する（購読用・自動更新）。
// toyooka-kensa-shared.html の「🔔 カレンダーを購読」ボタンが叩くエンドポイント。
// Supabase の kensa_vehicles テーブルを読み、HTML 側 buildICS() と同じ内容の ICS を返す。
//
// ※ 現在このプロジェクトは Cloudflare Workers（静的アセット配信のみ）構成のため、
//    functions/ は自動ルーティングされない。Pages への移行、または Workers への
//    ルーティング追加を行うと /calendar-feed として配信される。

const SB_URL = "https://cfvppxqwdtwwucnaurtb.supabase.co";
const SB_KEY = "sb_publishable_Ib5hD2wXpa7iuQkSvpyExQ_owiHvngd";

export async function onRequest(context) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/kensa_vehicles?select=id,data`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!res.ok) throw new Error("supabase " + res.status);
    const rows = await res.json();
    const vehicles = (rows || []).map((r) => r.data).filter(Boolean);
    const ics = buildICS(vehicles);
    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="toyooka-kensa.ics"',
        "Cache-Control": "public, max-age=1800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response("ICS feed error: " + ((e && e.message) || e), {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/* ---------- Date helpers（UTC基準で全日イベントのズレを防ぐ） ---------- */
function p(n) {
  return String(n).padStart(2, "0");
}
function parseYmd(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}
function addMonths(dt, m) {
  const d = new Date(dt);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + m);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}
function fmt(dt) {
  if (!dt) return "—";
  return `${dt.getUTCFullYear()}.${p(dt.getUTCMonth() + 1)}.${p(dt.getUTCDate())}`;
}
function tokuteiNext(v) {
  if (!v.tokTarget || !v.tokLast) return null;
  return addMonths(parseYmd(v.tokLast), v.tokInt || 12);
}
function shakenNext(v) {
  if (!v.shkTarget || !v.shkExp) return null;
  return parseYmd(v.shkExp);
}

/* ---------- ICS 生成（HTML の buildICS と同一ロジック） ---------- */
function icsDate(dt) {
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}`;
}
function icsStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}
function icsEsc(s) {
  return String(s == null ? "" : s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}
function pushEv(L, stamp, uid, start, summary, desc) {
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  L.push(
    "BEGIN:VEVENT",
    "UID:" + uid,
    "DTSTAMP:" + stamp,
    "DTSTART;VALUE=DATE:" + icsDate(start),
    "DTEND;VALUE=DATE:" + icsDate(end),
    "SUMMARY:" + icsEsc(summary),
    "DESCRIPTION:" + icsEsc(desc),
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + icsEsc(summary),
    "TRIGGER:PT9H",
    "END:VALARM",
    "END:VEVENT"
  );
}
function buildICS(vehicles) {
  const L = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Toyooka-gumi//Kensa//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:特自・車検 期限",
    "X-WR-TIMEZONE:Asia/Tokyo",
  ];
  const stamp = icsStamp();
  (vehicles || []).forEach((v) => {
    const items = [];
    if (v.tokTarget && tokuteiNext(v)) items.push(["特定自主検査", tokuteiNext(v)]);
    if (v.shkTarget && shakenNext(v)) items.push(["車検満了", shakenNext(v)]);
    items.forEach(([label, dt]) => {
      const info = `${v.type}${v.kanri ? " / " + v.kanri : ""}${v.bangou ? " / " + v.bangou : ""}`;
      pushEv(
        L,
        stamp,
        `${v.id}-${label}-r-${icsDate(dt)}@toyooka`,
        addMonths(dt, -1),
        `🔔【1か月前】${label}：${v.name}`,
        `${label}の期限は ${fmt(dt)} です。（${info}）`
      );
      pushEv(
        L,
        stamp,
        `${v.id}-${label}-d-${icsDate(dt)}@toyooka`,
        dt,
        `⚠️【${label}期限】${v.name}`,
        `本日が ${label} の期限です。（${info}）`
      );
    });
  });
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}
