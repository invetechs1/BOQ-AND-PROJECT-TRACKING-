'use strict';
// ============================================================
//  PRICE DATABASE & OFFERS (قاعدة بيانات الأسعار والعروض)
// ============================================================
let priceDB = null;          // {version, seq, offers, items, companyId, canEdit}
let priceDBLoaded = false;
let pdbView = 'items';

const pdbCanEdit = () => priceDB && priceDB.canEdit;

async function loadPriceDB(force){
  if (priceDBLoaded && !force) return;
  try {
    priceDB = await API.req('GET', '/api/pricedb');
    priceDBLoaded = true;
  } catch(e) { priceDB = {version:0, seq:1000, offers:[], items:[], canEdit:false}; }
}

async function savePriceDB(){
  if (!pdbCanEdit()) return;
  try {
    const r = await API.req('PUT', '/api/pricedb', {baseVersion: priceDB.version, data: {seq: priceDB.seq, offers: priceDB.offers, items: priceDB.items}});
    priceDB.version = r.version;
  } catch(e) {
    if (e.status === 409) { alert(T('⚠️ عُدّلت قاعدة الأسعار من مستخدم آخر — سيتم إعادة التحميل.')); await loadPriceDB(true); renderPdb(); }
    else alert(T('تعذر الحفظ:') + ' ' + e.message);
  }
}
const pdbSeq = () => (priceDB.seq = (priceDB.seq||1000) + 1);

async function onOpenPricedb(){
  $('pdb-loading').style.display = 'block';
  $('pdb-view-items').style.display = 'none';
  $('pdb-view-offers').style.display = 'none';
  await loadPriceDB();
  $('pdb-loading').style.display = 'none';
  renderPdb();
}

function switchPdbView(v){
  pdbView = v;
  $('pdb-tab-items').classList.toggle('active', v === 'items');
  $('pdb-tab-offers').classList.toggle('active', v === 'offers');
  $('pdb-view-items').style.display = v === 'items' ? 'block' : 'none';
  $('pdb-view-offers').style.display = v === 'offers' ? 'block' : 'none';
}

function renderPdb(){
  if (!priceDB) return;
  $('tc-pricedb').textContent = priceDB.items.length;
  $('pdb-items-count').textContent = priceDB.items.length;
  $('pdb-offers-count').textContent = priceDB.offers.length;
  const co = isAdmin() ? companyName(priceDB.companyId) : companyName(state.me.companyId);
  $('pdb-company-badge').textContent = co ? '🏢 ' + co : '';
  // زر الإضافة والتعديل حسب الصلاحية
  ['pdb-btn-additem','pdb-btn-import','pdb-btn-addoffer'].forEach(id => { if($(id)) $(id).style.display = pdbCanEdit() ? '' : 'none'; });
  switchPdbView(pdbView);
  renderPdbItems();
  renderPdbOffers();
}

