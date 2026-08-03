// KY日報アプリ用サービスワーカー
// 目的: PWAとして「アプリにインストール」できるようにする＋アプリ本体をオフラインでも起動可能にする
// （データはSupabase＝通信が必要。ここでキャッシュするのは画面本体だけ）
const CACHE = "anzenky-shell-v1";
const SHELL = "/anzen-ky";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// アプリ本体はネットワーク優先・失敗時はキャッシュ（オフライン起動用）
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.mode === "navigate" && (url.pathname === SHELL || url.pathname === SHELL + ".html")) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match(SHELL))
    );
  }
});
