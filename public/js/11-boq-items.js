'use strict';
// ============================================================
//  BOQ ITEMS TABLE
// ============================================================
let currentFilter = 'all';
const FILTERS = [
  ['all','الكل'], ['pending_approval','🕵 بانتظار اعتماد الاستشاري'], ['claimable','💰 له مطالبة'], ['partial','🟡 قيد التنفيذ'], ['available','▶ متاح للبدء'],
  ['waiting','⏳ ينتظر أعمال'], ['blocked','⛔ معيق'], ['done','✅ مكتمل'], ['claimed_full','📤 مرفوع بالكامل'], ['others','⚪ خارج النطاق']
];
function renderItemFilters(){
  $('items-filters').innerHTML = FILTERS.map(f =>
    '<button class="filter-btn' + (currentFilter===f[0]?' active':'') + '" onclick="setFilter(\'' + f[0] + '\')">' + T(f[1]) + '</button>'
  ).join(' ');
}
Object.assign(I18N_EN, {
  'الكل':'All',
  '💰 له مطالبة':'💰 Has claim',
  '🟡 قيد التنفيذ':'🟡 In progress',
  '▶ متاح للبدء':'▶ Available to start',
  '⏳ ينتظر أعمال':'⏳ Awaiting work',
  '⛔ معيق':'⛔ Blocked',
  '✅ مكتمل':'✅ Complete',
  '📤 مرفوع بالكامل':'📤 Fully claimed',
  '⚪ خارج النطاق':'⚪ Out of scope'
});
function setFilter(f){ currentFilter = f; renderItemFilters(); renderItemsTable(); }
// كتابة نص بحث تُبطل الفلتر الحالي بصرياً أيضاً (البحث يشمل كل الحالات) حتى لا يبدو الفلتر المميّز مضلّلاً
function searchItemsChanged(){
  if ($('search-items').value.trim() && currentFilter !== 'all') { currentFilter = 'all'; renderItemFilters(); }
  renderItemsTable();
}

// مجموعات مفتوحة (موسّعة) في جدول البنود — حالة عرض فقط للجلسة الحالية، لا تُحفظ.
// مطوية افتراضياً؛ أثناء البحث/الفلترة تُفتح تلقائياً المجموعة التي يوجد بها تطابق (ليظهر ضمن سياقه)،
// لكن لو المستخدم طواها يدوياً تبقى مطوية حتى أثناء البحث (بدل أن يبدو زر الطي/الفتح وكأنه لا يعمل)
const expandedGroups = new Set();
const collapsedGroups = new Set();
function isGroupExpanded(id, filtering){
  if (collapsedGroups.has(id)) return false;
  return expandedGroups.has(id) || !!filtering;
}
function toggleGroup(id){
  const wasExpanded = isGroupExpanded(id, isFilteringItems() && childrenOf(id).length > 0);
  if (wasExpanded) { collapsedGroups.add(id); expandedGroups.delete(id); }
  else { expandedGroups.add(id); collapsedGroups.delete(id); }
  renderItemsTable();
}
function isFilteringItems(){
  const search = ($('search-items').value || '').toLowerCase();
  return !!search || currentFilter !== 'all';
}