function renderPdbItems(){
  const search = ($('pdb-search').value || '').toLowerCase();
  const catFilter = $('pdb-cat-filter').value;
  const cats = [...new Set(priceDB.items.map(i => i.category).filter(Boolean))].sort();
  const cur = $('pdb-cat-filter').value;
  $('pdb-cat-filter').innerHTML = '<option value="">' + T('كل التصنيفات') + '</option>' + cats.map(c => '<option value="' + esc(c) + '"' + (c===cur?' selected':'') + '>' + esc(c) + '</option>').join('');

  let list = priceDB.items.filter(i => {
    if (catFilter && i.category !== catFilter) return false;
    if (search && !((i.desc||'').toLowerCase().includes(search) || (i.code||'').toLowerCase().includes(search))) return false;
    return true;
  });
  const boqReady = proj().id && (isManagerial() || ['pmo','pm'].includes(state.me.role));
  $('pdb-items-tbody').innerHTML = list.map(i =>
    '<tr>' +
    '<td><span class="item-no">' + esc(i.code||'—') + '</span></td>' +
    '<td><div class="desc-text" style="max-width:340px" data-tip="' + esc(i.desc) + '">' + esc(i.desc) + '</div></td>' +
    '<td><span class="pill gray" style="font-size:10px">' + esc(i.unit||'—') + '</span></td>' +
    '<td class="amount claimable">' + fmtN(i.rate) + '</td>' +
    '<td style="font-size:11px;color:var(--text2)">' + esc(i.category||'—') + '</td>' +
    '<td style="font-size:10px;color:var(--text3)" data-tip="' + esc(i.project||'') + '">' + esc(i.offerRef||'—') + '</td>' +
    '<td style="white-space:nowrap">' +
      (boqReady ? '<button class="mini-btn green" onclick="openInsertToBoq(' + i.id + ')">➕ ' + T('للمشروع') + '</button> ' : '') +
      (pdbCanEdit() ? '<button class="mini-btn" onclick="openPdbItemModal(' + i.id + ')">✏️</button>' : '') +
    '</td></tr>'
  ).join('') || '<tr><td colspan="7"><div class="empty-state">' +
    (priceDB.items.length === 0 && pdbCanEdit()
      ? '<div class="icon">💲</div><p>' + T('قاعدة الأسعار فارغة') + '</p><button class="btn btn-green" style="margin-top:10px" onclick="seedAzoomOffers()">📥 ' + T('تحميل عروض عزوم الجاهزة (3 عروض + بنودها)') + '</button><br><span style="font-size:11px;color:var(--text3)">' + T('أو أضف بنودك يدوياً / استورد من Excel') + '</span>'
      : '<p>' + T('لا توجد بنود مطابقة') + '</p>') + '</div></td></tr>';
}

function renderPdbOffers(){
  const typeLabel = {financial:T('مالي'), technical:T('فني'), both:T('مالي + فني')};
  $('pdb-offers-grid').innerHTML = priceDB.offers.map(o => {
    const sections = (o.sections||[]).map(s =>
      '<div class="sc-item"><span class="sc-item-name">' + esc(s.name) + '</span><span class="sc-item-val">' + fmtN(s.amount) + '</span></div>').join('');
    const atts = (o.attachments||[]).map(a =>
      '<a href="' + esc(a.url) + '" target="_blank" style="color:var(--blue);font-size:11px;text-decoration:none;display:block">' +
      (String(a.url).endsWith('.pdf') ? '📄' : '🖼') + ' ' + esc(a.name||T('ملف')) + ' ↗</a>').join('');
    return '<div class="card"><div class="card-title" style="flex-direction:column;align-items:stretch;gap:2px">' +
      '<span>📁 ' + esc(o.project||'—') + '</span>' +
      '<span style="font-size:11px;color:var(--text2);font-weight:400">' + esc(o.client||'') + (o.location ? ' · ' + esc(o.location) : '') + '</span></div>' +
      '<div class="sc-item"><span class="sc-item-name">' + T('رقم العرض') + '</span><span class="sc-item-val" style="color:var(--amber)">' + esc(o.ref||'—') + '</span></div>' +
      '<div class="sc-item"><span class="sc-item-name">' + T('التاريخ / النوع') + '</span><span class="sc-item-val">' + esc(o.date||'—') + ' · ' + (typeLabel[o.type]||'') + '</span></div>' +
      sections +
      '<div class="sc-item" style="border-top:1px solid var(--border)"><span class="sc-item-name">' + T('الإجمالي قبل الضريبة') + '</span><span class="sc-item-val" style="color:var(--amber)">' + money(o.subtotal) + '</span></div>' +
      '<div class="sc-item"><span class="sc-item-name">' + T('شامل الضريبة') + ' ' + (o.vatRate||15) + '%</span><span class="sc-item-val" style="color:var(--green-bright);font-weight:700">' + money(o.grandTotal) + '</span></div>' +
      (o.validityDays ? '<div class="sc-item"><span class="sc-item-name">' + T('صلاحية العرض') + '</span><span class="sc-item-val">' + o.validityDays + ' ' + T('يوم') + '</span></div>' : '') +
      (o.notes ? '<div style="font-size:11px;color:var(--text2);margin-top:6px">📝 ' + esc(o.notes) + '</div>' : '') +
      (atts ? '<div style="margin-top:8px">' + atts + '</div>' : '') +
      (pdbCanEdit() ? '<div style="margin-top:10px"><button class="mini-btn" onclick="openPdbOfferModal(' + o.id + ')">✏️ ' + T('تعديل') + '</button></div>' : '') +
      '</div>';
  }).join('') || '<div class="empty-state" style="grid-column:1/-1"><div class="icon">📁</div><p>' + T('لا توجد عروض مسجلة') + '</p></div>';
}

