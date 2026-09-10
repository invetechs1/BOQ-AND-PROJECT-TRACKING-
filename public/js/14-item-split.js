'use strict';
// ============================================================
//  تقسيم سعر البند إلى مكوّنات (منفصل عن "➕ بند فرعي" أعلاه):
//  الكمية والتنفيذ يبقيان بالكامل على البند الأصلي (نفس الشغل الفعلي) — فقط سعر الوحدة
//  يتوزّع على 2-4 مكوّنات، ولكل مكوّن اعتماده الخاص من الاستشاري (استلام منفصل ممكن لكل جزء).
//  قيد: بند لا يُقسَّم سعرياً وله بالفعل بنود فرعية مستقلة، ولا يُضاف له بند فرعي مستقل بعد تقسيم سعره —
//  الطريقتان لا تُخلطان على نفس البند لتفادي ازدواج/التباس في حساب القيمة الإجمالية.
// ============================================================
function canSplitItem(it){ return it.scope !== 'others' && !it.parentId && !isParent(it); }

let splitItemId = null;
function openSplitItemModal(id){
  const it = getItem(id);
  if (!it || !canSplitItem(it)) return;
  splitItemId = id;
  $('split-item-info').innerHTML = '<strong>' + esc(it.id) + '</strong> — ' + esc(it.desc) + '<br>' +
    T('الكمية:') + ' ' + fmtQ(it.totalQty) + ' ' + esc(it.unit) + ' · ' + T('سعر الوحدة:') + ' ' + fmtRate(it.unitRate) +
    '<br><span style="font-size:11px;color:var(--text2)">' + T('الكمية تبقى كما هي لكل الأجزاء (نفس الشغل الفعلي) — فقط سعر الوحدة يتوزّع بينها. البند الأصلي يبقى هو من يُنفَّذ ويُطالَب به؛ لكل جزء اعتماده الخاص من الاستشاري (استلام منفصل ممكن لكل مكوّن).') + '</span>';
  $('split-count').value = '2';
  renderSplitRows();
  $('split-item-modal').classList.add('open');
}

function renderSplitRows(){
  const it = getItem(splitItemId);
  if (!it) return;
  const n = Number($('split-count').value) || 2;
  const base = Math.floor((it.unitRate / n) * 100) / 100;
  const rows = [];
  let used = 0;
  for (let i = 0; i < n; i++) {
    const rate = i < n - 1 ? base : Math.round((it.unitRate - used) * 100) / 100;
    used = Math.round((used + rate) * 100) / 100;
    rows.push({ id: it.id + '-' + String.fromCharCode(65 + i), desc: it.desc + ' (' + (i+1) + '/' + n + ')', rate });
  }
  $('split-rows').innerHTML = rows.map((r, i) =>
    '<div class="f-grid" style="grid-template-columns:1fr 2fr 1fr;gap:8px;align-items:end;border:1px solid var(--border);border-radius:8px;padding:8px">' +
    '<div class="f-field"><label>' + T('رقم الجزء') + ' ' + (i+1) + '</label><input type="text" id="split-id-' + i + '" value="' + esc(r.id) + '"></div>' +
    '<div class="f-field"><label>' + T('الوصف') + '</label><input type="text" id="split-desc-' + i + '" value="' + esc(r.desc) + '"></div>' +
    '<div class="f-field"><label>' + T('سعر الوحدة') + '</label><input type="number" id="split-rate-' + i + '" min="0" step="0.01" value="' + r.rate + '" oninput="splitRowsRecalc()"></div>' +
    '</div>'
  ).join('');
  splitRowsRecalc();
}

function splitRowsRecalc(){
  const it = getItem(splitItemId);
  if (!it) return;
  const n = Number($('split-count').value) || 2;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Number($('split-rate-' + i).value) || 0;
  sum = Math.round(sum * 100) / 100;
  const remaining = Math.round((it.unitRate - sum) * 100) / 100;
  const box = $('split-remaining');
  if (Math.abs(remaining) < 0.01) {
    box.style.color = 'var(--green-bright)';
    box.textContent = '✅ ' + T('المجموع مطابق لسعر الوحدة') + ' (' + fmtRate(it.unitRate) + ')';
    $('split-confirm-btn').disabled = false;
  } else {
    box.style.color = 'var(--red)';
    box.textContent = (remaining > 0 ? '⚠️ ' + T('متبقٍ') : '⚠️ ' + T('زيادة')) + ' ' + fmtRate(Math.abs(remaining)) +
      ' — ' + T('يجب أن يساوي مجموع أسعار الأجزاء سعر وحدة البند الأصلي.');
    $('split-confirm-btn').disabled = true;
  }
}

function confirmSplitItem(){
  const it = getItem(splitItemId);
  if (!it || !canSplitItem(it)) { closeModal('split-item-modal'); return; }
  const n = Number($('split-count').value) || 2;
  const children = [];
  const seenIds = new Set();
  for (let i = 0; i < n; i++) {
    const id = $('split-id-' + i).value.trim();
    const desc = $('split-desc-' + i).value.trim();
    const rate = Number($('split-rate-' + i).value) || 0;
    if (!id || !desc) { alert(T('أكمل رقم ووصف كل جزء')); return; }
    if (rate <= 0) { alert(T('سعر كل جزء يجب أن يكون أكبر من صفر')); return; }
    if (seenIds.has(id) || (getItem(id) && id !== it.id)) { alert(T('رقم البند') + ' "' + id + '" ' + T('مكرر أو مستخدم في بند آخر')); return; }
    seenIds.add(id);
    children.push({ id, desc, unitRate: Math.round(rate*100)/100 });
  }
  const sum = Math.round(children.reduce((s,c) => s + c.unitRate, 0) * 100) / 100;
  if (Math.abs(sum - it.unitRate) > 0.01) { alert(T('مجموع أسعار الأجزاء يجب أن يساوي سعر وحدة البند الأصلي بالضبط')); return; }
  closeModal('split-item-modal');
  applyItemSplit(it.id, children);
  expandedGroups.add(it.id); collapsedGroups.delete(it.id);
  save(); renderAll();
  alert('✅ ' + T('تم تقسيم سعر البند إلى') + ' ' + n + ' ' + T('أجزاء.'));
}

