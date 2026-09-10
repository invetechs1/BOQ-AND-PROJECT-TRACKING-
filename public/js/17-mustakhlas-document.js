'use strict';
// ============================================================
//  MUSTAKHLAS DOCUMENT
// ============================================================
let currentDoc = null;
function showDoc(m){
  currentDoc = m;
  $('doc-title').textContent = '📄 ' + T('وثيقة المستخلص') + ' ' + (m.no || '');
  $('doc-csv-btn').style.display = '';
  const p = proj().info;
  const rows = m.lines.map((l, i) =>
    '<tr>' +
    '<td style="padding:6px;border:1px solid var(--border);text-align:center;font-family:var(--mono)">' + (i+1) + '</td>' +
    '<td style="padding:6px;border:1px solid var(--border);font-family:var(--mono);color:var(--amber)">' + esc(l.itemId) + '</td>' +
    '<td style="padding:6px;border:1px solid var(--border)">' + esc(l.desc) + '</td>' +
    '<td style="padding:6px;border:1px solid var(--border);text-align:center">' + esc(l.unit) + '</td>' +
    '<td style="padding:6px;border:1px solid var(--border);text-align:center;font-family:var(--mono)">' + fmtN(l.rate) + '</td>' +
    '<td style="padding:6px;border:1px solid var(--border);text-align:center;font-family:var(--mono)">' + fmtQ(l.prevQty) + '</td>' +
    '<td style="padding:6px;border:1px solid var(--border);text-align:center;font-family:var(--mono);color:var(--green)">' + fmtQ(l.currQty) + '</td>' +
    '<td style="padding:6px;border:1px solid var(--border);text-align:center;font-family:var(--mono)">' + fmtQ(l.cumQty) + '</td>' +
    '<td style="padding:6px;border:1px solid var(--border);text-align:center;font-family:var(--mono);font-weight:700;color:var(--green-bright)">' + fmtN(l.amount) + '</td>' +
    '</tr>').join('');

  const sumRow = (label, val, color, strong) =>
    '<tr' + (strong ? ' style="background:var(--green-dim)"' : '') + '><td colspan="8" style="padding:8px;border:1px solid var(--border);text-align:start;' + (strong?'font-weight:700;color:var(--green-bright)':'') + '">' + label + '</td>' +
    '<td style="padding:8px;border:1px solid var(--border);text-align:center;font-family:var(--mono);' + (strong?'font-weight:700;font-size:15px;color:var(--green-bright)':'color:' + color) + '">' + fmtN(val) + '</td></tr>';

  $('doc-content').innerHTML =
    '<div style="font-family:var(--font)">' +
    '<div style="text-align:center;padding:14px 0;border-bottom:2px solid var(--amber);margin-bottom:14px">' +
      '<div style="font-size:11px;color:var(--text2);letter-spacing:2px">' + esc(p.contractor) + '</div>' +
      '<div style="font-size:18px;font-weight:700;color:var(--amber);margin:4px 0">' + T('مستخلص أعمال رقم') + ' ' + esc(m.no) + '</div>' +
      '<div style="font-size:13px;color:var(--text2)">' + esc(p.name) + '</div></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:12px">' +
      '<div><span style="color:var(--text2)">' + T('المقاول الرئيسي:') + '</span> <strong>' + esc(p.client) + '</strong></div>' +
      '<div><span style="color:var(--text2)">' + T('الاستشاري:') + '</span> <strong>' + esc(p.consultant) + '</strong></div>' +
      '<div><span style="color:var(--text2)">' + T('تاريخ المستخلص:') + '</span> <strong>' + esc(m.date) + '</strong></div>' +
      '<div><span style="color:var(--text2)">' + T('عدد البنود:') + '</span> <strong>' + m.lines.length + '</strong></div>' +
      (m.by ? '<div><span style="color:var(--text2)">' + T('معد المستخلص:') + '</span> <strong>' + esc(m.by) + '</strong></div>' : '') +
      (m.status ? '<div><span style="color:var(--text2)">' + T('الحالة:') + '</span> <strong>' + (MUS_STATUS[m.status] ? musLbl(MUS_STATUS[m.status]) : m.status) + '</strong></div>' : '') +
      (m.approvedBy && m.status !== 'rejected' ? '<div><span style="color:var(--text2)">' + T('اعتمده:') + '</span> <strong>' + esc(m.approvedBy) + (m.approvedAt ? ' — ' + esc(m.approvedAt) : '') + '</strong></div>' : '') +
      (m.status === 'rejected' && m.rejectReason ? '<div style="grid-column:1/-1;color:var(--red)"><span>' + T('سبب الإرجاع:') + '</span> <strong>' + esc(m.rejectReason) + '</strong></div>' : '') +
      (m.invoiceNo ? '<div><span style="color:var(--text2)">' + T('رقم الفاتورة:') + '</span> <strong>' + esc(m.invoiceNo) + '</strong></div>' : '') +
      (m.notes ? '<div style="grid-column:1/-1"><span style="color:var(--text2)">' + T('ملاحظات:') + '</span> ' + esc(m.notes) + '</div>' : '') +
    '</div>' +
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">' +
    '<thead><tr style="background:var(--bg3)">' +
      ['#','البند','الوصف','الوحدة','السعر','الكمية السابقة','الكمية الحالية','التراكمي', LANG==='en' ? 'Current value (SAR)' : 'قيمة الحالي (ر.س)'].map(h => '<th style="padding:7px;border:1px solid var(--border);color:var(--amber);text-align:center">' + T(h) + '</th>').join('') +
    '</tr></thead><tbody>' + rows + '</tbody><tfoot>' +
    sumRow(T('قيمة الأعمال السابقة (مستخلصات سابقة)'), m.lines.reduce((s,l) => s + l.prevQty * l.rate, 0), 'var(--text2)') +
    sumRow(T('قيمة الأعمال الحالية (هذا المستخلص)'), m.gross, 'var(--amber)') +
    sumRow(T('قيمة الأعمال التراكمية'), m.lines.reduce((s,l) => s + l.cumQty * l.rate, 0), 'var(--teal)') +
    sumRow(T('ضريبة القيمة المضافة') + ' ' + m.vatRate + '% ' + T('(على الحالي)'), m.vat, 'var(--text)') +
    sumRow('− ' + T('محتجز ضمان') + ' ' + m.retRate + '%', -m.retention, 'var(--red)') +
    sumRow('− ' + T('استرداد دفعة مقدمة') + ' ' + m.advRate + '%', -m.advance, 'var(--red)') +
    sumRow(T('صافي المستحق للدفع (الحالي)'), m.net, '', true) +
    '</tfoot></table></div>' +
    ((m.attachments||[]).length ?
      '<div style="margin-top:14px"><div style="font-size:13px;font-weight:700;color:var(--amber);margin-bottom:6px">📎 ' + T('المرفقات') + ' (' + m.attachments.length + ') — ' + T('ملفات المستخلص واستلامات الاستشاري') + '</div>' +
      m.attachments.map(a => '<div style="font-size:12px;padding:3px 0"><a href="' + esc(a.url) + '" target="_blank" style="color:var(--blue);text-decoration:none">' +
        (String(a.url).endsWith('.pdf') ? '📄' : '🖼') + ' ' + esc(a.name || T('ملف مرفق')) + ' ↗</a></div>').join('') + '</div>' : '') +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:28px;font-size:12px">' +
      ['معد المستخلص','مدير الموقع','مدير المشروع'].map(r => '<div style="text-align:center;border-top:1px solid var(--border);padding-top:8px"><div style="color:var(--text2)">' + T(r) + '</div><div style="margin-top:26px;color:var(--text3)">' + T('التوقيع / التاريخ') + '</div></div>').join('') +
    '</div></div>';
  $('doc-modal').classList.add('open');
}
Object.assign(I18N_EN, {
  'وثيقة المستخلص':'Claim document',
  'مستخلص أعمال رقم':'Works claim no.',
  'المقاول الرئيسي:':'Main contractor:',
  'الاستشاري:':'Consultant:',
  'تاريخ المستخلص:':'Claim date:',
  'عدد البنود:':'Number of items:',
  'معد المستخلص:':'Prepared by:',
  'الحالة:':'Status:',
  'اعتمده:':'Approved by:',
  'رقم الفاتورة:':'Invoice no.:',
  'ملاحظات:':'Notes:',
  'البند':'Item',
  'الوصف':'Description',
  'الوحدة':'Unit',
  'السعر':'Price',
  'الكمية السابقة':'Previous qty',
  'الكمية الحالية':'Current qty',
  'التراكمي':'Cumulative',
  'إجمالي قيمة الأعمال الحالية':'Total value of current work',
  'ضريبة القيمة المضافة':'VAT',
  'صافي المستحق للدفع':'Net amount due',
  'قيمة الأعمال السابقة (مستخلصات سابقة)':'Value of previous work (prior claims)',
  'قيمة الأعمال الحالية (هذا المستخلص)':'Value of current work (this claim)',
  'قيمة الأعمال التراكمية':'Cumulative value of work',
  '(على الحالي)':'(on current)',
  'صافي المستحق للدفع (الحالي)':'Net amount due (current)',
  'معد المستخلص':'Prepared by',
  'مدير الموقع':'Site manager',
  'مدير المشروع':'Project manager',
  'التوقيع / التاريخ':'Signature / Date',
  'المرفقات':'Attachments',
  'ملفات المستخلص واستلامات الاستشاري':'Claim files and consultant receipts',
  'ملف مرفق':'Attached file'
});

