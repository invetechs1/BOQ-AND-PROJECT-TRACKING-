'use strict';
// ============================================================
//  DASHBOARD
// ============================================================
function renderKPIs(){
  const t = totals();
  const progressPct = t.azoomScope > 0 ? (t.executed / t.azoomScope * 100) : 0;
  const kpis = [
    {label:'قيمة نطاق أعمالنا', value:money(t.azoomScope), color:'amber', sub:T('من إجمالي البنود') + ' ' + money(t.contract)},
    {label:'قيمة الأعمال المنفذة', value:money(t.executed), color:'blue', sub:T('نسبة الإنجاز') + ' ' + progressPct.toFixed(1) + '%'},
    {label:'🕵 بانتظار اعتماد الاستشاري', value:money(t.pendingApproval), color:'orange', sub:t.pendingApprovalCount + ' ' + T('بند - منفذ يحتاج اعتماد + استلام')},
    {label:'✅ جاهز للرفع الآن (صافي)', value:money(t.net), color:'green', sub:actionableItems().filter(i=>netClaimable(i)>1).length + ' ' + T('بند - المعتمد ناقص المرفوع')},
    {label:'مرفوع بمستخلصات سابقة', value:money(t.claimed), color:'teal', sub:proj().mustakhlasat.length + ' ' + T('مستخلص')},
    {label:'محجوب بعوائق وتسلسل', value:money(t.locked), color:'red', sub:T('قيمة الأعمال غير الممكنة حالياً')},
    {label:'💵 محصل نقداً', value:money(t.collected), color:'teal', sub:T('متبقي تحصيله') + ' ' + money(Math.max(0, t.musNet - t.collected)) + ' ' + T('من المستخلصات')},
    {label:'خارج نطاقنا (منفذ سابقاً)', value:money(t.othersVal), color:'purple', sub:T('لا مطالبة عليها')}
  ];
  $('kpi-grid').innerHTML = kpis.map(k =>
    '<div class="kpi-card ' + k.color + '"><div class="kpi-label">' + T(k.label) + '</div><div class="kpi-value ' + k.color + '">' + k.value + '</div><div class="kpi-sub">' + k.sub + '</div></div>'
  ).join('');
}
Object.assign(I18N_EN, {
  'قيمة نطاق أعمالنا':'Value of our scope',
  'من إجمالي البنود':'of total items',
  'قيمة الأعمال المنفذة':'Value of executed work',
  'نسبة الإنجاز':'Progress',
  'مرفوع بمستخلصات سابقة':'Claimed in previous claims',
  'مستخلص':'claim',
  '✅ جاهز للرفع الآن (صافي)':'✅ Ready to claim now (net)',
  'بند - المنفذ ناقص المرفوع':'item(s) - executed minus claimed',
  'محجوب بعوائق وتسلسل':'Locked by blockers and sequence',
  'قيمة الأعمال غير الممكنة حالياً':'Value of work not currently possible',
  '💵 محصل نقداً':'💵 Collected in cash',
  'متبقي تحصيله':'Remaining to collect',
  'من المستخلصات':'from claims',
  'خارج نطاقنا (منفذ سابقاً)':'Out of our scope (previously done)',
  'لا مطالبة عليها':'No claim applies',
  '🕵 بانتظار اعتماد الاستشاري':'🕵 Awaiting consultant approval',
  'بند - منفذ يحتاج اعتماد + استلام':'item(s) - executed, needs approval + receipt',
  'بند - المعتمد ناقص المرفوع':'item(s) - approved minus claimed'
});

