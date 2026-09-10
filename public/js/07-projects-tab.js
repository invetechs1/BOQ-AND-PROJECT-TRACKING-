'use strict';
// ============================================================
//  PROJECTS TAB
// ============================================================
function renderProjects(){
  const list = accessibleProjects();
  $('btn-add-project').style.display = isManagerial() ? '' : 'none';
  $('btn-users-manage').style.display = isManagerial() ? '' : 'none';
  $('btn-companies').style.display = isAdmin() ? '' : 'none';
  $('btn-integration').style.display = isManagerial() ? '' : 'none';
  const roleNotices = {
    client:'⭐ أنت العميل (مالك الشركة) — تظهر لك مشاريع شركتك ولديك كامل الصلاحيات عليها.',
    pmo:'👔 أنت مدير المشاريع — تظهر لك جميع مشاريع شركتك للعمل عليها.',
    pm:'👤 أنت مدير مشروع — تظهر لك مشاريعك المعينة لك فقط.'
  };
  $('pm-notice').innerHTML = roleNotices[state.me.role] ? '<div class="alert info">' + T(roleNotices[state.me.role]) + '</div>' : '';
  $('projects-grid').innerHTML = list.map(p => {
    const t = totalsFor(p);
    const pct = t.azoomScope > 0 ? t.executed / t.azoomScope * 100 : 0;
    const barColor = pct >= 80 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)';
    const mgr = userName(p.managerUserId);
    const isCur = p.id === proj().id;
    return '<div class="card' + (isCur ? ' green-b' : '') + '" style="margin-bottom:0">' +
      '<div class="sc-header"><div class="sc-icon" style="background:var(--amber-dim)">🗂</div>' +
      '<div style="flex:1"><div>' + esc(p.info.name) + (isCur ? ' <span class="pill green" style="font-size:9px">' + T('الحالي') + '</span>' : '') + '</div>' +
      '<div style="font-size:11px;color:var(--text2)">' + (isAdmin() && companyName(p.companyId) ? '🏢 ' + esc(companyName(p.companyId)) + ' · ' : '') + esc(p.info.client || '—') + ' · ' + p.boqItems.length + ' ' + T('بند') + ' · ' + p.villas.length + ' ' + esc(T(p.info.unitLabel||'وحدة')) + '</div></div></div>' +
      '<div class="sc-item"><span class="sc-item-name">👤 ' + T('مدير المشروع') + '</span><span class="sc-item-val" style="color:' + (mgr ? 'var(--blue)' : 'var(--red)') + '">' + (mgr ? esc(mgr) : T('غير معيّن ⚠')) + '</span></div>' +
      '<div style="margin:8px 0"><div class="villa-prog-bar" style="height:6px"><div class="villa-prog-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
      '<div style="font-size:11px;font-family:var(--mono);color:' + barColor + '">' + pct.toFixed(1) + '% ' + T('إنجاز') + '</div></div>' +
      '<div class="sc-item"><span class="sc-item-name">' + T('قيمة النطاق') + '</span><span class="sc-item-val">' + money(t.azoomScope) + '</span></div>' +
      '<div class="sc-item"><span class="sc-item-name">✅ ' + T('جاهز للرفع') + '</span><span class="sc-item-val" style="color:var(--green-bright)">' + money(t.net) + '</span></div>' +
      '<div class="sc-item"><span class="sc-item-name">⛔ ' + T('بنود معيقة') + '</span><span class="sc-item-val" style="color:' + (t.blockedCount ? 'var(--red)' : 'var(--text3)') + '">' + t.blockedCount + '</span></div>' +
      '<div class="sc-item"><span class="sc-item-name">📤 ' + T('مستخلصات / محصل') + '</span><span class="sc-item-val" style="color:var(--teal)">' + p.mustakhlasat.length + ' · ' + money(t.collected) + '</span></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
      '<button class="btn btn-green" style="flex:1;font-size:12px;padding:6px" onclick="switchProject(' + p.id + ');switchTab(\'dashboard\')">📂 ' + T('فتح المشروع') + '</button>' +
      (isManagerial() ? '<button class="mini-btn" onclick="openProjectModal(' + p.id + ')">✏️ ' + T('تعديل / تعيين مدير') + '</button>' : '') +
      '</div></div>';
  }).join('') || '<div class="empty-state"><div class="icon">🗂</div><p>' + T('لا توجد مشاريع') + (isManagerial() ? T(' — أضف مشروعك الأول') : T(' معينة لك — راجع الإدارة')) + '</p></div>';
}

