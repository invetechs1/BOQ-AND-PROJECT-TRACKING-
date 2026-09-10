'use strict';
// ============================================================
//  طلبات تعديل الإنتاجية (رقابة على مدير المشروع)
// ============================================================
// يُنشئ مدير المشروع طلباً؛ لا يُطبَّق إلا بموافقة مالك الشركة (العميل) أو أدمن النظام
function submitEditRequest(payload){
  const p = proj();
  p.editRequests = p.editRequests || [];
  p.editRequests.push(Object.assign({
    id: nextSeq(), status:'pending',
    by: currentUser().name, byId: state.me.id, createdAt: new Date().toISOString(),
    clientApproved:false, clientBy:'', pmoApproved:false, pmoBy:''
  }, payload));
  save(); renderAll();
  alert(T('📨 تم إرسال الطلب إلى مالك الشركة — لن يُطبَّق أي تغيير أو حذف إلا بعد موافقته.'));
}

const pendingEditRequests = () => (proj().editRequests||[]).filter(r => r.status === 'pending');

function approveEditRequest(id){
  if (!canApproveEdits()) { alert(T('اعتماد التعديلات والحذف صلاحية مالك الشركة فقط')); return; }
  const r = (proj().editRequests||[]).find(x => x.id === id);
  if (!r || r.status !== 'pending') return;
  const me = currentUser().name + (state.me.role === 'admin' ? T(' (أدمن)') : '');
  // موافقة مالك الشركة وحدها تكفي وتُطبِّق فوراً
  r.clientApproved = true; r.clientBy = me; r.pmoApproved = true; r.pmoBy = me;
  if (r.type === 'log_delete') applyLogDelete(r.logId, true);
  else if (r.type === 'log_edit') applyLogEdit(r.logId, r.newQty, r.newNote);
  else if (r.type === 'item_delete') applyItemDelete(r.itemId);
  else if (r.type === 'qty_edit') {
    const it = getItem(r.itemId);
    if (it) {
      it.executedQty = Math.round(clamp(r.newQty, 0, it.totalQty) * 100) / 100;
      if ((it.approvedQty||0) > it.executedQty) it.approvedQty = it.executedQty;
    }
  }
  r.status = 'applied'; r.appliedAt = new Date().toISOString();
  save(); renderAll();
}

function rejectEditRequest(id){
  if (!canApproveEdits()) { alert(T('رفض التعديلات صلاحية مالك الشركة فقط')); return; }
  const r = (proj().editRequests||[]).find(x => x.id === id);
  if (!r || r.status !== 'pending') return;
  const reason = prompt(T('سبب رفض طلب التعديل (اختياري):')) || '';
  r.status = 'rejected'; r.rejectedBy = currentUser().name; r.rejectReason = reason; r.rejectedAt = new Date().toISOString();
  save(); renderAll();
}

