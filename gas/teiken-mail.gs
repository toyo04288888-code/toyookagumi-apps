// ============================================================
//  定検ナビ  期限お知らせメール（Google Apps Script）
//
//  毎朝1回 定検ナビのデータを確認し、次のタイミングでメールを送ります。
//   ・車検 …………… 満了日の3か月前 ／ 当日
//   ・特定自主検査 … 期限の1か月前 ／ 当日
//   ・測定機器の校正 … 有効期限の1か月前 ／ 当日
//  同じお知らせは1回だけ送ります（朝の実行が抜けた日があっても、翌日に送ります）。
//
//  ▼ 使い方
//   1. 下の MAIL_TO に送り先アドレスを入れる（複数はカンマ区切り）
//   2. 上のメニューで関数「setup」を選んで ▶実行 → 許可する
//   3. 関数「testMail」を実行すると、今の状況がテストメールで届きます
// ============================================================

const MAIL_TO = "ここに送り先のメールアドレス";   // 例: "tanaka@example.co.jp, suzuki@example.co.jp"
const SEND_HOUR = 7;                               // 毎朝この時刻（7時台）に確認

const SB_URL = "https://cfvppxqwdtwwucnaurtb.supabase.co";
const SB_KEY = "sb_publishable_Ib5hD2wXpa7iuQkSvpyExQ_owiHvngd";
const APP_URL = "https://toyookagumi-apps.toyo-04288888.workers.dev/tokuji-shaken";
const AFTER_DAYS = 7;   // 当日のお知らせを、実行漏れに備えて何日後まで送るか

// ---------- 初回だけ実行：毎朝の自動実行を登録 ----------
function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("dailyCheck").timeBased().everyDays(1).atHour(SEND_HOUR).inTimezone("Asia/Tokyo").create();
  Logger.log("毎朝 " + SEND_HOUR + " 時台の自動確認を登録しました。");
}

// ---------- テスト：今の期限状況をメールで送る（送信済みの記録は変えない） ----------
function testMail() {
  const items = listItems();
  const t = today();
  const near = items.filter(i => daysBetween(t, i.due) <= 90).sort((a, b) => a.due - b.due);
  const body = ["【テスト送信】定検ナビのお知らせメールの設定ができています。", "",
    near.length ? "参考：90日以内に期限が来るもの（期限切れを含む）" : "90日以内に期限が来るものはありません。",
    ...near.map(line), "", "アプリ：" + APP_URL].join("\n");
  MailApp.sendEmail(MAIL_TO, "【定検ナビ】テスト送信", body);
  Logger.log("テストメールを送りました：" + MAIL_TO);
}

// ---------- 毎朝の本処理 ----------
function dailyCheck() {
  const props = PropertiesService.getScriptProperties();
  const sent = JSON.parse(props.getProperty("sent") || "{}");
  const t = today();
  const lead = [], due = [];

  listItems().forEach(i => {
    const remind = addMonths(i.due, -i.leadMonths);
    const kR = i.key + "-r", kD = i.key + "-d";
    if (t >= remind && t < i.due && !sent[kR]) { lead.push(i); sent[kR] = ymd(t); }
    if (t >= i.due && daysBetween(i.due, t) <= AFTER_DAYS && !sent[kD]) { due.push(i); sent[kD] = ymd(t); }
  });

  if (lead.length || due.length) {
    const body = [];
    if (due.length) body.push("■ 本日が期限（または期限を過ぎました）", ...due.map(line), "");
    if (lead.length) body.push("■ 期限が近づいています", ...lead.map(line), "");
    body.push("アプリで確認・記録：" + APP_URL);
    MailApp.sendEmail(MAIL_TO, `【定検ナビ】期限のお知らせ（${lead.length + due.length}件）`, body.join("\n"));
  }

  // 1年以上前の送信記録は掃除
  const limit = ymd(addMonths(t, -12));
  Object.keys(sent).forEach(k => { if (sent[k] < limit) delete sent[k]; });
  props.setProperty("sent", JSON.stringify(sent));
}

// ---------- データ取得と期限の計算 ----------
function listItems() {
  const res = UrlFetchApp.fetch(SB_URL + "/rest/v1/kensa_vehicles?select=data", {
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, muteHttpExceptions: true,
  });
  const rows = JSON.parse(res.getContentText() || "[]");
  const out = [];
  (Array.isArray(rows) ? rows : []).forEach(r => {
    const v = r && r.data; if (!v) return;
    const name = (v.kind === "measure" ? (v.name || v.maker) : (v.maker || v.name)) || "（名称未登録）";
    const info = [v.kanri, v.bangou].filter(Boolean).join(" / ");
    const push = (label, dueDate, leadMonths, ym) => {
      if (!dueDate) return;
      out.push({ key: `${v.id}-${label}-${ymd(dueDate)}`, name, info, label, due: dueDate, leadMonths, ym });
    };
    if (v.tokTarget && v.tokLast) push("特定自主検査", addMonths(parseD(v.tokLast), v.tokInt || 12), 1, false);
    if (v.shkTarget && v.shkExp) push("車検満了", parseD(v.shkExp), 3, false);
    if (v.calTarget && v.calLast) push("校正", addMonths(parseD(v.calLast), v.calInt || 12), 1, true);
  });
  return out;
}

function line(i) {
  const d = daysBetween(today(), i.due);
  const left = d < 0 ? `${-d}日超過` : d === 0 ? "本日" : `あと${d}日`;
  const dt = i.ym ? `${i.due.getFullYear()}年${i.due.getMonth() + 1}月` : `${i.due.getFullYear()}年${i.due.getMonth() + 1}月${i.due.getDate()}日`;
  return `・${i.label}：${i.name}${i.info ? "（" + i.info + "）" : ""}　期限 ${dt}（${left}）`;
}

// ---------- 日付の小道具 ----------
function today() {
  const s = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
  return parseD(s);
}
function parseD(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d || 1); }
function addMonths(dt, m) { const x = new Date(dt); const day = x.getDate(); x.setMonth(x.getMonth() + m); if (x.getDate() < day) x.setDate(0); return x; }
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
function ymd(d) { return Utilities.formatDate(d, "Asia/Tokyo", "yyyy-MM-dd"); }