async function seedAzoomOffers(){
  if (!confirm(T('تحميل عروض عزوم الجاهزة (المودة، ذات النخيل، قلب نجد) مع بنود أسعارها إلى قاعدة الشركة؟'))) return;
  try {
    priceDB = await API.req('POST', '/api/pricedb/seed', {force: (priceDB.items.length||priceDB.offers.length) ? true : false});
    priceDBLoaded = true;
    renderPdb();
    alert('✅ ' + T('تم تحميل') + ' ' + priceDB.offers.length + ' ' + T('عروض و') + ' ' + priceDB.items.length + ' ' + T('بند سعر.'));
  } catch(e) { alert(e.message); }
}

// ---- إضافة/تعديل بند سعر ----
let pdbEditItemId = null;
function openPdbItemModal(id){
  if (!pdbCanEdit()) return;
  pdbEditItemId = id;
  const it = id ? priceDB.items.find(x => x.id === id) : null;
  $('pdb-item-title').textContent = it ? T('تعديل بند سعر') : T('إضافة بند سعر');
  $('pdi-delete').style.display = it ? '' : 'none';
  $('pdi-code').value = it ? (it.code||'') : '';
  $('pdi-unit').value = it ? (it.unit||'') : '';
  $('pdi-desc').value = it ? it.desc : '';
  $('pdi-rate').value = it ? it.rate : '';
  $('pdi-cat').value = it ? (it.category||'') : '';
  $('pdi-ref').value = it ? (it.offerRef||'') : '';
  $('pdi-project').value = it ? (it.project||'') : '';
  $('pdi-note').value = it ? (it.note||'') : '';
  $('pdi-units').innerHTML = [...new Set(priceDB.items.map(i=>i.unit).filter(Boolean))].map(u=>'<option value="'+esc(u)+'">').join('');
  $('pdi-cats').innerHTML = [...new Set(priceDB.items.map(i=>i.category).filter(Boolean))].map(c=>'<option value="'+esc(c)+'">').join('');
  $('pdb-item-modal').classList.add('open');
}
async function savePdbItem(){
  const desc = $('pdi-desc').value.trim(), rate = Number($('pdi-rate').value), unit = $('pdi-unit').value.trim();
  if (!desc || !unit || !($('pdi-rate').value)) { alert(T('أكمل: الوصف، الوحدة، السعر')); return; }
  const data = {code:$('pdi-code').value.trim(), desc, unit, rate, category:$('pdi-cat').value.trim(), offerRef:$('pdi-ref').value.trim(), project:$('pdi-project').value.trim(), note:$('pdi-note').value.trim()};
  if (pdbEditItemId) { const it = priceDB.items.find(x=>x.id===pdbEditItemId); Object.assign(it, data); }
  else priceDB.items.push({id: pdbSeq(), ...data});
  closeModal('pdb-item-modal'); await savePriceDB(); renderPdb();
}
async function deletePdbItem(){
  if (!pdbEditItemId || !confirm(T('حذف بند السعر؟'))) return;
  priceDB.items = priceDB.items.filter(x => x.id !== pdbEditItemId);
  closeModal('pdb-item-modal'); await savePriceDB(); renderPdb();
}

