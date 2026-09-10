'use strict';
// ============================================================
//  RENDER: SHARED
// ============================================================
function renderAll(){
  renderHeader(); renderProjects(); renderKPIs(); renderCharts(); renderAlerts(); renderClaimSummary();
  renderItemFilters(); renderItemsTable(); renderPlan(); renderBuilder(); renderHistory();
  renderBlocked(); renderVillaFilters(); renderVillaGrid(); renderProd(); renderSubs(); updateTabCounts();
}

function renderHeader(){
  const p = proj();
  const cu = currentUser();
  const mgr = userName(p.managerUserId);
  const tdef = PROJECT_TYPES[p.info.projectType] || PROJECT_TYPES.other;
  const co = companyName(p.companyId);
  $('hd-sub').textContent = (co ? '🏢 ' + co + ' | ' : '') + p.info.name + ' (' + T(tdef.label) + ')' + (mgr ? ' | ' + T('مدير المشروع') + ': ' + mgr : '');
  const list = accessibleProjects();
  $('proj-select').innerHTML = list.length
    ? list.map(x => '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>🗂 ' + esc(x.info.name) + '</option>').join('')
    : '<option>' + T('لا يوجد مشروع معين لك') + '</option>';
  $('user-chip').textContent = (ROLE_ICONS[cu.role]||'👤') + ' ' + cu.name + ' — ' + T(ROLE_LABELS[cu.role]||'');
  // مسميات الوحدات حسب نوع المشروع (فيلا / مبنى / قطاع...)
  $('villas-tab-label').textContent = ULS();
  $('add-villa-label').textContent = UL();
  $('wl-villa-label').textContent = UL() + ' (' + T('اختياري') + ')';
  $('wl-th-villa').textContent = UL();
}
Object.assign(I18N_EN, {
  'مدير المشروع':'Project manager',
  'لا يوجد مشروع معين لك':'No project assigned to you',
  'اختياري':'Optional',
  'فلل / وحدات سكنية':'Villas / residential units',
  'مباني':'Buildings',
  'بنية تحتية':'Infrastructure',
  'طرق':'Roads',
  'أخرى':'Other',
  'مبنى':'Building',
  'المباني':'Buildings',
  'قطاع':'Sector',
  'القطاعات':'Sectors',
  'قطاع (كم)':'Sector (km)'
});
