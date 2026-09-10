// خدمة الكاش للتطبيق (PWA) — تسمح بفتح التطبيق حتى مع ضعف الشبكة
const CACHE = 'azoom-shell-v2';
const SHELL = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png", "/css/app.css", "/js/00-core-prelude.js", "/js/01-i18n-core.js", "/js/02-i18n-extra.js", "/js/03-state-api.js", "/js/04-auth-projects.js", "/js/05-computed.js", "/js/06-render-shared.js", "/js/07-projects-tab.js", "/js/08-users.js", "/js/09-dashboard.js", "/js/10-action-plan.js", "/js/11-boq-items.js", "/js/12-consultant-approval.js", "/js/13-item-modal.js", "/js/14-item-split.js", "/js/15-mustakhlas-builder.js", "/js/16-mustakhlas-history.js", "/js/17-mustakhlas-document.js", "/js/18-documents.js", "/js/19-csv-export.js", "/js/20-blockers.js", "/js/21-villas.js", "/js/22-productivity.js", "/js/23-edit-requests.js", "/js/24-subcontractors.js", "/js/25-pricedb.js", "/js/26-boq-import.js", "/js/27-settings.js", "/js/28-boot.js", "/js/29-i18n-static.js"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;                 // الحفظ والرفع دائماً عبر الشبكة
  if (url.pathname.startsWith('/api/')) return;           // بيانات حية دائماً
  // الشبكة أولاً (لالتقاط التحديثات) مع الرجوع للكاش عند الانقطاع
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && (SHELL.includes(url.pathname) || url.pathname.startsWith('/uploads/'))) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    }).catch(() =>
      caches.match(e.request).then(m => m || (url.pathname.startsWith('/uploads/')
        ? new Response('', { status: 404 })
        : caches.match('/')))
    )
  );
});
