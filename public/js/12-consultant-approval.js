'use strict';
// ============================================================
//  اعتماد الاستشاري على الكميات (مع استلام موقّع)
// ============================================================
let aqItemId = null, aqPendingFiles = [], aqThenMustakhlas = false;
function openApproveQty(id, opts){
  const it = getItem(id);
  if (!it) return;
  if (!pdbCanApproveQty()) { alert(T('اعتماد الكميات صلاحية فريق المشروع')); return; }
  aqItemId = id; aqPendingFiles = []; aqThenMustakhlas = !!(opts && opts.thenMustakhlas);
  $('aq-title').textContent = aqThenMustakhlas ? T('📤 تحويل الكمية إلى مستخلص (رفع الاستلام)') : T('📋 اعتماد كمية من الاستشاري');
  const pend = pendingApprovalQty(it);
  $('aq-info').innerHTML = '<strong>' + esc(it.desc) + '</strong><br>' + T('منفذ ميدانياً:') + ' ' + fmtQ(qtyBase(it).executedQty||0) + ' ' + esc(it.unit) +
    ' · ' + T('معتمد سابقاً:') + ' ' + fmtQ(approvedOf(it)) + ' · <span style="color:var(--orange)">' + T('بانتظار الاعتماد:') + ' ' + fmtQ(pend) + '</span>';
  $('aq-sysqty').value = Math.round(pend*100)/100; // المنفذ غير المعتمد الذي أدخله المهندس
  $('aq-arqty').value = Math.round(pend*100)/100;
  $('aq-qty').value = Math.round(pend*100)/100;
  $('aq-qty').max = pend;
  $('aq-date').value = todayStr();
  $('aq-consultant').value = ''; $('aq-arno').value = ''; $('aq-note').value = '';
  $('aq-file').value = ''; renderAqFiles();
  aqCheckMatch();
  $('approve-qty-modal').classList.add('open');
}
function renderAqFiles(){
  $('aq-file-name').innerHTML = aqPendingFiles.map((f,i) =>
    '<span>' + (f.name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼') + ' ' + esc(f.name) +
    ' <span style="color:var(--red);cursor:pointer" onclick="aqPendingFiles.splice(' + i + ',1);renderAqFiles()">✕</span></span>').join('');
}
// تنبيه فوري عند اختلاف الكمية المعتمدة عن الموقّعة على الاستلام أو عن المنفذ في النظام
function aqCheckMatch(){
  const sys = Number($('aq-sysqty').value)||0, ar = Number($('aq-arqty').value)||0, ap = Number($('aq-qty').value)||0;
  const box = $('aq-match');
  let msg = '', color = '';
  if (ar && Math.abs(ar - ap) > 0.01) { msg = '⚠️ ' + T('الكمية المعتمدة (') + fmtQ(ap) + T(') لا تطابق الموقّعة على الاستلام (') + fmtQ(ar) + ')'; color = 'red'; }
  else if (ar && Math.abs(ar - sys) > 0.01) { msg = '⚠️ ' + T('تنبيه: الموقّع على الاستلام (') + fmtQ(ar) + T(') يختلف عن المنفذ في النظام (') + fmtQ(sys) + T(') — سيُسجّل الفرق للمراجعة.'); color = 'amber'; }
  else if (ar) { msg = '✅ ' + T('الكميات متطابقة'); color = 'green'; }
  if (msg) { box.style.display = 'block'; box.innerHTML = '<div style="font-size:12px;color:var(--' + color + ')">' + msg + '</div>'; }
  else box.style.display = 'none';
}
async function aqFilePicked(input){
  for (const f of [...input.files]) {
    try {
      if (f.type === 'application/pdf') { if (f.size > 9*1024*1024) { alert(f.name + ': ' + T('أكبر من 9MB')); continue; } aqPendingFiles.push({dataUrl: await readFileAsDataURL(f), name: f.name}); }
      else if (f.type.startsWith('image/')) aqPendingFiles.push({dataUrl: await compressImage(f), name: f.name});
      else alert(f.name + ': ' + T('PDF أو صورة فقط'));
    } catch(e) { alert(e.message); }
  }
  input.value = ''; renderAqFiles();
}
async function saveApproveQty(){
  const it = getItem(aqItemId);
  if (!it) return;
  const pend = pendingApprovalQty(it);
  const qty = Number($('aq-qty').value);
  if (!qty || qty <= 0) { alert(T('اكتب الكمية المعتمدة')); return; }
  if (qty > pend + 0.001) { alert(T('الكمية المعتمدة تتجاوز الكمية المنفذة بانتظار الاعتماد (') + fmtQ(pend) + ')'); return; }
  if (!aqPendingFiles.length) { alert(T('📎 إرفاق استلام الاستشاري الموقّع إلزامي (ويمكن إضافة ملفات داعمة)')); return; }
  if (offlineMode) { alert(T('📴 لا يمكن الاعتماد بدون اتصال')); return; }
  let docs = [];
  try { for (const f of aqPendingFiles) { const r = await API.req('POST', '/api/projects/' + proj().id + '/photos', {dataUrl: f.dataUrl}); docs.push({url: r.url, name: f.name}); } }
  catch(e) { alert(T('تعذر رفع الملفات:') + ' ' + e.message); return; }
  const arQty = Number($('aq-arqty').value) || qty;
  it.approvals = it.approvals || [];
  it.approvals.push({id: nextSeq(), qty, arQty, sysQty: Number($('aq-sysqty').value)||0,
    date: $('aq-date').value || todayStr(), consultant: $('aq-consultant').value.trim(),
    arNo: $('aq-arno').value.trim(), ar: docs[0], docs, note: $('aq-note').value.trim(), by: currentUser().name});
  it.approvedQty = Math.min(qtyBase(it).executedQty||0, (it.approvedQty||0) + qty);
  const toMustakhlas = aqThenMustakhlas;
  closeModal('approve-qty-modal'); save(); renderAll();
  if (toMustakhlas) {
    mbAddItem(it.id); // الكمية أصبحت مستلمة → ننتقل مباشرة لبناء المستخلص
    setTimeout(() => alert('✅ ' + T('تم اعتماد') + ' ' + fmtQ(qty) + ' ' + esc(it.unit) + ' ' + T('بالاستلام — الكمية أُضيفت للمستخلص. أكمل باقي البنود ثم اضغط "حفظ ورفع المستخلص".')), 100);
  } else {
    alert('✅ ' + T('اعتُمدت') + ' ' + fmtQ(qty) + ' ' + esc(it.unit) + ' ' + T('بالاستلام — أصبحت جاهزة للرفع في المستخلص.'));
  }
}
Object.assign(I18N_EN, {
  '📤 تحويل الكمية إلى مستخلص (رفع الاستلام)':'📤 Convert quantity to claim (upload receipt)',
  '📋 اعتماد كمية من الاستشاري':'📋 Approve quantity from consultant',
  'منفذ ميدانياً:':'Executed on site:',
  'معتمد سابقاً:':'Previously approved:',
  'بانتظار الاعتماد:':'Awaiting approval:',
  'الكمية المعتمدة (':'Approved quantity (',
  ') لا تطابق الموقّعة على الاستلام (':') does not match the signed receipt (',
  'تنبيه: الموقّع على الاستلام (':'Note: the signed receipt (',
  ') يختلف عن المنفذ في النظام (':') differs from what is recorded as executed in the system (',
  ') — سيُسجّل الفرق للمراجعة.':') — the difference will be logged for review.',
  'الكميات متطابقة':'Quantities match',
  'أكبر من 9MB':'larger than 9MB',
  'PDF أو صورة فقط':'PDF or image only',
  'الكمية المعتمدة تتجاوز الكمية المنفذة بانتظار الاعتماد (':'The approved quantity exceeds the executed quantity awaiting approval (',
  'تم اعتماد':'Approved',
  'بالاستلام — الكمية أُضيفت للمستخلص. أكمل باقي البنود ثم اضغط "حفظ ورفع المستخلص".':'with a receipt — the quantity was added to the claim. Finish the remaining items then click "Save and submit claim".',
  'اعتُمدت':'Approved',
  'بالاستلام — أصبحت جاهزة للرفع في المستخلص.':'with a receipt — it is now ready to claim.'
});

// 🔍 تدقيق استلامات الاستشاري — يراجعه المالك: مطابقة الكمية المنفذة (المهندس) مع الموقّعة على الاستلام (الاستشاري)
function buildApprovalAudit(){
  const p = proj();
  // كل الاستلامات
  const rows = [];
  p.boqItems.forEach(it => {
    (it.approvals||[]).forEach(a => rows.push({it, a}));
  });
  rows.sort((x,y) => (y.a.date||'').localeCompare(x.a.date||''));

  const arLink = a => a.ar ? '<a href="' + esc(a.ar.url) + '" target="_blank" style="color:var(--blue)">' + (String(a.ar.url).endsWith('.pdf')?'📄':'🖼') + ' ' + T('فتح ↗') + '</a>' : '<span style="color:var(--red)">' + T('لا يوجد') + '</span>';
  const auditRows = rows.map(({it,a}) => {
    const arq = a.arQty !== undefined ? a.arQty : a.qty;
    const mismatch = Math.abs(arq - a.qty) > 0.01;               // المعتمد ≠ الموقّع على الاستلام
    const sysDiff = a.sysQty !== undefined && Math.abs((a.sysQty) - arq) > 0.01; // الموقّع ≠ ما أدخله المهندس وقتها
    const flag = mismatch ? '<span style="color:var(--red);font-weight:700">⚠️ ' + T('لا تطابق') + '</span>'
      : sysDiff ? '<span style="color:var(--amber)">⚠️ ' + T('فرق عن إدخال المهندس') + '</span>'
      : '<span style="color:var(--green)">✅ ' + T('مطابق') + '</span>';
    return '<tr' + (mismatch||sysDiff ? ' style="background:' + (mismatch?'var(--red-dim)':'var(--amber-dim)') + '"' : '') + '>' +
      cell('<span style="font-family:var(--mono);color:var(--amber)">' + esc(it.id) + '</span> ' + esc(it.desc.slice(0,40))) +
      cell(esc(a.date), 'text-align:center;font-family:var(--mono)') +
      cell(a.sysQty !== undefined ? fmtQ(a.sysQty) : '—', 'text-align:center;font-family:var(--mono);color:var(--blue)') +
      cell(fmtQ(arq), 'text-align:center;font-family:var(--mono);color:var(--purple)') +
      cell(fmtQ(a.qty), 'text-align:center;font-family:var(--mono);color:var(--green)') +
      cell(esc(a.consultant||'—') + (a.arNo ? '<br><span style="font-size:10px;color:var(--text3)">' + T('استلام') + ' ' + esc(a.arNo) + '</span>' : ''), 'font-size:11px') +
      cell(esc(a.by||'—'), 'font-size:11px') +
      cell(arLink(a), 'text-align:center') +
      cell(flag, 'text-align:center') +
      '</tr>';
  }).join('');

  // بنود منفذة لم تُعتمد بعد (بانتظار استلام الاستشاري)
  // يشمل أجزاء تقسيم السعر أيضاً (لكل جزء اعتماده الخاص) — لا يقتصر على actionableItems()
  const pendingItems = proj().boqItems.filter(i => pendingApprovalQty(i) > 0.001);
  const pendingRows = pendingItems.map(it =>
    '<tr>' + cell('<span style="font-family:var(--mono);color:var(--amber)">' + esc(it.id) + '</span> ' + esc(it.desc.slice(0,45))) +
    cell(fmtQ(it.executedQty), 'text-align:center;font-family:var(--mono);color:var(--blue)') +
    cell(fmtQ(approvedOf(it)), 'text-align:center;font-family:var(--mono);color:var(--green)') +
    cell(fmtQ(pendingApprovalQty(it)), 'text-align:center;font-family:var(--mono);color:var(--orange)') +
    cell(esc(it.unit), 'text-align:center') + '</tr>').join('');

  const mismatches = rows.filter(({a}) => { const arq=a.arQty!==undefined?a.arQty:a.qty; return Math.abs(arq-a.qty)>0.01; }).length;
  const sec = (t,c) => '<div style="font-size:14px;font-weight:700;color:var(--' + (c||'amber') + ');margin:16px 0 8px">' + t + '</div>';
  const tbl = (heads, body) => '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--bg3)">' + heads.map(hcell).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>';

  const html = '<div style="font-family:var(--font)">' +
    docHeader(T('تقرير تدقيق استلامات الاستشاري'), todayStr()) +
    '<div class="alert ' + (mismatches ? 'danger' : 'success') + '" style="font-size:12px">' +
      (mismatches ? '⚠️ ' + T('يوجد') + ' ' + mismatches + ' ' + T('استلام الكمية المعتمدة فيه لا تطابق الكمية الموقّعة — راجعها.') : '✅ ' + T('جميع الكميات المعتمدة مطابقة للكميات الموقّعة على الاستلامات.')) +
      ' ' + T('الأعمدة:') + ' <strong>' + T('المنفذ حسب النظام') + '</strong> ' + T('(أدخله المهندس) مقابل') + ' <strong>' + T('الموقّع على الاستلام') + '</strong> ' + T('(وقّعه الاستشاري) مقابل') + ' <strong>' + T('المعتمد') + '</strong> ' + T('(دخل المستخلص).') + '</div>' +
    sec(T('استلامات الاستشاري المسجّلة') + ' (' + rows.length + ')') +
    (rows.length ? tbl(['البند','التاريخ','منفذ (النظام)','موقّع (الاستلام)','معتمد','الاستشاري','سجّله','الاستلام','المطابقة'].map(T), auditRows) : '<p style="font-size:12px;color:var(--text2)">' + T('لا توجد استلامات مسجّلة بعد') + '</p>') +
    sec(T('بنود منفذة بانتظار اعتماد الاستشاري') + ' (' + pendingItems.length + ')', 'orange') +
    (pendingItems.length ? tbl(['البند','منفذ','معتمد','بانتظار الاعتماد','الوحدة'].map(T), pendingRows) : '<p style="font-size:12px;color:var(--green)">' + T('لا توجد كميات منفذة بانتظار الاعتماد ✅') + '</p>') +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px;font-size:12px">' +
      '<div style="text-align:center;border-top:1px solid var(--border);padding-top:8px"><div style="color:var(--text2)">' + T('دقّقه') + '</div><div style="margin-top:26px;color:var(--text3)">' + T('التوقيع / التاريخ') + '</div></div>' +
      '<div style="text-align:center;border-top:1px solid var(--border);padding-top:8px"><div style="color:var(--text2)">' + T('المالك / الإدارة') + '</div><div style="margin-top:26px;color:var(--text3)">' + T('التوقيع / التاريخ') + '</div></div>' +
    '</div></div>';
  showPrintable(T('🔍 تدقيق استلامات الاستشاري'), html);
}
Object.assign(I18N_EN, {
  'فتح ↗':'Open ↗',
  'لا يوجد':'None',
  'لا تطابق':'Mismatch',
  'فرق عن إدخال المهندس':'Differs from field entry',
  'مطابق':'Matches',
  'استلام':'receipt',
  'تقرير تدقيق استلامات الاستشاري':'Consultant Receipts Audit Report',
  'يوجد':'There',
  'استلام الكمية المعتمدة فيه لا تطابق الكمية الموقّعة — راجعها.':'receipt(s) where the approved quantity does not match the signed quantity — please review.',
  'جميع الكميات المعتمدة مطابقة للكميات الموقّعة على الاستلامات.':'All approved quantities match the quantities signed on the receipts.',
  'الأعمدة:':'Columns:',
  'المنفذ حسب النظام':'Executed per system',
  '(أدخله المهندس) مقابل':'(entered by the engineer) vs.',
  'الموقّع على الاستلام':'Signed on receipt',
  '(وقّعه الاستشاري) مقابل':'(signed by the consultant) vs.',
  'المعتمد':'Approved',
  '(دخل المستخلص).':'(entered the claim).',
  'استلامات الاستشاري المسجّلة':'Consultant receipts recorded',
  'التاريخ':'Date',
  'منفذ (النظام)':'Executed (system)',
  'موقّع (الاستلام)':'Signed (receipt)',
  'الاستشاري':'Consultant',
  'سجّله':'Logged by',
  'المطابقة':'Match',
  'لا توجد استلامات مسجّلة بعد':'No receipts recorded yet',
  'بنود منفذة بانتظار اعتماد الاستشاري':'Items executed and awaiting consultant approval',
  'منفذ':'executed',
  'بانتظار الاعتماد':'Awaiting approval',
  'لا توجد كميات منفذة بانتظار الاعتماد ✅':'No executed quantities awaiting approval ✅',
  'دقّقه':'Audited by',
  'التوقيع / التاريخ':'Signature / Date',
  'المالك / الإدارة':'Owner / Management',
  'موقّع على الاستلام:':'Signed on receipt:',
  'الاستشاري:':'Consultant:',
  'استلام رقم':'Receipt no.',
  'الاستلام':'Receipt',
  'سجّله:':'Logged by:',
  'استلامات بند':'Receipts for item',
  'حذف اعتماد':'Delete approval',
  '؟ سترجع الكمية لبانتظار الاعتماد.':'? The quantity will return to awaiting approval.'
});

function viewApprovals(id){
  const it = getItem(id);
  if (!it || !(it.approvals||[]).length) return;
  const rows = it.approvals.map((a,i) => {
    const arq = a.arQty !== undefined ? a.arQty : a.qty;
    const mism = Math.abs(arq - a.qty) > 0.01;
    return '<div class="sc-item" style="align-items:flex-start"><span class="sc-item-name" style="white-space:normal">' +
    (mism ? '⚠️' : '✅') + ' ' + T('معتمد') + ' <strong>' + fmtQ(a.qty) + ' ' + esc(it.unit) + '</strong>' +
    ' · ' + T('موقّع على الاستلام:') + ' <strong style="color:' + (mism?'var(--red)':'var(--purple)') + '">' + fmtQ(arq) + '</strong>' +
    ' — ' + esc(a.date) + (a.consultant ? ' · ' + T('الاستشاري:') + ' ' + esc(a.consultant) : '') + (a.arNo ? ' · ' + T('استلام رقم') + ' ' + esc(a.arNo) : '') +
    '<br><span style="font-size:11px">' + T('سجّله:') + ' ' + esc(a.by||'—') + (a.note ? ' · ' + esc(a.note) : '') + '</span></span>' +
    '<span style="display:flex;flex-direction:column;gap:2px;align-items:flex-end">' +
    ((a.docs && a.docs.length ? a.docs : (a.ar ? [a.ar] : [])).map(d => '<a href="' + esc(d.url) + '" target="_blank" style="color:var(--blue);font-size:11px">' + (String(d.url).endsWith('.pdf')?'📄':'🖼') + ' ' + esc(d.name||T('ملف')) + ' ↗</a>').join('')) +
    (pdbCanApproveQty() ? '<button class="mini-btn red" onclick="deleteApproval(\'' + esc(id) + '\',' + a.id + ')">🗑</button>' : '') +
    '</span></div>';
  }).join('');
  showPrintable('📋 ' + T('استلامات بند') + ' ' + it.id, '<div style="font-family:var(--font)"><div style="font-size:13px;font-weight:700;margin-bottom:8px">' + esc(it.desc) + '</div>' + rows + '</div>');
}

function deleteApproval(id, approvalId){
  const it = getItem(id);
  if (!it) return;
  const a = (it.approvals||[]).find(x => x.id === approvalId);
  if (!a) return;
  if (approvedOf(it) - a.qty < claimedPct(it)*it.totalQty - 0.001) { alert(T('لا يمكن حذف هذا الاعتماد: كمية معتمدة منه مرفوعة بمستخلص. احذف المستخلص أولاً.')); return; }
  if (!confirm(T('حذف اعتماد') + ' ' + fmtQ(a.qty) + ' ' + esc(it.unit) + T('؟ سترجع الكمية لبانتظار الاعتماد.'))) return;
  (a.docs && a.docs.length ? a.docs : (a.ar ? [a.ar] : [])).forEach(d => { const file = String(d.url).split('/').pop(); API.req('DELETE', '/api/projects/' + proj().id + '/photos/' + file).catch(()=>{}); });
  it.approvals = it.approvals.filter(x => x.id !== approvalId);
  it.approvedQty = Math.max(0, (it.approvedQty||0) - a.qty);
  closeModal('doc-modal'); save(); renderAll();
}
