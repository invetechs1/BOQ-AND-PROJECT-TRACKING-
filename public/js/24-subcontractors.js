'use strict';
// ============================================================
//  مقاولو الباطن (جانب الصرف) — تسجيلهم، كمياتهم، مستخلصاتهم
// ============================================================
const getSub = id => (proj().subcontractors||[]).find(s => s.id === id);
const subRate = (sub, itemId) => { const r = (sub && sub.items||[]).find(x => x.itemId === itemId); return r ? (Number(r.rate)||0) : 0; };
// ما نفّذه هذا المقاول لبند (من يومياته المطبّقة على البند)
function subExecForItem(subId, itemId){
  return round2((proj().workLogs||[]).filter(l => l.subId === subId && l.itemId === itemId && l.applied)
    .reduce((s,l) => s + (Number(l.appliedQty)||0), 0));
}
const totalSubExecForItem = itemId => round2((proj().subcontractors||[]).reduce((s,sub) => s + subExecForItem(sub.id, itemId), 0));
// الكمية المؤهلة للصرف = المنفذ من هذا المقاول بحدود المعتمد من الاستشاري (موزّع بالتناسب عند تعدد المقاولين)
function subEligibleQty(subId, itemId){
  const it = getItem(itemId); if (!it) return 0;
  const subEx = subExecForItem(subId, itemId);
  const totEx = totalSubExecForItem(itemId);
  if (totEx <= 0 || subEx <= 0) return 0;
  const factor = Math.min(1, approvedOf(it) / totEx);
  return round2(subEx * factor);
}
// ما سبق تعميده لهذا المقاول لبند (من مستخلصاته غير المرفوضة)
function subClaimedQty(subId, itemId){
  return round2((proj().subMustakhlasat||[]).filter(m => m.subId === subId && m.status !== 'rejected')
    .reduce((s,m) => s + ((m.lines||[]).filter(l => l.itemId === itemId).reduce((a,l)=>a+(Number(l.currQty)||0),0)), 0));
}
const subAvailQty = (subId, itemId) => Math.max(0, round2(subEligibleQty(subId, itemId) - subClaimedQty(subId, itemId)));
// بنود يعمل عليها المقاول (المتفق عليها في عقده) — نعرض ما له فيه سعر متفق
const subItemIds = sub => (sub.items||[]).map(x => x.itemId).filter(id => getItem(id));
function subMusOf(subId){ return (proj().subMustakhlasat||[]).filter(m => m.subId === subId); }
function subPaid(m){ return (m.payments||[]).reduce((s,p)=>s+(Number(p.amount)||0),0); }
function subDueSummary(subId){
  const ms = subMusOf(subId).filter(m => m.status !== 'rejected');
  const net = round2(ms.reduce((s,m)=>s+(m.net||0),0));
  const paid = round2(ms.reduce((s,m)=>s+subPaid(m),0));
  // متاح للتعميد الآن (لم يُبنَ له مستخلص بعد)
  const avail = round2(subItemIds(getSub(subId)).reduce((s,id)=>s+subAvailQty(subId,id)*subRate(getSub(subId),id),0));
  return { musCount: ms.length, net, paid, remaining: Math.max(0, round2(net-paid)), availValue: avail };
}
// من يعتمد مستخلصات مقاولي الباطن؟ العميل ومدير المشاريع والأدمن
const canApproveSubMus = () => ['admin','client','pmo'].includes(state.me.role);
const SUBMUS_STATUS = {
  submitted:{label:'⏳ بانتظار الاعتماد', color:'amber'},
  rejected:{label:'↩ مرفوض', color:'red'},
  approved:{label:'✅ معتمد', color:'blue'},
  paid:{label:'💵 مدفوع', color:'green'}
};

let subView = 'list';
function switchSubView(v){
  subView = v;
  $('sub-view-list').style.display = v === 'list' ? '' : 'none';
  $('sub-view-mus').style.display = v === 'mus' ? '' : 'none';
  $('sub-tab-list').classList.toggle('active', v === 'list');
  $('sub-tab-mus').classList.toggle('active', v === 'mus');
}