// صندوق طلبات تعديل الإنتاجية (للعميل ومدير المشاريع + عرض حالة لمدير المشروع)
function renderEditRequests(){
  const box = $('edit-requests-box'); if (!box) return;
  const pend = pendingEditRequests();
  const badge = $('tc-prod-req');
  if (badge) { badge.textContent = pend.length; badge.style.display = (pend.length && canApproveEdits()) ? '' : 'none'; }
  if (canApproveEdits()) {
    if (!pend.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="card orange-b" style="margin-bottom:14px"><div class="sc-header"><div class="sc-icon" style="background:var(--orange-dim,rgba(240,136,62,0.15))">🔔</div>' +
      '<div><div style="font-weight:700">' + T('طلبات تعديل الإنتاجية بانتظار موافقتك') + ' (' + pend.length + ')</div>' +
      '<div style="font-size:11px;color:var(--text2)">' + T('لن يُطبَّق أي تعديل أو حذف من مدير المشروع إلا بموافقتك — الموافقة تُطبِّق فوراً والرفض يُبقي كل شيء كما هو') + '</div></div></div>' +
      '<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">' +
      pend.map(r => {
        const cOk = '';
        const mOk = '';
        const already = false;
        return '<div class="sc-item" style="align-items:flex-start;flex-direction:column;gap:6px;border:1px solid var(--border);border-radius:8px;padding:10px">' +
          '<div style="font-size:13px">' + esc(r.label||r.type) + '</div>' +
          (r.reason ? '<div style="font-size:12px;color:var(--text2)">' + T('السبب:') + ' ' + esc(r.reason) + '</div>' : '') +
          '<div style="font-size:11px;color:var(--text3)">' + T('مقدّم الطلب:') + ' ' + esc(r.by||'—') + ' · ' + esc((r.createdAt||'').slice(0,16).replace('T',' ')) + '</div>' +
          '<div style="display:flex;gap:6px">' +
          '<button class="mini-btn green" onclick="approveEditRequest(' + r.id + ')">✅ ' + T('موافقة وتطبيق') + '</button>' +
          '<button class="mini-btn red" onclick="rejectEditRequest(' + r.id + ')">✖ ' + T('رفض') + '</button>' +
          '</div></div>';
      }).join('') + '</div></div>';
  } else if (editsGated()) {
    // مدير المشروع يرى حالة طلباته
    const mine = (proj().editRequests||[]).filter(r => r.byId === state.me.id).slice(-8).reverse();
    const pendMine = mine.filter(r => r.status === 'pending');
    if (!pendMine.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="alert info" style="font-size:12px"><strong>' + T('طلبات بانتظار موافقة مالك الشركة') + ' (' + pendMine.length + ')</strong><br>' +
      pendMine.map(r => '• ' + esc(r.label||r.type) + ' — ⏳ ' + T('بانتظار موافقة مالك الشركة')).join('<br>') + '</div>';
  } else { box.innerHTML = ''; }
}
Object.assign(I18N_EN, {
  'تعديل الكمية المنفذة للبند ':'Editing the executed quantity for item ',
  ' من ':' from ',
  ' إلى ':' to ',
  'تعديل يومية ':'Editing log ',
  ' · بند ':' · item ',
  ': الكمية من ':': quantity from ',
  'حذف يومية ':'Deleting log ',
  ' (بند ':' (item ',
  '📨 إرسال طلب التعديل للإدارة':'📨 Send edit request to admin',
  '💾 حفظ التعديل':'💾 Save edit',
  'اكتب كمية صحيحة':'Enter a valid quantity',
  'اكتب سبب التعديل ليطّلع عليه المعتمِدون':'Enter a reason for the edit for the approvers to see',
  ' سيتم خصم الكمية من نسبة إنجاز البند.':' The quantity will be deducted from the item\'s completion percentage.',
  ' وستحذف صورها.':' and its photos will be deleted.',
  '📨 تم إرسال طلب التعديل إلى الإدارة (العميل ومدير المشاريع). لن يُطبَّق التغيير إلا بعد موافقتهما.':'📨 The edit request was sent to admin (client and projects manager). The change will not apply until both approve.',
  'اعتماد التعديلات صلاحية العميل ومدير المشاريع':'Approving edits is restricted to the client and projects manager',
  ' (أدمن)':' (admin)',
  'رفض التعديلات صلاحية العميل ومدير المشاريع':'Rejecting edits is restricted to the client and projects manager',
  'سبب رفض طلب التعديل (اختياري):':'Reason for rejecting the edit request (optional):',
  'طلبات تعديل الإنتاجية بانتظار موافقتك':'Productivity edit requests awaiting your approval',
  'لن يُطبَّق أي تعديل من مدير المشروع إلا بموافقة العميل ومدير المشاريع معاً':'No edit from a project manager will apply without the joint approval of the client and projects manager',
  'السبب:':'Reason:',
  'مقدّم الطلب:':'Requested by:',
  'وافقت — بانتظار الطرف الآخر':'Approved — awaiting the other party',
  'موافقة':'Approve',
  'رفض':'Reject',
  'طلبات تعديل بانتظار موافقة الإدارة':'Edit requests awaiting admin approval',
  '📨 تم إرسال الطلب إلى مالك الشركة — لن يُطبَّق أي تغيير أو حذف إلا بعد موافقته.':'📨 Request sent to the company owner — no change or deletion is applied until they approve it.',
  'اعتماد التعديلات والحذف صلاحية مالك الشركة فقط':'Approving edits and deletions is restricted to the company owner',
  'رفض التعديلات صلاحية مالك الشركة فقط':'Rejecting edits is restricted to the company owner',
  'لن يُطبَّق أي تعديل أو حذف من مدير المشروع إلا بموافقتك — الموافقة تُطبِّق فوراً والرفض يُبقي كل شيء كما هو':'No edit or deletion from the project manager is applied without your approval — approving applies it immediately, rejecting keeps everything as is',
  'موافقة وتطبيق':'Approve & apply',
  'طلبات بانتظار موافقة مالك الشركة':'Requests awaiting the company owner\'s approval',
  'بانتظار موافقة مالك الشركة':'Awaiting the company owner\'s approval',
  'حذف البند ':'Delete item ',
  'سيُسجَّل الباقي':'The remainder will be logged',
  'يوميةً باسمك، ويتحول البند إلى بانتظار اعتماد الاستشاري.':'as a work log in your name, and the item moves to pending consultant approval.',
  'البند منفذ 100% أصلاً.':'The item is already 100% executed.',
  '✔ البند الآن منفذ 100% وبانتظار اعتماد الاستشاري (اعتماد + استلام موقّع).':'✔ The item is now 100% executed and pending consultant approval (approval + signed receipt).'
});
