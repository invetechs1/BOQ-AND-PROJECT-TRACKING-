'use strict';
// ============================================================
//  PRODUCTIVITY
// ============================================================
// الفرقة: اسم فريق ميداني حر (نصي) — منفصل عن مقاول الباطن المنفّذ (wl-sub) الذي يُدار كجهة مستقلة بمستخلصاتها الخاصة
function crewLabel(l){
  return esc(l.crew || '—');
}

function renderProd(){
  renderEditRequests();
  if (!$('wl-date').value) $('wl-date').value = todayStr();
  $('crew-list').innerHTML = [...new Set(proj().workLogs.map(l => l.crew).filter(Boolean))].map(c => '<option value="' + esc(c) + '">').join('');
  // البند: حقل بحث ذكي بدل القائمة الطويلة — إعادة الضبط لو تغيّر المشروع أو حُذف البند المختار
  if ($('wl-item').value && !getItem($('wl-item').value)) { $('wl-item').value = ''; $('wl-item-search').value = ''; }
  $('wl-villa').innerHTML = '<option value="">' + T('— بدون ') + UL() + T(' محددة —') + '</option>' + proj().villas.map(v => '<option value="' + esc(v.no) + '">' + esc(v.no) + ' (' + esc(v.sheet) + ')</option>').join('');
  const wlSubCur = $('wl-sub').value;
  $('wl-sub').innerHTML = '<option value="">' + T('— تنفيذ ذاتي (بدون مقاول باطن) —') + '</option>' + (proj().subcontractors||[]).map(s => '<option value="' + s.id + '">🧱 ' + esc(s.name) + '</option>').join('');
  if (wlSubCur) $('wl-sub').value = wlSubCur;

  const logs = [...proj().workLogs].sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);
  $('wl-tbody').innerHTML = logs.slice(0, 60).map(l => {
    const it = getItem(l.itemId);
    const perWorker = l.workers > 0 ? l.qty / l.workers : 0;
    return '<tr>' +
      '<td style="font-family:var(--mono);font-size:12px">' + esc(l.date) + '</td>' +
      '<td style="font-size:11px;white-space:nowrap">' + crewLabel(l) + '</td>' +
      '<td><span class="item-no">' + esc(l.itemId) + '</span> <span style="font-size:11px;color:var(--text3)">' + esc(it ? it.desc.substring(0,25) : '') + '</span></td>' +
      '<td>' + (l.villaNo ? '#' + esc(l.villaNo) : '—') + '</td>' +
      '<td style="font-size:11px">' + (l.subId && getSub(l.subId) ? '🧱 ' + esc(getSub(l.subId).name) : '<span style="color:var(--text3)">' + T('تنفيذ ذاتي') + '</span>') + '</td>' +
      '<td class="amount">' + fmtQ(l.qty) + ' ' + esc(it ? it.unit : '') + '</td>' +
      '<td class="amount muted">' + (l.workers||'—') + '</td>' +
      '<td class="amount muted">' + fmtQ(perWorker) + '</td>' +
      '<td>' + ((l.photos||[]).length
        ? (l.photos.slice(0,3).map(ph => '<img class="log-photo" src="' + esc(ph.url) + '" onclick="openLightbox(\'' + esc(ph.url) + '\', \'' + esc(l.date + ' · ' + l.crew) + '\')" alt="">').join(' ') + (l.photos.length > 3 ? ' <span style="font-size:10px;color:var(--text3)">+' + (l.photos.length-3) + '</span>' : ''))
        : '<span style="color:var(--text3);font-size:11px">—</span>') + '</td>' +
      '<td>' + (l.applied ? '<span class="pill green" style="font-size:10px">' + T('نعم') + '</span>' : '<span class="pill gray" style="font-size:10px">' + T('لا') + '</span>') + '</td>' +
      '<td style="font-size:11px;color:var(--text3)">' + esc(l.by || '—') + '</td>' +
      '<td style="white-space:nowrap"><button class="mini-btn" onclick="openLogEdit(' + l.id + ')" data-tip="' + (editsGated()?T('طلب تعديل (يحتاج موافقة الإدارة)'):T('تعديل')) + '">✏️</button> ' +
      '<button class="mini-btn red" onclick="deleteWorkLog(' + l.id + ')" data-tip="' + (editsGated()?T('طلب حذف (يحتاج موافقة الإدارة)'):T('حذف')) + '">🗑</button></td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="12"><div class="empty-state"><p>' + T('لا توجد يوميات مسجلة') + '</p></div></td></tr>';

  // معرض أحدث صور الموقع
  const allPhotos = [];
  [...proj().workLogs].sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id).forEach(l => {
    (l.photos||[]).forEach(ph => {
      const it2 = getItem(l.itemId);
      allPhotos.push({url: ph.url, cap: l.date + ' · ' + (it2 ? it2.id : l.itemId) + (l.villaNo ? ' · ' + l.villaNo : '') + ' · ' + l.crew});
    });
  });
  $('site-gallery').innerHTML = allPhotos.length
    ? allPhotos.slice(0, 12).map(p =>
        '<div class="gallery-item" onclick="openLightbox(\'' + esc(p.url) + '\', \'' + esc(p.cap) + '\')"><img src="' + esc(p.url) + '" loading="lazy" alt=""><div class="gallery-cap">' + esc(p.cap) + '</div></div>').join('')
    : '<div class="empty-state" style="padding:14px;grid-column:1/-1"><p>' + T('أرفق صوراً مع اليوميات لتظهر هنا') + '</p></div>';

  // daily chart last 14 days
  const byDay = {};
  proj().workLogs.forEach(l => { byDay[l.date] = (byDay[l.date]||0) + l.qty; });
  const days = [];
  for (let k = 13; k >= 0; k--) days.push(daysAgo(k));
  const maxD = Math.max(1, ...days.map(d => byDay[d]||0));
  $('prod-daily-chart').innerHTML = days.map(d => {
    const q = byDay[d]||0;
    return '<div class="bar-row"><div class="bar-label" style="width:80px;font-family:var(--mono);font-size:10px">' + d.slice(5) + '</div>' +
      '<div class="bar-track" style="height:14px"><div class="bar-fill" style="width:' + (q/maxD*100) + '%;background:linear-gradient(90deg,var(--blue),var(--teal))"></div></div>' +
      '<div class="bar-amount" style="width:70px">' + (q ? fmtQ(q) : '—') + '</div></div>';
  }).join('');

  // crew summary (إحصائيات الفرق الميدانية)
  const crews = {};
  proj().workLogs.forEach(l => {
    const key = l.crew || '';
    if (!crews[key]) crews[key] = {qty:0, days:new Set(), workers:0, n:0, last:''};
    const c = crews[key];
    c.qty += l.qty; c.days.add(l.date); c.workers += (l.workers||0); c.n++;
    if (l.date > c.last) c.last = l.date;
  });
  $('crew-summary').innerHTML = Object.entries(crews).sort((a,b) => b[1].qty-a[1].qty).map(([name,c]) => {
    const avgDay = c.days.size ? c.qty / c.days.size : 0;
    return '<div class="sc-item" style="align-items:flex-start"><span class="sc-item-name" style="white-space:normal"><strong style="color:var(--text)">' + crewLabel({crew:name}) + '</strong><br>' +
      '<span style="font-size:11px">' + c.days.size + ' ' + T('يوم عمل') + ' · ' + T('آخر نشاط') + ' ' + esc(c.last) + '</span></span>' +
      '<span class="sc-item-val" style="color:var(--blue)">' + fmtQ(avgDay) + ' /' + T('يوم') + '<br><span style="color:var(--text3)">' + T('إجمالي') + ' ' + fmtQ(c.qty) + '</span></span></div>';
  }).join('') || '<div class="empty-state" style="padding:14px"><p>' + T('سجّل يوميات لعرض إحصائيات الفرق') + '</p></div>';

  // item rates + forecast
  const perItem = {};
  proj().workLogs.forEach(l => {
    if (!perItem[l.itemId]) perItem[l.itemId] = {qty:0, days:new Set()};
    perItem[l.itemId].qty += l.qty; perItem[l.itemId].days.add(l.date);
  });
  $('item-rates').innerHTML = Object.entries(perItem).map(([id,d]) => {
    const it = getItem(id);
    if (!it) return '';
    const rate = d.days.size ? d.qty / d.days.size : 0;
    const remaining = Math.max(0, it.totalQty - it.executedQty);
    const eta = rate > 0 && remaining > 0 ? Math.ceil(remaining / rate) : null;
    return '<div class="sc-item" style="align-items:flex-start"><span class="sc-item-name" style="white-space:normal"><span class="item-no">' + esc(id) + '</span> ' + esc(it.desc.substring(0,35)) + '<br>' +
      '<span style="font-size:11px">' + T('معدل') + ' ' + fmtQ(rate) + ' ' + esc(it.unit) + '/' + T('يوم') + ' · ' + T('متبقي') + ' ' + fmtQ(remaining) + '</span></span>' +
      '<span class="sc-item-val" style="color:' + (eta && eta > 30 ? 'var(--red)' : 'var(--green-bright)') + '">' + (remaining <= 0 ? '✅ ' + T('مكتمل') : eta ? '≈ ' + eta + ' ' + T('يوم للإنجاز') : '—') + '</span></div>';
  }).join('') || '<div class="empty-state" style="padding:14px"><p>' + T('لا توجد بيانات بعد') + '</p></div>';
}
Object.assign(I18N_EN, {
  'ملف صورة غير صالح':'Invalid image file',
  'اختر بند':'Choose an item',
  'اختر بند من قائمة البحث':'Choose an item from the search list',
  'لا يوجد بند مطابق':'No matching item',
  '— ضمن: ':'— under: ',
  'بند إضافي — أكمل البحث لتضييق النتائج':'more item(s) — refine your search to narrow the results',
  'اكتب اسم الفرقة / المسؤول':'Enter the crew / responsible name',
  'اكتب الكمية المنفذة':'Enter the executed quantity',
  '📴 لا يمكن التسجيل بدون اتصال':'📴 Cannot log while offline',
  'تعذر رفع الصور:':'Failed to upload photos:',
  'حذف اليومية؟':'Delete this log?',
  'سيتم خصم الكمية من نسبة إنجاز البند.':'The quantity will be deducted from the item\'s completion percentage.',
  'وستحذف صورها.':'and its photos will be deleted.',
  'بدون':'Without a',
  'محددة':'specified',
  '— بدون ':'— Without a ',
  ' محددة —':' specified —',
  '— تنفيذ ذاتي (بدون مقاول باطن) —':'— Self-executed (no subcontractor) —',
  'تنفيذ ذاتي':'Self-executed',
  'طلب تعديل (يحتاج موافقة الإدارة)':'Edit request (needs admin approval)',
  'طلب حذف (يحتاج موافقة الإدارة)':'Delete request (needs admin approval)',
  'نعم':'Yes',
  'لا':'No',
  'لا توجد يوميات مسجلة':'No logs recorded',
  'أرفق صوراً مع اليوميات لتظهر هنا':'Attach photos with logs for them to appear here',
  'يوم عمل':'work day(s)',
  'آخر نشاط':'Last activity',
  'إجمالي':'Total',
  'سجّل يوميات لعرض إحصائيات الفرق':'Log work to show crew statistics',
  'يوم للإنجاز':'day(s) to complete',
  'لا توجد بيانات بعد':'No data yet'
});

