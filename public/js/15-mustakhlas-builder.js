'use strict';
// ============================================================
//  MUSTAKHLAS BUILDER
// ============================================================
let mbSel = {}; // itemId -> qty

function claimableItems(){ return proj().boqItems.filter(i => i.scope !== 'others' && !isParent(i) && !isSplitChild(i) && availQty(i) > 0.01); }

let mbRatesProjectId = null; // آخر مشروع زُامنت له حقول محتجز الضمان / الدفعة المقدمة
function renderBuilder(){
  if (!$('mb-date').value) $('mb-date').value = todayStr();
  // زامن حقول النسب مع المشروع الحالي عند أول عرض أو عند تبديل المشروع
  // (وليس فقط عند كون الحقل فارغاً — وإلا تبقى نسب مشروع سابق عالقة بعد التبديل)
  if (mbRatesProjectId !== proj().id) {
    $('mb-ret').value = proj().info.retentionRate;
    $('mb-adv').value = proj().info.advanceRate;
    mbRatesProjectId = proj().id;
  }
  const list = claimableItems();
  $('mb-tbody').innerHTML = list.map(it => {
    const sel = mbSel[it.id] !== undefined;
    const qty = sel ? mbSel[it.id] : availQty(it);
    return '<tr style="' + (sel?'background:var(--green-dim)':'') + '">' +
      '<td><input type="checkbox" class="item-check"' + (sel?' checked':'') + ' onchange="mbToggle(\'' + esc(it.id) + '\', this.checked)"></td>' +
      '<td><span class="item-no">' + esc(it.id) + '</span></td>' +
      '<td><div class="desc-text" style="max-width:200px" data-tip="' + esc(it.desc) + '">' + esc(it.desc) + '</div></td>' +
      '<td>' + esc(it.unit) + '</td>' +
      '<td class="amount muted">' + fmtRate(it.unitRate) + '</td>' +
      '<td class="amount" style="color:var(--green)">' + fmtQ(approvedOf(it)) + '</td>' +
      '<td class="amount muted">' + fmtQ(it.claimedQty) + '</td>' +
      '<td><input type="number" class="qty-input" min="0" max="' + availQty(it) + '" step="0.1" value="' + (Math.round(qty*100)/100) + '"' + (sel?'':' disabled') + ' onchange="mbQty(\'' + esc(it.id) + '\', this.value)"></td>' +
      '<td class="amount claimable">' + (sel ? fmtN(qty * it.unitRate) : '—') + '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="9"><div class="empty-state"><p>' + T('لا توجد كميات معتمدة غير مرفوعة — اعتمد الكميات من الاستشاري أولاً (بمرفق الاستلام)') + '</p></div></td></tr>';
  renderMbTotals();
}
Object.assign(I18N_EN, { 'لا توجد كميات معتمدة غير مرفوعة — اعتمد الكميات من الاستشاري أولاً (بمرفق الاستلام)':'No approved quantities left unclaimed — get consultant approval first (with a receipt attachment)' });

function mbToggle(id, on){
  const it = getItem(id);
  if (on) mbSel[id] = availQty(it); else delete mbSel[id];
  renderBuilder();
}
function mbQty(id, val){
  const it = getItem(id);
  mbSel[id] = clamp(val, 0, availQty(it));
  renderBuilder();
}
function mbSelectAll(){ claimableItems().forEach(it => { mbSel[it.id] = availQty(it); }); renderBuilder(); }
function mbClear(){ mbSel = {}; renderBuilder(); }
function mbAddItem(id){ const it = getItem(id); if (it && availQty(it) > 0.01) { mbSel[id] = availQty(it); } switchTab('invoice'); switchInvView('new'); renderBuilder(); }

// زر "📤 مستخلص" في جدول الكميات: لو الكمية غير مستلمة بعد → نافذة رفع الاستلام أولاً ثم التحويل للمستخلص
function itemToMustakhlas(id){
  const it = getItem(id);
  if (!it) return;
  const pend = pendingApprovalQty(it), avail = availQty(it);
  if (pend > 0.01) {
    // يوجد كمية منفذة لم تُستلم بعد — نطلب استلام الاستشاري + الملفات الداعمة، ثم ننتقل للمستخلص
    if (!pdbCanApproveQty()) { alert(T('رفع الاستلام وتحويل الكمية للمستخلص صلاحية فريق المشروع')); return; }
    openApproveQty(id, {thenMustakhlas: true});
  } else if (avail > 0.01) {
    // الكمية مستلمة ومعتمدة مسبقاً → مباشرة للمستخلص
    mbAddItem(id);
  } else {
    alert(T('لا توجد كمية جاهزة لهذا البند.'));
  }
}
Object.assign(I18N_EN, {
  'رفع الاستلام وتحويل الكمية للمستخلص صلاحية فريق المشروع':'Uploading the receipt and converting the quantity to a claim is restricted to the project team',
  'لا توجد كمية جاهزة لهذا البند.':'No ready quantity for this item.'
});

function mbCompute(){
  const lines = [];
  Object.entries(mbSel).forEach(([id, qty]) => {
    const it = getItem(id);
    if (!it || qty <= 0) return;
    lines.push({itemId:id, desc:it.desc, unit:it.unit, rate:it.unitRate, totalQty:it.totalQty,
      prevQty:it.claimedQty, currQty:qty, cumQty:it.claimedQty + qty, amount:round2(qty * it.unitRate)});
  });
  const gross = round2(lines.reduce((s,l) => s + l.amount, 0));
  const vatRate = proj().info.vatRate, retRate = Number($('mb-ret').value)||0, advRate = Number($('mb-adv').value)||0;
  const vat = round2(gross * vatRate/100), retention = round2(gross * retRate/100), advance = round2(gross * advRate/100);
  return {lines, gross, vatRate, retRate, advRate, vat, retention, advance, net: round2(gross + vat - retention - advance)};
}

function renderMbTotals(){
  const c = mbCompute();
  $('mb-count').textContent = c.lines.length + ' ' + T('بند');
  $('mb-totals').innerHTML =
    '<div style="font-size:11px;color:var(--text2);margin-bottom:6px">💡 ' + T('القيمة محسوبة بسعر الوحدة فقط (غير شامل الضريبة) — تُضاف ضريبة القيمة المضافة أدناه في المطالبة') + '</div>' +
    '<div class="sc-item"><span class="sc-item-name">' + T('قيمة الأعمال الحالية') + '</span><span class="sc-item-val" style="color:var(--green-bright)">' + money(c.gross) + '</span></div>' +
    '<div class="sc-item"><span class="sc-item-name">+ ' + T('ضريبة') + ' ' + c.vatRate + '%</span><span class="sc-item-val">' + money(c.vat) + '</span></div>' +
    '<div class="sc-item"><span class="sc-item-name">− ' + T('محتجز ضمان') + ' ' + c.retRate + '%</span><span class="sc-item-val" style="color:var(--red)">' + money(c.retention) + '</span></div>' +
    '<div class="sc-item"><span class="sc-item-name">− ' + T('استرداد دفعة مقدمة') + ' ' + c.advRate + '%</span><span class="sc-item-val" style="color:var(--red)">' + money(c.advance) + '</span></div>' +
    '<div class="sc-item"><span class="sc-item-name" style="font-weight:700">' + T('صافي المستحق') + '</span><span class="sc-item-val" style="color:var(--green-bright);font-size:15px;font-weight:700">' + money(c.net) + '</span></div>';
}

// ---- مرفقات المستخلص (ملفات المستخلص + استلامات الاستشاري) ----
let mbPendingFiles = []; // [{dataUrl, name}]

function readFileAsDataURL(f){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error(T('تعذر قراءة الملف')));
    r.readAsDataURL(f);
  });
}

