'use strict';
// ============================================================
//  CSV EXPORT (Excel-compatible, UTF-8 BOM)
// ============================================================
function dlCSV(name, rows){
  const csv = '\uFEFF' + rows.map(r => r.map(c => {
    c = String(c ?? '');
    return /[",\n]/.test(c) ? '"' + c.replace(/"/g,'""') + '"' : c;
  }).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportItemsCSV(){
  const rows = [['رقم البند','القسم','الوصف','الوحدة','الكمية الكلية','سعر الوحدة','الإجمالي','الكمية المنفذة','المعتمد من الاستشاري','بانتظار الاعتماد','الكمية المرفوعة','صافي المطالبة','الحالة','العائق / يعتمد على'].map(T)];
  actionableItems().forEach(it => {
    const st = T(STATUS_META[statusOf(it)].label);
    const dep = it.blocker && it.blocker.active ? it.blocker.reason : (it.predecessors||[]).join(' + ');
    rows.push([it.id, it.div + ' ' + (it.divAr||''), it.desc, it.unit, it.totalQty, it.unitRate, amt(it),
      it.executedQty, approvedOf(it), pendingApprovalQty(it), it.claimedQty, Math.round(netClaimable(it)), st, dep]);
  });
  dlCSV('BOQ-' + todayStr() + '.csv', rows);
}

function exportLogsCSV(){
  const rows = [['التاريخ','الفرقة','مقاول الباطن','البند','الوصف','الوحدة/الموقع','الكمية','الوحدة','عدد العمال','الإنتاجية/عامل','سجلها','ملاحظات'].map(T)];
  [...proj().workLogs].sort((a,b) => a.date.localeCompare(b.date)).forEach(l => {
    const it = getItem(l.itemId);
    const sub = l.subId && getSub(l.subId) ? getSub(l.subId).name : '';
    rows.push([l.date, l.crew || '', sub, l.itemId, it ? it.desc : '', l.villaNo || '', l.qty, it ? it.unit : '',
      l.workers || '', l.workers > 0 ? (l.qty/l.workers).toFixed(1) : '', l.by || '', l.note || '']);
  });
  dlCSV('WorkLogs-' + todayStr() + '.csv', rows);
}

function exportDocCSV(){
  if (!currentDoc) return;
  const m = currentDoc;
  const rows = [[T('مستخلص'), m.no, T('التاريخ'), m.date],
    ['رقم البند','الوصف','الوحدة','السعر','الكمية السابقة','الكمية الحالية','التراكمي','قيمة الحالي'].map(T)];
  m.lines.forEach(l => rows.push([l.itemId, l.desc, l.unit, l.rate, l.prevQty, l.currQty, l.cumQty, Math.round(l.amount)]));
  rows.push([]);
  rows.push([T('قيمة الأعمال'), Math.round(m.gross)]);
  rows.push([T('ضريبة') + ' ' + m.vatRate + '%', Math.round(m.vat)]);
  rows.push([T('محتجز ضمان') + ' ' + m.retRate + '%', -Math.round(m.retention)]);
  rows.push([T('استرداد دفعة مقدمة') + ' ' + m.advRate + '%', -Math.round(m.advance)]);
  rows.push([T('صافي المستحق'), Math.round(m.net)]);
  dlCSV('Mustakhlas-' + (m.no||'preview').replace(/[^\w-]/g,'') + '.csv', rows);
}
Object.assign(I18N_EN, {
  'رقم البند':'Item No.',
  'القسم':'Division',
  'الوصف':'Description',
  'الوحدة':'Unit',
  'الكمية الكلية':'Total quantity',
  'سعر الوحدة':'Unit price',
  'الإجمالي':'Total',
  'الكمية المنفذة':'Executed quantity',
  'نسبة التنفيذ %':'Execution %',
  'المعتمد من الاستشاري':'Approved by consultant',
  'بانتظار الاعتماد':'Awaiting approval',
  'الكمية المرفوعة':'Claimed quantity',
  'صافي المطالبة':'Net claim',
  'الحالة':'Status',
  'العائق / يعتمد على':'Blocker / depends on',
  'التاريخ':'Date',
  'الفرقة':'Crew',
  'مقاول الباطن':'Subcontractor',
  'البند':'Item',
  'الوحدة/الموقع':'Unit/location',
  'الكمية':'Quantity',
  'عدد العمال':'Number of workers',
  'الإنتاجية/عامل':'Productivity/worker',
  'سجلها':'Logged by',
  'ملاحظات':'Notes',
  'مستخلص':'Claim',
  'الكمية السابقة':'Previous quantity',
  'الكمية الحالية':'Current quantity',
  'التراكمي':'Cumulative',
  'قيمة الحالي':'Current value',
  'قيمة الأعمال':'Value of work',
  'ضريبة':'VAT',
  'محتجز ضمان':'Retention',
  'استرداد دفعة مقدمة':'Advance recovery',
  'صافي المستحق':'Net due'
});