function renderSubs(){
  // شارة العدد + الإنذارات
  $('tc-subs').textContent = (proj().subcontractors||[]).length;
  const alerts = proj().subAlerts||[];
  const ab = $('tc-subs-alert');
  if (ab) { ab.textContent = alerts.length; ab.style.display = (alerts.length && canApproveSubMus()) ? '' : 'none'; }
  $('sub-mus-count').textContent = (proj().subMustakhlasat||[]).length;
  // بانر إنذارات التلاعب (للمعتمِدين)
  const banner = $('subs-alert-banner');
  if (banner) {
    if (canApproveSubMus() && alerts.length) {
      banner.innerHTML = '<div class="card red-b" style="margin-bottom:12px"><div class="sc-header"><div class="sc-icon" style="background:var(--red-dim)">🚨</div>' +
        '<div><div style="font-weight:700;color:var(--red)">' + T('إنذارات محاولات تجاوز كميات مقاولي الباطن') + ' (' + alerts.length + ')</div>' +
        '<div style="font-size:11px;color:var(--text2)">' + T('حاول مدير المشروع تعميد كمية أكبر من المنفذ فعلاً — مُنعت تلقائياً') + '</div></div>' +
        '<button class="mini-btn" style="margin-inline-start:auto" onclick="clearSubAlerts()">' + T('مسح') + '</button></div>' +
        '<div style="margin-top:8px;font-size:12px;display:flex;flex-direction:column;gap:4px">' +
        alerts.slice(-6).reverse().map(a => '• ' + esc(a.at||'') + ' — ' + esc(a.by||'') + ': ' + T('بند') + ' ' + esc(a.itemId) + ' ' + T('لمقاول «') + esc(a.subName||'') + T('» حاول ') + fmtQ(a.attempted) + ' ' + T('والمتاح') + ' ' + fmtQ(a.max)).join('') +
        '</div></div>';
    } else banner.innerHTML = '';
  }
  // البطاقات
  const canManage = isManagerial() || ['pmo','pm'].includes(state.me.role);
  $('sub-add-btn').style.display = canManage ? '' : 'none';
  const cards = (proj().subcontractors||[]).map(s => {
    const d = subDueSummary(s.id);
    return '<div class="card" style="cursor:default">' +
      '<div class="sc-header"><div class="sc-icon" style="background:var(--blue-dim,rgba(88,166,255,0.15))">🧱</div>' +
      '<div><div style="font-weight:700">' + esc(s.name) + '</div>' +
      '<div style="font-size:11px;color:var(--text2)">' + (s.phone?esc(s.phone)+' · ':'') + (s.items||[]).length + ' ' + T('بند') + ' · ' + T('حجز') + ' ' + (s.retentionRate!=null?s.retentionRate:10) + '%</div></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px;margin-top:8px;font-size:12px">' +
      '<div class="sc-item"><span class="sc-item-name">' + T('متاح للتعميد الآن') + '</span><span class="sc-item-val" style="color:var(--green-bright)">' + money(d.availValue) + '</span></div>' +
      '<div class="sc-item"><span class="sc-item-name">' + T('صافي مستخلصاته') + '</span><span class="sc-item-val">' + money(d.net) + '</span></div>' +
      '<div class="sc-item"><span class="sc-item-name">' + T('مدفوع') + '</span><span class="sc-item-val" style="color:var(--teal)">' + money(d.paid) + '</span></div>' +
      '<div class="sc-item"><span class="sc-item-name">' + T('متبقٍ للصرف') + '</span><span class="sc-item-val" style="color:var(--red)">' + money(d.remaining) + '</span></div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">' +
      (canManage ? '<button class="mini-btn green" onclick="openSubDetail(' + s.id + ')">📂 ' + T('فتح الصفحة وبناء مستخلص') + '</button>' : '') +
      (canManage ? '<button class="mini-btn" onclick="openSubEdit(' + s.id + ')">✏️ ' + T('تعديل') + '</button>' : '') +
      (isManagerial() ? '<button class="mini-btn red" onclick="deleteSub(' + s.id + ')">🗑</button>' : '') +
      '</div></div>';
  }).join('') || '<div class="empty-state"><div class="icon">🧱</div><p>' + T('لا يوجد مقاولو باطن — أضف أول مقاول') + '</p></div>';
  $('subs-cards').innerHTML = cards;
  renderSubMusTable();
}

function clearSubAlerts(){ if (!canApproveSubMus()) return; proj().subAlerts = []; save(); renderAll(); }