function renderCharts(){
  // by division: executed vs total (azoom scope)
  const divs = {};
  actionableItems().forEach(it => {
    if (it.scope === 'others') return;
    if (!divs[it.div]) divs[it.div] = {name:it.divAr, total:0, exec:0, net:0};
    divs[it.div].total += amt(it);
    divs[it.div].exec += itemPct(it) * amt(it);
    divs[it.div].net += netClaimable(it);
  });
  const maxT = Math.max(1, ...Object.values(divs).map(d => d.total));
  $('div-chart').innerHTML = Object.entries(divs).map(([dv,d]) => {
    const p = d.total > 0 ? d.exec/d.total*100 : 0;
    const label = p >= 8 ? p.toFixed(0) + '%' : '';
    return '<div class="bar-row"><div class="bar-label">' + esc(dv) + ' - ' + esc(d.name) + '</div>' +
      '<div class="bar-track" style="width:' + Math.max(20, d.total/maxT*100) + '%"><div class="bar-fill" style="width:' + p + '%;background:linear-gradient(90deg,var(--green),var(--teal))">' + label + '</div></div>' +
      '<div class="bar-amount">' + fmtN(d.exec) + ' / ' + fmtN(d.total) + '</div></div>';
  }).join('') || '<div class="empty-state"><p>' + T('لا توجد بيانات') + '</p></div>';

  // by status
  const stG = {};
  actionableItems().forEach(it => {
    const st = statusOf(it);
    if (!stG[st]) stG[st] = 0;
    stG[st] += amt(it);
  });
  const maxS = Math.max(1, ...Object.values(stG));
  const colorVar = {others:'var(--text3)', by_client:'var(--purple)', blocked:'var(--red)', waiting:'var(--orange)', available:'var(--blue)', partial:'var(--amber)', done:'var(--green)', claimed_full:'var(--teal)'};
  const order = ['done','claimed_full','partial','available','waiting','blocked','by_client','others'];
  $('status-chart').innerHTML = order.filter(st => stG[st]).map(st => {
    const m = STATUS_META[st];
    return '<div class="bar-row"><div class="bar-label">' + m.icon + ' ' + T(m.label) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + (stG[st]/maxS*100) + '%;background:' + colorVar[st] + '"></div></div>' +
      '<div class="bar-amount">' + money(stG[st]) + '</div></div>';
  }).join('');
}

function renderAlerts(){
  const t = totals();
  const blockedItems = actionableItems().filter(i => statusOf(i) === 'blocked');
  const reasons = [...new Set(blockedItems.map(i => i.blocker.reason))];
  let html = '';
  // تنبيه المراجع: مستخلصات بانتظار الاعتماد
  const pendingMus = proj().mustakhlasat.filter(m => m.status === 'submitted');
  if (canReviewMus() && pendingMus.length) {
    html += '<div class="alert warning">🔔 <div><strong>' + pendingMus.length + ' ' + T('مستخلص بانتظار مراجعتك واعتمادك') + '</strong> (' + money(pendingMus.reduce((s,m)=>s+m.gross,0)) + ') — <a href="#" onclick="switchTab(\'invoice\');switchInvView(\'history\');return false" style="color:var(--amber);font-weight:700">' + T('افتح المستخلصات ←') + '</a></div></div>';
  }
  const myRejected = proj().mustakhlasat.filter(m => m.status === 'rejected');
  if (state.me.role === 'pm' && myRejected.length) {
    html += '<div class="alert danger">↩ <div><strong>' + myRejected.length + ' ' + T('مستخلص معاد لك للتعديل') + '</strong> — ' + T('راجع سبب الإرجاع، احذفه وأعد رفعه بعد التصحيح.') + '</div></div>';
  }
  if (t.pendingApprovalCount) html += '<div class="alert warning">🕵 <div><strong>' + t.pendingApprovalCount + ' ' + T('بند بانتظار اعتماد الاستشاري') + '</strong> (' + money(t.pendingApproval) + ') — ' + T('منفذ ميدانياً ولا يمكن رفعه بمستخلص قبل اعتماد الاستشاري وإرفاق الاستلام الموقّع.') + ' <a href="#" onclick="switchTab(\'items\');setFilter(\'pending_approval\');return false" style="color:var(--amber);font-weight:700">' + T('اعرض البنود ←') + '</a></div></div>';
  if (t.net > 1) html += '<div class="alert success">✅ <div>' + T('عندك') + ' <strong>' + money(t.net) + '</strong> ' + T('معتمدة وجاهزة للرفع الآن — روح لتبويب المستخلصات.') + '</div></div>';
  if (blockedItems.length) html += '<div class="alert danger">⛔ <div><strong>' + blockedItems.length + ' ' + T('بند') + '</strong> ' + T('موقوف بعوائق خارجية') + ' (' + reasons.map(esc).join('، ') + ') — ' + T('راجع تبويب العوائق للأثر المالي.') + '</div></div>';
  const stale = actionableItems().filter(i => statusOf(i) === 'available');
  if (stale.length) html += '<div class="alert warning">▶ <div><strong>' + stale.length + ' ' + T('بند') + '</strong> ' + T('متاح تبدأ فيه الحين بدون أي عائق — بقيمة') + ' ' + money(stale.reduce((s,i)=>s+remainingValue(i),0)) + '.</div></div>';
  $('alerts-area').innerHTML = html;
}

