'use strict';
// ============================================================
//  USERS
// ============================================================
const ROLE_LABELS = {admin:'أدمن النظام', client:'العميل - مالك الشركة', pmo:'مدير المشاريع', pm:'مدير مشروع'};

function openUsersManage(){
  if (!isManagerial()) { alert(T('إدارة المستخدمين صلاحية أدمن النظام أو العميل')); return; }
  // الأدوار المتاحة: الأدمن يضيف أي دور، والعميل يضيف موظفي شركته فقط
  const roleOpts = isAdmin()
    ? [['pm','مدير مشروع (مشروعه فقط)'],['pmo','مدير المشاريع (كل مشاريع شركته)'],['client','العميل - مالك الشركة (كامل صلاحيات شركته)'],['admin','أدمن النظام (كل شيء)']]
    : [['pm','مدير مشروع (مشروعه فقط)'],['pmo','مدير المشاريع (كل مشاريع الشركة)']];
  $('us-role').innerHTML = roleOpts.map(([v,l]) => '<option value="' + v + '">' + T(l) + '</option>').join('');
  $('us-company').innerHTML = (state.companies||[]).map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');
  usRoleChanged();
  renderUsersList();
  $('users-modal').classList.add('open');
}

function usRoleChanged(){
  // الشركة تظهر للأدمن فقط، وتختفي عند دور الأدمن (لا شركة له)
  $('us-company-wrap').style.display = (isAdmin() && $('us-role').value !== 'admin') ? '' : 'none';
}

// من أستطيع إدارته؟ الأدمن: الجميع · العميل: موظفو شركته (pmo/pm)
const canManageUserUI = u => isAdmin() ||
  (state.me.role === 'client' && ['pmo','pm'].includes(u.role) && u.companyId === state.me.companyId);

const ROLE_ICONS = {admin:'★', client:'⭐', pmo:'👔', pm:'👤'};

function renderUsersList(){
  $('users-list').innerHTML = state.users.map(u => {
    const projects = state.projects.filter(p => p.managerUserId === u.id);
    const co = companyName(u.companyId);
    const manageable = canManageUserUI(u);
    return '<div class="sc-item"><span class="sc-item-name" style="white-space:normal">' +
      (ROLE_ICONS[u.role]||'👤') + ' <strong style="color:var(--text)">' + esc(u.name) + '</strong> — ' + T(ROLE_LABELS[u.role]||u.role) +
      (co ? ' · 🏢 ' + esc(co) : '') +
      ' <span style="font-family:var(--mono);font-size:10px;color:var(--text3)">(' + esc(u.username) + ')</span>' +
      (projects.length ? '<br><span style="font-size:11px">' + T('يدير:') + ' ' + projects.map(p => esc(p.info.name)).join('، ') + '</span>' : '') + '</span>' +
      '<span>' + (manageable ? '<button class="mini-btn" onclick="resetUserPassword(' + u.id + ')">🔑 ' + T('كلمة المرور') + '</button> ' : '') +
      (u.id === state.me.id ? '<span class="pill blue" style="font-size:9px">' + T('أنت') + '</span>'
        : manageable ? '<button class="mini-btn red" onclick="deleteUser(' + u.id + ')">🗑</button>' : '') + '</span></div>';
  }).join('');
}

Object.assign(I18N_EN, {
  'أدمن النظام':'System admin',
  'العميل - مالك الشركة':'Client - company owner',
  'مدير المشاريع':'Projects manager',
  'مدير مشروع':'Project manager',
  'مدير مشروع (مشروعه فقط)':'Project manager (their project only)',
  'مدير المشاريع (كل مشاريع شركته)':'Projects manager (all of their company\'s projects)',
  'العميل - مالك الشركة (كامل صلاحيات شركته)':'Client - company owner (full permissions over their company)',
  'أدمن النظام (كل شيء)':'System admin (everything)',
  'مدير المشاريع (كل مشاريع الشركة)':'Projects manager (all of the company\'s projects)'
});

async function addUser(){
  const name = $('us-name').value.trim();
  const username = $('us-username').value.trim();
  const password = $('us-pin').value.trim();
  if (!name || !username || !password) { alert(T('أكمل: الاسم، اسم المستخدم، كلمة المرور')); return; }
  const role = $('us-role').value;
  const body = {username, name, role, password};
  if (isAdmin() && role !== 'admin') body.companyId = Number($('us-company').value) || null;
  try {
    const u = await API.req('POST', '/api/users', body);
    state.users.push(u);
    $('us-name').value = ''; $('us-username').value = ''; $('us-pin').value = '';
    renderUsersList(); renderAll();
  } catch(e) { alert(e.message); }
}

