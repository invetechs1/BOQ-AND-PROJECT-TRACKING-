'use strict';
// ============================================================
//  BLOCKED TAB
// ============================================================
function renderBlocked(){
  const blocked = actionableItems().filter(i => statusOf(i) === 'blocked');
  const groups = {};
  blocked.forEach(i => {
    const key = i.blocker.reason || T('غير محدد');
    if (!groups[key]) groups[key] = {type:i.blocker.type, items:[], down:new Set()};
    groups[key].items.push(i);
    downstreamSet(i.id, groups[key].down);
  });
  const typeLabels = {external:'عائق خارجي', material:'مواد غير متوفرة', client_supply:'توريد العميل', other:'أخرى'};
  const typeIcons = {external:'🕐', material:'📦', client_supply:'🚚', other:'⚠'};

  $('blocker-groups').innerHTML = Object.entries(groups).map(([reason,g]) => {
    const directVal = g.items.reduce((s,i) => s + remainingValue(i), 0);
    const downItems = [...g.down].map(getItem).filter(Boolean).filter(i => !g.items.includes(i) && i.scope !== 'others');
    const downVal = downItems.reduce((s,i) => s + remainingValue(i), 0);
    const sinceDates = g.items.map(i => i.blocker.since).filter(Boolean).sort();
    const age = sinceDates.length ? ageDays(sinceDates[0]) : null;
    const expDates = g.items.map(i => i.blocker.expected).filter(Boolean).sort();
    return '<div class="card red-b" style="margin-bottom:0">' +
      '<div class="sc-header"><div class="sc-icon" style="background:var(--red-dim)">' + (typeIcons[g.type]||'⚠') + '</div>' +
      '<div><div style="color:var(--red)">' + esc(reason) + '</div><div style="font-size:11px;color:var(--text2)">' + T(typeLabels[g.type]||'') + ' · ' + T('يوقف') + ' ' + g.items.length + ' ' + T('بند مباشرة') + (downItems.length ? ' + ' + downItems.length + ' ' + T('بند تابع') : '') +
      (age !== null ? ' · <strong style="color:var(--red)">' + T('موقوف منذ') + ' ' + age + ' ' + T('يوم') + '</strong>' : '') +
      (expDates.length ? ' · ' + T('متوقع الحل') + ' ' + esc(expDates[0]) : '') + '</div></div></div>' +
      g.items.map(i => '<div class="sc-item"><span class="sc-item-name"><span class="item-no">' + esc(i.id) + '</span> ' + esc(i.desc.substring(0,45)) + '</span><span class="sc-item-val" style="color:var(--red)">' + fmtN(remainingValue(i)) + '</span></div>').join('') +
      (downItems.length ? '<div class="sc-item"><span class="sc-item-name" style="color:var(--orange)">⛓ ' + T('أعمال تابعة محجوبة:') + ' ' + downItems.map(i=>esc(i.id)).join('، ') + '</span><span class="sc-item-val" style="color:var(--orange)">' + fmtN(downVal) + '</span></div>' : '') +
      '<div class="sc-item" style="border-top:2px solid var(--border)"><span style="font-weight:700">' + T('إجمالي الأثر لو انحل العائق') + '</span><span class="sc-item-val" style="color:var(--red);font-size:13px">🔓 ' + money(directVal + downVal) + '</span></div>' +
      '<div style="margin-top:10px"><button class="btn btn-green" style="width:100%;font-size:12px;padding:6px" onclick="resolveBlockerGroup(' + JSON.stringify(reason).replace(/"/g,'&quot;') + ')">✅ ' + T('تم حل العائق — افتح الأعمال') + '</button></div>' +
      '</div>';
  }).join('') || '<div class="empty-state"><div class="icon">🎉</div><p>' + T('لا توجد عوائق خارجية نشطة') + '</p></div>';

  // waiting table
  const waiting = actionableItems().filter(i => statusOf(i) === 'waiting');
  let sumW = 0;
  $('waiting-tbody').innerHTML = waiting.map(w => {
    const chain = chainOf(w);
    sumW += remainingValue(w);
    const chainStr = chain.map(c => '<b>' + esc(c.id) + '</b> (' + (itemPct(c)*100).toFixed(0) + '%' + (statusOf(c)==='blocked' ? ' ⛔' : '') + ')').join(' ⟵ ');
    const first = chain[0];
    return '<tr>' +
      '<td><span class="item-no">' + esc(w.id) + '</span></td>' +
      '<td><div class="desc-text" data-tip="' + esc(w.desc) + '">' + esc(w.desc) + '</div></td>' +
      '<td>' + (first ? '<span class="prereq-box">⏭ ' + esc(first.id) + ' - ' + esc(first.desc.substring(0,30)) + '</span>' : '—') + '</td>' +
      '<td><span class="chain">' + esc(w.id) + ' ⟵ ' + chainStr + '</span></td>' +
      '<td class="amount blocked">' + fmtN(remainingValue(w)) + '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="5"><div class="empty-state"><p>' + T('لا توجد بنود منتظرة على أعمال سابقة') + '</p></div></td></tr>';
  $('waiting-tfoot').innerHTML = waiting.length ? '<tr class="summary-row"><td colspan="4" style="text-align:start;color:var(--text2)">' + T('إجمالي القيمة المنتظرة') + '</td><td class="amount blocked">' + fmtN(sumW) + '</td></tr>' : '';

  // resolved blockers history
  const logs = [...(proj().blockerLog||[])].sort((a,b) => (b.resolvedAt||'').localeCompare(a.resolvedAt||''));
  $('blocker-log-list').innerHTML = logs.length ? logs.map(l => {
    const dur = (l.since && l.resolvedAt) ? ageDays(l.since) - ageDays(l.resolvedAt) : null;
    return '<div class="sc-item"><span class="sc-item-name" style="white-space:normal">✅ <strong style="color:var(--green-bright)">' + esc(l.reason) + '</strong> — ' + T('حُل بتاريخ') + ' ' + esc(l.resolvedAt) +
      (dur !== null && dur >= 0 ? ' (' + T('استمر') + ' ' + dur + ' ' + T('يوم') + ')' : '') + (l.by ? ' · ' + T('بواسطة') + ' ' + esc(l.by) : '') + '<br><span style="font-size:11px">' + T('كان يوقف:') + ' ' + l.items.map(esc).join('، ') + '</span></span></div>';
  }).join('') : '<div class="empty-state" style="padding:14px"><p>' + T('لم يتم حل أي عائق بعد — عند الضغط على "تم حل العائق" يسجل هنا') + '</p></div>';
}

function resolveBlockerGroup(reason){
  const items = proj().boqItems.filter(i => i.blocker && i.blocker.active && i.blocker.reason === reason);
  if (!items.length) return;
  if (!confirm(T('تأكيد حل العائق "') + reason + T('"؟ سيتم فتح') + ' ' + items.length + ' ' + T('بند للعمل.'))) return;
  const sinceDates = items.map(i => i.blocker.since).filter(Boolean).sort();
  proj().blockerLog.push({id: nextSeq(), reason, type: items[0].blocker.type, items: items.map(i => i.id), since: sinceDates[0] || '', resolvedAt: todayStr(), by: currentUser().name});
  items.forEach(i => { i.blocker.active = false; });
  save(); renderAll();
}
Object.assign(I18N_EN, {
  'عائق خارجي':'External blocker',
  'مواد غير متوفرة':'Materials unavailable',
  'توريد العميل':'Client supply',
  'أخرى':'Other',
  'يوقف':'Stops',
  'بند مباشرة':'item(s) directly',
  'بند تابع':'dependent item(s)',
  'متوقع الحل':'Expected resolution',
  'أعمال تابعة محجوبة:':'Locked dependent work:',
  'إجمالي الأثر لو انحل العائق':'Total impact if the blocker is resolved',
  'تم حل العائق — افتح الأعمال':'Blocker resolved — open the work',
  'لا توجد عوائق خارجية نشطة':'No active external blockers',
  'لا توجد بنود منتظرة على أعمال سابقة':'No items waiting on prior work',
  'إجمالي القيمة المنتظرة':'Total waiting value',
  'حُل بتاريخ':'Resolved on',
  'استمر':'lasted',
  'بواسطة':'by',
  'كان يوقف:':'was blocking:',
  'لم يتم حل أي عائق بعد — عند الضغط على "تم حل العائق" يسجل هنا':'No blocker resolved yet — it will be logged here when you click "Blocker resolved"',
  'تأكيد حل العائق "':'Confirm resolving the blocker "',
  '"؟ سيتم فتح':'"? This will open',
  'بند للعمل.':'item(s) for work.'
});