function renderClaimSummary(){
  const t = totals();
  const vat = t.net * proj().info.vatRate/100;
  $('claim-summary').innerHTML =
    '<div class="sc-item"><span class="sc-item-name">' + T('إجمالي المنفذ ميدانياً') + '</span><span class="sc-item-val" style="color:var(--blue)">' + money(t.executed) + '</span></div>' +
    '<div class="sc-item"><span class="sc-item-name">' + T('🕵 بانتظار اعتماد الاستشاري') + '</span><span class="sc-item-val" style="color:var(--orange)">' + money(t.pendingApproval) + '</span></div>' +
    '<div class="sc-item"><span class="sc-item-name">' + T('معتمد من الاستشاري') + '</span><span class="sc-item-val" style="color:var(--green)">' + money(t.approved) + '</span></div>' +
    '<div class="sc-item"><span class="sc-item-name">' + T('مرفوع بمستخلصات سابقة') + '</span><span class="sc-item-val" style="color:var(--teal)">− ' + money(t.claimed) + '</span></div>' +
    '<div class="sc-item"><span class="sc-item-name" style="font-weight:700">' + T('الصافي الجاهز للرفع') + '</span><span class="sc-item-val" style="color:var(--green-bright);font-size:13px">' + money(t.net) + '</span></div>' +
    '<div class="sc-item"><span class="sc-item-name">+ ' + T('ضريبة') + ' ' + proj().info.vatRate + '%</span><span class="sc-item-val">' + money(vat) + '</span></div>' +
    '<div class="sc-item"><span class="sc-item-name" style="font-weight:700">' + T('الإجمالي شامل الضريبة') + '</span><span class="sc-item-val" style="color:var(--green-bright);font-weight:700;font-size:13px">' + money(t.net + vat) + '</span></div>';
}
Object.assign(I18N_EN, {
  'لا توجد بيانات':'No data',
  'عندك':'You have',
  'جاهزة للرفع الآن — روح لتبويب المستخلصات.':'ready to claim now — go to the Claims tab.',
  'معتمدة وجاهزة للرفع الآن — روح لتبويب المستخلصات.':'approved and ready to claim now — go to the Claims tab.',
  'موقوف بعوائق خارجية':'blocked by external issues',
  'راجع تبويب العوائق للأثر المالي.':'check the Blockers tab for the financial impact.',
  'متاح تبدأ فيه الحين بدون أي عائق — بقيمة':'available to start now with no blockers — worth',
  'إجمالي المنفذ':'Total executed',
  'إجمالي المنفذ ميدانياً':'Total executed on site',
  '🕵 بانتظار اعتماد الاستشاري':'🕵 Awaiting consultant approval',
  'معتمد من الاستشاري':'Approved by consultant',
  'مرفوع بمستخلصات سابقة':'Claimed in previous claims',
  'الصافي الجاهز للرفع':'Net ready to claim',
  'ضريبة':'VAT',
  'الإجمالي شامل الضريبة':'Total including VAT',
  'مستخلص بانتظار مراجعتك واعتمادك':'claim(s) awaiting your review and approval',
  'افتح المستخلصات ←':'Open claims ←',
  'مستخلص معاد لك للتعديل':'claim(s) returned to you for correction',
  'راجع سبب الإرجاع، احذفه وأعد رفعه بعد التصحيح.':'Check the rejection reason, delete it and resubmit after correcting.',
  'بند بانتظار اعتماد الاستشاري':'item(s) awaiting consultant approval',
  'منفذ ميدانياً ولا يمكن رفعه بمستخلص قبل اعتماد الاستشاري وإرفاق الاستلام الموقّع.':'executed on site but cannot be claimed before consultant approval and a signed receipt attachment.',
  'اعرض البنود ←':'View items ←'
});

function quickBuildInvoice(){ switchTab('invoice'); switchInvView('new'); mbSelectAll(); }

// معدل الإنتاج اليومي لكل بند من سجل اليوميات
function itemLogRates(){
  const per = {};
  proj().workLogs.forEach(l => {
    if (!per[l.itemId]) per[l.itemId] = {qty:0, days:new Set()};
    per[l.itemId].qty += l.qty; per[l.itemId].days.add(l.date);
  });
  const out = {};
  Object.entries(per).forEach(([id,d]) => { out[id] = {qty:d.qty, days:d.days.size, rate: d.days.size ? d.qty/d.days.size : 0}; });
  return out;
}