// ---- الشركات (أدمن النظام) ----
function openCompanies(){
  if (!isAdmin()) { alert(T('إدارة الشركات صلاحية أدمن النظام فقط')); return; }
  renderCompaniesList();
  $('companies-modal').classList.add('open');
}

function renderCompaniesList(){
  $('companies-list').innerHTML = (state.companies||[]).map(c => {
    const nProj = state.projects.filter(p => p.companyId === c.id).length;
    const nUsers = state.users.filter(u => u.companyId === c.id).length;
    return '<div class="sc-item"><span class="sc-item-name" style="white-space:normal">🏢 <strong style="color:var(--text)">' + esc(c.name) + '</strong>' +
      '<br><span style="font-size:11px">' + nProj + ' ' + T('مشروع') + ' · ' + nUsers + ' ' + T('مستخدم') + '</span></span>' +
      '<span><button class="mini-btn" onclick="renameCompany(' + c.id + ')">✏️</button> ' +
      '<button class="mini-btn red" onclick="deleteCompany(' + c.id + ')">🗑</button></span></div>';
  }).join('') || '<div class="empty-state" style="padding:14px"><p>' + T('لا توجد شركات — أضف أول شركة') + '</p></div>';
}

async function addCompany(){
  const name = $('co-name').value.trim();
  if (!name) { alert(T('اكتب اسم الشركة')); return; }
  try {
    const c = await API.req('POST', '/api/companies', {name});
    state.companies.push(c);
    $('co-name').value = '';
    renderCompaniesList(); renderAll();
  } catch(e) { alert(e.message); }
}

async function renameCompany(id){
  const c = state.companies.find(x => x.id === id);
  if (!c) return;
  const name = prompt(T('الاسم الجديد للشركة:'), c.name);
  if (name === null || !name.trim()) return;
  try {
    await API.req('PUT', '/api/companies/' + id, {name: name.trim()});
    c.name = name.trim();
    renderCompaniesList(); renderAll();
  } catch(e) { alert(e.message); }
}

async function deleteCompany(id){
  const c = state.companies.find(x => x.id === id);
  if (!c) return;
  if (!confirm(T('حذف شركة "') + c.name + T('"؟ (لن يُسمح إذا كان لديها مشاريع أو مستخدمون)'))) return;
  try {
    await API.req('DELETE', '/api/companies/' + id);
    state.companies = state.companies.filter(x => x.id !== id);
    renderCompaniesList(); renderAll();
  } catch(e) { alert(e.message); }
}
Object.assign(I18N_EN, {
  'إدارة الشركات صلاحية أدمن النظام فقط':'Managing companies is system-admin only',
  'مشروع':'project(s)',
  'مستخدم':'user(s)',
  'لا توجد شركات — أضف أول شركة':'No companies yet — add the first one',
  'اكتب اسم الشركة':'Enter the company name',
  'الاسم الجديد للشركة:':'New name for the company:',
  'حذف شركة "':'Delete company "',
  '"؟ (لن يُسمح إذا كان لديها مشاريع أو مستخدمون)':'"? (Not allowed if it has projects or users)',
  '🏢 إدارة الشركات (أدمن النظام)':'🏢 Manage Companies (System Admin)',
  'كل شركة لها مشاريعها ومستخدموها: العميل ومدير المشاريع يشوفون مشاريع شركتهم فقط.':'Each company has its own projects and users: the client and projects manager only see their own company\'s projects.',
  'اسم الشركة الجديدة':'New company name',
  '+ إضافة شركة':'+ Add company'
});

// ---------- ربط Bassir ERP (خانة API — يكمل المبرمج الربط الفعلي) ----------
function openIntegration(){
  if (!isManagerial()) { alert(T('ربط ERP صلاحية أدمن النظام أو عميل الشركة')); return; }
  const wrap = $('int-company-wrap');
  if (isAdmin()) {
    wrap.style.display = '';
    $('int-company').innerHTML = (state.companies||[]).map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');
  } else { wrap.style.display = 'none'; }
  $('integration-modal').classList.add('open');
  loadIntegration();
}