function renderItemsTable(){
  const search = ($('search-items').value || '').toLowerCase();
  const filtering = isFilteringItems();
  const matches = it => {
    if (search && !(it.desc.toLowerCase().includes(search) || it.id.toLowerCase().includes(search) || (it.divAr||'').includes(search))) return false;
    if (currentFilter === 'all') return true;
    if (currentFilter === 'claimable') return netClaimable(it) > 1;
    if (currentFilter === 'pending_approval') return pendingApprovalQty(it) > 0.001;
    return statusOf(it) === currentFilter;
  };
  // ترتيب هرمي: كل بند رئيسي يتبعه بنوده الفرعية
  const all = proj().boqItems;
  const topLevel = all.filter(it => !isChild(it));
  const rows = []; // {it, kind:'header'|'child'|'normal', expanded?}
  let shownLeaves = 0;
  topLevel.forEach(t => {
    if (isParent(t)) {
      const kids = childrenOf(t.id);
      const visKids = matches(t) ? kids : kids.filter(matches);
      if (matches(t) || visKids.length) {
        const expanded = isGroupExpanded(t.id, filtering && visKids.length > 0);
        rows.push({it:t, kind:'header', expanded});
        shownLeaves += visKids.length;
        if (expanded) visKids.forEach(k => { rows.push({it:k, kind:'child'}); });
      }
    } else if (matches(t)) {
      rows.push({it:t, kind:'normal'}); shownLeaves++;
    }
  });

  let sumAmt = 0, sumNet = 0;
  $('items-tbody').innerHTML = rows.map(({it, kind, expanded}) => {
    if (kind === 'header') {
      const g = groupAgg(it);
      sumAmt += g.amt; sumNet += g.net;
      const stColor = g.execPct>=DONE?'green':g.execPct>0?'amber':'red';
      return '<tr style="background:var(--panel2,rgba(127,127,127,0.06))">' +
        '<td class="sticky-col"><button class="group-toggle" onclick="toggleGroup(\'' + esc(it.id) + '\')" data-tip="' + T('عرض/إخفاء البنود الفرعية') + '" style="background:none;border:none;color:inherit;cursor:pointer;font-size:13px;padding:0 4px 0 0">' + (expanded?'▾':'▸') + '</button><span class="item-no">' + esc(it.id) + '</span><br><span style="font-size:10px;color:var(--text3)">' + esc(it.div) + '</span></td>' +
        '<td><div class="desc-text" style="font-weight:700;max-width:195px" data-tip="' + T('بند رئيسي مقسّم إلى ') + g.count + T(' بند فرعي') + '">📁 ' + esc(it.desc) + ' <span class="pill blue" style="font-size:9px">' + g.count + ' ' + T('فرعي') + '</span></div><span style="font-size:10px;color:var(--text3)">' + esc(it.divAr||'') + '</span></td>' +
        '<td class="tight"><span style="color:var(--text3)">—</span></td>' +
        '<td class="amount tight muted">—</td>' +
        '<td class="amount tight muted" data-tip="' + T('مجموع أسعار البنود الفرعية') + '">' + fmtN(g.rateSum) + '</td>' +
        '<td class="amount tight">' + fmtN(g.amt) + '</td>' +
        '<td class="tight"><span style="display:inline-flex;align-items:center;gap:5px"><span style="font-family:var(--mono);font-size:10px;color:var(--text2)">' + (g.execPct*100).toFixed(1) + '%</span><span class="prog-bar" style="width:44px"><span class="prog-fill ' + stColor + '" style="width:' + (g.execPct*100) + '%;display:block"></span></span></span></td>' +
        '<td class="tight">' + (g.pending>1 ? '<span style="font-size:11px;color:var(--orange)">🕵 ' + T('بانتظار') + ' ' + fmtN(g.pending) + '</span>' : '<span style="color:var(--text3)">—</span>') + '</td>' +
        '<td class="amount tight" style="color:var(--teal)">' + (g.claimedPct*100).toFixed(0) + '%</td>' +
        '<td class="amount tight ' + (g.net>1?'claimable':'muted') + '">' + (g.net>1?fmtN(g.net):'—') + '</td>' +
        '<td><span class="pill blue" style="font-size:10px">' + T('بند رئيسي') + '</span></td>' +
        '<td class="tight">—</td>' +
        '<td style="white-space:nowrap"><button class="mini-btn" onclick="openItemModal(\'' + esc(it.id) + '\')">✏️ ' + T('تعديل') + '</button></td>' +
        '</tr>';
    }
    const it2 = it, st = statusOf(it2), net = netClaimable(it2);
    const indent = kind === 'child';
    // ملاحظة: قيمة البند الفرعي مُحتسبة بالفعل ضمن مجموع البند الرئيسي (groupAgg) أعلاه — لا تُضاف مرة ثانية هنا
    if (!indent) { sumAmt += amt(it2); sumNet += net; }
    let depHtml = '—';
    if (it2.blocker && it2.blocker.active) depHtml = '<span class="blocker-box" data-tip="' + esc(it2.blocker.reason) + (it2.blocker.note ? ' — ' + esc(it2.blocker.note) : '') + '">⛔ ' + esc(it2.blocker.reason) + '</span>';
    else if ((it2.predecessors||[]).length) {
      const preds = it2.predecessors.map(pid => { const p = getItem(pid); return p ? esc(pid) + ' (' + (itemPct(p)*100).toFixed(0) + '%)' : esc(pid); }).join('، ');
      depHtml = '<span class="prereq-box" data-tip="' + esc(preds) + '">⏭ ' + preds + '</span>';
    }
    return '<tr' + (indent ? ' style="background:var(--panel2,rgba(127,127,127,0.02))"' : '') + '>' +
      '<td class="sticky-col"' + (indent?' style="padding-inline-start:18px"':'') + '><span class="item-no">' + (indent?'<span style="color:var(--text3)">↳ </span>':'') + esc(it2.id) + '</span><br><span style="font-size:10px;color:var(--text3)">' + esc(it2.div) + '</span></td>' +
      '<td><div class="desc-text" style="max-width:195px" data-tip="' + esc(it2.desc) + '">' + esc(it2.desc) + '</div><span style="font-size:10px;color:var(--text3)">' + esc(it2.divAr||'') + '</span></td>' +
      '<td class="tight"><span class="pill gray" style="font-size:10px">' + esc(it2.unit) + '</span></td>' +
      '<td class="amount tight muted">' + fmtQ(qtyBase(it2).totalQty) + '</td>' +
      '<td class="amount tight muted">' + fmtN(it2.unitRate) + '</td>' +
      '<td class="amount tight">' + fmtN(amt(it2)) + '</td>' +
      '<td class="tight">' + (it2.scope==='others' ? '<span style="color:var(--text3)">—</span>' :
        isSplitChild(it2) ?
        ('<span style="display:inline-flex;flex-direction:column;gap:3px;align-items:flex-start">' +
         '<span style="font-size:10px;color:var(--text3)" data-tip="' + T('الكمية والتنفيذ مرآة للبند الأصلي — عدّلها من') + ' ' + esc(it2.parentId) + '">' + T('مرآة للبند الأصلي') + '</span>' +
         '<span style="display:inline-flex;align-items:center;gap:5px"><span style="font-family:var(--mono);font-size:10px;color:var(--text2)">' + (itemPct(it2)*100).toFixed(1) + '%</span><span class="prog-bar" style="width:44px"><span class="prog-fill ' + (itemPct(it2)>=DONE?'green':itemPct(it2)>0?'amber':'red') + '" style="width:' + (itemPct(it2)*100) + '%;display:block"></span></span></span>' +
         '</span>') :
        ('<span style="display:inline-flex;flex-direction:column;gap:3px;align-items:flex-start">' +
        '<input type="number" class="qty-input" style="width:70px" min="0" max="' + it2.totalQty + '" step="any" value="' + (Math.round((it2.executedQty||0)*100)/100) + '" onchange="setItemQty(\'' + esc(it2.id) + '\', this.value)" data-tip="' + T('أدخل الكمية المنفذة (من أصل ') + fmtQ(it2.totalQty) + ' ' + esc(it2.unit) + T(') — العميل يحاسب بالكميات') + '">' +
        '<span style="display:inline-flex;align-items:center;gap:5px"><span style="font-family:var(--mono);font-size:10px;color:var(--text2)">' + (itemPct(it2)*100).toFixed(1) + '%</span><span class="prog-bar" style="width:44px"><span class="prog-fill ' + (itemPct(it2)>=DONE?'green':itemPct(it2)>0?'amber':'red') + '" style="width:' + (itemPct(it2)*100) + '%;display:block"></span></span></span>' +
        '</span>')) + '</td>' +
      '<td class="tight">' + approvalCell(it2) + '</td>' +
      '<td class="amount tight" style="color:var(--teal)">' + (claimedPct(it2)*100).toFixed(0) + '%</td>' +
      '<td class="amount tight ' + (net>1?'claimable':'muted') + '">' + (net>1?fmtN(net):'—') + '</td>' +
      '<td>' + statusPill(st) + '</td>' +
      '<td class="tight">' + depHtml + '</td>' +
      '<td style="white-space:nowrap"><button class="mini-btn" onclick="openItemModal(\'' + esc(it2.id) + '\')">✏️ ' + T('تعديل') + '</button>' +
      (!indent && canSplitItem(it2) ? ' <button class="mini-btn" onclick="openSplitItemModal(\'' + esc(it2.id) + '\')" data-tip="' + T('تقسيم سعر الوحدة إلى مكوّنات (نفس الكمية)') + '">✂ ' + T('تقسيم الجدول') + '</button>' : '') +
      (!isSplitChild(it2) && it2.scope !== 'others' && (availQty(it2) > 0.01 || pendingApprovalQty(it2) > 0.01)
        ? ' <button class="mini-btn green" onclick="itemToMustakhlas(\'' + esc(it2.id) + '\')" data-tip="' + T('نقل إلى مستخلص') + '">📤</button>' : '') +
      (it2.scope !== 'others' && it2.totalQty > 0 && !isParent(it2) && (it2.executedQty||0) < it2.totalQty - 0.001
        ? ' <button class="mini-btn" style="border-color:rgba(240,136,62,0.5);color:var(--orange)" onclick="markItemDone(\'' + esc(it2.id) + '\')" data-tip="' + T('تسجيل البند كمنجز 100% — يُسجَّل الباقي يوميةً باسمك ويتحول البند لانتظار اعتماد الاستشاري') + '">✔ ' + T('منجز') + '</button>' : '') + '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="13"><div class="empty-state"><p>' + T('لا توجد بنود مطابقة') + '</p></div></td></tr>';

  $('items-tfoot').innerHTML = '<tr class="summary-row"><td colspan="5" style="text-align:right;color:var(--text2)">' + T('الإجمالي') + ' (' + shownLeaves + ' ' + T('بند') + ')</td>' +
    '<td class="amount" style="color:var(--amber)">' + fmtN(sumAmt) + '</td><td colspan="3"></td>' +
    '<td class="amount claimable">' + fmtN(sumNet) + '</td><td colspan="3"></td></tr>';
}
Object.assign(I18N_EN, {
  'عرض/إخفاء البنود الفرعية':'Show/hide sub-items',
  'تقسيم الجدول':'Split BOQ',
  'نقل إلى مستخلص':'Move to claim',
  'بند رئيسي مقسّم إلى ':'Main item split into ',
  ' بند فرعي':' sub-item(s)',
  'فرعي':'sub',
  'مجموع أسعار البنود الفرعية':'Sum of sub-item prices',
  'بند رئيسي':'Main item',
  'بند فرعي':'Sub-item',
  'أدخل الكمية المنفذة (من أصل ':'Enter the executed quantity (out of ',
  ') — العميل يحاسب بالكميات':') — the client is billed by quantity'
});

// خلية اعتماد الاستشاري في جدول الكميات
function approvalCell(it){
  if (it.scope === 'others') return '<span style="color:var(--text3)">—</span>';
  const pend = pendingApprovalQty(it), appr = approvedOf(it), apct = approvedPct(it);
  const canApprove = pdbCanApproveQty();
  let html = '<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">';
  if (appr > 0.001) html += '<span style="display:inline-flex;align-items:center;gap:5px" data-tip="' + T('معتمد') + ' ' + fmtQ(appr) + ' ' + esc(it.unit||'') + '"><span style="font-family:var(--mono);font-size:10px;color:var(--green)">✅ ' + fmtQ(appr) + ' (' + (apct*100).toFixed(1) + '%)</span><span class="prog-bar" style="width:40px"><span class="prog-fill green" style="width:' + (apct*100) + '%;display:block"></span></span></span>';
  if (pend > 0.001) {
    html += '<span style="font-size:11px;color:var(--orange)">🕵 ' + T('بانتظار') + ' ' + fmtQ(pend) + '</span>';
    if (canApprove) html += '<button class="mini-btn" style="border-color:rgba(240,136,62,0.5);color:var(--orange)" onclick="openApproveQty(\'' + esc(it.id) + '\')" data-tip="' + T('اعتماد + استلام') + '">📋</button>';
  }
  if (appr < 0.001 && pend < 0.001) html += '<span style="color:var(--text3);font-size:11px">—</span>';
  // عرض استلامات سابقة — يظهر دائماً (حتى بلا استلامات بعد) ليبقى مكانه ثابتاً ومعروفاً
  const recCount = (it.approvals||[]).length;
  html += '<button class="mini-btn" style="font-size:11px;padding:2px 7px;' + (recCount ? 'border-color:rgba(88,166,255,0.5);color:var(--blue)' : 'opacity:0.5;cursor:default') + '"' + (recCount ? ' onclick="viewApprovals(\'' + esc(it.id) + '\')"' : ' disabled') + ' data-tip="' + T('عرض المستندات المرفوعة لهذا البند') + '">📎 ' + recCount + ' ' + T('استلام') + '</button>';
  html += '</div>';
  return html;
}
Object.assign(I18N_EN, {
  'معتمد':'Approved',
  'بانتظار':'Pending',
  'اعتماد + استلام':'Approve + receipt',
  'عرض المستندات المرفوعة لهذا البند':'View the documents uploaded for this item',
  'استلام':'receipt'
});
// من يعتمد كميات الاستشاري؟ الموظف الميداني فأعلى (يرفع الاستلام الموقّع)
const pdbCanApproveQty = () => ['admin','client','pmo','pm'].includes(state.me.role);

// إدخال الكمية المنفذة مباشرة — العميل يحاسب بالكميات فالحسبة تكون دقيقة
function setItemQty(id, val){
  const it = getItem(id);
  if (!it) return;
  const newVal = Math.round(clamp(val, 0, it.totalQty) * 100) / 100;
  // مدير المشروع: تعديل الكمية المنفذة يتطلب موافقة الإدارة (لا يُطبَّق مباشرة)
  if (editsGated() && Math.abs(newVal - (it.executedQty||0)) > 0.001) {
    submitEditRequest({ type:'qty_edit', itemId:id, fromQty:(it.executedQty||0), newQty:newVal,
      label:T('تعديل الكمية المنفذة للبند ') + id + T(' من ') + fmtQ(it.executedQty||0) + T(' إلى ') + fmtQ(newVal) + ' ' + (it.unit||'') });
    renderAll(); // إرجاع الحقل لقيمته الأصلية
    return;
  }
  it.executedQty = newVal;
  // المعتمد لا يتجاوز المنفذ (لو خفّض المنفذ تحت المعتمد يُقلّص المعتمد)
  if ((it.approvedQty||0) > it.executedQty) it.approvedQty = it.executedQty;
  if (it.executedQty < it.claimedQty) {
    alert(T('تنبيه: الكمية المنفذة (') + fmtQ(it.executedQty) + T(') أصبحت أقل من الكمية المرفوعة بمستخلصات سابقة (') + fmtQ(it.claimedQty) + ').');
  }
  save(); renderAll();
}
Object.assign(I18N_EN, {
  'لا يمكن البدء قبل اكتمال هذه البنود':'Cannot start before these items are complete',
  'تعديل':'Edit',
  'لا توجد بنود مطابقة':'No matching items',
  'الإجمالي':'Total',
  'تنبيه: الكمية المنفذة (':'Note: the executed quantity (',
  ') أصبحت أقل من الكمية المرفوعة بمستخلصات سابقة (':') is now less than the quantity already claimed in previous claims (',
  'أدخل الكمية المنفذة (من أصل':'Enter the executed quantity (out of',
  '— العميل يحاسب بالكميات':'— client accounts by quantities'
});
