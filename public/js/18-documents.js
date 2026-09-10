'use strict';
// ============================================================
//  DOCUMENTS: BLOCKER LETTER + PROGRESS REPORT
// ============================================================
const cell = (v, extra) => '<td style="padding:6px;border:1px solid var(--border);' + (extra||'') + '">' + v + '</td>';
const hcell = v => '<th style="padding:7px;border:1px solid var(--border);color:var(--amber);text-align:center">' + v + '</th>';

function docHeader(title, sub){
  const p = proj().info;
  return '<div style="text-align:center;padding:14px 0;border-bottom:2px solid var(--amber);margin-bottom:14px">' +
    '<div style="font-size:11px;color:var(--text2);letter-spacing:2px">' + esc(p.contractor) + '</div>' +
    '<div style="font-size:18px;font-weight:700;color:var(--amber);margin:4px 0">' + title + '</div>' +
    '<div style="font-size:13px;color:var(--text2)">' + esc(p.name) + (sub ? ' — ' + sub : '') + '</div></div>';
}

function genBlockerLetter(){
  const p = proj().info;
  const blocked = actionableItems().filter(i => statusOf(i) === 'blocked');
  if (!blocked.length) { alert(T('لا توجد عوائق نشطة حالياً 🎉')); return; }
  const groups = {};
  blocked.forEach(i => {
    const key = i.blocker.reason;
    if (!groups[key]) groups[key] = {items:[], down:new Set(), since:''};
    groups[key].items.push(i);
    downstreamSet(i.id, groups[key].down);
    if (i.blocker.since && (!groups[key].since || i.blocker.since < groups[key].since)) groups[key].since = i.blocker.since;
  });
  let totalImpact = 0;
  const rows = Object.entries(groups).map(([reason,g]) => {
    const downItems = [...g.down].map(getItem).filter(Boolean).filter(i => !g.items.includes(i) && i.scope !== 'others');
    const val = g.items.reduce((s,i) => s + remainingValue(i), 0) + downItems.reduce((s,i) => s + remainingValue(i), 0);
    totalImpact += val;
    const age = g.since ? ageDays(g.since) : null;
    return '<tr>' +
      cell(esc(reason)) +
      cell(g.items.map(i => esc(i.id)).join('، ') + (downItems.length ? '<br><span style="font-size:10px;color:var(--text2)">+ ' + T('تابعة:') + ' ' + downItems.map(i=>esc(i.id)).join('، ') + '</span>' : ''), 'font-family:var(--mono);font-size:11px') +
      cell(g.since ? esc(g.since) + (age !== null ? '<br>(' + age + ' ' + T('يوم') + ')' : '') : '—', 'text-align:center;font-family:var(--mono);font-size:11px') +
      cell(fmtN(val), 'text-align:center;font-family:var(--mono);font-weight:700;color:var(--red)') +
      '</tr>';
  }).join('');

  const html = '<div style="font-family:var(--font)">' +
    docHeader(T('خطاب إشعار تعثر أعمال وطلب إزالة عوائق'), '') +
    '<div style="font-size:12px;margin-bottom:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
      '<div><span style="color:var(--text2)">' + T('إلى السادة /') + ' </span><strong>' + esc(p.client) + '</strong> ' + T('المحترمين') + '</div>' +
      '<div><span style="color:var(--text2)">' + T('التاريخ:') + ' </span><strong>' + todayStr() + '</strong></div>' +
      '<div><span style="color:var(--text2)">' + T('نسخة إلى /') + ' </span><strong>' + esc(p.consultant) + '</strong></div>' +
      '<div><span style="color:var(--text2)">' + T('الموضوع:') + ' </span><strong>' + T('إشعار بتوقف أعمال بسبب عوائق خارجة عن إرادتنا') + '</strong></div>' +
    '</div>' +
    '<p style="font-size:13px;line-height:2;margin-bottom:12px">' + T('السلام عليكم ورحمة الله وبركاته، وبعد:') + '<br>' +
    T('نفيدكم بأن الأعمال الموضحة في الجدول أدناه ضمن نطاق أعمالنا في المشروع') + ' <strong>' + T('متوقفة حالياً') + '</strong> ' + T('لأسباب خارجة عن إرادتنا، وذلك على النحو التالي:') + '</p>' +
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px">' +
    '<thead><tr style="background:var(--bg3)">' + [ 'العائق', 'البنود المتأثرة', 'موقوف منذ', LANG==='en'?'Locked value (SAR)':'القيمة المحجوبة (ر.س)' ].map(h => hcell(T(h))).join('') + '</tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '<tfoot><tr style="background:var(--bg3)">' + cell('<strong>' + T('إجمالي القيمة المحجوبة') + '</strong>', 'text-align:start') + cell('', '') + cell('', '') + cell('<strong>' + fmtN(totalImpact) + '</strong>', 'text-align:center;font-family:var(--mono);color:var(--red)') + '</tr></tfoot>' +
    '</table></div>' +
    '<p style="font-size:13px;line-height:2;margin-bottom:12px">' + T('وعليه، نأمل من سعادتكم التكرم بسرعة إزالة العوائق المذكورة أعلاه لتمكيننا من استكمال الأعمال حسب البرنامج الزمني،') + ' ' +
    T('علماً بأن استمرار هذه العوائق يؤثر مباشرة على نسب الإنجاز والمستخلصات الشهرية، ونحتفظ بحقنا في المطالبة بتمديد المدة وأي تكاليف مترتبة على هذا التوقف.') + '<br>' + T('وتفضلوا بقبول فائق الاحترام والتقدير،') + '</p>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:28px;font-size:12px">' +
      '<div style="text-align:center;border-top:1px solid var(--border);padding-top:8px"><div style="color:var(--text2)">' + T('مدير المشروع') + ' — ' + esc(p.contractor) + '</div><div style="margin-top:26px;color:var(--text3)">' + T('التوقيع / التاريخ') + '</div></div>' +
      '<div style="text-align:center;border-top:1px solid var(--border);padding-top:8px"><div style="color:var(--text2)">' + T('استلمه عن المقاول الرئيسي') + '</div><div style="margin-top:26px;color:var(--text3)">' + T('التوقيع / التاريخ') + '</div></div>' +
    '</div></div>';
  showPrintable('✉️ ' + T('خطاب إشعار تعثر'), html);
}
Object.assign(I18N_EN, {
  'لا توجد عوائق نشطة حالياً 🎉':'No active blockers right now 🎉',
  'تابعة:':'dependent:',
  'يوم':'days',
  'خطاب إشعار تعثر أعمال وطلب إزالة عوائق':'Work-Stoppage Notice and Request to Remove Blockers',
  'إلى السادة /':'To Messrs. /',
  'المحترمين':'',
  'التاريخ:':'Date:',
  'نسخة إلى /':'Copy to /',
  'الموضوع:':'Subject:',
  'إشعار بتوقف أعمال بسبب عوائق خارجة عن إرادتنا':'Notice of work stoppage due to circumstances beyond our control',
  'السلام عليكم ورحمة الله وبركاته، وبعد:':'Dear Sirs,',
  'نفيدكم بأن الأعمال الموضحة في الجدول أدناه ضمن نطاق أعمالنا في المشروع':'We would like to inform you that the works listed in the table below, within our scope on the project, are',
  'متوقفة حالياً':'currently stopped',
  'لأسباب خارجة عن إرادتنا، وذلك على النحو التالي:':'for reasons beyond our control, as detailed below:',
  'العائق':'Blocker',
  'البنود المتأثرة':'Affected items',
  'موقوف منذ':'Stopped since',
  'إجمالي القيمة المحجوبة':'Total locked value',
  'وعليه، نأمل من سعادتكم التكرم بسرعة إزالة العوائق المذكورة أعلاه لتمكيننا من استكمال الأعمال حسب البرنامج الزمني،':'We therefore kindly request your prompt action to remove the above blockers so we can complete the works as scheduled,',
  'علماً بأن استمرار هذه العوائق يؤثر مباشرة على نسب الإنجاز والمستخلصات الشهرية، ونحتفظ بحقنا في المطالبة بتمديد المدة وأي تكاليف مترتبة على هذا التوقف.':'noting that continuation of these blockers directly affects progress rates and monthly claims, and we reserve our right to claim a time extension and any costs arising from this stoppage.',
  'وتفضلوا بقبول فائق الاحترام والتقدير،':'Please accept our highest regards and appreciation,',
  'استلمه عن المقاول الرئيسي':'Received on behalf of the main contractor',
  'خطاب إشعار تعثر':'Blocker Notice Letter'
});