// 🧾 الفاتورة الضريبية للمستخلص المعتمد
function showInvoice(m){
  const p = proj().info;
  const totalWithVat = m.gross + m.vat;
  const html = '<div style="font-family:var(--font)">' +
    '<div style="text-align:center;padding:14px 0;border-bottom:2px solid var(--amber);margin-bottom:14px">' +
      '<div style="font-size:11px;color:var(--text2);letter-spacing:2px">' + esc(p.contractor) + '</div>' +
      '<div style="font-size:18px;font-weight:700;color:var(--amber);margin:4px 0">فاتورة ضريبية — Tax Invoice</div>' +
      '<div style="font-size:14px;font-family:var(--mono);color:var(--teal)">' + esc(m.invoiceNo) + '</div></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:12px">' +
      '<div><span style="color:var(--text2)">المورد:</span> <strong>' + esc(p.contractor) + '</strong></div>' +
      '<div><span style="color:var(--text2)">تاريخ الفاتورة:</span> <strong>' + esc(m.invoiceDate) + '</strong></div>' +
      '<div><span style="color:var(--text2)">العميل:</span> <strong>' + esc(p.client || '—') + '</strong></div>' +
      '<div><span style="color:var(--text2)">المشروع:</span> <strong>' + esc(p.name) + '</strong></div>' +
      '<div><span style="color:var(--text2)">مرجع المستخلص:</span> <strong>' + esc(m.no) + ' بتاريخ ' + esc(m.date) + '</strong></div>' +
      '<div><span style="color:var(--text2)">اعتمده:</span> <strong>' + esc(m.approvedBy || '—') + '</strong></div>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px">' +
    '<thead><tr style="background:var(--bg3)">' + ['البيان','المبلغ (ر.س)'].map(hcell).join('') + '</tr></thead>' +
    '<tbody><tr>' + cell('قيمة الأعمال المنفذة حسب المستخلص رقم ' + esc(m.no) + ' (' + m.lines.length + ' بند)') +
      cell(fmtN(m.gross), 'text-align:center;font-family:var(--mono)') + '</tr></tbody>' +
    '<tfoot>' +
      '<tr>' + cell('<strong>الإجمالي قبل الضريبة</strong>', 'text-align:right') + cell(fmtN(m.gross), 'text-align:center;font-family:var(--mono)') + '</tr>' +
      '<tr>' + cell('ضريبة القيمة المضافة ' + m.vatRate + '%', 'text-align:right') + cell(fmtN(m.vat), 'text-align:center;font-family:var(--mono)') + '</tr>' +
      '<tr style="background:var(--green-dim)">' + cell('<strong style="color:var(--green-bright)">الإجمالي شامل الضريبة</strong>', 'text-align:right') +
        cell('<strong style="color:var(--green-bright);font-size:15px">' + fmtN(totalWithVat) + '</strong>', 'text-align:center;font-family:var(--mono)') + '</tr>' +
    '</tfoot></table>' +
    '<div style="font-size:11px;color:var(--text2);margin-bottom:10px">ملاحظة: تُطبق المحتجزات (ضمان ' + m.retRate + '% / دفعة مقدمة ' + m.advRate + '%) عند السداد حسب شروط العقد — صافي المستحق: ' + money(m.net) + '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px;font-size:12px">' +
      '<div style="text-align:center;border-top:1px solid var(--border);padding-top:8px"><div style="color:var(--text2)">عن المورد</div><div style="margin-top:26px;color:var(--text3)">التوقيع / الختم</div></div>' +
      '<div style="text-align:center;border-top:1px solid var(--border);padding-top:8px"><div style="color:var(--text2)">استلمها عن العميل</div><div style="margin-top:26px;color:var(--text3)">التوقيع / التاريخ</div></div>' +
    '</div></div>';
  showPrintable('🧾 فاتورة ' + m.invoiceNo, html);
}

