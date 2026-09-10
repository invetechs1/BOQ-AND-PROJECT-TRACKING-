'use strict';
// ============================================================
//  BOQ EXCEL IMPORT (استيراد جدول الكميات)
// ============================================================
let biTarget = 'boq'; // 'boq' | 'pricedb'
let biWB = null, biRows = [], biHeaderIdx = 0;

// تحميل مكتبة قراءة Excel عند الحاجة (مخزنة محلياً في السيرفر)
function loadXLSX(){
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve();
    const s = document.createElement('script');
    s.src = '/vendor/xlsx.full.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(T('تعذر تحميل مكتبة قراءة Excel')));
    document.head.appendChild(s);
  });
}
Object.assign(I18N_EN, { 'تعذر تحميل مكتبة قراءة Excel':'Failed to load the Excel reading library' });

function openBoqImport(){
  $('bi-file').value = '';
  $('bi-config').style.display = 'none';
  $('bi-dup').value = 'skip';
  biWB = null; biRows = [];
  // عنوان النافذة حسب الهدف
  const isPdb = biTarget === 'pricedb';
  document.querySelector('#boq-import-modal .modal-title span').textContent = isPdb ? T('📥 استيراد بنود أسعار من Excel') : T('📥 استيراد جدول كميات من Excel');
  $('boq-import-modal').classList.add('open');
  loadXLSX().catch(e => alert(e.message));
}