function intCompanyId(){ return isAdmin() ? (Number($('int-company').value) || null) : null; }

async function loadIntegration(){
  $('int-status').textContent = T('جارٍ التحميل…');
  try {
    const cid = intCompanyId();
    const r = await API.req('GET', '/api/integration' + (cid ? '?companyId=' + cid : ''));
    const b = r.bassir || {};
    $('int-enabled').checked = !!b.enabled;
    $('int-url').value = b.url || '';
    $('int-key').value = '';
    $('int-key').placeholder = b.apiKeySet ? T('•••••••• (مفتاح محفوظ — اتركه فارغاً للإبقاء عليه)') : T('أدخل المفتاح');
    $('int-key-hint').textContent = b.apiKeySet ? T('🔒 يوجد مفتاح محفوظ. اتركه فارغاً للإبقاء عليه، أو اكتب مفتاحاً جديداً لاستبداله.') : T('لا يوجد مفتاح محفوظ بعد.');
    $('int-auth-header').value = b.authHeader || 'Authorization';
    $('int-auth-prefix').value = b.authPrefix !== undefined ? b.authPrefix : 'Bearer ';
    const canEdit = r.canEdit !== false;
    ['int-enabled','int-url','int-key','int-auth-header','int-auth-prefix'].forEach(id => { $(id).disabled = !canEdit; });
    $('int-status').innerHTML = b.lastStatus
      ? '<span style="color:var(--text2)">' + T('آخر حالة:') + ' ' + esc(b.lastStatus) + '</span>'
      : '<span style="color:var(--text2)">' + T('لم يُرسل أي طلب بعد.') + '</span>';
  } catch(e){ $('int-status').innerHTML = '<span style="color:var(--danger)">' + T('تعذر التحميل:') + ' ' + esc(e.message) + '</span>'; }
}

async function saveIntegration(){
  const cid = intCompanyId();
  const bassir = {
    enabled: $('int-enabled').checked,
    url: $('int-url').value.trim(),
    authHeader: $('int-auth-header').value.trim() || 'Authorization',
    authPrefix: $('int-auth-prefix').value
  };
  const key = $('int-key').value;
  if (key) bassir.apiKey = key; // يُرسل فقط عند إدخال مفتاح جديد
  try {
    const body = { bassir }; if (cid) body.companyId = cid;
    await API.req('PUT', '/api/integration' + (cid ? '?companyId=' + cid : ''), body);
    await loadIntegration(); // يُحدّث مؤشر المفتاح المحفوظ
    $('int-status').innerHTML = '<span style="color:var(--success,#2e7d32)">✅ ' + T('تم حفظ الإعدادات') + '</span>';
  } catch(e){ $('int-status').innerHTML = '<span style="color:var(--danger)">' + T('فشل الحفظ:') + ' ' + esc(e.message) + '</span>'; }
}

async function testIntegration(){
  const cid = intCompanyId();
  if (!$('int-url').value.trim()) { alert(T('أدخل رابط API أولاً ثم احفظ قبل الاختبار')); return; }
  $('int-status').innerHTML = '<span style="color:var(--text2)">' + T('جارٍ إرسال طلب تجريبي…') + '</span>';
  try {
    const body = cid ? { companyId: cid } : {};
    const r = await API.req('POST', '/api/integration/test' + (cid ? '?companyId=' + cid : ''), body);
    $('int-status').innerHTML = r.ok
      ? '<span style="color:var(--success,#2e7d32)">✅ ' + T('نجح الاتصال (HTTP') + ' ' + r.status + ')</span>'
      : '<span style="color:var(--danger)">⚠️ ' + T('استجابة غير متوقعة (HTTP') + ' ' + r.status + ')</span>';
  } catch(e){ $('int-status').innerHTML = '<span style="color:var(--danger)">❌ ' + T('تعذر الاتصال:') + ' ' + esc(e.message) + '</span>'; }
}
Object.assign(I18N_EN, {
  'جارٍ التحميل…':'Loading…',
  '•••••••• (مفتاح محفوظ — اتركه فارغاً للإبقاء عليه)':'•••••••• (key saved — leave blank to keep it)',
  'أدخل المفتاح':'Enter the key',
  '🔒 يوجد مفتاح محفوظ. اتركه فارغاً للإبقاء عليه، أو اكتب مفتاحاً جديداً لاستبداله.':'🔒 A key is saved. Leave it blank to keep it, or enter a new key to replace it.',
  'لا يوجد مفتاح محفوظ بعد.':'No key saved yet.',
  'آخر حالة:':'Last status:',
  'لم يُرسل أي طلب بعد.':'No request sent yet.',
  'تعذر التحميل:':'Failed to load:',
  'تم حفظ الإعدادات':'Settings saved',
  'فشل الحفظ:':'Save failed:',
  'جارٍ إرسال طلب تجريبي…':'Sending a test request…',
  'نجح الاتصال (HTTP':'Connection succeeded (HTTP',
  'استجابة غير متوقعة (HTTP':'Unexpected response (HTTP',
  'تعذر الاتصال:':'Could not connect:'
});