// تنفيذ تقسيم السعر: البند الأصلي لا يتغيّر إطلاقاً — يبقى هو من يُنفَّذ ويُطالَب به بالكامل.
// الأجزاء بنود عرض فقط: لا كمية ولا تنفيذ مخزّن عليها — تُقرأ من الأب عبر qtyBase، فقط سعر الوحدة واعتمادها الخاصين بها.
function applyItemSplit(parentId, children){
  const parent = getItem(parentId);
  if (!parent) return;
  children.forEach(c => {
    proj().boqItems.push({
      id: c.id, desc: c.desc, unitRate: c.unitRate,
      div: parent.div, divAr: parent.divAr, unit: parent.unit, scope: parent.scope,
      parentId: parentId, splitAt: new Date().toISOString(), approvedQty: 0, approvals: []
    });
  });
}
Object.assign(I18N_EN, {
  'هذا البند مقسَّم السعر — سيُحذف معه كل أجزائه':'This item\'s price is split — all its parts will be deleted with it',
  '✂ تقسيم البند إلى بنود فرعية':'✂ Split unit price into components',
  'عدد الأجزاء':'Number of parts',
  '✂ تقسيم البند':'✂ Split price',
  'الكمية:':'Quantity:',
  'سعر الوحدة:':'Unit price:',
  'الكمية تبقى كما هي لكل الأجزاء (نفس الشغل الفعلي) — فقط سعر الوحدة يتوزّع بينها. البند الأصلي يبقى هو من يُنفَّذ ويُطالَب به؛ لكل جزء اعتماده الخاص من الاستشاري (استلام منفصل ممكن لكل مكوّن).':'The quantity stays the same for every part (it\'s the same physical work) — only the unit price is split between them. The original item remains the one that gets executed and claimed; each part has its own consultant approval (a separate receipt is possible for each component).',
  'رقم الجزء':'Part no.',
  'الوصف':'Description',
  'المجموع مطابق لسعر الوحدة':'The total matches the unit price',
  'متبقٍ':'Remaining',
  'زيادة':'Excess',
  'يجب أن يساوي مجموع أسعار الأجزاء سعر وحدة البند الأصلي.':'The parts\' prices must add up exactly to the original item\'s unit price.',
  'أكمل رقم ووصف كل جزء':'Fill in the number and description for every part',
  'سعر كل جزء يجب أن يكون أكبر من صفر':'Each part\'s price must be greater than zero',
  'مكرر أو مستخدم في بند آخر':'is duplicated or already used by another item',
  'مجموع أسعار الأجزاء يجب أن يساوي سعر وحدة البند الأصلي بالضبط':'The parts\' prices must add up exactly to the original item\'s unit price',
  'تم تقسيم سعر البند إلى':'The item\'s price was split into',
  'أجزاء.':'parts.',
  'مرآة للبند الأصلي':'Mirrors original item',
  'الكمية والتنفيذ مرآة للبند الأصلي — عدّلها من':'Quantity and execution mirror the original item — edit them from',
  'تقسيم سعر الوحدة إلى مكوّنات (نفس الكمية)':'Split the unit price into components (same quantity)',
  'تعديل بند':'Edit item',
  'تعديل بند ':'Edit item ',
  'إضافة بند فرعي تحت ':'Add sub-item under ',
  'إضافة بند جديد':'Add new item',
  '— بند مستقل (بدون تجميع)':'— Independent item (no grouping)',
  'أكمل الحقول الإلزامية: رقم البند، الوصف، الكمية، السعر':'Fill in the required fields: item number, description, quantity, price',
  'رقم البند موجود مسبقاً':'Item number already exists',
  'البند لا يمكن أن يعتمد على نفسه':'An item cannot depend on itself',
  'البند لا يمكن أن يكون فرعاً من نفسه':'An item cannot be a sub-item of itself',
  'لا يمكن التداخل أكثر من مستوى واحد — اختر بنداً رئيسياً ليس فرعياً بنفسه':'Only one level of nesting is allowed — choose a main item that is not itself a sub-item',
  'هذا البند رئيسي وله بنود فرعية — لا يمكن جعله فرعاً لبند آخر':'This is a main item with sub-items — it cannot become a sub-item of another item',
  'مطابق لسعر البند الرئيسي':'Matches the main item price',
  'أعلى بـ ':'Higher by ',
  'أقل بـ ':'Lower by ',
  'مجموع أسعار الفروع = ':'Sum of sub-item prices = ',
  'مقابل سعر البند الرئيسي':'against the main item price',
  'عائق غير محدد':'Unspecified blocker',
  'هذا بند رئيسي وله ':'This is a main item with ',
  ' بند فرعي. سيصبح كل فرعٍ بنداً مستقلاً. متابعة؟':' sub-item(s). Each sub-item will become an independent item. Continue?',
  'هذا البند مرفوع في مستخلصات سابقة. متأكد من حذفه؟':'This item has been claimed in previous claims. Are you sure you want to delete it?',
  'حذف البند':'Delete item',
  'حذف البند ':'Delete item ',
  ' نهائياً؟':' permanently?'
});