// ---- صور الموقع: ضغط بالمتصفح ثم رفع للخادم ----
let wlPendingPhotos = []; // [{dataUrl, name}]

function compressImage(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1600;
      let w = img.width, h = img.height;
      if (Math.max(w, h) > MAX) { const k = MAX / Math.max(w, h); w = Math.round(w*k); h = Math.round(h*k); }
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(T('ملف صورة غير صالح'))); };
    img.src = url;
  });
}

async function wlPhotosPicked(input){
  const files = [...(input.files || [])].slice(0, 8 - wlPendingPhotos.length);
  for (const f of files) {
    try {
      const dataUrl = await compressImage(f);
      wlPendingPhotos.push({dataUrl, name: f.name});
    } catch(e) { alert(e.message); }
  }
  input.value = '';
  renderWlPhotoStrip();
}

function renderWlPhotoStrip(){
  $('wl-photo-strip').innerHTML = wlPendingPhotos.map((p, i) =>
    '<span class="photo-thumb-wrap"><img class="photo-thumb" src="' + p.dataUrl + '" onclick="openLightbox(wlPendingPhotos[' + i + '].dataUrl)" alt="">' +
    '<button class="photo-thumb-x" onclick="wlPendingPhotos.splice(' + i + ',1);renderWlPhotoStrip()">✕</button></span>'
  ).join('');
}

