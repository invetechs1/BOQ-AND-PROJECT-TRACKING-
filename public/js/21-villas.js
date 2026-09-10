'use strict';
// ============================================================
//  VILLAS
// ============================================================
let currentVillaFilter = 'all';
let currentVillaNo = null;

function renderVillaFilters(){
  const sheets = [...new Set(proj().villas.map(v => v.sheet))];
  $('villa-filters').innerHTML = ['<button class="filter-btn' + (currentVillaFilter==='all'?' active':'') + '" onclick="setVillaFilter(\'all\')">' + T('كل') + ' ' + ULS() + '</button>']
    .concat(sheets.map(s => '<button class="filter-btn' + (currentVillaFilter===s?' active':'') + '" onclick="setVillaFilter(\'' + esc(s) + '\')">' + esc(s) + '</button>')).join(' ');
}
Object.assign(I18N_EN, { 'كل':'All' });
function setVillaFilter(f){ currentVillaFilter = f; closeVillaDetail(); renderVillaFilters(); renderVillaGrid(); }

function villaPct(itemId, villaNo){
  const vp = proj().villaProgress[itemId];
  return vp && vp[villaNo] !== undefined ? clamp(vp[villaNo],0,100) : 0;
}

function renderVillaGrid(){
  let list = proj().villas;
  if (currentVillaFilter !== 'all') list = list.filter(v => v.sheet === currentVillaFilter);
  const activeItems = proj().boqItems.filter(i => i.scope !== 'others' && !isParent(i) && !isSplitChild(i));
  $('villa-grid').innerHTML = list.map(v => {
    let wSum = 0, wTot = 0, done = 0, prog = 0, blockedC = 0;
    activeItems.forEach(it => {
      const p = villaPct(it.id, v.no);
      wSum += p/100 * amt(it); wTot += amt(it);
      if (p >= 99.5) done++;
      else if (p > 0) prog++;
      if (statusOf(it) === 'blocked') blockedC++;
    });
    const pct = wTot > 0 ? wSum/wTot*100 : 0;
    const barColor = pct >= 80 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)';
    return '<div class="villa-card" onclick="showVillaDetail(\'' + esc(v.no) + '\')">' +
      '<div class="villa-no">' + esc(UL()) + ' ' + esc(v.no) + '</div><div class="villa-sheet">' + esc(v.sheet) + '</div>' +
      '<div class="villa-prog-bar"><div class="villa-prog-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
      '<div style="font-size:11px;font-family:var(--mono);color:' + barColor + ';margin-bottom:6px">' + pct.toFixed(0) + '% ' + T('(مرجّح بالقيمة)') + '</div>' +
      '<div class="villa-status-row"><span class="villa-stat vs-done">' + done + ' ' + T('مكتمل') + '</span><span class="villa-stat vs-prog">' + prog + ' ' + T('جاري') + '</span><span class="villa-stat vs-blocked">' + blockedC + ' ' + T('معيق') + '</span></div>' +
      '</div>';
  }).join('') || '<div class="empty-state"><p>' + T('لا توجد فلل') + '</p></div>';
}

function showVillaDetail(no){
  currentVillaNo = no;
  const v = proj().villas.find(x => x.no === no);
  if (!v) return;
  $('villa-grid').style.display = 'none';
  $('villa-detail').style.display = 'block';
  $('villa-detail-title').textContent = T('تفاصيل') + ' ' + UL() + ' ' + no + ' - ' + v.sheet;
  $('villa-detail-tbody').innerHTML = proj().boqItems.filter(i => i.scope !== 'others' && !isParent(i) && !isSplitChild(i)).map(it => {
    const p = villaPct(it.id, no);
    return '<tr>' +
      '<td><span class="item-no">' + esc(it.id) + '</span></td>' +
      '<td><div class="desc-text" data-tip="' + esc(it.desc) + '">' + esc(it.desc) + '</div></td>' +
      '<td><span style="display:inline-flex;align-items:center;gap:6px"><input type="number" class="pct-input" min="0" max="100" value="' + p.toFixed(0) + '" onchange="setVillaPct(\'' + esc(it.id) + '\',\'' + esc(no) + '\', this.value)"><span class="prog-bar"><span class="prog-fill ' + (p>=99.5?'green':p>0?'amber':'red') + '" style="width:' + p + '%;display:block"></span></span></span></td>' +
      '<td>' + statusPill(statusOf(it)) + '</td>' +
      '</tr>';
  }).join('');
}

function setVillaPct(itemId, villaNo, val){
  if (!proj().villaProgress[itemId]) proj().villaProgress[itemId] = {};
  proj().villaProgress[itemId][villaNo] = clamp(val, 0, 100);
  save(); renderVillaGrid();
}

function closeVillaDetail(){
  currentVillaNo = null;
  $('villa-detail').style.display = 'none';
  $('villa-grid').style.display = 'grid';
}

function addVilla(){
  const no = prompt(T('رقم / اسم') + ' ' + UL() + ':');
  if (!no) return;
  if (proj().villas.find(v => v.no === no.trim())) { alert(UL() + ' ' + T('موجودة مسبقاً')); return; }
  const sheet = prompt(T('المخطط / الشيت (مثال C36):'), 'C37') || '—';
  proj().villas.push({no:no.trim(), sheet:sheet.trim()});
  save(); renderVillaFilters(); renderVillaGrid(); updateTabCounts();
}

function deleteVilla(){
  if (!currentVillaNo) return;
  if (!confirm(T('حذف') + ' ' + UL() + ' ' + currentVillaNo + T(' وكل نسبها؟'))) return;
  proj().villas = proj().villas.filter(v => v.no !== currentVillaNo);
  Object.values(proj().villaProgress).forEach(vp => { delete vp[currentVillaNo]; });
  closeVillaDetail(); save(); renderAll();
}

function syncFromVillas(){
  if (!proj().villas.length) { alert(T('لا توجد فلل')); return; }
  if (!confirm(T('سيتم إعادة حساب نسبة إنجاز كل بند من متوسط نسب الوحدات المسجلة') + ' (' + proj().villas.length + ' ' + UL() + '). ' + T('متابعة؟'))) return;
  actionableItems().forEach(it => {
    if (it.scope === 'others') return;
    const vp = proj().villaProgress[it.id];
    if (!vp || !Object.keys(vp).length) return;
    const mean = proj().villas.reduce((s,v) => s + villaPct(it.id, v.no), 0) / proj().villas.length;
    it.executedQty = Math.round(mean/100 * it.totalQty * 100) / 100;
  });
  save(); renderAll();
}
Object.assign(I18N_EN, {
  '(مرجّح بالقيمة)':'(value-weighted)',
  'جاري':'In progress',
  'معيق':'Blocked',
  'لا توجد فلل':'No units',
  'تفاصيل':'Details',
  'رقم / اسم':'Number / name of',
  'موجودة مسبقاً':'already exists',
  'المخطط / الشيت (مثال C36):':'Plan / sheet (e.g. C36):',
  'حذف':'Delete',
  ' وكل نسبها؟':' and all its percentages?',
  'سيتم إعادة حساب نسبة إنجاز كل بند من متوسط نسب الوحدات المسجلة':'Each item\'s completion percentage will be recalculated from the average of the registered unit percentages',
  'متابعة؟':'Continue?'
});