async function resetUserPassword(id){
  const u = state.users.find(x => x.id === id);
  if (!u) return;
  const password = prompt(T('كلمة المرور الجديدة لـ "') + u.name + T('" (4 أحرف على الأقل):'));
  if (password === null || !password.trim()) return;
  try {
    await API.req('PUT', '/api/users/' + id, {password: password.trim()});
    alert(T('تم تغيير كلمة المرور ✅'));
  } catch(e) { alert(e.message); }
}

async function deleteUser(id){
  const u = state.users.find(x => x.id === id);
  if (!u) return;
  const projects = state.projects.filter(p => p.managerUserId === id);
  if (!confirm(T('حذف المستخدم "') + u.name + T('"؟') + (projects.length ? T(' سيتم إلغاء تعيينه من') + ' ' + projects.length + ' ' + T('مشروع.') : ''))) return;
  try {
    await API.req('DELETE', '/api/users/' + id);
    projects.forEach(p => { p.managerUserId = null; p.version++; });
    state.users = state.users.filter(x => x.id !== id);
    renderUsersList(); renderAll();
  } catch(e) { alert(e.message); }
}
Object.assign(I18N_EN, {
  'مالك / إدارة':'Owner / admin',
  'مدير مشروع':'Project manager',
  'إدارة المستخدمين صلاحية المالك فقط':'Managing users is owner-only',
  'يدير:':'Manages:',
  'كلمة المرور':'Password',
  'أنت':'You',
  'أكمل: الاسم، اسم المستخدم، كلمة المرور':'Fill in: name, username, password',
  'كلمة المرور الجديدة لـ "':'New password for "',
  '" (4 أحرف على الأقل):':'" (at least 4 characters):',
  'تم تغيير كلمة المرور ✅':'Password changed ✅',
  'حذف المستخدم "':'Delete user "',
  '"؟':'"?',
  ' سيتم إلغاء تعيينه من':' They will be unassigned from',
  'مشروع.':'project(s).'
});

function updateTabCounts(){
  $('tc-projects').textContent = accessibleProjects().length;
  $('tc-items').textContent = actionableItems().length;
  $('tc-plan').textContent = actionableItems().filter(i => netClaimable(i) > 1).length;
  $('tc-invoice').textContent = proj().mustakhlasat.length;
  $('tc-blocked').textContent = actionableItems().filter(i => ['blocked','waiting'].includes(statusOf(i))).length;
  $('tc-villas').textContent = proj().villas.length;
  $('tc-prod').textContent = proj().workLogs.length;
  const preq = pendingEditRequests().length, prb = $('tc-prod-req');
  if (prb) { prb.textContent = preq; prb.style.display = (preq && canApproveEdits()) ? '' : 'none'; }
}

function switchTab(id){
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  $('tab-' + id).classList.add('active');
  if (id === 'pricedb') onOpenPricedb();
}

function statusPill(st){
  const m = STATUS_META[st];
  return '<span class="pill ' + m.color + '">' + m.icon + ' ' + T(m.label) + '</span>';
}
function pctBar(pct, color){
  const c = color || (pct >= DONE ? 'green' : pct > 0 ? 'amber' : 'red');
  return '<span style="display:inline-flex;align-items:center;gap:6px"><span style="font-family:var(--mono);font-size:12px">' + (pct*100).toFixed(0) + '%</span><span class="prog-bar"><span class="prog-fill ' + c + '" style="width:' + (pct*100) + '%;display:block"></span></span></span>';
}
