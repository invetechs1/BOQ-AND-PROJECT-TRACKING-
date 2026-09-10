'use strict';
// ============================================================
//  MULTI-PROJECT + USERS (المصادقة من الخادم)
// ============================================================
const DUMMY_PROJECT = {id:0, managerUserId:null, seq:1000,
  info:{name:'لا يوجد مشروع', client:'', consultant:'', contractor:'', totalVillas:0, vatRate:15, retentionRate:0, advanceRate:0, projectType:'other', unitLabel:'وحدة', unitsTitle:'الوحدات'},
  boqItems:[], villas:[], villaProgress:{}, mustakhlasat:[], workLogs:[], blockerLog:[]};
Object.assign(I18N_EN, {
  'نظام إدارة المستخلصات والإنتاجية':'Claims & Productivity Management System',
  '⏳ جاري تحميل النظام...':'⏳ Loading system...',
  'سجّل دخولك للمتابعة':'Sign in to continue',
  'اسم المستخدم':'Username',
  'كلمة المرور':'Password',
  '🔓 دخول':'🔓 Login',
  '📴 وضع بدون اتصال — عرض آخر بيانات محفوظة (للقراءة فقط) ·':'📴 Offline mode — showing last saved data (read-only) ·',
  'إعادة المحاولة':'Retry',
  '🚪 خروج':'🚪 Logout',
  '⬤ حفظ تلقائي':'⬤ Auto-save',
  '؟ دليل الاستخدام':'؟ User guide',
  '⚙ إعدادات':'⚙ Settings',
  '⬇ نسخة احتياطية':'⬇ Backup',
  '⬆ استيراد':'⬆ Import',
  '🗂 المشاريع':'🗂 Projects',
  '📊 لوحة التحكم':'📊 Dashboard',
  '🧭 خطة العمل':'🧭 Action Plan',
  '📋 جدول الكميات':'📋 BOQ',
  '💰 المستخلصات':'💰 Claims',
  '🚫 العوائق':'🚫 Blockers',
  '👷 الإنتاجية':'👷 Productivity',
  'لا يوجد مشروع':'No project',
  'وحدة':'Unit',
  'الوحدات':'Units',
  'فيلا':'Villa',
  'الفلل':'Villas'
});

function currentUser(){
  return state.users.find(u => u.id === state.me.id) || state.me;
}
// الأدوار: admin أدمن النظام · client العميل (كامل صلاحيات شركته) · pmo مدير المشاريع (كل مشاريع شركته) · pm مدير مشروع (مشروعه فقط)
const isAdmin = () => state.me.role === 'admin';
const isManagerial = () => ['admin','client'].includes(state.me.role); // من يدير المشاريع والمستخدمين
const isOwner = isManagerial; // (توافقية مع الكود القديم)
// رقابة تعديل الإنتاجية: مدير المشروع (pm) تعديلاته/حذفه للإنتاجية والكميات المنفذة تحتاج موافقة العميل ومدير المشاريع معاً
const editsGated = () => state.me.role === 'pm';
const canApproveEdits = () => ['admin','client'].includes(state.me.role); // موافقة مالك الشركة (أو أدمن النظام) فقط
const accessibleProjects = () => state.projects; // الخادم يعيد المشاريع المصرح بها فقط
const userName = id => { const u = state.users.find(x => x.id === id); return u ? u.name : null; };
const companyName = id => { const c = (state.companies||[]).find(x => x.id === id); return c ? c.name : null; };

function proj(){
  let p = state ? state.projects.find(x => x.id === state.currentProjectId) : null;
  if (!p && state && state.projects.length) {
    p = state.projects[0];
    state.currentProjectId = p.id;
  }
  return p || DUMMY_PROJECT;
}

// مسمى الوحدة حسب نوع المشروع (فيلا / مبنى / قطاع طريق ...)
const UL = () => T(proj().info.unitLabel || 'وحدة');
const ULS = () => T(proj().info.unitsTitle || 'الوحدات');
const PROJECT_TYPES = {
  residential: {label:'فلل / وحدات سكنية', unit:'فيلا', units:'الفلل'},
  buildings:   {label:'مباني', unit:'مبنى', units:'المباني'},
  infra:       {label:'بنية تحتية', unit:'قطاع', units:'القطاعات'},
  roads:       {label:'طرق', unit:'قطاع (كم)', units:'القطاعات'},
  other:       {label:'أخرى', unit:'وحدة', units:'الوحدات'}
};

// معرّف تسلسلي داخل المشروع الحالي (لليوميات والمستخلصات والدفعات...)
function nextSeq(){
  const p = proj();
  p.seq = (p.seq || 1000) + 1;
  return p.seq;
}

function switchProject(id){
  state.currentProjectId = Number(id);
  localStorage.setItem('azoom_proj', String(state.currentProjectId));
  mbSel = {};
  closeVillaDetail();
  renderAll();
}