function openLightbox(url, caption){
  if (!url) return;
  $('lightbox-img').src = url;
  $('lightbox-cap').textContent = caption || '';
  $('lightbox').classList.add('open');
}

async function uploadPendingPhotos(){
  const uploaded = [];
  for (const p of wlPendingPhotos) {
    const r = await API.req('POST', '/api/projects/' + proj().id + '/photos', {dataUrl: p.dataUrl});
    uploaded.push({url: r.url});
  }
  return uploaded;
}

// ---- حقل البحث الذكي عن البند (يدعم مئات/آلاف البنود) ----
let wlItemActive = -1;
function wlItemFilter(typing){
  const q = ($('wl-item-search').value || '').toLowerCase().trim();
  // لو غيّر النص بعد اختيار بند، أفرغ الاختيار المخزّن
  if (typing) $('wl-item').value = '';
  const items = proj().boqItems.filter(i => i.scope !== 'others' && !isParent(i) && !isSplitChild(i)); // الإنتاجية تُسجّل على البنود الفرعية لا الرئيسية
  const norm = s => String(s||'').toLowerCase();
  let list = q ? items.filter(i => norm(i.id).includes(q) || norm(i.desc).includes(q) || norm(i.divAr).includes(q) || norm(i.div).includes(q)) : items;
  wlItemActive = -1;
  const box = $('wl-item-list');
  box.innerHTML = list.slice(0, 60).map((i, idx) => {
    const par = parentOf(i);
    return '<div class="combo-opt" data-idx="' + idx + '" data-id="' + esc(i.id) + '" onmousedown="event.preventDefault(); wlItemPick(\'' + esc(i.id).replace(/'/g,"\\'") + '\')">' +
      (par ? '<span style="color:var(--text3)">↳ </span>' : '') +
      '<span class="co-code">' + esc(i.id) + '</span> ' + esc(i.desc) + ' <span class="co-unit">(' + esc(i.unit) + ')</span>' +
      (par ? ' <span style="font-size:10px;color:var(--text3)">' + T('— ضمن: ') + esc(par.desc.substring(0,30)) + '</span>' : '') + '</div>';
  }).join('')
    || '<div class="combo-opt" style="color:var(--text3)">' + T('لا يوجد بند مطابق') + '</div>';
  if (list.length > 60) box.innerHTML += '<div class="combo-opt" style="color:var(--text3);font-size:11px">... ' + (list.length-60) + ' ' + T('بند إضافي — أكمل البحث لتضييق النتائج') + '</div>';
  box.style.display = 'block';
}
function wlItemPick(id){
  const it = getItem(id);
  if (!it) return;
  $('wl-item').value = id;
  $('wl-item-search').value = id + ' - ' + it.desc;
  $('wl-item-list').style.display = 'none';
}
function wlItemBlur(){ setTimeout(() => { $('wl-item-list').style.display = 'none'; }, 160); }
function wlItemKey(e){
  const box = $('wl-item-list');
  if (box.style.display === 'none') return;
  const opts = [...box.querySelectorAll('.combo-opt[data-id]')];
  if (e.key === 'ArrowDown') { e.preventDefault(); wlItemActive = Math.min(opts.length-1, wlItemActive+1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); wlItemActive = Math.max(0, wlItemActive-1); }
  else if (e.key === 'Enter') { e.preventDefault(); if (opts[wlItemActive]) wlItemPick(opts[wlItemActive].dataset.id); return; }
  else if (e.key === 'Escape') { box.style.display = 'none'; return; }
  else return;
  opts.forEach((o,i) => o.classList.toggle('active', i === wlItemActive));
  if (opts[wlItemActive]) opts[wlItemActive].scrollIntoView({block:'nearest'});
}

async function addWorkLog(){
  const itemId = $('wl-item').value;
  const it = getItem(itemId);
  const qty = Number($('wl-qty').value);
  const crew = $('wl-crew').value.trim();
  if (!it) { alert(T('اختر بند من قائمة البحث')); $('wl-item-search').focus(); return; }
  if (!crew) { alert(T('اكتب اسم الفرقة / المسؤول')); return; }
  if (!qty || qty <= 0) { alert(T('اكتب الكمية المنفذة')); return; }
  if (offlineMode) { alert(T('📴 لا يمكن التسجيل بدون اتصال')); return; }
  let photos = [];
  if (wlPendingPhotos.length) {
    try { photos = await uploadPendingPhotos(); }
    catch(e) { alert(T('تعذر رفع الصور:') + ' ' + e.message); return; }
  }
  const villaNo = $('wl-villa').value;
  const apply = true; // الكمية تنعكس تلقائياً على نسبة إنجاز البند — بلا خيار تعطيل
  let appliedQty = 0;
  if (apply) {
    appliedQty = Math.min(qty, Math.max(0, it.totalQty - it.executedQty));
    it.executedQty = Math.round((it.executedQty + appliedQty) * 100) / 100;
    if (villaNo && it.qtyPerVilla > 0) {
      if (!proj().villaProgress[itemId]) proj().villaProgress[itemId] = {};
      const cur = villaPct(itemId, villaNo);
      proj().villaProgress[itemId][villaNo] = clamp(cur + qty / it.qtyPerVilla * 100, 0, 100);
    }
  }
  proj().workLogs.push({
    id: nextSeq(), date: $('wl-date').value || todayStr(), crew,
    itemId, villaNo, subId: Number($('wl-sub').value) || null, qty, workers: Number($('wl-workers').value)||0,
    note: $('wl-note').value.trim(), applied: apply, appliedQty, by: currentUser().name, photos
  });
  $('wl-qty').value = ''; $('wl-note').value = '';
  $('wl-item').value = ''; $('wl-item-search').value = ''; // إفراغ حقل بحث البند للتسجيل التالي
  wlPendingPhotos = []; renderWlPhotoStrip();
  save(); renderAll();
}

function deleteWorkLog(id){
  const l = proj().workLogs.find(x => x.id === id);
  if (!l) return;
  // مدير المشروع: الحذف يتطلب موافقة الإدارة
  if (editsGated()) {
    const it = getItem(l.itemId);
    submitEditRequest({ type:'log_delete', logId:id,
      label:T('حذف يومية ') + esc(l.date) + ' · ' + esc(l.crew) + ' · ' + fmtQ(l.qty) + ' ' + (it?it.unit:'') + T(' (بند ') + esc(l.itemId) + ')' });
    return;
  }
  if (!confirm(T('حذف اليومية؟') + (l.applied ? T(' سيتم خصم الكمية من نسبة إنجاز البند.') : '') + ((l.photos||[]).length ? T(' وستحذف صورها.') : ''))) return;
  applyLogDelete(id, true);
  save(); renderAll();
}

// تنفيذ حذف اليومية فعلياً (يُستدعى مباشرة من الإدارة أو بعد اعتماد الطلب)
function applyLogDelete(id, deletePhotos){
  const l = proj().workLogs.find(x => x.id === id);
  if (!l) return;
  if (deletePhotos) (l.photos||[]).forEach(ph => {
    const file = String(ph.url).split('/').pop();
    API.req('DELETE', '/api/projects/' + proj().id + '/photos/' + file).catch(() => {});
  });
  if (l.applied && l.appliedQty > 0) {
    const it = getItem(l.itemId);
    if (it) it.executedQty = Math.max(0, Math.round((it.executedQty - l.appliedQty) * 100) / 100);
    if (l.villaNo) {
      const it2 = getItem(l.itemId);
      if (it2 && it2.qtyPerVilla > 0 && proj().villaProgress[l.itemId]) {
        const cur = villaPct(l.itemId, l.villaNo);
        proj().villaProgress[l.itemId][l.villaNo] = clamp(cur - l.qty / it2.qtyPerVilla * 100, 0, 100);
      }
    }
  }
  proj().workLogs = proj().workLogs.filter(x => x.id !== id);
}

// ---- تعديل اليومية (كمية/ملاحظة) ----
let editingLogId = null;
function openLogEdit(id){
  const l = proj().workLogs.find(x => x.id === id);
  if (!l) return;
  editingLogId = id;
  const it = getItem(l.itemId);
  $('le-info').innerHTML = '<strong>' + esc(l.date) + ' · ' + esc(l.crew) + '</strong> — ' + T('بند') + ' ' + esc(l.itemId) + ' ' + esc(it?it.desc.substring(0,30):'');
  $('le-qty').value = l.qty;
  $('le-note').value = l.note || '';
  $('le-reason-wrap').style.display = editsGated() ? '' : 'none';
  $('le-reason').value = '';
  $('le-save-btn').textContent = editsGated() ? T('📨 إرسال طلب التعديل للإدارة') : T('💾 حفظ التعديل');
  $('log-edit-modal').classList.add('open');
}
function saveLogEdit(){
  const l = proj().workLogs.find(x => x.id === editingLogId);
  if (!l) return;
  const newQty = Number($('le-qty').value);
  if (!newQty || newQty <= 0) { alert(T('اكتب كمية صحيحة')); return; }
  const newNote = $('le-note').value.trim();
  if (editsGated()) {
    const reason = $('le-reason').value.trim();
    if (!reason) { alert(T('اكتب سبب التعديل ليطّلع عليه المعتمِدون')); return; }
    const it = getItem(l.itemId);
    submitEditRequest({ type:'log_edit', logId:editingLogId, newQty, newNote, reason,
      label:T('تعديل يومية ') + esc(l.date) + T(' · بند ') + esc(l.itemId) + T(': الكمية من ') + fmtQ(l.qty) + T(' إلى ') + fmtQ(newQty) + ' ' + (it?it.unit:'') });
    closeModal('log-edit-modal'); return;
  }
  applyLogEdit(editingLogId, newQty, newNote);
  closeModal('log-edit-modal'); save(); renderAll();
}
// تنفيذ تعديل اليومية فعلياً (يعيد أثر الكمية القديمة ثم يطبّق الجديدة كما في الإضافة)
function applyLogEdit(id, newQty, newNote){
  const l = proj().workLogs.find(x => x.id === id);
  if (!l) return;
  const it = getItem(l.itemId);
  if (l.applied && it) {
    // إرجاع الأثر القديم
    it.executedQty = Math.max(0, Math.round((it.executedQty - (l.appliedQty||0)) * 100) / 100);
    if (l.villaNo && it.qtyPerVilla > 0 && proj().villaProgress[l.itemId]) {
      const cur = villaPct(l.itemId, l.villaNo);
      proj().villaProgress[l.itemId][l.villaNo] = clamp(cur - l.qty / it.qtyPerVilla * 100, 0, 100);
    }
    // تطبيق الكمية الجديدة
    const applied = Math.min(newQty, Math.max(0, it.totalQty - it.executedQty));
    it.executedQty = Math.round((it.executedQty + applied) * 100) / 100;
    l.appliedQty = applied;
    if (l.villaNo && it.qtyPerVilla > 0) {
      if (!proj().villaProgress[l.itemId]) proj().villaProgress[l.itemId] = {};
      const cur = villaPct(l.itemId, l.villaNo);
      proj().villaProgress[l.itemId][l.villaNo] = clamp(cur + newQty / it.qtyPerVilla * 100, 0, 100);
    }
  }
  l.qty = newQty;
  if (newNote !== undefined) l.note = newNote;
}
