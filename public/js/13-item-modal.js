'use strict';
// ============================================================
//  ITEM MODAL (add / edit)
// ============================================================
let editingItemId = null;

function openItemModal(id, opts){
  opts = opts || {};
  editingItemId = id;
  const it = id ? getItem(id) : null;
  const presetParent = it ? (it.parentId || '') : (opts.parentId || '');
  const parItem = presetParent ? getItem(presetParent) : null;
  $('item-modal-title').textContent = it ? T('تعديل بند ') + it.id : (parItem ? T('إضافة بند فرعي تحت ') + parItem.id : T('إضافة بند جديد'));
  $('im-delete-btn').style.display = it ? '' : 'none';
  // قائمة البنود الرئيسية المؤهلة: أي بند ليس فرعياً بنفسه وليس هو البند الحالي وليس من فروع البند الحالي
  const kidIds = it ? new Set(childrenOf(it.id).map(k=>k.id)) : new Set();
  const parentOpts = proj().boqItems.filter(c => (!it || c.id !== it.id) && !isChild(c) && !kidIds.has(c.id));
  $('im-parent').innerHTML = '<option value="">' + T('— بند مستقل (بدون تجميع)') + '</option>' +
    parentOpts.map(c => '<option value="' + esc(c.id) + '"' + (c.id===presetParent?' selected':'') + '>' + esc(c.id) + ' — ' + esc(c.desc.substring(0,40)) + '</option>').join('');
  // اقتراح رقم للبند الفرعي الجديد
  const suggestId = (!it && parItem) ? parItem.id + '.' + (childrenOf(parItem.id).length + 1) : '';
  $('im-id').value = it ? it.id : suggestId; $('im-id').disabled = !!it;
  $('im-div').value = it ? it.div : (parItem ? parItem.div : 'DIV 9');
  $('im-divAr').value = it ? (it.divAr||'') : (parItem ? (parItem.divAr||'') : '');
  $('im-desc').value = it ? it.desc : '';
  $('im-unit').value = it ? it.unit : (parItem ? parItem.unit : 'م²');
  $('im-qtyv').value = it ? it.qtyPerVilla : (parItem ? parItem.qtyPerVilla : '');
  // بند فرعي (مكوّن سعر تقسيم): الكمية والمنفذ مرآة للبند الأصلي — تُعرض هنا للعلم فقط ولا تُعدَّل
  $('im-qty').value = it ? qtyBase(it).totalQty : (parItem ? parItem.totalQty : '');
  $('im-rate').value = it ? it.unitRate : '';
  $('im-exec').value = it ? qtyBase(it).executedQty : 0;
  $('im-qty').disabled = $('im-exec').disabled = !!(it && isSplitChild(it));
  $('im-scope').value = it ? it.scope : 'azoom';
  $('im-blk').checked = !!(it && it.blocker && it.blocker.active);
  $('im-blk-reason').value = it && it.blocker ? it.blocker.reason : '';
  $('im-blk-type').value = it && it.blocker ? it.blocker.type : 'external';
  $('im-blk-note').value = it && it.blocker ? (it.blocker.note||'') : '';
  $('im-blk-since').value = it && it.blocker ? (it.blocker.since||'') : '';
  $('im-blk-expected').value = it && it.blocker ? (it.blocker.expected||'') : '';
  $('im-notes').value = it ? (it.notes||'') : '';
  $('div-list').innerHTML = [...new Set(proj().boqItems.map(i=>i.div))].map(d=>'<option value="'+esc(d)+'">').join('');
  const preds = it ? (it.predecessors||[]) : [];
  $('im-preds').innerHTML = proj().boqItems.filter(i => !it || i.id !== it.id).map(i =>
    '<label><input type="checkbox" value="' + esc(i.id) + '"' + (preds.includes(i.id)?' checked':'') + '> <span class="item-no">' + esc(i.id) + '</span> ' + esc(i.desc.substring(0,50)) + '</label>'
  ).join('');
  imRateHint();
  $('item-modal').classList.add('open');
}