// خيارات مدير المشروع: موظفو الشركة بدور مدير مشروع أو مدير مشاريع
function pmManagerOptions(companyId, selectedId){
  const candidates = state.users.filter(u => ['pm','pmo'].includes(u.role) && u.companyId === companyId);
  return '<option value="">' + T('— بدون مدير معيّن —') + '</option>' +
    candidates.map(u => '<option value="' + u.id + '"' + (selectedId === u.id ? ' selected' : '') + '>' + esc(u.name) + ' (' + T(ROLE_LABELS[u.role]) + ')</option>').join('');
}
function pmCompanyChanged(){
  $('pm-manager').innerHTML = pmManagerOptions(Number($('pm-company').value), null);
}
Object.assign(I18N_EN, {
  'أنت مسجل كمدير مشروع — تظهر لك مشاريعك المعينة فقط.':'You are signed in as a project manager — only your assigned projects are shown.',
  'الحالي':'Current',
  'بند':'item',
  'غير معيّن ⚠':'Not assigned ⚠',
  'إنجاز':'progress',
  'قيمة النطاق':'Scope value',
  'جاهز للرفع':'Ready to claim',
  'بنود معيقة':'Blocked items',
  'مستخلصات / محصل':'Claims / collected',
  'فتح المشروع':'Open project',
  'تعديل / تعيين مدير':'Edit / assign manager',
  'لا توجد مشاريع':'No projects',
  ' — أضف مشروعك الأول':' — add your first project',
  ' معينة لك — راجع الإدارة':' assigned to you — check with the admin'
});

