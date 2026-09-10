'use strict';
// ============================================================
//  MUSTAKHLAS HISTORY
// ============================================================
const MUS_STATUS = {
  submitted:{label:'⏳ بانتظار الاعتماد', color:'amber'},
  rejected:{label:'↩ معاد للتعديل', color:'red'},
  approved:{label:'✅ معتمد', color:'blue'},
  paid:{label:'💵 مدفوع', color:'green'}
};
const musLbl = m => T(m.label);
// من يراجع ويعتمد ويصدر الفواتير ويسجل الدفعات؟ مدير المشاريع فأعلى
const canReviewMus = () => ['admin','client','pmo'].includes(state.me.role);
Object.assign(I18N_EN, {
  '⏳ بانتظار الاعتماد':'⏳ Awaiting approval',
  '↩ معاد للتعديل':'↩ Returned for correction',
  '✅ معتمد':'✅ Approved',
  '💵 مدفوع':'💵 Paid'
});

let invView = 'new';
function switchInvView(v){
  invView = v;
  $('inv-view-new').style.display = v === 'new' ? '' : 'none';
  $('inv-view-history').style.display = v === 'history' ? '' : 'none';
  $('inv-tab-new').classList.toggle('active', v === 'new');
  $('inv-tab-history').classList.toggle('active', v === 'history');
}