async function mbFilesPicked(input){
  const files = [...(input.files || [])].slice(0, 15 - mbPendingFiles.length);
  for (const f of files) {
    try {
      if (f.type === 'application/pdf') {
        if (f.size > 9 * 1024 * 1024) { alert(f.name + ': ' + T('الملف أكبر من 9MB')); continue; }
        mbPendingFiles.push({dataUrl: await readFileAsDataURL(f), name: f.name});
      } else if (f.type.startsWith('image/')) {
        mbPendingFiles.push({dataUrl: await compressImage(f), name: f.name});
      } else {
        alert(f.name + ': ' + T('الصيغة غير مدعومة (PDF أو صور فقط)'));
      }
    } catch(e) { alert(e.message); }
  }
  input.value = '';
  renderMbFilesList();
}
Object.assign(I18N_EN, {
  'تعذر قراءة الملف':'Could not read the file',
  'الملف أكبر من 9MB':'File larger than 9MB',
  'الصيغة غير مدعومة (PDF أو صور فقط)':'Unsupported format (PDF or images only)'
});

function renderMbFilesList(){
  $('mb-files-list').innerHTML = mbPendingFiles.map((f, i) =>
    '<div class="sc-item" style="padding:3px 0"><span class="sc-item-name" style="font-size:11px">' +
    (f.name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼') + ' ' + esc(f.name) + '</span>' +
    '<button class="mini-btn red" onclick="mbPendingFiles.splice(' + i + ',1);renderMbFilesList()">✕</button></div>'
  ).join('');
}

async function uploadMbFiles(){
  const uploaded = [];
  for (const f of mbPendingFiles) {
    const r = await API.req('POST', '/api/projects/' + proj().id + '/photos', {dataUrl: f.dataUrl});
    uploaded.push({url: r.url, name: f.name});
  }
  return uploaded;
}

async function saveMustakhlas(){
  const c = mbCompute();
  if (!c.lines.length) { alert(T('حدّد بنود أولاً')); return; }
  if (offlineMode) { alert(T('📴 لا يمكن الرفع بدون اتصال')); return; }
  if (!mbPendingFiles.length && state.me.role === 'pm' &&
      !confirm(T('⚠️ لم ترفق ملفات المستخلص واستلامات الاستشاري — مدير المشاريع يحتاجها للاعتماد. متابعة بدون مرفقات؟'))) return;
  if (!confirm(T('رفع المستخلص بقيمة') + ' ' + money(c.gross) + T(' للمراجعة والاعتماد؟ سيتم خصم الكميات من الرصيد القابل للرفع.'))) return;
  let attachments = [];
  if (mbPendingFiles.length) {
    try { attachments = await uploadMbFiles(); }
    catch(e) { alert(T('تعذر رفع المرفقات:') + ' ' + e.message); return; }
  }
  const no = 'MUS-' + String(proj().mustakhlasat.length + 1).padStart(3,'0');
  const rec = {id: nextSeq(), no, date: $('mb-date').value || todayStr(), status:'submitted',
    lines:c.lines, gross:c.gross, vatRate:c.vatRate, retRate:c.retRate, advRate:c.advRate,
    vat:c.vat, retention:c.retention, advance:c.advance, net:c.net, notes:$('mb-notes').value.trim(),
    payments:[], by: currentUser().name, attachments};
  c.lines.forEach(l => { const it = getItem(l.itemId); if (it) it.claimedQty = Math.min(it.totalQty, it.claimedQty + l.currQty); });
  proj().mustakhlasat.push(rec);
  mbSel = {}; $('mb-notes').value = '';
  mbPendingFiles = []; renderMbFilesList();
  save(); renderAll(); switchInvView('history'); showDoc(rec);
  if (state.me.role === 'pm') setTimeout(() => alert(T('✅ تم رفع المستخلص للمراجعة — سيظهر لمدير المشاريع لاعتماده وإصدار الفاتورة.')), 300);
}
Object.assign(I18N_EN, { '✅ تم رفع المستخلص للمراجعة — سيظهر لمدير المشاريع لاعتماده وإصدار الفاتورة.':'✅ The claim was submitted for review — it will appear to the project manager for approval and invoicing.' });

function previewMustakhlas(){
  const c = mbCompute();
  if (!c.lines.length) { alert(T('حدّد بنود أولاً')); return; }
  showDoc({no:T('(معاينة - غير محفوظ)'), date:$('mb-date').value||todayStr(), status:'preview', ...c, notes:$('mb-notes').value.trim()});
}
Object.assign(I18N_EN, {
  'القيمة محسوبة بسعر الوحدة فقط (غير شامل الضريبة) — تُضاف ضريبة القيمة المضافة أدناه في المطالبة':'The value is calculated at the unit price only (excluding VAT) — VAT is added below in the claim',
  'قيمة الأعمال الحالية':'Value of current work',
  'محتجز ضمان':'Retention',
  'استرداد دفعة مقدمة':'Advance recovery',
  'صافي المستحق':'Net due',
  'حدّد بنود أولاً':'Select items first',
  'حفظ المستخلص بقيمة':'Save the claim worth',
  '؟ سيتم خصم الكميات من الرصيد القابل للرفع.':'? Quantities will be deducted from the claimable balance.',
  '(معاينة - غير محفوظ)':'(Preview - not saved)',
  '📴 لا يمكن الرفع بدون اتصال':'📴 Cannot submit while offline',
  '⚠️ لم ترفق ملفات المستخلص واستلامات الاستشاري — مدير المشاريع يحتاجها للاعتماد. متابعة بدون مرفقات؟':'⚠️ You have not attached the claim files and consultant receipts — the project manager needs these for approval. Continue without attachments?',
  'رفع المستخلص بقيمة':'Submit the claim worth',
  ' للمراجعة والاعتماد؟ سيتم خصم الكميات من الرصيد القابل للرفع.':' for review and approval? Quantities will be deducted from the claimable balance.',
  'تعذر رفع المرفقات:':'Could not upload attachments:'
});