let editingProjectId = null;
function openProjectModal(id){
  if (!isManagerial()) { alert(T('إضافة وتعديل المشاريع صلاحية أدمن النظام أو العميل')); return; }
  editingProjectId = id;
  const p = id ? state.projects.find(x => x.id === id) : null;
  $('project-modal-title').textContent = p ? T('تعديل مشروع:') + ' ' + p.info.name : T('إضافة مشروع جديد');
  $('pm-delete-btn').style.display = p ? '' : 'none';
  $('pm-name').value = p ? p.info.name : '';
  $('pm-type').value = p ? (p.info.projectType||'residential') : 'residential';
  $('pm-unit').value = p ? (p.info.unitLabel||'') : T(PROJECT_TYPES.residential.unit);
  $('pm-units').value = p ? (p.info.unitsTitle||'') : T(PROJECT_TYPES.residential.units);
  $('pm-client').value = p ? (p.info.client||'') : '';
  $('pm-consultant').value = p ? (p.info.consultant||'') : '';
  $('pm-contractor').value = p ? (p.info.contractor||'') : (state.projects[0] ? state.projects[0].info.contractor : '');
  $('pm-villas').value = p ? (p.info.totalVillas||0) : 0;
  $('pm-vat').value = p ? p.info.vatRate : 15;
  $('pm-ret').value = p ? p.info.retentionRate : 10;
  $('pm-adv').value = p ? p.info.advanceRate : 0;
  // الشركة: الأدمن يختار، وغيره مثبتة على شركته
  const myCompanyId = state.me.companyId;
  const projCompanyId = p ? p.companyId : (isAdmin() ? ((state.companies[0]||{}).id || null) : myCompanyId);
  $('pm-company-wrap').style.display = isAdmin() ? '' : 'none';
  $('pm-company').innerHTML = (state.companies||[]).map(c =>
    '<option value="' + c.id + '"' + (c.id === projCompanyId ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  $('pm-manager').innerHTML = pmManagerOptions(projCompanyId, p ? p.managerUserId : null);
  $('pm-boq-src-wrap').style.display = p ? 'none' : '';
  if (!p) {
    $('pm-boq-src').innerHTML = '<option value="">' + T('جدول كميات فارغ (أضف البنود يدوياً)') + '</option>' +
      state.projects.map(x => '<option value="' + x.id + '">' + T('نسخ بنود من:') + ' ' + esc(x.info.name) + ' ' + T('(بدون نسب التنفيذ)') + '</option>').join('');
  }
  $('project-modal').classList.add('open');
}
Object.assign(I18N_EN, {
  '⭐ أنت العميل (مالك الشركة) — تظهر لك مشاريع شركتك ولديك كامل الصلاحيات عليها.':'⭐ You are the client (company owner) — your company\'s projects are shown, with full permissions over them.',
  '👔 أنت مدير المشاريع — تظهر لك جميع مشاريع شركتك للعمل عليها.':'👔 You are the projects manager — all of your company\'s projects are shown for you to work on.',
  '👤 أنت مدير مشروع — تظهر لك مشاريعك المعينة لك فقط.':'👤 You are a project manager — only your assigned projects are shown.',
  'إضافة وتعديل المشاريع صلاحية أدمن النظام أو العميل':'Adding and editing projects is restricted to the system admin or the client'
});

function pmTypeChanged(){
  const t = PROJECT_TYPES[$('pm-type').value] || PROJECT_TYPES.other;
  $('pm-unit').value = T(t.unit);
  $('pm-units').value = T(t.units);
}

async function saveProject(){
  const name = $('pm-name').value.trim();
  if (!name) { alert(T('اكتب اسم المشروع')); return; }
  const type = $('pm-type').value;
  const tdef = PROJECT_TYPES[type] || PROJECT_TYPES.other;
  const info = {
    name, client:$('pm-client').value.trim(), consultant:$('pm-consultant').value.trim(),
    contractor:$('pm-contractor').value.trim(), totalVillas:Number($('pm-villas').value)||0,
    vatRate:Number($('pm-vat').value)||0, retentionRate:Number($('pm-ret').value)||0, advanceRate:Number($('pm-adv').value)||0,
    projectType:type, unitLabel:$('pm-unit').value.trim()||tdef.unit, unitsTitle:$('pm-units').value.trim()||tdef.units
  };
  const managerUserId = Number($('pm-manager').value) || null;
  const companyId = isAdmin() ? Number($('pm-company').value) || null : state.me.companyId;
  try {
    if (editingProjectId) {
      const p = state.projects.find(x => x.id === editingProjectId);
      p.info = info; p.managerUserId = managerUserId;
      if (isAdmin() && companyId) p.companyId = companyId;
      dirtyProjects.add(p.id);
      await flushSaves(false);
    } else {
      let boqItems = [];
      const srcId = Number($('pm-boq-src').value);
      if (srcId) {
        const src = state.projects.find(x => x.id === srcId);
        if (src) boqItems = src.boqItems.map(it => ({...it, predecessors:[...(it.predecessors||[])], blocker:null, executedQty:0, claimedQty:0}));
      }
      const data = {managerUserId, companyId, info, seq:1000, boqItems, villas:[], villaProgress:{}, mustakhlasat:[], workLogs:[], blockerLog:[], editRequests:[], subcontractors:[], subMustakhlasat:[], subAlerts:[]};
      const r = await API.req('POST', '/api/projects', {data});
      state.projects.push({...data, id:r.id, version:r.version});
      state.currentProjectId = r.id;
      localStorage.setItem('azoom_proj', String(r.id));
    }
    closeModal('project-modal'); renderAll();
  } catch(e) { alert(T('تعذر الحفظ:') + ' ' + e.message); }
}

async function deleteProject(){
  if (!editingProjectId) return;
  const p = state.projects.find(x => x.id === editingProjectId);
  if (!confirm(T('حذف المشروع "') + p.info.name + T('" نهائياً بكل بنوده ومستخلصاته ويومياته؟ خذ نسخة احتياطية أولاً!'))) return;
  if (!confirm(T('تأكيد أخير: البيانات لا يمكن استرجاعها بعد الحذف.'))) return;
  try {
    await API.req('DELETE', '/api/projects/' + editingProjectId);
    state.projects = state.projects.filter(x => x.id !== editingProjectId);
    closeModal('project-modal'); renderAll();
  } catch(e) { alert(e.message); }
}
Object.assign(I18N_EN, {
  'إضافة وتعديل المشاريع صلاحية المالك فقط':'Adding and editing projects is owner-only',
  'تعديل مشروع:':'Edit project:',
  'إضافة مشروع جديد':'Add new project',
  '— بدون مدير معيّن —':'— No manager assigned —',
  'مالك':'Owner',
  'جدول كميات فارغ (أضف البنود يدوياً)':'Empty BOQ (add items manually)',
  'نسخ بنود من:':'Copy items from:',
  '(بدون نسب التنفيذ)':'(without execution percentages)',
  'اكتب اسم المشروع':'Enter the project name',
  'حذف المشروع "':'Permanently delete project "',
  '" نهائياً بكل بنوده ومستخلصاته ويومياته؟ خذ نسخة احتياطية أولاً!':'" along with all its items, claims and logs? Take a backup first!',
  'تأكيد أخير: البيانات لا يمكن استرجاعها بعد الحذف.':'Final confirmation: this data cannot be recovered after deletion.'
});