// عرض وثيقة عامة (خطاب / تقرير) في نافذة الطباعة
function showPrintable(title, html){
  currentDoc = null;
  $('doc-title').textContent = title;
  $('doc-csv-btn').style.display = 'none';
  $('doc-content').innerHTML = html;
  $('doc-modal').classList.add('open');
}

function printDoc(){
  const content = $('doc-content').innerHTML;
  const w = window.open('', '_blank');
  const dir = LANG === 'en' ? 'ltr' : 'rtl';
  w.document.write('<!DOCTYPE html><html lang="' + LANG + '" dir="' + dir + '"><head><meta charset="UTF-8"><title>' + T('مستخلص - عزوم المتحدة') + '</title><style>' +
    "@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');" +
    "* { box-sizing:border-box; margin:0; padding:0; } body { font-family:'IBM Plex Sans Arabic',sans-serif; background:#fff; color:#000; padding:20px; direction:" + dir + "; }" +
    ':root { --bg3:#f2f2f2; --border:#bbb; --amber:#8a5a00; --green:#1a6e2e; --green-bright:#14571f; --green-dim:#e8f5ea; --red:#a01818; --text:#000; --text2:#444; --text3:#777; --font:inherit; --mono:monospace; }' +
    '</style></head><body>' + content + '</body></html>');
  w.document.close();
  setTimeout(() => w.print(), 400);
}
Object.assign(I18N_EN, { 'مستخلص - عزوم المتحدة':'Claim - Azoom United' });