function renderSubMusTable(){
  const ms = [...(proj().subMustakhlasat||[])].sort((a,b)=> (b.date||'').localeCompare(a.date||'') || b.id-a.id);
  const totNet = round2(ms.filter(m=>m.status!=='rejected').reduce((s,m)=>s+(m.net||0),0));
  const totPaid = round2(ms.reduce((s,m)=>s+subPaid(m),0));
  $('submus-kpis').innerHTML = [
    {label:'عدد المستخلصات', value:ms.length, color:'amber', sub:''},
    {label:'إجمالي صافي المستحق', value:money(totNet), color:'blue', sub:T('بعد الحجز والخصومات')},
    {label:'💵 المدفوع', value:money(totPaid), color:'green', sub:''},
    {label:'متبقٍ للصرف', value:money(Math.max(0,round2(totNet-totPaid))), color:'red', sub:''}
  ].map(k => '<div class="kpi-card ' + k.color + '"><div class="kpi-label">' + T(k.label) + '</div><div class="kpi-value ' + k.color + '">' + k.value + '</div><div class="kpi-sub">' + k.sub + '</div></div>').join('');
  $('submus-tbody').innerHTML = ms.map(m => {
    const sub = getSub(m.subId); const st = SUBMUS_STATUS[m.status]||SUBMUS_STATUS.submitted;
    const paid = subPaid(m); const nAtt = (m.docs||[]).length;
    let btns = '<button class="mini-btn" onclick="viewSubMus(' + m.id + ')">📄 ' + T('عرض') + '</button> ';
    if (canApproveSubMus()) {
      if (m.status === 'submitted') btns += '<button class="mini-btn green" onclick="approveSubMus(' + m.id + ')">✅ ' + T('اعتماد') + '</button> <button class="mini-btn red" onclick="rejectSubMus(' + m.id + ')">↩ ' + T('رفض') + '</button> ';
      if (['approved','paid'].includes(m.status)) btns += '<button class="mini-btn green" onclick="openSubPay(' + m.id + ')">💵 ' + T('اعتماد صرف') + '</button> ';
    }
    const canDel = isManagerial() || ['submitted','rejected'].includes(m.status);
    return '<tr>' +
      '<td><span class="item-no">' + esc(m.no) + '</span>' + (nAtt?'<br><span class="pill blue" style="font-size:9px">📎 ' + nAtt + '</span>':'') + '</td>' +
      '<td>' + esc(sub?sub.name:'—') + '</td>' +
      '<td style="font-family:var(--mono);font-size:12px">' + esc(m.date) + '</td>' +
      '<td>' + (m.lines||[]).length + '</td>' +
      '<td class="amount">' + fmtN(m.gross) + '</td>' +
      '<td class="amount muted">' + fmtN(round2((m.retention||0)+(m.dedTotal||0))) + '</td>' +
      '<td class="amount claimable">' + fmtN(m.net) + '</td>' +
      '<td class="amount" style="color:' + (paid>=m.net-1?'var(--green-bright)':paid>0?'var(--amber)':'var(--text3)') + '">' + (paid>0?fmtN(paid):'—') + '</td>' +
      '<td><span class="pill ' + st.color + '"' + (m.status==='rejected'&&m.rejectReason?' data-tip="'+esc(m.rejectReason)+'"':'') + '>' + T(st.label) + '</span></td>' +
      '<td style="white-space:nowrap">' + btns + (canDel?'<button class="mini-btn red" onclick="deleteSubMus(' + m.id + ')">🗑</button>':'') + '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="10"><div class="empty-state"><p>' + T('لا توجد مستخلصات مقاولي باطن بعد') + '</p></div></td></tr>';
}

// ---- إضافة/تعديل مقاول باطن ----
let editingSubId = null, subDraftItems = [];
function openSubEdit(id){
  const s = id ? getSub(id) : null;
  editingSubId = id;
  subDraftItems = s ? JSON.parse(JSON.stringify(s.items||[])) : [];
  $('sub-edit-title').textContent = s ? T('تعديل مقاول باطن') : T('إضافة مقاول باطن');
  $('sub-name').value = s ? s.name : '';
  $('sub-phone').value = s ? (s.phone||'') : '';
  $('sub-ret').value = s ? (s.retentionRate!=null?s.retentionRate:10) : 10;
  $('sub-note').value = s ? (s.note||'') : '';
  $('sub-item-id').value = ''; $('sub-item-search').value = ''; $('sub-item-rate').value = '';
  renderSubDraftItems();
  $('sub-edit-modal').classList.add('open');
}
function renderSubDraftItems(){
  $('sub-items-list').innerHTML = subDraftItems.length ? subDraftItems.map((r,i) => {
    const it = getItem(r.itemId);
    return '<div class="sc-item"><span class="sc-item-name" style="white-space:normal"><span class="item-no">' + esc(r.itemId) + '</span> ' + esc(it?it.desc.substring(0,40):T('(بند محذوف)')) + ' <span style="color:var(--text3)">(' + esc(it?it.unit:'') + ')</span></span>' +
      '<span style="display:flex;align-items:center;gap:8px"><span class="sc-item-val">' + fmtN(r.rate) + ' ' + T('ر.س') + '</span>' +
      '<button class="mini-btn red" onclick="subDraftItems.splice(' + i + ',1);renderSubDraftItems()">✕</button></span></div>';
  }).join('') : '<div style="color:var(--text3);font-size:12px;padding:6px">' + T('لم تُضف بنود بعد') + '</div>';
}
function subAddItemRate(){
  const itemId = $('sub-item-id').value;
  const rate = Number($('sub-item-rate').value);
  if (!itemId) { alert(T('اختر بنداً من القائمة')); return; }
  if (!rate || rate <= 0) { alert(T('أدخل السعر المتفق عليه')); return; }
  if (subDraftItems.some(r => r.itemId === itemId)) { alert(T('البند مضاف مسبقاً')); return; }
  subDraftItems.push({ itemId, rate });
  $('sub-item-id').value = ''; $('sub-item-search').value = ''; $('sub-item-rate').value = '';
  renderSubDraftItems();
}
function saveSub(){
  const name = $('sub-name').value.trim();
  if (!name) { alert(T('اكتب اسم مقاول الباطن')); return; }
  const data = { name, phone:$('sub-phone').value.trim(), retentionRate:clamp($('sub-ret').value,0,100), note:$('sub-note').value.trim(), items:subDraftItems };
  if (editingSubId) { Object.assign(getSub(editingSubId), data); }
  else { proj().subcontractors.push(Object.assign({id: nextSeq()}, data)); }
  closeModal('sub-edit-modal'); save(); renderAll();
}
function deleteSub(id){
  if (!isManagerial()) { alert(T('حذف مقاول الباطن صلاحية العميل أو الأدمن')); return; }
  const s = getSub(id); if (!s) return;
  if (subMusOf(id).length) { alert(T('لا يمكن حذف مقاول له مستخلصات — احذف مستخلصاته أولاً')); return; }
  if (!confirm(T('حذف مقاول الباطن «') + s.name + T('»؟'))) return;
  proj().subcontractors = proj().subcontractors.filter(x => x.id !== id);
  save(); renderAll();
}
Object.assign(I18N_EN, {
  'إنذارات محاولات تجاوز كميات مقاولي الباطن':'Subcontractor over-quantity attempt alerts',
  'حاول مدير المشروع تعميد كمية أكبر من المنفذ فعلاً — مُنعت تلقائياً':'The project manager tried to allocate a quantity greater than what was actually executed — automatically blocked',
  'مسح':'Clear',
  'لمقاول «':'for contractor «',
  '» حاول ':'» attempted ',
  'والمتاح':'and available',
  'حجز':'Retention',
  'متاح للتعميد الآن':'Available to allocate now',
  'صافي مستخلصاته':'Net of their claims',
  'مدفوع':'Paid',
  '💵 المدفوع':'💵 Paid',
  'متبقٍ للصرف':'Remaining to disburse',
  'فتح الصفحة وبناء مستخلص':'Open page and build a claim',
  'لا يوجد مقاولو باطن — أضف أول مقاول':'No subcontractors — add the first one',
  'بعد الحجز والخصومات':'After retention and deductions',
  '↩ مرفوض':'↩ Rejected',
  'اعتماد صرف':'Approve disbursement',
  'لا توجد مستخلصات مقاولي باطن بعد':'No subcontractor claims yet',
  'تعديل مقاول باطن':'Edit subcontractor',
  'إضافة مقاول باطن':'Add subcontractor',
  '(بند محذوف)':'(deleted item)',
  'ر.س':'SAR',
  'لم تُضف بنود بعد':'No items added yet',
  'اختر بنداً من القائمة':'Choose an item from the list',
  'أدخل السعر المتفق عليه':'Enter the agreed price',
  'البند مضاف مسبقاً':'Item already added',
  'اكتب اسم مقاول الباطن':'Enter the subcontractor name',
  'حذف مقاول الباطن صلاحية العميل أو الأدمن':'Deleting a subcontractor is restricted to the client or admin',
  'لا يمكن حذف مقاول له مستخلصات — احذف مستخلصاته أولاً':'Cannot delete a subcontractor with claims — delete their claims first',
  'حذف مقاول الباطن «':'Delete subcontractor «',
  '»؟':'»?'
});
// combobox لاختيار بند في نموذج المقاول
function subItemFilter(typing){
  const q = ($('sub-item-search').value||'').toLowerCase().trim();
  if (typing) $('sub-item-id').value = '';
  const items = proj().boqItems.filter(i => i.scope !== 'others' && !isParent(i) && !isSplitChild(i));
  const norm = s => String(s||'').toLowerCase();
  const list = q ? items.filter(i => norm(i.id).includes(q) || norm(i.desc).includes(q) || norm(i.divAr).includes(q)) : items;
  const box = $('sub-item-list');
  box.innerHTML = list.slice(0,50).map(i =>
    '<div class="combo-opt" onmousedown="event.preventDefault(); subItemPick(\'' + esc(i.id).replace(/\x27/g,"\\\x27") + '\')"><span class="co-code">' + esc(i.id) + '</span> ' + esc(i.desc) + ' <span class="co-unit">(' + esc(i.unit) + ')</span></div>').join('')
    || '<div class="combo-opt" style="color:var(--text3)">' + T('لا يوجد بند مطابق') + '</div>';
  box.style.display = 'block';
}
function subItemPick(id){ const it = getItem(id); if (!it) return; $('sub-item-id').value = id; $('sub-item-search').value = id + ' - ' + it.desc; $('sub-item-list').style.display = 'none'; }
function subItemBlur(){ setTimeout(()=>{ $('sub-item-list').style.display = 'none'; }, 160); }

// ---- صفحة مقاول الباطن: تعميد الكميات وبناء المستخلص ----
let sdSubId = null, sdSel = {}, sdPendingFiles = [];
function openSubDetail(id){
  const s = getSub(id); if (!s) return;
  sdSubId = id; sdSel = {}; sdPendingFiles = [];
  $('sub-detail-title').textContent = '📂 ' + s.name + ' — ' + T('تعميد الكميات وبناء المستخلص');
  $('sd-ret').value = s.retentionRate!=null?s.retentionRate:10;
  ['sd-materials','sd-utilities','sd-performance','sd-other'].forEach(k => $(k).value = 0);
  $('sd-date').value = todayStr();
  $('sd-files-list').innerHTML = '';
  renderSubDetail();
  $('sub-detail-modal').classList.add('open');
}
function renderSubDetail(){
  const s = getSub(sdSubId); if (!s) return;
  const ids = subItemIds(s);
  $('sub-detail-tbody').innerHTML = ids.map(id => {
    const it = getItem(id); const rate = subRate(s, id);
    const ex = subExecForItem(sdSubId, id), elig = subEligibleQty(sdSubId, id), claimed = subClaimedQty(sdSubId, id), avail = subAvailQty(sdSubId, id);
    const val = sdSel[id]!==undefined ? sdSel[id] : '';
    return '<tr>' +
      '<td><span class="item-no">' + esc(id) + '</span> <span style="font-size:11px;color:var(--text3)">' + esc(it.desc.substring(0,24)) + '</span></td>' +
      '<td><span class="pill gray" style="font-size:10px">' + esc(it.unit) + '</span></td>' +
      '<td class="amount muted">' + fmtN(rate) + '</td>' +
      '<td class="amount">' + fmtQ(ex) + '</td>' +
      '<td class="amount" style="color:var(--blue)">' + fmtQ(elig) + '</td>' +
      '<td class="amount muted">' + fmtQ(claimed) + '</td>' +
      '<td class="amount ' + (avail>0.01?'claimable':'muted') + '">' + fmtQ(avail) + '</td>' +
      '<td><input type="number" class="qty-input" min="0" max="' + avail + '" step="any" value="' + val + '" placeholder="0" oninput="sdSetQty(\'' + esc(id) + '\', this.value)" style="width:90px"></td>' +
      '<td class="amount">' + fmtN(round2((Number(val)||0)*rate)) + '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="9"><div class="empty-state"><p>' + T('لا بنود لهذا المقاول — أضف بنوده وأسعاره من «تعديل»') + '</p></div></td></tr>';
  renderSubMusTotals();
}
function sdSetQty(id, val){
  const s = getSub(sdSubId); const avail = subAvailQty(sdSubId, id);
  let q = Math.round((Number(val)||0)*100)/100;
  if (q > avail + 0.001) {
    // منع التلاعب: تجاوز المتاح (المنفذ المعتمد) — إنذار + تسجيل
    recordSubAlert(sdSubId, id, q, avail);
    alert(T('⛔ إنذار: لا يمكن تعميد كمية (') + fmtQ(q) + T(') أكبر من المتاح فعلاً (') + fmtQ(avail) + T(') لهذا المقاول في البند ') + id + T('. تم إبلاغ الإدارة.'));
    q = avail;
  }
  if (q <= 0) delete sdSel[id]; else sdSel[id] = q;
  renderSubDetail();
}
function recordSubAlert(subId, itemId, attempted, max){
  const s = getSub(subId);
  proj().subAlerts = proj().subAlerts || [];
  proj().subAlerts.push({ id: nextSeq(), subId, subName: s?s.name:'', itemId, attempted: round2(attempted), max: round2(max), by: currentUser().name, at: new Date().toISOString().slice(0,16).replace('T',' ') });
  save();
}
function subMusComputeDraft(){
  const s = getSub(sdSubId); const lines = [];
  Object.entries(sdSel).forEach(([id, q]) => {
    const qty = Number(q)||0; if (qty <= 0) return;
    const it = getItem(id); if (!it) return;
    const rate = subRate(s, id); const prev = subClaimedQty(sdSubId, id);
    lines.push({itemId:id, desc:it.desc, unit:it.unit, rate, prevQty:prev, currQty:qty, cumQty:round2(prev+qty), amount:round2(qty*rate)});
  });
  const gross = round2(lines.reduce((a,l)=>a+l.amount,0));
  const retRate = clamp($('sd-ret').value,0,100);
  const ded = { materials:Number($('sd-materials').value)||0, utilities:Number($('sd-utilities').value)||0, performance:Number($('sd-performance').value)||0, other:Number($('sd-other').value)||0 };
  const retention = round2(gross*retRate/100);
  const dedTotal = round2(ded.materials+ded.utilities+ded.performance+ded.other);
  const prevPaid = round2(subMusOf(sdSubId).filter(m=>m.status!=='rejected').reduce((a,m)=>a+(m.net||0),0));
  const net = round2(gross - retention - dedTotal);
  return {lines, gross, retRate, retention, ded, dedTotal, prevPaid, net};
}
function renderSubMusTotals(){
  const c = subMusComputeDraft();
  $('sd-totals').innerHTML =
    '<div class="sc-item"><span class="sc-item-name">' + T('قيمة الأعمال') + ' (' + c.lines.length + ' ' + T('بند') + ')</span><span class="sc-item-val" style="color:var(--green-bright)">' + money(c.gross) + '</span></div>' +
    '<div class="sc-item"><span class="sc-item-name">− ' + T('حجز جودة') + ' ' + c.retRate + '%</span><span class="sc-item-val" style="color:var(--red)">' + money(c.retention) + '</span></div>' +
    (c.ded.materials?'<div class="sc-item"><span class="sc-item-name">− ' + T('مواد') + '</span><span class="sc-item-val" style="color:var(--red)">' + money(c.ded.materials) + '</span></div>':'') +
    (c.ded.utilities?'<div class="sc-item"><span class="sc-item-name">− ' + T('كهرباء وماء') + '</span><span class="sc-item-val" style="color:var(--red)">' + money(c.ded.utilities) + '</span></div>':'') +
    (c.ded.performance?'<div class="sc-item"><span class="sc-item-name">− ' + T('سوء أداء/غرامات') + '</span><span class="sc-item-val" style="color:var(--red)">' + money(c.ded.performance) + '</span></div>':'') +
    (c.ded.other?'<div class="sc-item"><span class="sc-item-name">− ' + T('خصومات أخرى') + '</span><span class="sc-item-val" style="color:var(--red)">' + money(c.ded.other) + '</span></div>':'') +
    (c.prevPaid?'<div class="sc-item"><span class="sc-item-name" style="font-size:11px;color:var(--text3)">(' + T('سبق صرفه لهذا المقاول تراكمياً:') + ' ' + money(c.prevPaid) + ')</span><span></span></div>':'') +
    '<div class="sc-item"><span class="sc-item-name" style="font-weight:700">' + T('صافي مستحق هذا المستخلص') + '</span><span class="sc-item-val" style="color:var(--green-bright);font-size:15px;font-weight:700">' + money(c.net) + '</span></div>';
}
async function sdFilesPicked(input){
  const files = [...(input.files||[])].slice(0, 15 - sdPendingFiles.length);
  for (const f of files) {
    try {
      if (f.type === 'application/pdf') { if (f.size > 9*1024*1024) { alert(f.name+': '+T('أكبر من 9MB')); continue; } sdPendingFiles.push({dataUrl: await readFileAsDataURL(f), name:f.name}); }
      else if (f.type.startsWith('image/')) sdPendingFiles.push({dataUrl: await compressImage(f), name:f.name});
      else alert(f.name+': '+T('صيغة غير مدعومة'));
    } catch(e){ alert(e.message); }
  }
  input.value = '';
  $('sd-files-list').innerHTML = sdPendingFiles.map((f,i)=>'<div class="sc-item" style="padding:3px 0"><span class="sc-item-name" style="font-size:11px">' + (f.name.toLowerCase().endsWith('.pdf')?'📄':'🖼') + ' ' + esc(f.name) + '</span><button class="mini-btn red" onclick="sdPendingFiles.splice(' + i + ',1);sdFilesPicked({files:[]})">✕</button></div>').join('');
}
async function buildSubMus(){
  const c = subMusComputeDraft();
  if (!c.lines.length) { alert(T('عمّد كمية بند واحد على الأقل')); return; }
  if (offlineMode) { alert(T('📴 لا يمكن البناء بدون اتصال')); return; }
  // فحص أمان أخير: لا تجاوز للمتاح
  for (const l of c.lines) {
    if (l.currQty > subAvailQty(sdSubId, l.itemId) + 0.01) { alert(T('⛔ كمية البند ') + l.itemId + T(' تتجاوز المتاح')); return; }
  }
  if (!sdPendingFiles.length) { alert(T('⛔ المرفقات إلزامية: أرفق المستخلص المعمول من قِبل الشركة واعتمادات الاستشاري قبل الرفع (تُحفظ في أرشيف المشروع).')); return; }
  if (!confirm(T('بناء مستخلص مقاول الباطن بصافي ') + money(c.net) + T(' ورفعه للاعتماد؟'))) return;
  let docs = [];
  if (sdPendingFiles.length) {
    try { for (const f of sdPendingFiles) { const r = await API.req('POST', '/api/projects/' + proj().id + '/photos', {dataUrl:f.dataUrl}); docs.push({url:r.url, name:f.name}); } }
    catch(e){ alert(T('تعذر رفع المرفقات:') + ' ' + e.message); return; }
  }
  const s = getSub(sdSubId);
  const no = 'SUB-' + String((proj().subMustakhlasat||[]).length + 1).padStart(3,'0');
  proj().subMustakhlasat.push({
    id: nextSeq(), no, subId: sdSubId, date: $('sd-date').value || todayStr(), status:'submitted',
    lines:c.lines, gross:c.gross, retRate:c.retRate, retention:c.retention, ded:c.ded, dedTotal:c.dedTotal,
    prevPaid:c.prevPaid, net:c.net, docs, payments:[], by: currentUser().name, createdAt: new Date().toISOString()
  });
  closeModal('sub-detail-modal'); save(); renderAll(); switchSubView('mus');
  setTimeout(()=>alert(T('✅ تم رفع مستخلص مقاول الباطن للاعتماد.')), 200);
}

// ---- عرض/اعتماد/صرف مستخلص مقاول الباطن ----
function subMusDocHtml(m){
  const sub = getSub(m.subId);
  const rows = (m.lines||[]).map(l => '<tr><td style="text-align:right">' + esc(l.itemId) + ' — ' + esc(l.desc) + '</td><td style="text-align:center">' + esc(l.unit) + '</td><td style="text-align:center;font-family:var(--mono)">' + fmtN(l.rate) + '</td><td style="text-align:center;font-family:var(--mono)">' + fmtQ(l.currQty) + '</td><td style="text-align:center;font-family:var(--mono)">' + fmtN(l.amount) + '</td></tr>').join('');
  const dedRows = [];
  if (m.retention) dedRows.push([T('حجز جودة') + ' ' + m.retRate + '%', m.retention]);
  if (m.ded && m.ded.materials) dedRows.push([T('خصم مواد'), m.ded.materials]);
  if (m.ded && m.ded.utilities) dedRows.push([T('كهرباء وماء'), m.ded.utilities]);
  if (m.ded && m.ded.performance) dedRows.push([T('سوء أداء/غرامات'), m.ded.performance]);
  if (m.ded && m.ded.other) dedRows.push([T('خصومات أخرى'), m.ded.other]);
  const docsHtml = (m.docs||[]).length ? '<div style="margin-top:10px"><strong>' + T('المرفقات والتسوية:') + '</strong><br>' + m.docs.map(d=>'<a href="' + esc(d.url) + '" target="_blank" style="color:var(--blue);font-size:12px">' + (String(d.url).endsWith('.pdf')?'📄':'🖼') + ' ' + esc(d.name||T('ملف')) + ' ↗</a>').join('<br>') + '</div>' : '<div style="margin-top:10px;color:var(--red);font-size:12px">⚠ ' + T('لا مرفقات') + '</div>';
  return '<div style="font-family:var(--font)"><div style="font-size:14px;font-weight:700;margin-bottom:4px">' + T('مستخلص مقاول باطن') + ' ' + esc(m.no) + '</div>' +
    '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">' + T('المقاول:') + ' ' + esc(sub?sub.name:'—') + ' · ' + T('التاريخ:') + ' ' + esc(m.date) + ' · ' + T('أعدّه:') + ' ' + esc(m.by||'—') + '</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--bg2)"><th style="text-align:right;padding:5px">' + T('البند') + '</th><th>' + T('الوحدة') + '</th><th>' + T('السعر') + '</th><th>' + T('الكمية') + '</th><th>' + T('القيمة') + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">' +
    '<tr><td style="text-align:right;padding:4px"><strong>' + T('قيمة الأعمال') + '</strong></td><td style="text-align:left;font-family:var(--mono)">' + fmtN(m.gross) + '</td></tr>' +
    dedRows.map(d=>'<tr><td style="text-align:right;padding:4px;color:var(--red)">− ' + esc(d[0]) + '</td><td style="text-align:left;font-family:var(--mono);color:var(--red)">' + fmtN(d[1]) + '</td></tr>').join('') +
    '<tr style="background:var(--green-dim)"><td style="text-align:right;padding:6px"><strong style="color:var(--green-bright)">' + T('صافي المستحق') + '</strong></td><td style="text-align:left;font-family:var(--mono);font-weight:700;color:var(--green-bright)">' + fmtN(m.net) + '</td></tr>' +
    (m.prevPaid?'<tr><td style="text-align:right;padding:4px;font-size:11px;color:var(--text3)">' + T('سبق صرفه تراكمياً') + '</td><td style="text-align:left;font-family:var(--mono);font-size:11px;color:var(--text3)">' + fmtN(m.prevPaid) + '</td></tr>':'') +
    '</table>' + docsHtml + '</div>';
}
function viewSubMus(id){ const m = (proj().subMustakhlasat||[]).find(x=>x.id===id); if (m) showPrintable(T('مستخلص مقاول باطن') + ' ' + m.no, subMusDocHtml(m)); }
function approveSubMus(id){
  if (!canApproveSubMus()) { alert(T('اعتماد مستخلصات مقاولي الباطن صلاحية العميل ومدير المشاريع')); return; }
  const m = (proj().subMustakhlasat||[]).find(x=>x.id===id); if (!m || m.status!=='submitted') return;
  if (!confirm(T('اعتماد مستخلص ') + m.no + T(' بصافي ') + money(m.net) + T('؟ راجع الأوراق والتسوية قبل الاعتماد.'))) return;
  m.status = 'approved'; m.approvedBy = currentUser().name; m.approvedAt = todayStr(); m.rejectReason = '';
  save(); renderAll();
}
function rejectSubMus(id){
  if (!canApproveSubMus()) return;
  const m = (proj().subMustakhlasat||[]).find(x=>x.id===id); if (!m) return;
  const reason = prompt(T('سبب الرفض (يظهر لمدير المشروع):')); if (reason===null) return;
  m.status = 'rejected'; m.rejectReason = reason.trim()||T('يحتاج تعديل'); m.approvedBy = currentUser().name; m.approvedAt = todayStr();
  save(); renderAll();
}
let subPayId = null;
function openSubPay(id){
  if (!canApproveSubMus()) { alert(T('اعتماد الصرف صلاحية العميل ومدير المشاريع')); return; }
  const m = (proj().subMustakhlasat||[]).find(x=>x.id===id); if (!m) return;
  subPayId = id; const paid = subPaid(m);
  $('subpay-info').textContent = m.no + ' — ' + T('صافي') + ' ' + money(m.net) + ' · ' + T('مدفوع') + ' ' + money(paid) + ' · ' + T('متبقٍ') + ' ' + money(Math.max(0,round2(m.net-paid)));
  $('subpay-date').value = todayStr();
  $('subpay-amount').value = Math.max(0, round2(m.net - paid));
  $('subpay-note').value = '';
  $('subpay-modal').classList.add('open');
}
function saveSubPay(){
  const m = (proj().subMustakhlasat||[]).find(x=>x.id===subPayId); if (!m) return;
  const amount = Number($('subpay-amount').value);
  if (!amount || amount <= 0) { alert(T('اكتب مبلغ الصرف')); return; }
  const paid = subPaid(m);
  if (amount > round2(m.net - paid) + 0.01) { if (!confirm(T('المبلغ أكبر من المتبقٍ — متابعة؟'))) return; }
  m.payments.push({id:nextSeq(), date:$('subpay-date').value||todayStr(), amount:round2(amount), note:$('subpay-note').value.trim(), by:currentUser().name});
  if (subPaid(m) >= m.net - 1) m.status = 'paid';
  closeModal('subpay-modal'); save(); renderAll();
}
function deleteSubMus(id){
  const m = (proj().subMustakhlasat||[]).find(x=>x.id===id); if (!m) return;
  if (!isManagerial() && !['submitted','rejected'].includes(m.status)) { alert(T('لا يمكن حذف مستخلص معتمد — راجع الإدارة')); return; }
  if (!confirm(T('حذف مستخلص ') + m.no + T('؟ سترجع كمياته للمتاح.'))) return;
  proj().subMustakhlasat = proj().subMustakhlasat.filter(x=>x.id!==id);
  save(); renderAll();
}
Object.assign(I18N_EN, {
  'تعميد الكميات وبناء المستخلص':'Allocate quantities and build a claim',
  'لا بنود لهذا المقاول — أضف بنوده وأسعاره من «تعديل»':'No items for this subcontractor — add their items and rates from "Edit"',
  '⛔ إنذار: لا يمكن تعميد كمية (':'⛔ Alert: cannot allocate a quantity (',
  ') أكبر من المتاح فعلاً (':') greater than what is actually available (',
  ') لهذا المقاول في البند ':') for this subcontractor on item ',
  '. تم إبلاغ الإدارة.':'. Admin has been notified.',
  'حجز جودة':'Quality retention',
  'مواد':'Materials',
  'كهرباء وماء':'Electricity & water',
  'سوء أداء/غرامات':'Poor performance/penalties',
  'خصومات أخرى':'Other deductions',
  'سبق صرفه لهذا المقاول تراكمياً:':'Previously disbursed to this subcontractor (cumulative):',
  'صافي مستحق هذا المستخلص':'Net due for this claim',
  'صيغة غير مدعومة':'Unsupported format',
  'عمّد كمية بند واحد على الأقل':'Allocate a quantity for at least one item',
  '📴 لا يمكن البناء بدون اتصال':'📴 Cannot build while offline',
  '⛔ كمية البند ':'⛔ Quantity for item ',
  ' تتجاوز المتاح':' exceeds what is available',
  '⛔ المرفقات إلزامية: أرفق المستخلص المعمول من قِبل الشركة واعتمادات الاستشاري قبل الرفع (تُحفظ في أرشيف المشروع).':'⛔ Attachments are mandatory: attach the claim prepared by the company and the consultant approvals before submitting (stored in the project archive).',
  'بناء مستخلص مقاول الباطن بصافي ':'Build the subcontractor claim with net ',
  ' ورفعه للاعتماد؟':' and submit it for approval?',
  '✅ تم رفع مستخلص مقاول الباطن للاعتماد.':'✅ The subcontractor claim was submitted for approval.',
  'خصم مواد':'Materials deduction',
  'المرفقات والتسوية:':'Attachments and settlement:',
  'لا مرفقات':'No attachments',
  'مستخلص مقاول باطن':'Subcontractor claim',
  'المقاول:':'Subcontractor:',
  'أعدّه:':'Prepared by:',
  'سبق صرفه تراكمياً':'Previously disbursed (cumulative)',
  'اعتماد مستخلصات مقاولي الباطن صلاحية العميل ومدير المشاريع':'Approving subcontractor claims is restricted to the client and projects manager',
  'اعتماد مستخلص ':'Approve claim ',
  ' بصافي ':' with net ',
  '؟ راجع الأوراق والتسوية قبل الاعتماد.':'? Review the documents and settlement before approving.',
  'سبب الرفض (يظهر لمدير المشروع):':'Reason for rejection (shown to the project manager):',
  'اعتماد الصرف صلاحية العميل ومدير المشاريع':'Approving disbursement is restricted to the client and projects manager',
  'صافي':'Net',
  'متبقٍ':'Remaining',
  'اكتب مبلغ الصرف':'Enter the disbursement amount',
  'المبلغ أكبر من المتبقٍ — متابعة؟':'The amount is greater than what remains — continue?',
  'لا يمكن حذف مستخلص معتمد — راجع الإدارة':'An approved claim cannot be deleted — contact admin',
  'حذف مستخلص ':'Delete claim ',
  '؟ سترجع كمياته للمتاح.':'? Its quantities will be returned to the available balance.'
});

function rejectEditRequest(id){
  if (!canApproveEdits()) { alert(T('رفض التعديلات صلاحية مالك الشركة فقط')); return; }
  const r = (proj().editRequests||[]).find(x => x.id === id);
  if (!r || r.status !== 'pending') return;
  const reason = prompt(T('سبب رفض الطلب (اختياري):')) || '';
  r.status = 'rejected'; r.rejectedBy = currentUser().name; r.rejectReason = reason; r.rejectedAt = new Date().toISOString();
  save(); renderAll();
}

// صندوق طلبات التعديل: مالك الشركة يقبل فيُطبَّق أو يرفض؛ ومدير المشروع يرى حالة طلباته
function renderEditRequests(){
  const box = $('edit-requests-box'); if (!box) return;
  const pend = pendingEditRequests();
  if (canApproveEdits()) {
    if (!pend.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="card" style="margin-bottom:14px;border:1px solid rgba(240,136,62,0.5)">' +
      '<div style="font-weight:700">🔔 ' + T('طلبات تعديل الإنتاجية بانتظار موافقتك') + ' (' + pend.length + ')</div>' +
      '<div style="font-size:11px;color:var(--text2);margin-top:2px">' + T('لن يُطبَّق أي تعديل أو حذف من مدير المشروع إلا بموافقتك — الموافقة تُطبِّق فوراً والرفض يُبقي كل شيء كما هو') + '</div>' +
      '<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">' +
      pend.map(r =>
        '<div style="border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px">' +
        '<div style="font-size:13px">' + esc(r.label||r.type) + '</div>' +
        (r.reason ? '<div style="font-size:12px;color:var(--text2)">' + T('السبب') + ': ' + esc(r.reason) + '</div>' : '') +
        '<div style="font-size:11px;color:var(--text3)">' + T('مقدّم الطلب') + ': ' + esc(r.by||'—') + ' · ' + esc((r.createdAt||'').slice(0,16).replace('T',' ')) + '</div>' +
        '<div style="display:flex;gap:6px">' +
        '<button class="mini-btn green" onclick="approveEditRequest(' + r.id + ')">✅ ' + T('موافقة وتطبيق') + '</button>' +
        '<button class="mini-btn red" onclick="rejectEditRequest(' + r.id + ')">✖ ' + T('رفض') + '</button>' +
        '</div></div>').join('') + '</div></div>';
  } else if (editsGated()) {
    const pendMine = (proj().editRequests||[]).filter(r => r.byId === state.me.id && r.status === 'pending');
    if (!pendMine.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="alert info" style="font-size:12px"><strong>' + T('طلبات بانتظار موافقة مالك الشركة') + ' (' + pendMine.length + ')</strong><br>' +
      pendMine.map(r => '• ' + esc(r.label||r.type)).join('<br>') + '</div>';
  } else { box.innerHTML = ''; }
}

Object.assign(I18N_EN, {
  'حذف يومية':'Delete work log', 'بند':'item',
  '📨 تم إرسال الطلب إلى مالك الشركة — لن يُطبَّق أي تغيير أو حذف إلا بعد موافقته.':'📨 Request sent to the company owner — no change or deletion is applied until they approve it.',
  'اعتماد التعديلات والحذف صلاحية مالك الشركة فقط':'Approving edits and deletions is restricted to the company owner',
  'رفض التعديلات صلاحية مالك الشركة فقط':'Rejecting edits is restricted to the company owner',
  'سبب رفض الطلب (اختياري):':'Reason for rejection (optional):',
  'طلبات تعديل الإنتاجية بانتظار موافقتك':'Productivity edit requests awaiting your approval',
  'لن يُطبَّق أي تعديل أو حذف من مدير المشروع إلا بموافقتك — الموافقة تُطبِّق فوراً والرفض يُبقي كل شيء كما هو':'No edit or deletion from the project manager is applied without your approval — approving applies it immediately, rejecting keeps everything as is',
  'السبب':'Reason', 'مقدّم الطلب':'Requested by', 'موافقة وتطبيق':'Approve & apply', 'رفض':'Reject',
  'طلبات بانتظار موافقة مالك الشركة':'Requests awaiting the company owner\'s approval',
  '📨 يوجد طلب مشابه بانتظار موافقة مالك الشركة بالفعل.':'📨 A similar request is already pending the company owner\'s approval.',
  'تعديل سعر الوحدة للبند':'Edit unit price for item',
  'تعديل الكمية الكلية للبند':'Edit total quantity for item',
  'تعديل الكمية المنفذة للبند':'Edit executed quantity for item',
  'أدمن':'Admin',
  'الكمية تُضاف تلقائياً إلى نسبة إنجاز البند (والوحدة إذا محددة) وتظهر للاستشاري ضمن «بانتظار الاعتماد».':'The quantity is automatically added to the item\'s completion percentage (and the unit, if specified) and appears to the consultant as "pending approval".',
  'طلب حذف (يحتاج موافقة مالك الشركة)':'Deletion request (requires the company owner\'s approval)',
  'تسجيل البند كمنجز 100% — يُسجَّل الباقي يوميةً باسمك ويتحول البند لانتظار اعتماد الاستشاري':'Mark the item 100% done — the remainder is logged in your name and the item moves to pending consultant approval',
  'منجز':'Done', 'إعلان إنجاز البند':'Item completion declaration',
  'تسجيل البند كمنجز 100%؟':'Mark this item as 100% done?',
  'سيُسجَّل الباقي':'The remainder will be logged',
  'يوميةً باسمك، ويتحول البند إلى بانتظار اعتماد الاستشاري.':'as a work log in your name, and the item moves to pending consultant approval.',
  'البند منفذ 100% أصلاً.':'The item is already 100% executed.',
  'تسجيل البند كمنجز 100% (الكمية المتبقية)':'Item marked 100% done (remaining quantity)',
  '✔ البند الآن منفذ 100% وبانتظار اعتماد الاستشاري (اعتماد + استلام موقّع).':'✔ The item is now 100% executed and pending consultant approval (approval + signed receipt).'
});