// ---- إضافة/تعديل عرض ----
let pdbEditOfferId = null;
let pdoPendingFiles = [];
function pdoRecalc(){
  const sub = Number($('pdo-subtotal').value)||0, vr = Number($('pdo-vat').value)||0;
  $('pdo-grand').value = money(sub * (1 + vr/100));
}
function openPdbOfferModal(id){
  if (!pdbCanEdit()) return;
  pdbEditOfferId = id; pdoPendingFiles = [];
  const o = id ? priceDB.offers.find(x => x.id === id) : null;
  $('pdb-offer-title').textContent = o ? T('تعديل عرض') : T('إضافة عرض');
  $('pdo-delete').style.display = o ? '' : 'none';
  $('pdo-ref').value = o ? (o.ref||'') : '';
  $('pdo-date').value = o ? (o.date||'') : todayStr();
  $('pdo-client').value = o ? (o.client||'') : '';
  $('pdo-location').value = o ? (o.location||'') : '';
  $('pdo-project').value = o ? (o.project||'') : '';
  $('pdo-type').value = o ? (o.type||'financial') : 'financial';
  $('pdo-validity').value = o ? (o.validityDays||0) : 0;
  $('pdo-subtotal').value = o ? o.subtotal : '';
  $('pdo-vat').value = o ? o.vatRate : 15;
  $('pdo-sections').value = o ? (o.sections||[]).map(s => s.name + ' = ' + s.amount).join('\n') : '';
  $('pdo-notes').value = o ? (o.notes||'') : '';
  renderPdoFiles();
  pdoRecalc();
  $('pdb-offer-modal').classList.add('open');
}
async function pdoFilesPicked(input){
  for (const f of [...input.files].slice(0, 10 - pdoPendingFiles.length)) {
    try {
      if (f.type === 'application/pdf') { if (f.size > 9*1024*1024) { alert(f.name+': '+T('أكبر من 9MB')); continue; } pdoPendingFiles.push({dataUrl: await readFileAsDataURL(f), name: f.name}); }
      else if (f.type.startsWith('image/')) pdoPendingFiles.push({dataUrl: await compressImage(f), name: f.name});
    } catch(e) { alert(e.message); }
  }
  input.value = ''; renderPdoFiles();
}
function renderPdoFiles(){
  const existing = (pdbEditOfferId ? (priceDB.offers.find(x=>x.id===pdbEditOfferId)||{}).attachments || [] : []);
  $('pdo-files-list').innerHTML =
    existing.map(a => '<div class="sc-item" style="padding:3px 0"><span class="sc-item-name" style="font-size:11px"><a href="'+esc(a.url)+'" target="_blank" style="color:var(--blue)">'+(String(a.url).endsWith('.pdf')?'📄':'🖼')+' '+esc(a.name||T('ملف'))+'</a></span></div>').join('') +
    pdoPendingFiles.map((f,i) => '<div class="sc-item" style="padding:3px 0"><span class="sc-item-name" style="font-size:11px">⏳ '+esc(f.name)+'</span><button class="mini-btn red" onclick="pdoPendingFiles.splice('+i+',1);renderPdoFiles()">✕</button></div>').join('');
}
function parseSections(txt){
  return txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.lastIndexOf('=');
    if (i < 0) return null;
    return {name: l.slice(0,i).trim(), amount: Number(l.slice(i+1).replace(/[,،\s]/g,'')) || 0};
  }).filter(Boolean);
}
async function savePdbOffer(){
  const ref = $('pdo-ref').value.trim(), project = $('pdo-project').value.trim(), subtotal = Number($('pdo-subtotal').value);
  if (!ref || !project || !($('pdo-subtotal').value)) { alert(T('أكمل: رقم العرض، المشروع، الإجمالي')); return; }
  let uploaded = [];
  if (pdoPendingFiles.length) {
    try { for (const f of pdoPendingFiles) { const r = await API.req('POST','/api/pricedb/upload',{dataUrl:f.dataUrl}); uploaded.push({url:r.url, name:f.name}); } }
    catch(e) { alert(T('تعذر رفع الملفات:') + ' ' + e.message); return; }
  }
  const vatRate = Number($('pdo-vat').value)||0;
  const data = {ref, date:$('pdo-date').value, client:$('pdo-client').value.trim(), location:$('pdo-location').value.trim(),
    project, type:$('pdo-type').value, validityDays:Number($('pdo-validity').value)||0,
    subtotal: round2(subtotal), vatRate, vat: round2(subtotal*vatRate/100), grandTotal: round2(subtotal + subtotal*vatRate/100),
    sections: parseSections($('pdo-sections').value), notes:$('pdo-notes').value.trim()};
  if (pdbEditOfferId) {
    const o = priceDB.offers.find(x=>x.id===pdbEditOfferId);
    o.attachments = (o.attachments||[]).concat(uploaded);
    Object.assign(o, data);
  } else priceDB.offers.push({id: pdbSeq(), ...data, attachments: uploaded});
  closeModal('pdb-offer-modal'); await savePriceDB(); renderPdb();
}
async function deletePdbOffer(){
  if (!pdbEditOfferId || !confirm(T('حذف العرض؟ (لا تُحذف بنود الأسعار المرتبطة)'))) return;
  priceDB.offers = priceDB.offers.filter(x => x.id !== pdbEditOfferId);
  closeModal('pdb-offer-modal'); await savePriceDB(); renderPdb();
}