const arDigits = s => String(s)
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
function numVal(v){
  if (typeof v === 'number') return isFinite(v) ? v : null;
  // إزالة فواصل الآلاف: , عادية · ، عربية · ٬ فاصل الآلاف العربي · مسافات — و ٫ الفاصلة العشرية العربية تصبح نقطة
  const s = arDigits(String(v ?? '')).replace(/[,،٬'\s]/g, '').replace(/٫/g, '.');
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
const strVal = v => String(v ?? '').trim();

async function biFilePicked(input){
  const f = input.files[0];
  if (!f) return;
  try {
    await loadXLSX();
    const buf = await f.arrayBuffer();
    biWB = XLSX.read(buf, {type:'array'});
    $('bi-sheet').innerHTML = biWB.SheetNames.map((n,i) => '<option value="' + i + '">' + esc(n) + '</option>').join('');
    $('bi-config').style.display = '';
    biSheetChanged();
  } catch(e) { alert(T('تعذر قراءة الملف:') + ' ' + e.message); }
}
Object.assign(I18N_EN, { 'تعذر قراءة الملف:':'Failed to read the file:' });

function biSheetChanged(){
  const ws = biWB.Sheets[biWB.SheetNames[Number($('bi-sheet').value)]];
  biRows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
  // كشف صف العناوين تلقائياً: أول صف فيه 3 خلايا نصية (غير رقمية) على الأقل
  let hdr = 0;
  for (let i = 0; i < Math.min(biRows.length, 15); i++) {
    const texts = (biRows[i]||[]).filter(c => strVal(c) && numVal(c) === null);
    if (texts.length >= 3) { hdr = i; break; }
  }
  $('bi-header-row').value = hdr + 1;
  biHeaderChanged();
}

const BI_FIELDS = [
  {key:'id',    label:'رقم البند *',      hints:['رقم البند','رقم','بند','البند','item no','item','code','no']},
  {key:'desc',  label:'الوصف *',         hints:['الوصف','وصف','بيان','البيان','بيان الاعمال','الاعمال','description','desc']},
  {key:'unit',  label:'الوحدة',          hints:['الوحدة','وحدة','unit','uom']},
  {key:'qty',   label:'الكمية الكلية *', hints:['الكمية الكلية','الكمية','الكميات','كمية','qty','quantity']},
  {key:'rate',  label:'سعر الوحدة *',    hints:['سعر الوحدة','السعر','سعر','الفئة','فئة','unit rate','rate','price']},
  {key:'div',   label:'القسم',           hints:['القسم','قسم','التصنيف','division','div']},
  {key:'qtyPerUnit', label:'الكمية لكل وحدة', hints:['الكمية لكل وحدة','كمية الوحدة','كمية/وحدة','لكل فيلا','qty per unit']},
  {key:'exec',  label:'الكمية المنفذة',  hints:['الكمية المنفذة','المنفذ','منفذ','executed']}
];

function biHeaderChanged(){
  biHeaderIdx = clamp(Number($('bi-header-row').value) - 1, 0, Math.max(0, biRows.length - 1));
  const headers = (biRows[biHeaderIdx]||[]).map(strVal);
  const opts = ['<option value="">' + T('— غير موجود —') + '</option>'].concat(
    headers.map((h,i) => '<option value="' + i + '">' + esc(h || (T('عمود') + ' ' + (i+1))) + '</option>')).join('');
  $('bi-mapping').innerHTML = BI_FIELDS.map(f =>
    '<div class="f-field"><label>' + T(f.label) + '</label><select id="bi-map-' + f.key + '" onchange="biRenderPreview()">' + opts + '</select></div>'
  ).join('');
  // تخمين تلقائي للمطابقة (مطابقة تامة أولاً ثم جزئية)
  const norm = s => String(s).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
  const used = new Set();
  BI_FIELDS.forEach(f => {
    let best = '';
    headers.forEach((h,i) => {
      if (best !== '' || used.has(i)) return;
      if (f.hints.some(hint => norm(h) === norm(hint))) best = String(i);
    });
    if (best === '') headers.forEach((h,i) => {
      if (best !== '' || used.has(i)) return;
      const hn = norm(h);
      if (hn && f.hints.some(hint => hn.includes(norm(hint)))) best = String(i);
    });
    if (best !== '') used.add(Number(best));
    $('bi-map-' + f.key).value = best;
  });
  biRenderPreview();
}
Object.assign(I18N_EN, {
  '— غير موجود —':'— Not present —',
  'عمود':'Column',
  'رقم البند *':'Item No. *',
  'الوصف *':'Description *',
  'الكمية الكلية *':'Total quantity *',
  'سعر الوحدة *':'Unit price *',
  'القسم':'Division',
  'الكمية لكل وحدة':'Quantity per unit',
  'الكمية المنفذة':'Executed quantity'
});

function biParseRows(){
  const map = {};
  BI_FIELDS.forEach(f => { const v = $('bi-map-' + f.key).value; map[f.key] = v === '' ? null : Number(v); });
  const out = [];
  for (let i = biHeaderIdx + 1; i < biRows.length; i++) {
    const row = biRows[i] || [];
    const get = k => map[k] === null ? '' : row[map[k]];
    const id = strVal(get('id'));
    const desc = strVal(get('desc'));
    if (!id && !desc) continue; // صف فارغ
    const qty = numVal(get('qty'));
    const rate = numVal(get('rate'));
    const isPdb = biTarget === 'pricedb';
    let err = '';
    if (isPdb) {
      // بنود الأسعار: الوصف والسعر إلزامي، رقم البند والكمية اختياريان
      if (!desc) err = T('الوصف مفقود');
      else if (rate === null || rate < 0) err = T('السعر غير صالح');
    } else {
      if (!id) err = T('رقم البند مفقود');
      else if (!desc) err = T('الوصف مفقود');
      else if (qty === null || qty <= 0) err = T('الكمية غير صالحة');
      else if (rate === null || rate < 0) err = T('السعر غير صالح');
    }
    const dup = !err && !isPdb && !!getItem(id);
    out.push({row:i+1, id, desc, unit:strVal(get('unit')) || '—', qty, rate,
      div:strVal(get('div')), qtyPerUnit:numVal(get('qtyPerUnit')) || 0, exec:numVal(get('exec')) || 0, err, dup});
  }
  // مكرر داخل الملف نفسه
  const seen = {};
  out.forEach(r => {
    if (r.err) return;
    if (seen[r.id]) r.err = T('مكرر داخل الملف (صف') + ' ' + seen[r.id] + ')';
    else seen[r.id] = r.row;
  });
  Object.assign(I18N_EN, {
    'رقم البند مفقود':'Item number missing',
    'الوصف مفقود':'Description missing',
    'الكمية غير صالحة':'Invalid quantity',
    'السعر غير صالح':'Invalid price',
    'مكرر داخل الملف (صف':'Duplicate within the file (row',
    'أُضيف':'Added',
    'بند سعر':'price item(s)',
    'صفوف بها أخطاء لم تُستورد:':'Rows with errors that were not imported:'
  });
  return out;
}

function biRenderPreview(){
  if (!biRows.length) return;
  const rows = biParseRows();
  const ok = rows.filter(r => !r.err && !r.dup).length;
  const dups = rows.filter(r => !r.err && r.dup).length;
  const errs = rows.filter(r => r.err).length;
  $('bi-counts').textContent = ok + ' ' + T('جديد') + ' · ' + dups + ' ' + T('موجود مسبقاً') + ' · ' + errs + ' ' + T('خطأ');
  $('bi-preview').innerHTML = rows.slice(0, 30).map(r =>
    '<tr style="' + (r.err ? 'background:var(--red-dim)' : r.dup ? 'background:var(--amber-dim)' : '') + '">' +
    '<td style="font-family:var(--mono);font-size:10px;color:var(--text3)">' + r.row + '</td>' +
    '<td><span class="item-no">' + esc(r.id) + '</span></td>' +
    '<td><div class="desc-text" style="max-width:200px" data-tip="' + esc(r.desc) + '">' + esc(r.desc) + '</div></td>' +
    '<td>' + esc(r.unit) + '</td>' +
    '<td class="amount">' + (r.qty === null ? '—' : fmtQ(r.qty)) + '</td>' +
    '<td class="amount">' + (r.rate === null ? '—' : Number(r.rate).toLocaleString('en-US', {maximumFractionDigits:2})) + '</td>' +
    '<td class="amount">' + ((r.qty !== null && r.rate !== null) ? fmtN(r.qty * r.rate) : '—') + '</td>' +
    '<td style="font-size:11px;color:' + (r.err ? 'var(--red)' : r.dup ? 'var(--amber)' : 'var(--green)') + '">' + (r.err || (r.dup ? T('موجود مسبقاً') : '✓')) + '</td>' +
    '</tr>').join('') +
    (rows.length > 30 ? '<tr><td colspan="8" style="color:var(--text3);font-size:11px">... ' + T('و') + ' ' + (rows.length - 30) + ' ' + T('صف إضافي (سيُستورد كاملاً)') + '</td></tr>' : '') ||
    '<tr><td colspan="8"><div class="empty-state"><p>' + T('لا توجد صفوف بيانات') + '</p></div></td></tr>';
}
Object.assign(I18N_EN, {
  'جديد':'new',
  'موجود مسبقاً':'already exists',
  'خطأ':'error',
  'و':'and',
  'صف إضافي (سيُستورد كاملاً)':'more row(s) (will be fully imported)',
  'لا توجد صفوف بيانات':'No data rows'
});

async function biDoImport(){
  const all = biParseRows();
  const rows = all.filter(r => !r.err);
  if (!rows.length) { alert(T('لا توجد صفوف صالحة للاستيراد — راجع مطابقة الأعمدة')); return; }
  const errCount = all.length - rows.length;

  // استيراد إلى قاعدة الأسعار
  if (biTarget === 'pricedb') {
    rows.forEach(r => priceDB.items.push({id: pdbSeq(), code: r.id||'', desc: r.desc, unit: r.unit, rate: r.rate,
      category: r.div||'', offerRef:'', project:'', note:''}));
    closeModal('boq-import-modal');
    await savePriceDB(); renderPdb();
    biTarget = 'boq';
    alert('✅ ' + T('أُضيف') + ' ' + rows.length + ' ' + T('بند سعر') + (errCount ? '\n⚠️ ' + T('صفوف بها أخطاء لم تُستورد:') + ' ' + errCount : ''));
    return;
  }

  const dupPolicy = $('bi-dup').value;
  let added = 0, updated = 0, skipped = 0;
  rows.forEach(r => {
    const existing = getItem(r.id);
    if (existing) {
      if (dupPolicy === 'update') {
        existing.desc = r.desc; existing.unit = r.unit; existing.totalQty = r.qty; existing.unitRate = r.rate;
        if (r.div) existing.div = r.div;
        if (r.qtyPerUnit) existing.qtyPerVilla = r.qtyPerUnit;
        updated++;
      } else skipped++;
      return;
    }
    proj().boqItems.push({
      id:r.id, div:r.div || '—', divAr:'', desc:r.desc, unit:r.unit,
      qtyPerVilla:r.qtyPerUnit || 0, totalQty:r.qty, unitRate:r.rate,
      scope:'azoom', predecessors:[], blocker:null,
      executedQty: clamp(r.exec || 0, 0, r.qty), approvedQty:0, approvals:[], claimedQty:0, notes:''
    });
    added++;
  });
  save(); renderAll();
  closeModal('boq-import-modal');
  alert('✅ ' + T('تم الاستيراد:') + '\n• ' + T('بنود جديدة:') + ' ' + added + '\n• ' + T('تم تحديثها:') + ' ' + updated + '\n• ' + T('متجاهلة (مكررة):') + ' ' + skipped + (errCount ? '\n⚠️ ' + T('صفوف فيها أخطاء لم تُستورد:') + ' ' + errCount : ''));
}
Object.assign(I18N_EN, {
  'لا توجد صفوف صالحة للاستيراد — راجع مطابقة الأعمدة':'No valid rows to import — check the column mapping',
  'تم الاستيراد:':'Import complete:',
  'بنود جديدة:':'New items:',
  'تم تحديثها:':'Updated:',
  'متجاهلة (مكررة):':'Skipped (duplicates):',
  'صفوف فيها أخطاء لم تُستورد:':'Rows with errors not imported:'
});

async function biDownloadTemplate(){
  try {
    await loadXLSX();
    const data = [
      [T('رقم البند'),T('الوصف'),T('الوحدة'),T('الكمية الكلية'),T('سعر الوحدة'),T('القسم'),T('الكمية لكل وحدة'),T('الكمية المنفذة')],
      ['1.1','أعمال الحفر والردم','م³',5000,12,'أعمال الموقع','',''],
      ['2.1','خرسانة مسلحة للقواعد','م³',800,320,'الأعمال الإنشائية','',''],
      ['3.1','بلوك مصمت 20سم','م²',12000,45,'أعمال البناء','','']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:10},{wch:40},{wch:8},{wch:14},{wch:12},{wch:18},{wch:15},{wch:15}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOQ');
    wb.Workbook = {Views:[{RTL: LANG !== 'en'}]};
    XLSX.writeFile(wb, 'BOQ-Template.xlsx');
  } catch(e) { alert(e.message); }
}
