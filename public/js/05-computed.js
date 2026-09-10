'use strict';
// ============================================================
//  DERIVED / COMPUTED
// ============================================================
const getItem = id => proj().boqItems.find(i => i.id === id);
// ---- تقسيم البند إلى بنود فرعية (مستوى واحد) ----
const childrenOf = id => proj().boqItems.filter(i => i.parentId === id);
const isParent = it => !!it && proj().boqItems.some(i => i.parentId === it.id);   // بند رئيسي = له بنود فرعية
const isChild = it => !!it && !!it.parentId && !!getItem(it.parentId);            // بند فرعي
const parentOf = it => (it && it.parentId) ? getItem(it.parentId) : null;
// تقسيم سعر البند (منفصل عن "بند فرعي" مستقل): بند فرعي "مكوّن سعر" (splitAt) لا يملك كمية/تنفيذ/مرفوع خاصاً به —
// كلها مرآة للبند الأصلي (نفس الشغل الفعلي)، وله فقط سعر وحدة واعتماد خاصين به. qtyBase تُرجع مصدر الكمية الحقيقي:
// الأب لمكوّن سعر، أو البند ذاته لأي بند آخر (عادي أو بند فرعي مستقل بكميته الخاصة)
const isSplitChild = it => !!it && !!it.splitAt && !!it.parentId;
const qtyBase = it => { const b = isSplitChild(it) ? getItem(it.parentId) : null; return b || it; };
// تجميع أرقام البند الرئيسي من فروعه (لتفادي الازدواج في الحساب)
function groupAgg(parent){
  const kids = childrenOf(parent.id);
  const a = kids.reduce((s,k)=>s+amt(k),0);
  const wpct = f => a>0 ? kids.reduce((s,k)=>s + f(k)*amt(k),0)/a : 0;
  return { count:kids.length, amt:a, rateSum:kids.reduce((s,k)=>s+(k.unitRate||0),0),
    execPct:wpct(itemPct), approvedPct:wpct(approvedPct), claimedPct:wpct(claimedPct),
    net:kids.reduce((s,k)=>s+netClaimable(k),0), pending:kids.reduce((s,k)=>s+pendingApprovalValue(k),0) };
}
const amt = it => (qtyBase(it).totalQty||0) * (it.unitRate||0);
const approvedOf = it => { const b = qtyBase(it); return Math.min(b.executedQty||0, it.approvedQty!==undefined ? it.approvedQty : (b.executedQty||0)); };
const itemPct = it => { const b = qtyBase(it); return b.totalQty > 0 ? clamp(b.executedQty / b.totalQty, 0, 1) : 0; };      // نسبة المنفذ ميدانياً
const approvedPct = it => { const b = qtyBase(it); return b.totalQty > 0 ? clamp(approvedOf(it) / b.totalQty, 0, 1) : 0; };    // نسبة المعتمد من الاستشاري
const claimedPct = it => { const b = qtyBase(it); return b.totalQty > 0 ? clamp((b.claimedQty||0) / b.totalQty, 0, 1) : 0; };
const pendingApprovalQty = it => { const b = qtyBase(it); return it.scope === 'others' ? 0 : Math.max(0, (b.executedQty||0) - approvedOf(it)); }; // منفذ بانتظار اعتماد الاستشاري
const pendingApprovalValue = it => pendingApprovalQty(it) * (it.unitRate||0);
// المتاح للمستخلص = المعتمد من الاستشاري ناقص المرفوع سابقاً (وليس المنفذ)
const availQty = it => { const b = qtyBase(it); return Math.max(0, approvedOf(it) - (b.claimedQty||0)); };
const netClaimable = it => it.scope === 'others' ? 0 : availQty(it) * it.unitRate;
const remainingValue = it => it.scope === 'others' ? 0 : (1 - itemPct(it)) * amt(it);
// قائمة "قابلة للتصرف": تستبعد البنود الفرعية (مكوّنات السعر) — تُستخدم في كل مكان يُبنى منه
// قرار/إجراء فعلي (مطالبة، إنتاجية، تقارير) حتى لا يظهر مكوّن سعر كعنصر مستقل قابل للتنفيذ أو المطالبة
const actionableItems = () => proj().boqItems.filter(i => !i.parentId);
const DONE = 0.995;

const STATUS_META = {
  others:       {label:'خارج النطاق - منفذ سابقاً', color:'gray',   icon:'⚪'},
  by_client:    {label:'بانتظار توريد العميل', color:'purple', icon:'🔷'},
  blocked:      {label:'معيق - عائق خارجي', color:'red',  icon:'⛔'},
  waiting:      {label:'بانتظار أعمال سابقة', color:'orange', icon:'⏳'},
  available:    {label:'متاح للبدء الآن', color:'blue',   icon:'▶'},
  partial:      {label:'قيد التنفيذ', color:'amber',  icon:'🟡'},
  pending_consultant: {label:'بانتظار اعتماد الاستشاري', color:'orange', icon:'🕵'},
  done:         {label:'مكتمل - معتمد', color:'green',  icon:'✅'},
  claimed_full: {label:'مكتمل ومرفوع', color:'teal',   icon:'📤'}
};
Object.assign(I18N_EN, {
  'خارج النطاق - منفذ سابقاً':'Out of scope',
  'بانتظار توريد العميل':'Awaiting client supply',
  'معيق - عائق خارجي':'Blocked',
  'بانتظار أعمال سابقة':'Awaiting prior work',
  'متاح للبدء الآن':'Available',
  'قيد التنفيذ':'In progress',
  'بانتظار اعتماد الاستشاري':'Pending approval',
  'مكتمل - معتمد':'Approved',
  'مكتمل':'Complete',
  'مكتمل ومرفوع':'Claimed'
});