// ---- إدراج بند من القاعدة إلى جدول كميات المشروع ----
let pdbInsertItemId = null;
function openInsertToBoq(itemId){
  const it = priceDB.items.find(x => x.id === itemId);
  if (!it) return;
  if (!proj().id) { alert(T('افتح مشروعاً أولاً')); return; }
  pdbInsertItemId = itemId;
  $('pdb-insert-info').innerHTML = '<strong>' + esc(it.desc) + '</strong><br>' + T('الوحدة:') + ' ' + esc(it.unit) + ' · ' + T('السعر:') + ' ' + fmtN(it.rate) + ' ' + (LANG==='en'?'SAR':'ر.س') + ' → ' + T('المشروع:') + ' ' + esc(proj().info.name);
  // اقترح رقم بند غير مكرر
  let base = it.code || 'P1', cand = base, n = 1;
  while (getItem(cand)) { cand = base + '-' + (++n); }
  $('pdb-ins-id').value = cand;
  $('pdb-ins-qty').value = 0;
  $('pdb-insert-modal').classList.add('open');
}
function confirmInsertToBoq(){
  const it = priceDB.items.find(x => x.id === pdbInsertItemId);
  if (!it) return;
  const id = $('pdb-ins-id').value.trim();
  if (!id) { alert(T('اكتب رقم البند')); return; }
  if (getItem(id)) { alert(T('رقم البند موجود في المشروع')); return; }
  const qty = Number($('pdb-ins-qty').value) || 0;
  proj().boqItems.push({id, div:it.category||'—', divAr:'', desc:it.desc, unit:it.unit,
    qtyPerVilla:0, totalQty:qty, unitRate:it.rate, scope:'azoom', predecessors:[], blocker:null,
    executedQty:0, approvedQty:0, approvals:[], claimedQty:0, notes: it.offerRef ? T('من عرض') + ' ' + it.offerRef : ''});
  closeModal('pdb-insert-modal'); save(); renderAll();
  alert('✅ ' + T('أُضيف البند') + ' ' + id + ' ' + T('إلى جدول كميات المشروع.'));
}

function exportPdbItemsCSV(){
  const rows = [['الكود','الوصف','الوحدة','سعر الوحدة','التصنيف','رقم العرض','المشروع','ملاحظات'].map(T)];
  priceDB.items.forEach(i => rows.push([i.code||'', i.desc, i.unit, i.rate, i.category||'', i.offerRef||'', i.project||'', i.note||'']));
  dlCSV('price-database-' + todayStr() + '.csv', rows);
}

function openPdbImport(){ biTarget = 'pricedb'; openBoqImport(); }