// ---- الدخول والخروج ----
function showLogin(){
  $('app-loading').style.display = 'none';
  $('login-overlay').style.display = 'flex';
}
function hideLogin(){
  $('login-overlay').style.display = 'none';
  $('app-loading').style.display = 'none';
}
async function doLogin(){
  $('login-err').textContent = '';
  try {
    const d = await API.req('POST', '/api/auth/login', {
      username: $('login-user').value.trim(),
      password: $('login-pass').value
    });
    API.token = d.token;
    localStorage.setItem('azoom_token', d.token);
    $('login-pass').value = '';
    await refreshState();
    hideLogin();
  } catch(e) {
    $('login-err').textContent = e.message;
  }
}
function logout(){
  if (!confirm(T('تسجيل الخروج؟'))) return;
  localStorage.removeItem('azoom_token');
  API.token = '';
  location.reload();
}
async function changeMyPassword(){
  const oldPassword = prompt(T('كلمة المرور الحالية:'));
  if (oldPassword === null) return;
  const newPassword = prompt(T('كلمة المرور الجديدة (4 أحرف على الأقل):'));
  if (newPassword === null) return;
  try {
    await API.req('PUT', '/api/me/password', {oldPassword, newPassword});
    alert(T('تم تغيير كلمة المرور ✅'));
  } catch(e) { alert(e.message); }
}
Object.assign(I18N_EN, {
  'تسجيل الخروج؟':'Log out?',
  'كلمة المرور الحالية:':'Current password:',
  'كلمة المرور الجديدة (4 أحرف على الأقل):':'New password (at least 4 characters):',
  'تم تغيير كلمة المرور ✅':'Password changed ✅'
});

// ترقية بيانات مشروع واحد (إضافة الحقول الجديدة بدون فقدان شيء)
function migrateProject(p){
  p.info = p.info || {};
  p.info.projectType = p.info.projectType || 'residential';
  p.info.unitLabel = p.info.unitLabel || 'فيلا';
  p.info.unitsTitle = p.info.unitsTitle || 'الفلل';
  p.seq = p.seq || 1000;
  p.blockerLog = p.blockerLog || []; p.workLogs = p.workLogs || [];
  p.editRequests = p.editRequests || []; // طلبات تعديل الإنتاجية بانتظار موافقة الإدارة
  p.subcontractors = p.subcontractors || []; // مقاولو الباطن (بنودهم وأسعارهم المتفق عليها)
  p.subMustakhlasat = p.subMustakhlasat || []; // مستخلصات مقاولي الباطن (جانب الصرف)
  p.subAlerts = p.subAlerts || []; // إنذارات محاولات تجاوز الكميات
  p.villas = p.villas || []; p.villaProgress = p.villaProgress || {}; p.boqItems = p.boqItems || [];
  p.mustakhlasat = p.mustakhlasat || [];
  p.mustakhlasat.forEach(m => { m.payments = m.payments || []; m.attachments = m.attachments || []; });
  p.boqItems.forEach(i => {
    if (i.blocker) { i.blocker.since = i.blocker.since || ''; i.blocker.expected = i.blocker.expected || ''; }
    // اعتماد الاستشاري على الكميات: الكميات القائمة تُعامل كمعتمدة (ترحيل)، والجديد يبدأ بانتظار الاعتماد
    if (i.approvedQty === undefined) i.approvedQty = i.executedQty || 0;
    i.approvals = i.approvals || [];
  });
  return p;
}

// تحويل نسخة احتياطية قديمة (من إصدار المتصفح) إلى قائمة مشاريع
function projectsFromLegacyBackup(data){
  let projects;
  if (data.projects) projects = data.projects;
  else if (data.boqItems) {
    projects = [{
      managerUserId:null, info:data.project || {name:'مشروع مستورد'},
      boqItems:data.boqItems, villas:data.villas||[], villaProgress:data.villaProgress||{},
      mustakhlasat:data.mustakhlasat||[], workLogs:data.workLogs||[], blockerLog:data.blockerLog||[]
    }];
  } else return null;
  return projects.map(p => { const {id, version, ...rest} = p; return migrateProject(rest); });
}

// ---- تحميل الحالة من الخادم (مع كاش للعمل بدون اتصال) ----
let offlineMode = false;

async function refreshState(){
  const d = await API.req('GET', '/api/state');
  d.projects.forEach(migrateProject);
  const savedProj = Number(localStorage.getItem('azoom_proj') || 0);
  state = { me: d.me, users: d.users, companies: d.companies || [], projects: d.projects, currentProjectId: savedProj };
  if (!state.projects.find(p => p.id === state.currentProjectId)) {
    state.currentProjectId = state.projects.length ? state.projects[0].id : 0;
  }
  offlineMode = false;
  priceDBLoaded = false; // إعادة تحميل قاعدة الأسعار حسب سياق المستخدم
  $('offline-banner').style.display = 'none';
  try { localStorage.setItem('azoom_cache', JSON.stringify({me:d.me, users:d.users, companies:d.companies||[], projects:d.projects})) } catch(e) {}
  renderAll();
}

