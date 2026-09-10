'use strict';
// ============================================================
//  SETTINGS / IMPORT / EXPORT
// ============================================================
function openSettings(){
  const p = proj().info;
  $('st-name').value = p.name; $('st-client').value = p.client; $('st-consultant').value = p.consultant;
  $('st-contractor').value = p.contractor; $('st-villas').value = p.totalVillas;
  $('st-unit').value = p.unitLabel || ''; $('st-units').value = p.unitsTitle || '';
  $('st-vat').value = p.vatRate; $('st-ret').value = p.retentionRate; $('st-adv').value = p.advanceRate;
  $('settings-modal').classList.add('open');
}
function saveSettings(){
  const p = proj().info;
  p.name = $('st-name').value.trim(); p.client = $('st-client').value.trim();
  p.consultant = $('st-consultant').value.trim(); p.contractor = $('st-contractor').value.trim();
  p.totalVillas = Number($('st-villas').value)||0;
  p.unitLabel = $('st-unit').value.trim() || p.unitLabel || 'وحدة';
  p.unitsTitle = $('st-units').value.trim() || p.unitsTitle || 'الوحدات';
  p.vatRate = Number($('st-vat').value)||0; p.retentionRate = Number($('st-ret').value)||0; p.advanceRate = Number($('st-adv').value)||0;
  $('mb-ret').value = p.retentionRate; $('mb-adv').value = p.advanceRate;
  closeModal('settings-modal'); save(); renderAll();
}
async function resetDemo(){
  if (!isManagerial()) { alert(T('صلاحية أدمن النظام أو العميل فقط')); return; }
  if (!confirm(T('إضافة مشروع تجريبي كامل (مشروع SANG بفلله وبنوده ويومياته) للتعرف على النظام؟'))) return;
  try {
    const data = migrateProject(demoProjectData()); // يضبط approvedQty/approvals للبنود التجريبية
    data.companyId = isAdmin() ? ((state.companies[0]||{}).id || null) : state.me.companyId;
    const r = await API.req('POST', '/api/projects', {data});
    state.projects.push({...data, id:r.id, version:r.version});
    state.currentProjectId = r.id;
    localStorage.setItem('azoom_proj', String(r.id));
    closeModal('settings-modal'); renderAll();
  } catch(e) { alert(e.message); }
}
function exportJSON(){
  if (isAdmin()) { // نسخة كاملة من الخادم
    fetch('/api/backup', {headers:{'Authorization':'Bearer ' + API.token}})
      .then(r => r.blob())
      .then(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'azoom-backup-' + todayStr() + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(e => alert(T('تعذر التصدير:') + ' ' + e.message));
  } else {
    const blob = new Blob([JSON.stringify({projects: state.projects}, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'azoom-projects-' + todayStr() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
function importJSON(input){
  const file = input.files[0];
  if (!file) return;
  if (!isAdmin()) { alert(T('الاستيراد صلاحية أدمن النظام فقط')); input.value=''; return; }
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      const projects = projectsFromLegacyBackup(data);
      if (!projects) throw new Error(T('صيغة الملف غير صحيحة'));
      if (!confirm(T('استبدال جميع المشاريع على الخادم بمحتوى الملف') + ' (' + projects.length + ' ' + T('مشروع') + ')? ' + T('المستخدمون لن يتأثروا.'))) { input.value=''; return; }
      await API.req('POST', '/api/restore', {projects});
      await refreshState();
      alert(T('تم الاستيراد بنجاح ✅'));
    } catch(err) { alert(T('فشل الاستيراد:') + ' ' + err.message); }
    input.value = '';
  };
  reader.readAsText(file);
}
Object.assign(I18N_EN, {
  'صلاحية المالك فقط':'Owner permission only',
  'صلاحية أدمن النظام أو العميل فقط':'System admin or client permission only',
  'إضافة مشروع تجريبي كامل (مشروع SANG بفلله وبنوده ويومياته) للتعرف على النظام؟':'Add a full demo project (the SANG project with its villas, items and logs) to learn the system?',
  'تعذر التصدير:':'Export failed:',
  'الاستيراد صلاحية المالك فقط':'Importing is owner-only',
  'الاستيراد صلاحية أدمن النظام فقط':'Importing is restricted to the system admin',
  'صيغة الملف غير صحيحة':'Invalid file format',
  'استبدال جميع المشاريع على الخادم بمحتوى الملف':'Replace all projects on the server with the file\'s content',
  'مشروع':'project(s)',
  'المستخدمون لن يتأثروا.':'Users will not be affected.',
  'تم الاستيراد بنجاح ✅':'Imported successfully ✅',
  'فشل الاستيراد:':'Import failed:'
});
function openHelp(){ $('help-modal').classList.add('open'); }
function closeModal(id){ $(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(ov => {
  // إغلاق النافذة بالنقر على الخلفية: يُشترط أن يبدأ الضغط (mousedown) وينتهي (click) كلاهما على
  // الخلفية نفسها — وليس فقط أن ينتهي عليها. بدون هذا الشرط، اختيار عنصر من قائمة منسدلة (مثل بحث
  // البند في نموذج مقاول الباطن) تُخفى فور الـmousedown يمكن أن يجعل الـclick التالي (نفس الإحداثيات)
  // يقع فعلياً على الخلفية بعد اختفاء القائمة من تحت المؤشر، فيُغلق النافذة خطأً رغم أن المستخدم كان
  // يختار عنصراً داخلها لا ينقر خارجها.
  let downOnOverlay = false;
  ov.addEventListener('mousedown', e => { downOnOverlay = (e.target === ov); });
  ov.addEventListener('click', e => { if (downOnOverlay && e.target === ov) ov.classList.remove('open'); downOnOverlay = false; });
});

// live-update sidebar totals when rates change
['mb-ret','mb-adv'].forEach(id => document.addEventListener('DOMContentLoaded', () => $(id).addEventListener('input', renderMbTotals)));