function renderHistory(){
  const asc = [...proj().mustakhlasat].sort((a,b) => a.date.localeCompare(b.date) || a.id - b.id);
  // التراكمي حتى تاريخ كل مستخلص
  const cumMap = {};
  let running = 0;
  asc.forEach(m => { running += m.gross; cumMap[m.id] = running; });
  const totGross = running;
  const totNet = asc.reduce((s,m) => s + m.net, 0);
  const totPaid = asc.reduce((s,m) => s + paidAmount(m), 0);

  $('inv-hist-count').textContent = asc.length;

  // ملخص مالي أعلى صفحة المستخلصات السابقة
  const t = totals();
  $('mus-kpis').innerHTML = [
    {label:'عدد المستخلصات', value:asc.length, color:'amber', sub:asc.length ? T('آخرها') + ' ' + asc[asc.length-1].date : '—'},
    {label:'إجمالي قيمة الأعمال المرفوعة', value:money(totGross), color:'teal', sub:((t.azoomScope>0? (totGross/t.azoomScope*100).toFixed(1):0)) + T('% من قيمة النطاق')},
    {label:'إجمالي صافي المستحق', value:money(totNet), color:'blue', sub:T('بعد الضريبة والمحتجزات')},
    {label:'💵 المحصل نقداً', value:money(totPaid), color:'green', sub:T('من المستخلصات المرفوعة')},
    {label:'متبقي التحصيل', value:money(Math.max(0, totNet - totPaid)), color:'red', sub:T('مستحق لم يُدفع بعد')}
  ].map(k => '<div class="kpi-card ' + k.color + '"><div class="kpi-label">' + T(k.label) + '</div><div class="kpi-value ' + k.color + '">' + k.value + '</div><div class="kpi-sub">' + k.sub + '</div></div>').join('');

  const list = [...asc].reverse(); // الأحدث أولاً
  $('mus-history-tbody').innerHTML = list.map(m => {
    const stm = MUS_STATUS[m.status] || MUS_STATUS.submitted;
    const paid = paidAmount(m);
    const nAtt = (m.attachments||[]).length;
    // أزرار سير العمل حسب الدور والحالة
    let flowBtns = '';
    if (canReviewMus()) {
      if (m.status === 'submitted') flowBtns = '<button class="mini-btn green" onclick="approveMus(' + m.id + ')">✅ ' + T('اعتماد') + '</button> <button class="mini-btn red" onclick="rejectMus(' + m.id + ')">↩ ' + T('إرجاع') + '</button> ';
      else if (m.status === 'approved' && !m.invoiceNo) flowBtns = '<button class="mini-btn green" onclick="issueInvoice(' + m.id + ')">🧾 ' + T('إصدار الفاتورة') + '</button> ';
      if (m.invoiceNo) flowBtns += '<button class="mini-btn" onclick="viewInvoice(' + m.id + ')">🧾 ' + esc(m.invoiceNo) + '</button> ';
      if (['approved','paid'].includes(m.status)) flowBtns += '<button class="mini-btn green" onclick="openPay(' + m.id + ')">💵 ' + T('دفعة') + '</button> ';
    }
    const canDelete = canReviewMus() || ['submitted','rejected'].includes(m.status);
    return '<tr>' +
      '<td><span class="item-no">' + esc(m.no) + '</span>' + (nAtt ? '<br><span class="pill blue" style="font-size:9px" data-tip="' + T('مرفقات:') + ' ' + (m.attachments||[]).map(a=>esc(a.name||T('ملف'))).join(' · ') + '">📎 ' + nAtt + '</span>' : '') + '</td>' +
      '<td style="font-family:var(--mono);font-size:12px">' + esc(m.date) + '</td>' +
      '<td>' + m.lines.length + '</td>' +
      '<td class="amount">' + fmtN(m.gross) + '</td>' +
      '<td class="amount" style="color:var(--teal)">' + fmtN(cumMap[m.id]) + '</td>' +
      '<td class="amount claimable">' + fmtN(m.net) + '</td>' +
      '<td class="amount" style="color:' + (paid >= m.net - 1 ? 'var(--green-bright)' : paid > 0 ? 'var(--amber)' : 'var(--text3)') + '" data-tip="' + (m.payments||[]).map(p => esc(p.date) + ': ' + fmtN(p.amount)).join(' | ') + '">' + (paid > 0 ? fmtN(paid) : '—') + '</td>' +
      '<td><span class="pill ' + stm.color + '"' + (m.status === 'rejected' && m.rejectReason ? ' data-tip="' + T('سبب الإرجاع:') + ' ' + esc(m.rejectReason) + '"' : '') + (m.status !== 'submitted' && m.approvedBy ? ' data-tip="' + T('اعتمده') + ' ' + esc(m.approvedBy) + ' — ' + esc(m.approvedAt||'') + '"' : '') + '>' + musLbl(stm) + '</span></td>' +
      '<td style="font-size:11px;color:var(--text3)">' + esc(m.by || '—') + '</td>' +
      '<td style="white-space:nowrap"><button class="mini-btn" onclick="viewMus(' + m.id + ')">📄 ' + T('عرض') + '</button> ' + flowBtns +
      (canDelete ? '<button class="mini-btn red" onclick="deleteMus(' + m.id + ')">🗑</button>' : '') + '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="10"><div class="empty-state"><p>' + T('لا توجد مستخلصات مرفوعة بعد — أعد مستخلصك الأول من "إعداد مستخلص جديد"') + '</p></div></td></tr>';

  $('mus-history-tfoot').innerHTML = asc.length ? '<tr class="summary-row">' +
    '<td colspan="3" style="text-align:start;color:var(--text2)">' + T('الإجمالي') + ' (' + asc.length + ' ' + T('مستخلص') + ')</td>' +
    '<td class="amount" style="color:var(--amber)">' + fmtN(totGross) + '</td><td></td>' +
    '<td class="amount claimable">' + fmtN(totNet) + '</td>' +
    '<td class="amount" style="color:var(--green-bright)">' + fmtN(totPaid) + '</td><td colspan="3"></td></tr>' : '';

  // monthly claimed chart
  const byMonth = {};
  proj().mustakhlasat.forEach(m => { const k = (m.date||'').slice(0,7); if (k) byMonth[k] = (byMonth[k]||0) + m.gross; });
  const months = Object.keys(byMonth).sort();
  const maxM = Math.max(1, ...months.map(k => byMonth[k]));
  $('mus-monthly').innerHTML = months.length ? months.map(k =>
    '<div class="bar-row"><div class="bar-label" style="width:80px;font-family:var(--mono);font-size:11px">' + esc(k) + '</div>' +
    '<div class="bar-track"><div class="bar-fill" style="width:' + (byMonth[k]/maxM*100) + '%;background:linear-gradient(90deg,var(--teal),var(--green))"></div></div>' +
    '<div class="bar-amount">' + money(byMonth[k]) + '</div></div>').join('')
    : '<div class="empty-state" style="padding:14px"><p>' + T('لا توجد مستخلصات بعد') + '</p></div>';
}
Object.assign(I18N_EN, {
  'اعتماد ✓':'Approve ✓',
  'تم الدفع 💵':'Mark paid 💵',
  'عرض':'View',
  'دفعة':'Payment',
  'اعتماد':'Approve',
  'إرجاع':'Return',
  'إصدار الفاتورة':'Issue invoice',
  'سبب الإرجاع:':'Reason for return:',
  'اعتمده':'Approved by',
  'لا توجد مستخلصات مرفوعة بعد':'No claims submitted yet',
  'لا توجد مستخلصات بعد':'No claims yet',
  'لا توجد مستخلصات مرفوعة بعد — أعد مستخلصك الأول من "إعداد مستخلص جديد"':'No claims submitted yet — prepare your first one from "New Claim"',
  'عدد المستخلصات':'Number of claims',
  'آخرها':'Last one',
  'إجمالي قيمة الأعمال المرفوعة':'Total value of submitted work',
  '% من قيمة النطاق':'% of scope value',
  'إجمالي صافي المستحق':'Total net due',
  'بعد الضريبة والمحتجزات':'After VAT and retentions',
  '💵 المحصل نقداً':'💵 Collected in cash',
  'من المستخلصات المرفوعة':'From submitted claims',
  'متبقي التحصيل':'Remaining to collect',
  'مستحق لم يُدفع بعد':'Due but not yet paid',
  'التراكمي حتى تاريخه':'Cumulative to date',
  'سجّله':'Logged by',
  'مرفقات:':'Attachments:'
});

// ---- payments ----
let payMusId = null;
function openPay(id){
  if (!canReviewMus()) { alert(T('تسجيل الدفعات صلاحية مدير المشاريع فأعلى')); return; }
  const m = proj().mustakhlasat.find(x => x.id === id);
  if (!m) return;
  payMusId = id;
  const paid = paidAmount(m);
  $('pay-info').textContent = m.no + ' — ' + T('صافي المستحق') + ' ' + money(m.net) + ' · ' + T('محصل') + ' ' + money(paid) + ' · ' + T('متبقي') + ' ' + money(Math.max(0, m.net - paid));
  $('pay-date').value = todayStr();
  $('pay-amount').value = Math.max(0, Math.round((m.net - paid) * 100) / 100);
  $('pay-note').value = '';
  $('pay-modal').classList.add('open');
}
function savePayment(){
  const m = proj().mustakhlasat.find(x => x.id === payMusId);
  if (!m) return;
  const amount = Number($('pay-amount').value);
  if (!amount || amount <= 0) { alert(T('اكتب مبلغ الدفعة')); return; }
  m.payments.push({id: nextSeq(), date: $('pay-date').value || todayStr(), amount, note: $('pay-note').value.trim(), by: currentUser().name});
  if (paidAmount(m) >= m.net - 1) m.status = 'paid';
  closeModal('pay-modal'); save(); renderAll();
}

// ---- سير الاعتماد: مراجعة مدير المشاريع → اعتماد → إصدار فاتورة ----
function approveMus(id){
  if (!canReviewMus()) { alert(T('الاعتماد صلاحية مدير المشاريع فأعلى')); return; }
  const m = proj().mustakhlasat.find(x => x.id === id);
  if (!m) return;
  if (!confirm(T('اعتماد المستخلص') + ' ' + m.no + ' ' + T('بقيمة') + ' ' + money(m.gross) + T('؟ راجع المرفقات واستلامات الاستشاري قبل الاعتماد.'))) return;
  m.status = 'approved';
  m.approvedBy = currentUser().name;
  m.approvedAt = todayStr();
  m.rejectReason = '';
  save(); renderAll();
}

function rejectMus(id){
  if (!canReviewMus()) return;
  const m = proj().mustakhlasat.find(x => x.id === id);
  if (!m) return;
  const reason = prompt(T('سبب الإرجاع للتعديل (سيظهر لمدير المشروع):'));
  if (reason === null) return;
  m.status = 'rejected';
  m.rejectReason = reason.trim() || T('يحتاج تعديل');
  m.approvedBy = currentUser().name;
  m.approvedAt = todayStr();
  save(); renderAll();
  alert(T('↩ تم إرجاع المستخلص — مدير المشروع يحذفه ويعيد رفعه بعد التصحيح (الكميات ترجع للرصيد عند الحذف).'));
}

function issueInvoice(id){
  if (!canReviewMus()) { alert(T('إصدار الفواتير صلاحية مدير المشاريع فأعلى')); return; }
  const m = proj().mustakhlasat.find(x => x.id === id);
  if (!m || m.status !== 'approved') return;
  const invCount = proj().mustakhlasat.filter(x => x.invoiceNo).length;
  m.invoiceNo = 'INV-' + String(invCount + 1).padStart(3,'0');
  m.invoiceDate = todayStr();
  m.invoiceBy = currentUser().name;
  save(); renderAll(); showInvoice(m);
}
Object.assign(I18N_EN, {
  'الاعتماد صلاحية مدير المشاريع فأعلى':'Approval is restricted to project managers and above',
  'اعتماد المستخلص':'Approve claim',
  'بقيمة':'worth',
  '؟ راجع المرفقات واستلامات الاستشاري قبل الاعتماد.':'? Review the attachments and consultant receipts before approving.',
  'سبب الإرجاع للتعديل (سيظهر لمدير المشروع):':'Reason for returning for correction (will be shown to the project manager):',
  'يحتاج تعديل':'Needs correction',
  '↩ تم إرجاع المستخلص — مدير المشروع يحذفه ويعيد رفعه بعد التصحيح (الكميات ترجع للرصيد عند الحذف).':'↩ The claim was returned — the project manager should delete it and resubmit after correcting (quantities are restored to the balance on deletion).',
  'إصدار الفواتير صلاحية مدير المشاريع فأعلى':'Issuing invoices is restricted to project managers and above'
});

function viewInvoice(id){ const m = proj().mustakhlasat.find(x => x.id === id); if (m && m.invoiceNo) showInvoice(m); }

function viewMus(id){ const m = proj().mustakhlasat.find(x => x.id === id); if (m) showDoc(m); }

function deleteMus(id){
  const m = proj().mustakhlasat.find(x => x.id === id);
  if (!m) return;
  if (!canReviewMus() && !['submitted','rejected'].includes(m.status)) { alert(T('لا يمكن حذف مستخلص معتمد — راجع مدير المشاريع')); return; }
  if (!confirm(T('حذف المستخلص') + ' ' + m.no + T('؟ سيتم إرجاع كمياته إلى الرصيد القابل للرفع.'))) return;
  m.lines.forEach(l => { const it = getItem(l.itemId); if (it) it.claimedQty = Math.max(0, it.claimedQty - l.currQty); });
  proj().mustakhlasat = proj().mustakhlasat.filter(x => x.id !== id);
  save(); renderAll();
}
Object.assign(I18N_EN, {
  'محصل':'Collected',
  'اكتب مبلغ الدفعة':'Enter the payment amount',
  'حذف المستخلص':'Delete claim',
  '؟ سيتم إرجاع كمياته إلى الرصيد القابل للرفع.':'? Its quantities will be returned to the claimable balance.',
  'لا يمكن حذف مستخلص معتمد — راجع مدير المشاريع':'An approved claim cannot be deleted — contact the project manager'
});