// عند انقطاع الاتصال: عرض آخر بيانات محفوظة للقراءة فقط
function loadOfflineCache(){
  try {
    const c = JSON.parse(localStorage.getItem('azoom_cache'));
    if (!c || !c.projects) return false;
    c.projects.forEach(migrateProject);
    state = { me:c.me, users:c.users, companies:c.companies||[], projects:c.projects, currentProjectId: Number(localStorage.getItem('azoom_proj')||0) };
    if (!state.projects.find(p => p.id === state.currentProjectId)) {
      state.currentProjectId = state.projects.length ? state.projects[0].id : 0;
    }
    offlineMode = true;
    $('offline-banner').style.display = 'block';
    renderAll();
    return true;
  } catch(e) { return false; }
}

async function retryOnline(){
  try { await refreshState(); } catch(e) { alert(T('لا يزال الاتصال متعذراً')); }
}
Object.assign(I18N_EN, { 'لا يزال الاتصال متعذراً':'Still unable to connect' });
window.addEventListener('online', () => { if (offlineMode) retryOnline(); });

// ---- حفظ تلقائي إلى الخادم مع كشف تعارض التعديلات ----
let saveTimer = null;
const dirtyProjects = new Set();

function save(){
  if (!proj().id) return;
  if (offlineMode) { alert(T('📴 أنت في وضع بدون اتصال — التعديلات غير ممكنة حتى عودة الاتصال بالخادم.')); return; }
  dirtyProjects.add(proj().id);
  $('save-badge').textContent = T('⬤ جاري الحفظ...');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushSaves(false), 700);
}

async function flushSaves(keepalive){
  for (const id of [...dirtyProjects]) {
    const p = state.projects.find(x => x.id === id);
    if (!p) { dirtyProjects.delete(id); continue; }
    const { version, ...data } = p;
    try {
      const r = await API.req('PUT', '/api/projects/' + id, { baseVersion: version, data }, keepalive);
      p.version = r.version;
      dirtyProjects.delete(id);
      $('save-badge').textContent = T('⬤ محفوظ') + ' ' + new Date().toLocaleTimeString('en-GB');
    } catch(e) {
      if (e.status === 409) {
        dirtyProjects.delete(id);
        alert(T('⚠️ تم تعديل هذا المشروع من مستخدم آخر في نفس الوقت. سيتم تحميل آخر نسخة محفوظة.'));
        await refreshState();
      } else if (e.status === 401) {
        showLogin();
      } else {
        $('save-badge').textContent = T('⬤ تعذر الحفظ — إعادة المحاولة...');
        setTimeout(() => { if (dirtyProjects.size) flushSaves(false); }, 5000);
      }
      break;
    }
  }
}
Object.assign(I18N_EN, {
  '📴 أنت في وضع بدون اتصال — التعديلات غير ممكنة حتى عودة الاتصال بالخادم.':'📴 You are offline — changes are not possible until the connection to the server returns.',
  '⬤ جاري الحفظ...':'⬤ Saving...',
  '⬤ محفوظ':'⬤ Saved',
  '⚠️ تم تعديل هذا المشروع من مستخدم آخر في نفس الوقت. سيتم تحميل آخر نسخة محفوظة.':'⚠️ This project was edited by another user at the same time. The latest saved version will be loaded.',
  '⬤ تعذر الحفظ — إعادة المحاولة...':'⬤ Save failed — retrying...'
});

// حفظ ما تبقى عند إغلاق الصفحة
window.addEventListener('pagehide', () => { if (dirtyProjects.size) flushSaves(true); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirtyProjects.size) flushSaves(true); });

// حماية من عيب معروف في المتصفحات: تمرير عجلة الفأرة فوق حقل رقمي مركَّز عليه (focus) يغيّر قيمته بصمت
// (مثلاً أثناء التمرير في الصفحة) بدل تمرير الصفحة عادةً — قد يُفسد سعراً أو كمية دون أن يلاحظ المستخدم.
// الحل: إلغاء تركيز أي حقل رقمي فور محاولة التمرير فوقه، فتعمل عجلة الفأرة كتمرير صفحة عادي دائماً.
document.addEventListener('wheel', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'number') document.activeElement.blur();
}, { passive: true });

// مزامنة دورية: لو عدّل مستخدم آخر مشروعاً، حدّث تلقائياً
setInterval(async () => {
  if (!API.token || !state || dirtyProjects.size) return;
  try {
    const v = await API.req('GET', '/api/state/versions');
    const changed = v.length !== state.projects.length ||
      v.some(x => { const lp = state.projects.find(p => p.id === x.id); return !lp || lp.version !== x.version; });
    if (changed && !dirtyProjects.size) await refreshState();
  } catch(e) {}
}, 60000);
