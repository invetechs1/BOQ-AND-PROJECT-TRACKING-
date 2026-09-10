'use strict';
// ============================================================
//  ACTION PLAN
// ============================================================
function renderPlan(){
  const claimable = actionableItems().filter(i => netClaimable(i) > 1).sort((a,b) => netClaimable(b) - netClaimable(a));
  const workNow = actionableItems().filter(i => ['partial','available'].includes(statusOf(i))).sort((a,b) => remainingValue(b) - remainingValue(a));

  // external blockers grouped with downstream impact
  const blockedItems = actionableItems().filter(i => statusOf(i) === 'blocked');
  const groups = {};
  blockedItems.forEach(i => {
    const key = i.blocker.reason || T('غير محدد');
    if (!groups[key]) groups[key] = {type:i.blocker.type, direct:[], down:new Set()};
    groups[key].direct.push(i);
    downstreamSet(i.id, groups[key].down);
  });
  const blockerRows = Object.entries(groups).map(([reason,g]) => {
    const directVal = g.direct.reduce((s,i) => s + remainingValue(i), 0);
    const downItems = [...g.down].map(getItem).filter(Boolean).filter(i => !g.direct.includes(i) && i.scope !== 'others');
    const downVal = downItems.reduce((s,i) => s + remainingValue(i), 0);
    return {reason, type:g.type, direct:g.direct, downItems, directVal, downVal, total:directVal + downVal};
  }).sort((a,b) => b.total - a.total);

  // sequence: waiting items grouped by root cause (root not blocked externally)
  const waiting = actionableItems().filter(i => statusOf(i) === 'waiting');
  const seqGroups = {};
  waiting.forEach(w => {
    const root = rootCauseOf(w);
    if (!root) return;
    if (statusOf(root) === 'blocked') return; // already counted under blockers
    if (!seqGroups[root.id]) seqGroups[root.id] = {root, items:[]};
    seqGroups[root.id].items.push(w);
  });
  const seqRows = Object.values(seqGroups).map(g => ({
    ...g, unlockVal: g.items.reduce((s,i) => s + remainingValue(i), 0)
  })).sort((a,b) => b.unlockVal - a.unlockVal);

  let html = '';

  // 1 — claim now
  const netTotal = claimable.reduce((s,i) => s + netClaimable(i), 0);
  html += '<div class="card green-b"><div class="card-title"><span>1️⃣ ✅ ' + T('ارفع مستخلص الآن — صافي جاهز:') + ' <span style="color:var(--green-bright);font-family:var(--mono)">' + money(netTotal) + '</span></span>' +
    '<button class="btn btn-green" onclick="quickBuildInvoice()">💰 ' + T('ابنِ المستخلص') + '</button></div>';
  html += claimable.length ? claimable.slice(0,10).map(i =>
    '<div class="sc-item"><span class="sc-item-name"><span class="item-no">' + esc(i.id) + '</span> ' + esc(i.desc) + ' <span style="color:var(--text3)">(' + (itemPct(i)*100).toFixed(0) + '% ' + T('منفذ') + ' / ' + (claimedPct(i)*100).toFixed(0) + '% ' + T('مرفوع') + ')</span></span>' +
    '<span class="sc-item-val" style="color:var(--green-bright)">' + money(netClaimable(i)) + '</span></div>').join('')
    : '<div class="empty-state" style="padding:16px"><p>' + T('لا يوجد شيء جاهز للرفع حالياً — سجّل تنفيذ أولاً') + '</p></div>';
  if (claimable.length > 10) html += '<div class="sc-item"><span class="sc-item-name">+ ' + (claimable.length-10) + ' ' + T('بنود أخرى...') + '</span></div>';
  html += '</div>';

  // 2 — work on now
  html += '<div class="card blue-b"><div class="card-title"><span>2️⃣ 🔨 ' + T('اشتغل على هذي البنود الحين (بدون عوائق) — كل نسبة تنفيذ تتحول مطالبة') + '</span></div>';
  html += workNow.length ? workNow.map(i => {
    const st = statusOf(i);
    const perPct = amt(i)/100;
    return '<div class="sc-item"><span class="sc-item-name"><span class="item-no">' + esc(i.id) + '</span> ' + esc(i.desc) + ' ' + statusPill(st) + '</span>' +
      '<span class="sc-item-val">' + T('متبقي') + ' <span style="color:var(--amber)">' + money(remainingValue(i)) + '</span> · ' + T('كل 1% =') + ' ' + money(perPct) + '</span></div>';
  }).join('') : '<div class="empty-state" style="padding:16px"><p>' + T('لا توجد بنود متاحة — كل الشغل إما مكتمل أو معلق بعوائق') + '</p></div>';
  html += '</div>';

  // 3 — blockers priority
  html += '<div class="card red-b"><div class="card-title"><span>3️⃣ ⛔ ' + T('طالب بحل هذي العوائق (مرتبة بالأثر المالي)') + '</span></div>';
  html += blockerRows.length ? blockerRows.map(b =>
    '<div class="sc-item" style="align-items:flex-start"><span class="sc-item-name" style="white-space:normal"><strong style="color:var(--red)">' + esc(b.reason) + '</strong><br>' +
    '<span style="font-size:11px">' + T('يوقف مباشرة') + ' ' + b.direct.length + ' ' + T('بند') + ' (' + money(b.directVal) + ')' +
    (b.downItems.length ? ' + ' + T('يمنع بعده') + ' ' + b.downItems.length + ' ' + T('بند') + ' (' + money(b.downVal) + ')' : '') + '</span></span>' +
    '<span class="sc-item-val" style="color:var(--red);font-size:13px">🔓 ' + T('يفتح') + ' ' + money(b.total) + '</span></div>').join('')
    : '<div class="empty-state" style="padding:16px"><p>' + T('لا توجد عوائق خارجية 🎉') + '</p></div>';
  html += '</div>';

  // 4 — sequence unlocks
  html += '<div class="card orange-b"><div class="card-title"><span>4️⃣ ⛓ ' + T('خلّص هذي البنود عشان تفتح اللي بعدها') + '</span></div>';
  html += seqRows.length ? seqRows.map(g =>
    '<div class="sc-item" style="align-items:flex-start"><span class="sc-item-name" style="white-space:normal">' + T('خلّص') + ' <span class="item-no">' + esc(g.root.id) + '</span> ' + esc(g.root.desc) + ' <span style="color:var(--amber)">(' + (itemPct(g.root)*100).toFixed(0) + '%)</span><br>' +
    '<span style="font-size:11px">' + T('يفتح:') + ' ' + g.items.map(i => '<span class="item-no">' + esc(i.id) + '</span>').join('، ') + '</span></span>' +
    '<span class="sc-item-val" style="color:var(--orange)">🔓 ' + money(g.unlockVal) + '</span></div>').join('')
    : '<div class="empty-state" style="padding:16px"><p>' + T('لا توجد بنود منتظرة على تسلسل') + '</p></div>';
  html += '</div>';

  // 5 — forecast from productivity rates
  const rates = itemLogRates();
  const forecastRows = proj().boqItems
    .filter(i => ['partial','available'].includes(statusOf(i)) && rates[i.id] && rates[i.id].rate > 0)
    .map(i => {
      const r = rates[i.id].rate;
      const remaining = Math.max(0, i.totalQty - i.executedQty);
      const eta = remaining > 0 ? Math.ceil(remaining / r) : 0;
      const weekly = Math.min(remaining, r * 7) * i.unitRate;
      return {it:i, rate:r, remaining, eta, weekly};
    }).sort((a,b) => b.weekly - a.weekly);
  const weeklyTotal = forecastRows.reduce((s,f) => s + f.weekly, 0);
  html += '<div class="card teal-b" style="border-color:rgba(57,208,216,0.4)"><div class="card-title"><span>5️⃣ 📈 ' + T('توقع نمو المطالبات حسب معدل إنتاجك الفعلي') +
    (forecastRows.length ? ' — ' + T('تضيف أسبوعياً ≈') + ' <span style="color:var(--teal);font-family:var(--mono)">' + money(weeklyTotal) + '</span>' : '') + '</span></div>';
  html += forecastRows.length ? forecastRows.map(f =>
    '<div class="sc-item" style="align-items:flex-start"><span class="sc-item-name" style="white-space:normal"><span class="item-no">' + esc(f.it.id) + '</span> ' + esc(f.it.desc) + '<br>' +
    '<span style="font-size:11px">' + T('معدل') + ' ' + fmtQ(f.rate) + ' ' + esc(f.it.unit) + '/' + T('يوم') + ' · ' + T('متبقي') + ' ' + fmtQ(f.remaining) + ' · ' + T('يكتمل خلال ≈') + ' ' + f.eta + ' ' + T('يوم') + '</span></span>' +
    '<span class="sc-item-val" style="color:var(--teal)">+ ' + money(f.weekly) + ' /' + T('أسبوع') + '</span></div>').join('')
    : '<div class="empty-state" style="padding:16px"><p>' + T('سجّل يوميات العمل في تبويب الإنتاجية ليحسب النظام التوقع تلقائياً') + '</p></div>';
  html += '</div>';

  $('plan-content').innerHTML = html;
}
Object.assign(I18N_EN, {
  'غير محدد':'Unspecified',
  'ارفع مستخلص الآن — صافي جاهز:':'Submit a claim now — net ready:',
  'ابنِ المستخلص':'Build the claim',
  'منفذ':'executed',
  'مرفوع':'claimed',
  'لا يوجد شيء جاهز للرفع حالياً — سجّل تنفيذ أولاً':'Nothing ready to claim right now — log execution first',
  'بنود أخرى...':'more item(s)...',
  'اشتغل على هذي البنود الحين (بدون عوائق) — كل نسبة تنفيذ تتحول مطالبة':'Work on these items now (no blockers) — every percent of progress becomes a claim',
  'متبقي':'Remaining',
  'كل 1% =':'each 1% =',
  'لا توجد بنود متاحة — كل الشغل إما مكتمل أو معلق بعوائق':'No items available — all work is either complete or blocked',
  'طالب بحل هذي العوائق (مرتبة بالأثر المالي)':'Push to resolve these blockers (ranked by financial impact)',
  'يوقف مباشرة':'Directly stops',
  'يمنع بعده':'and blocks after it',
  'يفتح':'unlocks',
  'لا توجد عوائق خارجية 🎉':'No external blockers 🎉',
  'خلّص هذي البنود عشان تفتح اللي بعدها':'Finish these items to unlock what comes after',
  'خلّص':'Finish',
  'يفتح:':'unlocks:',
  'لا توجد بنود منتظرة على تسلسل':'No items waiting on a sequence',
  'توقع نمو المطالبات حسب معدل إنتاجك الفعلي':'Forecasted claim growth from your actual production rate',
  'تضيف أسبوعياً ≈':'adding weekly ≈',
  'معدل':'Rate',
  'يوم':'day',
  'يكتمل خلال ≈':'completes in ≈',
  'أسبوع':'week',
  'سجّل يوميات العمل في تبويب الإنتاجية ليحسب النظام التوقع تلقائياً':'Log work in the Productivity tab so the system can calculate the forecast automatically'
});