function buildProgressReport(){
  const t = totals();
  const progressPct = t.azoomScope > 0 ? (t.executed / t.azoomScope * 100) : 0;

  // per-division summary
  const divs = {};
  actionableItems().forEach(it => {
    if (it.scope === 'others') return;
    if (!divs[it.div]) divs[it.div] = {name:it.divAr, total:0, exec:0, claimed:0};
    divs[it.div].total += amt(it); divs[it.div].exec += itemPct(it)*amt(it); divs[it.div].claimed += claimedPct(it)*amt(it);
  });
  const divRows = Object.entries(divs).map(([dv,d]) =>
    '<tr>' + cell(esc(dv) + ' — ' + esc(d.name)) + cell(fmtN(d.total),'text-align:center;font-family:var(--mono)') +
    cell(fmtN(d.exec),'text-align:center;font-family:var(--mono)') + cell((d.total>0?(d.exec/d.total*100):0).toFixed(1)+'%','text-align:center;font-family:var(--mono);color:var(--green)') +
    cell(fmtN(d.claimed),'text-align:center;font-family:var(--mono)') + '</tr>').join('');

  // blockers
  const blocked = actionableItems().filter(i => statusOf(i) === 'blocked');
  const bGroups = {};
  blocked.forEach(i => {
    const k = i.blocker.reason;
    if (!bGroups[k]) bGroups[k] = {n:0, val:0, since:''};
    bGroups[k].n++; bGroups[k].val += remainingValue(i);
    if (i.blocker.since && (!bGroups[k].since || i.blocker.since < bGroups[k].since)) bGroups[k].since = i.blocker.since;
  });
  const blockerRows = Object.entries(bGroups).map(([r,g]) =>
    '<tr>' + cell(esc(r)) + cell(g.n,'text-align:center') + cell(g.since ? ageDays(g.since) + ' ' + T('يوم') : '—','text-align:center;font-family:var(--mono)') +
    cell(fmtN(g.val),'text-align:center;font-family:var(--mono);color:var(--red)') + '</tr>').join('');

  // top claimables
  const claimables = actionableItems().filter(i => netClaimable(i) > 1).sort((a,b) => netClaimable(b)-netClaimable(a)).slice(0,10);
  const claimRows = claimables.map(i =>
    '<tr>' + cell('<span style="font-family:var(--mono);color:var(--amber)">' + esc(i.id) + '</span> ' + esc(i.desc)) +
    cell((itemPct(i)*100).toFixed(0)+'%','text-align:center;font-family:var(--mono)') +
    cell(fmtN(netClaimable(i)),'text-align:center;font-family:var(--mono);color:var(--green)') + '</tr>').join('');

  // productivity last 7 days
  const wk = daysAgo(7);
  const recent = proj().workLogs.filter(l => l.date >= wk);
  const crewQty = {};
  recent.forEach(l => { crewQty[l.crew] = (crewQty[l.crew]||0) + l.qty; });
  const crewRows = Object.entries(crewQty).sort((a,b)=>b[1]-a[1]).map(([c,q]) =>
    '<tr>' + cell(esc(c)) + cell(fmtQ(q),'text-align:center;font-family:var(--mono)') + '</tr>').join('');

  const sec = title => '<div style="font-size:14px;font-weight:700;color:var(--amber);margin:16px 0 8px">' + T(title) + '</div>';
  const tbl = (heads, rows) => '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">' +
    '<thead><tr style="background:var(--bg3)">' + heads.map(h => hcell(T(h))).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';

  const html = '<div style="font-family:var(--font)">' +
    docHeader(T('تقرير تقدم الأعمال والمستخلصات'), todayStr()) +
    sec('1. الملخص المالي') +
    tbl(['البيان', LANG==='en'?'Value (SAR)':'القيمة (ر.س)'],
      '<tr>' + cell(T('قيمة نطاق أعمالنا')) + cell(fmtN(t.azoomScope),'text-align:center;font-family:var(--mono)') + '</tr>' +
      '<tr>' + cell(T('قيمة الأعمال المنفذة') + ' (' + progressPct.toFixed(1) + '%)') + cell(fmtN(t.executed),'text-align:center;font-family:var(--mono);color:var(--blue)') + '</tr>' +
      '<tr>' + cell(T('مرفوع بمستخلصات سابقة')) + cell(fmtN(t.claimed),'text-align:center;font-family:var(--mono)') + '</tr>' +
      '<tr>' + cell('<strong>' + T('الصافي الجاهز للرفع') + '</strong>') + cell('<strong>' + fmtN(t.net) + '</strong>','text-align:center;font-family:var(--mono);color:var(--green)') + '</tr>' +
      '<tr>' + cell(T('محجوب بعوائق وتسلسل أعمال')) + cell(fmtN(t.locked),'text-align:center;font-family:var(--mono);color:var(--red)') + '</tr>' +
      '<tr>' + cell(T('محصل نقداً من المستخلصات')) + cell(fmtN(t.collected),'text-align:center;font-family:var(--mono)') + '</tr>') +
    sec('2. التقدم حسب الأقسام') +
    tbl(['القسم','القيمة','المنفذ','النسبة','المرفوع'], divRows || '<tr>' + cell('—','text-align:center') + '</tr>') +
    sec('3. العوائق النشطة') +
    (blockerRows ? tbl(['العائق','عدد البنود','موقوف منذ','القيمة المحجوبة'], blockerRows) : '<p style="font-size:12px;color:var(--green)">' + T('لا توجد عوائق نشطة ✅') + '</p>') +
    sec('4. أعلى البنود الجاهزة للمطالبة') +
    (claimRows ? tbl(['البند','منفذ','صافي المطالبة'], claimRows) : '<p style="font-size:12px;color:var(--text2)">' + T('لا يوجد رصيد جاهز للرفع حالياً') + '</p>') +
    sec('5. إنتاجية آخر 7 أيام حسب الفرقة') +
    (crewRows ? tbl(['الفرقة','الكمية المنفذة'], crewRows) : '<p style="font-size:12px;color:var(--text2)">' + T('لا توجد يوميات مسجلة خلال آخر 7 أيام') + '</p>') +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:28px;font-size:12px">' +
      '<div style="text-align:center;border-top:1px solid var(--border);padding-top:8px"><div style="color:var(--text2)">' + T('معد التقرير') + '</div><div style="margin-top:26px;color:var(--text3)">' + T('التوقيع / التاريخ') + '</div></div>' +
      '<div style="text-align:center;border-top:1px solid var(--border);padding-top:8px"><div style="color:var(--text2)">' + T('مدير المشروع') + '</div><div style="margin-top:26px;color:var(--text3)">' + T('التوقيع / التاريخ') + '</div></div>' +
    '</div></div>';
  showPrintable('📄 ' + T('تقرير تقدم الأعمال'), html);
}
Object.assign(I18N_EN, {
  '1. الملخص المالي':'1. Financial Summary',
  'البيان':'Item',
  'قيمة نطاق أعمالنا':'Value of our scope',
  'قيمة الأعمال المنفذة':'Value of executed work',
  'مرفوع بمستخلصات سابقة':'Claimed in previous claims',
  'الصافي الجاهز للرفع':'Net ready to claim',
  'محجوب بعوائق وتسلسل أعمال':'Locked by blockers and work sequence',
  'محصل نقداً من المستخلصات':'Collected in cash from claims',
  '2. التقدم حسب الأقسام':'2. Progress by Division',
  'القسم':'Division',
  'القيمة':'Value',
  'المنفذ':'Executed',
  'النسبة':'Percentage',
  'المرفوع':'Claimed',
  '3. العوائق النشطة':'3. Active Blockers',
  'العائق':'Blocker',
  'عدد البنود':'Number of items',
  'موقوف منذ':'Stopped since',
  'القيمة المحجوبة':'Locked value',
  'لا توجد عوائق نشطة ✅':'No active blockers ✅',
  '4. أعلى البنود الجاهزة للمطالبة':'4. Top Items Ready to Claim',
  'صافي المطالبة':'Net claim',
  'لا يوجد رصيد جاهز للرفع حالياً':'No balance is ready to claim right now',
  '5. إنتاجية آخر 7 أيام حسب الفرقة':'5. Last 7 Days’ Productivity by Crew',
  'الفرقة':'Crew',
  'الكمية المنفذة':'Quantity executed',
  'لا توجد يوميات مسجلة خلال آخر 7 أيام':'No logs recorded in the last 7 days',
  'معد التقرير':'Prepared by',
  'تقرير تقدم الأعمال والمستخلصات':'Works Progress and Claims Report',
  'تقرير تقدم الأعمال':'Progress Report'
});