function statusOf(it){
  if (it.scope === 'others') return 'others';
  const pct = itemPct(it);
  if (it.blocker && it.blocker.active && pct < DONE) return 'blocked';
  if (it.scope === 'client_supply' && pct === 0) return 'by_client';
  const preds = (it.predecessors||[]).map(getItem).filter(Boolean);
  const incomplete = preds.filter(p => approvedPct(p) < DONE);
  if (pct === 0 && incomplete.length) return 'waiting';
  if (pct === 0) return 'available';
  // يوجد منفذ بانتظار اعتماد الاستشاري ولا يوجد رصيد معتمد متاح للرفع
  if (pendingApprovalQty(it) > 0.001 && availQty(it) < 0.001) return 'pending_consultant';
  if (pct >= DONE && approvedPct(it) >= DONE) return claimedPct(it) >= approvedPct(it) - 0.005 ? 'claimed_full' : 'done';
  return 'partial';
}

function successorsOf(id){ return proj().boqItems.filter(i => (i.predecessors||[]).includes(id)); }
function downstreamSet(id, seen){
  seen = seen || new Set();
  successorsOf(id).forEach(c => { if (!seen.has(c.id)) { seen.add(c.id); downstreamSet(c.id, seen); } });
  return seen;
}
// سلسلة الاعتماد: يرجع مسار أول سلف غير مكتمل حتى الجذر
function chainOf(it){
  const path = [];
  let cur = it, guard = 0;
  while (cur && guard++ < 10) {
    const inc = (cur.predecessors||[]).map(getItem).filter(Boolean).filter(p => itemPct(p) < DONE);
    if (!inc.length) break;
    inc.sort((a,b) => itemPct(a) - itemPct(b));
    cur = inc[0];
    path.push(cur);
  }
  return path;
}
function rootCauseOf(it){ const c = chainOf(it); return c.length ? c[c.length-1] : null; }

// ملاحظة: totalsFor تُستدعى أحياناً لمشروع غير المشروع الحالي المعروض (شبكة المشاريع) — لذا
// نستبعد البنود الفرعية (مكوّنات السعر) محلياً هنا بدل استخدام actionableItems() العامة (التي تفترض proj() الحالي)
function totalsFor(p){
  const t = {contract:0, azoomScope:0, executed:0, approved:0, pendingApproval:0, claimed:0, net:0, locked:0, othersVal:0, musNet:0, collected:0, blockedCount:0, pendingApprovalCount:0};
  const getP = id => p.boqItems.find(i => i.id === id);
  const isParentIn = it => p.boqItems.some(c => c.parentId === it.id);
  // مصدر الكمية الحقيقي محلياً (لا نستخدم qtyBase العامة المرتبطة بـ proj() الحالي — p قد يكون مشروعاً آخر)
  const baseP = it => { const b = (it.splitAt && it.parentId) ? getP(it.parentId) : null; return b || it; };
  p.boqItems.forEach(it => {
    if (isParentIn(it)) return; // البند الرئيسي مجرد تجميع — القيمة محسوبة في فروعه
    const b = baseP(it);
    const a = (b.totalQty||0) * (it.unitRate||0);
    t.contract += a;
    if (it.scope === 'others') { t.othersVal += a; return; }
    t.azoomScope += a;
    const pct = b.totalQty>0 ? clamp((b.executedQty||0)/b.totalQty,0,1) : 0;
    const apprOf = Math.min(b.executedQty||0, it.approvedQty!==undefined?it.approvedQty:(b.executedQty||0));
    const apprPct = b.totalQty>0 ? clamp(apprOf/b.totalQty,0,1) : 0;
    const claimPct = b.totalQty>0 ? clamp((b.claimedQty||0)/b.totalQty,0,1) : 0;
    const pendQty = Math.max(0,(b.executedQty||0)-apprOf);
    const availQ = Math.max(0, apprOf-(b.claimedQty||0));
    t.executed += pct * a;
    t.approved += apprPct * a;
    t.pendingApproval += pendQty * (it.unitRate||0);
    if (pendQty > 0.001) t.pendingApprovalCount++;
    t.claimed += claimPct * a;
    t.net += availQ * it.unitRate;
    if (it.blocker && it.blocker.active && pct < DONE) t.blockedCount++;
    let locked = it.blocker && it.blocker.active && pct < DONE;
    if (!locked && pct === 0) {
      if (it.scope === 'client_supply') locked = true;
      else locked = (it.predecessors||[]).map(getP).filter(Boolean).some(x => (x.totalQty>0 ? (x.executedQty||0)/x.totalQty : 0) < DONE);
    }
    if (locked) t.locked += (1 - pct) * a;
  });
  p.mustakhlasat.forEach(m => { t.musNet += m.net; t.collected += paidAmount(m); });
  return t;
}
function totals(){ return totalsFor(proj()); }