// تنويه مقارنة أسعار الفروع مع البند الرئيسي (إرشادي فقط)
function imRateHint(){
  const hint = $('im-parent-hint'); if (!hint) return;
  const parId = $('im-parent').value;
  if (!parId) { hint.textContent = ''; return; }
  const par = getItem(parId); if (!par) { hint.textContent = ''; return; }
  const myRate = Number($('im-rate').value) || 0;
  const others = childrenOf(parId).filter(k => k.id !== editingItemId).reduce((s,k) => s + (k.unitRate||0), 0);
  const sum = others + myRate;
  const diff = Math.round((sum - (par.unitRate||0)) * 100) / 100;
  const cmp = Math.abs(diff) < 0.01
    ? '<span style="color:var(--green)">✓ ' + T('مطابق لسعر البند الرئيسي') + '</span>'
    : (diff > 0 ? '<span style="color:var(--amber)">' + T('أعلى بـ ') + fmtN(diff) + '</span>' : '<span style="color:var(--amber)">' + T('أقل بـ ') + fmtN(-diff) + '</span>');
  hint.innerHTML = T('مجموع أسعار الفروع = ') + '<strong>' + fmtN(sum) + '</strong> ' + T('مقابل سعر البند الرئيسي') + ' <strong>' + fmtN(par.unitRate||0) + '</strong> — ' + cmp;
}

function saveItem(){
  const id = $('im-id').value.trim();
  if (!id || !$('im-desc').value.trim() || !$('im-qty').value || !$('im-rate').value) { alert(T('أكمل الحقول الإلزامية: رقم البند، الوصف، الكمية، السعر')); return; }
  if (!editingItemId && getItem(id)) { alert(T('رقم البند موجود مسبقاً')); return; }
  const preds = [...$('im-preds').querySelectorAll('input:checked')].map(c => c.value);
  if (preds.includes(id)) { alert(T('البند لا يمكن أن يعتمد على نفسه')); return; }
  // البند الرئيسي (للتقسيم إلى بنود فرعية) — مستوى واحد فقط
  let parentId = $('im-parent').value || null;
  if (parentId) {
    if (parentId === id) { alert(T('البند لا يمكن أن يكون فرعاً من نفسه')); return; }
    const par = getItem(parentId);
    if (par && par.parentId) { alert(T('لا يمكن التداخل أكثر من مستوى واحد — اختر بنداً رئيسياً ليس فرعياً بنفسه')); return; }
    if (editingItemId && childrenOf(editingItemId).length) { alert(T('هذا البند رئيسي وله بنود فرعية — لا يمكن جعله فرعاً لبند آخر')); return; }
  }
  const blkActive = $('im-blk').checked;
  const data = {
    id, div:$('im-div').value.trim()||'—', divAr:$('im-divAr').value.trim(), desc:$('im-desc').value.trim(),
    unit:$('im-unit').value.trim()||'—', qtyPerVilla:Number($('im-qtyv').value)||0,
    totalQty:Number($('im-qty').value)||0, unitRate:Number($('im-rate').value)||0,
    executedQty:clamp($('im-exec').value, 0, Number($('im-qty').value)||0),
    scope:$('im-scope').value, predecessors:preds, parentId,
    blocker: blkActive ? {active:true, reason:$('im-blk-reason').value.trim()||T('عائق غير محدد'), type:$('im-blk-type').value, note:$('im-blk-note').value.trim(), since:$('im-blk-since').value || todayStr(), expected:$('im-blk-expected').value || ''} : null,
    notes:$('im-notes').value.trim()
  };
  if (editingItemId) {
    const it = getItem(editingItemId);
    if (isSplitChild(it)) {
      // بند فرعي (مكوّن سعر تقسيم): يُعدَّل فقط الوصف وسعر الوحدة — الكمية والتنفيذ مرآة للبند الأصلي ولا تُكتب هنا
      it.desc = data.desc; it.unitRate = data.unitRate; it.notes = data.notes;
      closeModal('item-modal'); save(); renderAll();
      return;
    }
    // مدير المشروع: تعديل الكمية المنفذة من نموذج البند يتطلب موافقة الإدارة — لا يُطبَّق مباشرة
    let qtyReq = null;
    if (editsGated() && Math.abs((data.executedQty||0) - (it.executedQty||0)) > 0.001) {
      qtyReq = { type:'qty_edit', itemId:it.id, fromQty:(it.executedQty||0), newQty:data.executedQty,
        label:T('تعديل الكمية المنفذة للبند ') + it.id + T(' من ') + fmtQ(it.executedQty||0) + T(' إلى ') + fmtQ(data.executedQty) + ' ' + (it.unit||'') };
      data.executedQty = it.executedQty; // إبقاء القيمة الأصلية حتى الموافقة
    }
    data.claimedQty = it.claimedQty;
    data.approvedQty = Math.min(it.approvedQty||0, data.executedQty);
    data.approvals = it.approvals || [];
    Object.assign(it, data);
    closeModal('item-modal');
    if (qtyReq) submitEditRequest(qtyReq); else { save(); renderAll(); }
    return;
  } else {
    if (editsGated()) data.executedQty = 0; // البنود الجديدة من مدير المشروع تبدأ بكمية منفذة صفر
    data.claimedQty = 0;
    data.approvedQty = 0; // الكميات الجديدة تبدأ بانتظار اعتماد الاستشاري
    data.approvals = [];
    proj().boqItems.push(data);
    if (parentId) { expandedGroups.add(parentId); collapsedGroups.delete(parentId); }
  }
  closeModal('item-modal'); save(); renderAll();
}

