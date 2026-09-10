'use strict';
// ============================================================
//  BOOT
// ============================================================
async function boot(){
  if (!API.token) { showLogin(); return; }
  try {
    await refreshState();
    hideLogin();
  } catch(e) {
    if (e.status === 401) {
      localStorage.removeItem('azoom_token');
      API.token = '';
      showLogin();
    } else if (loadOfflineCache()) {
      hideLogin();
    } else {
      $('app-loading').textContent = '⚠️ ' + T('تعذر الاتصال بالخادم:') + ' ' + e.message + ' — ' + T('أعد تحميل الصفحة');
    }
  }
}
Object.assign(I18N_EN, {
  'تعذر الاتصال بالخادم:':'Could not connect to the server:',
  'أعد تحميل الصفحة':'reload the page'
});