function deleteItem(){
  if (!editingItemId) return;
  const it = getItem(editingItemId);
  // مدير المشروع: حذف البند يتطلب موافقة مالك الشركة — لا حذف مباشر
  if (editsGated()) {
    closeModal('item-modal');
    submitEditRequest({ type:'item_delete', itemId: editingItemId,
      label: T('حذف البند ') + esc(editingItemId) + ' — ' + esc((it.desc||'').substring(0,60)) });
    return;
  }
  const kids = childrenOf(editingItemId);
  const kidsAreSplit = kids.length && !!kids[0].splitAt; // مكوّنات تقسيم سعر: تُحذف مع الأب (لا معنى لها منفردة) — بخلاف بند فرعي مستقل يُفك ارتباطه
  if (kids.length) {
    const msg = kidsAreSplit
      ? T('هذا البند مقسَّم السعر — سيُحذف معه كل أجزائه') + ' (' + kids.length + '). ' + T('متابعة؟')
      : T('هذا بند رئيسي وله ') + kids.length + T(' بند فرعي. سيصبح كل فرعٍ بنداً مستقلاً. متابعة؟');
    if (!confirm(msg)) return;
  }
  if (it.claimedQty > 0 && !confirm(T('هذا البند مرفوع في مستخلصات سابقة. متأكد من حذفه؟'))) return;
  if (!confirm(T('حذف البند ') + editingItemId + T(' نهائياً؟'))) return;
  applyItemDelete(editingItemId);
  closeModal('item-modal'); save(); renderAll();
}

// تنفيذ حذف البند فعلياً (مباشرة من الإدارة أو بعد اعتماد مالك الشركة للطلب)
function applyItemDelete(itemId){
  const kids = childrenOf(itemId);
  const kidsAreSplit = kids.length && !!kids[0].splitAt;
  proj().boqItems = proj().boqItems.filter(i => i.id !== itemId);
  if (kidsAreSplit) {
    // مكوّنات تقسيم السعر تُحذف مع البند الأصلي
    const kidIds = new Set(kids.map(k => k.id));
    proj().boqItems = proj().boqItems.filter(i => !kidIds.has(i.id));
  } else {
    // فك ارتباط الفروع المستقلة لتصبح بنوداً مستقلة
    proj().boqItems.forEach(i => { if (i.parentId === itemId) i.parentId = null; });
  }
  proj().boqItems.forEach(i => { i.predecessors = (i.predecessors||[]).filter(p => p !== itemId); });
  delete proj().villaProgress[itemId];
  proj().workLogs = (proj().workLogs||[]).filter(l => l.itemId !== itemId);
}

// «منجز»: المهندس يعلن اكتمال البند — الباقي يُسجَّل يوميةً موثقة باسمه،
// فيصل المنفذ 100% ويتحول البند تلقائياً إلى «بانتظار اعتماد الاستشاري»
function markItemDone(id){
  const it = getItem(id);
  if (!it || it.totalQty <= 0) return;
  const remaining = Math.round(Math.max(0, it.totalQty - (it.executedQty||0)) * 100) / 100;
  if (remaining < 0.001) { alert(T('البند منفذ 100% أصلاً.')); return; }
  if (!confirm(T('تسجيل البند كمنجز 100%؟') + '\n' + T('سيُسجَّل الباقي') + ' (' + fmtQ(remaining) + ' ' + it.unit + ') ' + T('يوميةً باسمك، ويتحول البند إلى بانتظار اعتماد الاستشاري.'))) return;
  it.executedQty = it.totalQty;
  proj().workLogs.push({
    id: nextSeq(), date: todayStr(), crew: T('إعلان إنجاز البند'),
    itemId: id, villaNo: '', qty: remaining, workers: 0,
    note: T('تسجيل البند كمنجز 100% (الكمية المتبقية)'), applied: true, appliedQty: remaining,
    by: currentUser().name, photos: []
  });
  save(); renderAll();
  alert(T('✔ البند الآن منفذ 100% وبانتظار اعتماد الاستشاري (اعتماد + استلام موقّع).'));
}
