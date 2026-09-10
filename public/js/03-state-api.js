'use strict';
// ============================================================
//  STATE & API PERSISTENCE
// ============================================================
let state = null;

const API = {
  token: localStorage.getItem('azoom_token') || '',
  async req(method, url, body, keepalive){
    const r = await fetch(url, {
      method,
      keepalive: !!keepalive,
      headers: {'Content-Type':'application/json', ...(this.token ? {'Authorization':'Bearer ' + this.token} : {})},
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let d = {};
    try { d = await r.json(); } catch(e) {}
    if (!r.ok) { const err = new Error(ERR_MSG(d.error, d) || ((LANG==='en'?'Error ':'خطأ ') + r.status)); err.status = r.status; err.data = d; throw err; }
    return d;
  }
};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (n,a,b) => Math.min(b, Math.max(a, Number(n)||0));
const round2 = n => Math.round((Number(n)||0) * 100) / 100; // تفادي أخطاء الفاصلة العائمة في المبالغ المخزّنة
const fmtN = n => Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0});
const fmtQ = n => Number(n||0).toLocaleString('en-US',{maximumFractionDigits:1});
// سعر الوحدة تحديداً: يُعرض بدقة كسور — تقريب fmtN لأقرب رقم صحيح يُخفي هللات قد تُربك عند تقسيم السعر لاحقاً
const fmtRate = n => Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const money = n => fmtN(n) + (LANG === 'en' ? ' SAR' : ' ر.س');
const todayStr = () => new Date().toISOString().slice(0,10);
const daysAgo = k => { const d = new Date(); d.setDate(d.getDate()-k); return d.toISOString().slice(0,10); };
const ageDays = d => { if (!d) return null; const n = Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000); return isNaN(n) ? null : Math.max(0, n); };
const paidAmount = m => (m.payments||[]).reduce((s,p) => s + (Number(p.amount)||0), 0);

// مشروع تجريبي كامل (يضيفه المالك من الإعدادات عند الحاجة)
function demoProjectData(){
  const items = [
    {id:'2.1', div:'DIV 2', divAr:'أعمال الموقع', desc:'توريد وتركيب إنترلوك (بلاط خرسانة مسبق الصب)', unit:'م²', qtyPerVilla:121, totalQty:11616, unitRate:60, scope:'azoom', predecessors:[], blocker:{active:true, reason:'تأخر أعمال الردم', type:'external', note:'لم يبدأ في كل الفلل - بانتظار اكتمال الردم من المقاول الرئيسي (متوقع 15 يوم)', since:daysAgo(20), expected:''}, executedQty:0, claimedQty:0, notes:''},
    {id:'4.1', div:'DIV 4', divAr:'أعمال البناء', desc:'بلوك خرساني W2 سمك 100مم', unit:'م²', qtyPerVilla:196, totalQty:18816, unitRate:86, scope:'others', predecessors:[], blocker:null, executedQty:0, claimedQty:0, notes:'نُفّذ من قِبل مقاول آخر قبل بدء عزوم'},
    {id:'4.2', div:'DIV 4', divAr:'أعمال البناء', desc:'بلوك خرساني W3 سمك 150مم', unit:'م²', qtyPerVilla:57, totalQty:5472, unitRate:95, scope:'azoom', predecessors:[], blocker:null, executedQty:5472, claimedQty:0, notes:''},
    {id:'4.3', div:'DIV 4', divAr:'أعمال البناء', desc:'بلوك خرساني W4 سمك 200مم', unit:'م²', qtyPerVilla:3.56, totalQty:342, unitRate:100, scope:'others', predecessors:[], blocker:null, executedQty:0, claimedQty:0, notes:'نُفّذ من قِبل مقاول آخر'},
    {id:'4.4', div:'DIV 4', divAr:'أعمال البناء', desc:'بلوك خرساني معزول W5 سمك 200مم', unit:'م²', qtyPerVilla:32, totalQty:3072, unitRate:120, scope:'others', predecessors:[], blocker:null, executedQty:0, claimedQty:0, notes:'نُفّذ من قِبل مقاول آخر'},
    {id:'9.1', div:'DIV 9', divAr:'أعمال التشطيبات', desc:'لياسة أسمنتية - المناطق الجافة (سمك 12مم)', unit:'م²', qtyPerVilla:306, totalQty:29376, unitRate:40, scope:'azoom', predecessors:[], blocker:null, executedQty:27907, claimedQty:0, notes:'C35 متسلم 100% / C36 جاري 90%'},
    {id:'9.2', div:'DIV 9', divAr:'أعمال التشطيبات', desc:'لياسة أسمنتية - المناطق الرطبة', unit:'م²', qtyPerVilla:172, totalQty:16512, unitRate:40, scope:'others', predecessors:[], blocker:null, executedQty:0, claimedQty:0, notes:''},
    {id:'9.3', div:'DIV 9', divAr:'أعمال التشطيبات', desc:'لياسة خارجية للفيلا', unit:'م²', qtyPerVilla:14, totalQty:1344, unitRate:50, scope:'others', predecessors:[], blocker:null, executedQty:0, claimedQty:0, notes:''},
    {id:'9.4.3', div:'DIV 9', divAr:'أعمال التشطيبات', desc:'ألواح الأسمنت (سيمنت بورد) + عزل 50مم', unit:'م²', qtyPerVilla:219, totalQty:21024, unitRate:50, scope:'azoom', predecessors:[], blocker:null, executedQty:21024, claimedQty:0, notes:'مكتمل في جميع الفلل'},
    {id:'9.4.4', div:'DIV 9', divAr:'أعمال التشطيبات', desc:'لاصق مفاصل وقيط الجوانب', unit:'م²', qtyPerVilla:219, totalQty:21024, unitRate:20, scope:'azoom', predecessors:[], blocker:null, executedQty:21024, claimedQty:0, notes:'مكتمل في جميع الفلل'},
    {id:'9.5', div:'DIV 9', divAr:'أعمال التشطيبات', desc:'سيراميك جدران 200×200 (توريد من SBG)', unit:'م²', qtyPerVilla:183, totalQty:17568, unitRate:25, scope:'client_supply', predecessors:[], blocker:null, executedQty:0, claimedQty:0, notes:'المواد يوفرها العميل - دور عزوم التركيب فقط عند التسليم'},
    {id:'9.6.1', div:'DIV 9', divAr:'الدهانات الداخلية', desc:'تحضير الأسطح - دهان داخلي', unit:'م²', qtyPerVilla:555, totalQty:53301, unitRate:3, scope:'azoom', predecessors:[], blocker:null, executedQty:53301, claimedQty:53301, notes:''},
    {id:'9.6.2', div:'DIV 9', divAr:'الدهانات الداخلية', desc:'بريمر إنتر برايم (الجزيرة)', unit:'م²', qtyPerVilla:555, totalQty:53301, unitRate:2, scope:'azoom', predecessors:['9.6.1'], blocker:null, executedQty:53301, claimedQty:53301, notes:''},
    {id:'9.6.3', div:'DIV 9', divAr:'الدهانات الداخلية', desc:'معجون جداري - الطبقة الأولى', unit:'م²', qtyPerVilla:555, totalQty:53301, unitRate:7, scope:'azoom', predecessors:['9.6.2'], blocker:null, executedQty:26650, claimedQty:0, notes:'بعض الفلل منتهية'},
    {id:'9.6.4', div:'DIV 9', divAr:'الدهانات الداخلية', desc:'معجون جداري - الطبقة الثانية', unit:'م²', qtyPerVilla:555, totalQty:53301, unitRate:6, scope:'azoom', predecessors:['9.6.3'], blocker:null, executedQty:15990, claimedQty:0, notes:''},
    {id:'9.6.5', div:'DIV 9', divAr:'الدهانات الداخلية', desc:'طلاء نهائي Jaz Acryl - الطبقة الأولى', unit:'م²', qtyPerVilla:555, totalQty:53301, unitRate:3, scope:'azoom', predecessors:['9.6.4'], blocker:null, executedQty:0, claimedQty:0, notes:''},
    {id:'9.6.6', div:'DIV 9', divAr:'الدهانات الداخلية', desc:'طلاء نهائي Jaz Acryl - الطبقة الثانية', unit:'م²', qtyPerVilla:555, totalQty:53301, unitRate:4, scope:'azoom', predecessors:['9.6.5'], blocker:null, executedQty:0, claimedQty:0, notes:''},
    {id:'9.7.1', div:'DIV 9', divAr:'دهانات السقف', desc:'تحضير أسطح السقف', unit:'م²', qtyPerVilla:214, totalQty:20544, unitRate:4, scope:'azoom', predecessors:[], blocker:null, executedQty:20544, claimedQty:0, notes:''},
    {id:'9.7.2', div:'DIV 9', divAr:'دهانات السقف', desc:'بريمر سقف (إنتر برايم)', unit:'م²', qtyPerVilla:214, totalQty:20544, unitRate:2, scope:'azoom', predecessors:['9.7.1'], blocker:null, executedQty:20544, claimedQty:0, notes:''},
    {id:'9.8', div:'DIV 9', divAr:'دهانات السقف', desc:'معجون سقف - الطبقة الأولى', unit:'م²', qtyPerVilla:214, totalQty:20544, unitRate:8, scope:'azoom', predecessors:['9.7.2'], blocker:null, executedQty:8218, claimedQty:0, notes:''},
    {id:'9.9', div:'DIV 9', divAr:'دهانات السقف', desc:'معجون سقف - الطبقة الثانية', unit:'م²', qtyPerVilla:214, totalQty:20544, unitRate:6, scope:'azoom', predecessors:['9.8'], blocker:null, executedQty:0, claimedQty:0, notes:''},
    {id:'9.9E', div:'DIV 9', divAr:'الدهانات الخارجية', desc:'تحضير أسطح الواجهة الخارجية للفيلا', unit:'م²', qtyPerVilla:553, totalQty:53088, unitRate:7, scope:'azoom', predecessors:['2.1'], blocker:null, executedQty:0, claimedQty:0, notes:'لا يمكن البدء قبل تركيب الإنترلوك'},
    {id:'9.10', div:'DIV 9', divAr:'الدهانات الخارجية', desc:'بريمر خارجي Primex للواجهة', unit:'م²', qtyPerVilla:553, totalQty:53088, unitRate:2, scope:'azoom', predecessors:['9.9E'], blocker:null, executedQty:0, claimedQty:0, notes:''},
    {id:'9.11', div:'DIV 9', divAr:'الدهانات الخارجية', desc:'طلاء ملمسي خارجي (الجزيرة تكستشر)', unit:'م²', qtyPerVilla:553, totalQty:53088, unitRate:10, scope:'azoom', predecessors:['9.10'], blocker:null, executedQty:0, claimedQty:0, notes:''},
    {id:'9.12', div:'DIV 9', divAr:'دهانات السور الخارجي', desc:'تحضير أسطح السور الخارجي', unit:'م²', qtyPerVilla:231, totalQty:22176, unitRate:7, scope:'azoom', predecessors:[], blocker:null, executedQty:21511, claimedQty:0, notes:'فيلا واحدة 70%'},
    {id:'9.13', div:'DIV 9', divAr:'دهانات السور الخارجي', desc:'بريمر Primex للسور', unit:'م²', qtyPerVilla:231, totalQty:22176, unitRate:2, scope:'azoom', predecessors:['9.12'], blocker:null, executedQty:21511, claimedQty:0, notes:''},
    {id:'9.14', div:'DIV 9', divAr:'دهانات السور الخارجي', desc:'طلاء ملمسي للسور + طبقتان نهائيتان', unit:'م²', qtyPerVilla:231, totalQty:22176, unitRate:21, scope:'azoom', predecessors:['9.13'], blocker:null, executedQty:13306, claimedQty:0, notes:''},
    {id:'9.15', div:'DIV 9', divAr:'تشطيبات الأرضيات', desc:'بورسلان أرضية 400×400مم', unit:'م²', qtyPerVilla:195, totalQty:18720, unitRate:40, scope:'azoom', predecessors:[], blocker:{active:true, reason:'عدم تركيب الأبواب والشبابيك (SBG)', type:'external', note:'الأرضيات تتطلب غلق الغرف أولاً - جميع الفلل متوقفة', since:daysAgo(15), expected:''}, executedQty:0, claimedQty:0, notes:''},
    {id:'9.16', div:'DIV 9', divAr:'تشطيبات الأرضيات', desc:'قرنيز بورسلان عرض 400مم', unit:'خ.م', qtyPerVilla:222, totalQty:21312, unitRate:10, scope:'azoom', predecessors:['9.15'], blocker:null, executedQty:0, claimedQty:0, notes:''},
    {id:'9.17', div:'DIV 9', divAr:'تشطيبات الأرضيات', desc:'سيراميك حمامات 200×200مم', unit:'م²', qtyPerVilla:46, totalQty:4416, unitRate:30, scope:'azoom', predecessors:[], blocker:{active:true, reason:'عدم تركيب الأبواب والشبابيك (SBG)', type:'external', note:'مرتبط بنفس عائق الأرضيات', since:daysAgo(15), expected:''}, executedQty:0, claimedQty:0, notes:''},
    {id:'9.18-23', div:'DIV 9', divAr:'تشطيبات الأرضيات', desc:'عتبات رخام (أحجام مختلفة 160-270مم)', unit:'خ.م', qtyPerVilla:26, totalQty:2496, unitRate:50, scope:'azoom', predecessors:[], blocker:{active:true, reason:'عدم تركيب الأبواب والشبابيك (SBG)', type:'external', note:'تركيب الأبواب مطلوب لتحديد المقاسات', since:daysAgo(15), expected:''}, executedQty:0, claimedQty:0, notes:''},
    {id:'9.24-27', div:'DIV 9', divAr:'تشطيبات الأرضيات', desc:'درج بورسلان مضاد للانزلاق (صعود + مدخل)', unit:'قطعة', qtyPerVilla:98, totalQty:9408, unitRate:35, scope:'azoom', predecessors:[], blocker:{active:true, reason:'عدم تركيب الأبواب والشبابيك (SBG)', type:'external', note:'مرتبط بنفس عائق الأرضيات', since:daysAgo(15), expected:''}, executedQty:0, claimedQty:0, notes:''},
    {id:'9.28', div:'DIV 9', divAr:'تشطيبات الأسقف', desc:'أسقف معلقة ألياف معدنية 600×600 (ممرات)', unit:'م²', qtyPerVilla:11.5, totalQty:1104, unitRate:85, scope:'azoom', predecessors:['9.6.6'], blocker:{active:true, reason:'مواد الأسقف المعلقة غير متوفرة', type:'material', note:'يلزم تأمين المواد قبل البدء', since:daysAgo(10), expected:''}, executedQty:0, claimedQty:0, notes:''},
    {id:'9.29', div:'DIV 9', divAr:'تشطيبات الأسقف', desc:'أسقف معلقة بانل معدني 600×600 (حمامات)', unit:'م²', qtyPerVilla:24, totalQty:2304, unitRate:85, scope:'azoom', predecessors:['9.9'], blocker:null, executedQty:0, claimedQty:0, notes:''}
  ];

  const villaDefs = [
    ['403','C35',1],['404','C35',1],['451','C35',1],['452','C35',1],['453','C35',1],
    ['405','C35',1],['421','C35',1],['422','C35',1],['433','C35',1],['434','C35',0.7],
    ['454','C36',0.9],['455','C36',1],['456','C36',0.9],['465','C36',0.9],['466','C36',0.9],
    ['474','C36',1],['476','C36',1],['488','C36',1],['490','C36',1],['505','C36',1],
    ['500','C37',0.7],['501','C37',0.75],['502','C37',0.8],['503','C37',0.85],['504','C37',0.8],
    ['513','C37',0.7],['514','C37',0.75],['515','C37',0.7],['516','C37',0.65],['517','C37',0.6]
  ];
  const villas = villaDefs.map(v => ({no:v[0], sheet:v[1]}));
  const villaProgress = {};
  items.forEach(it => {
    if (it.scope === 'others') return;
    const basePct = it.totalQty > 0 ? it.executedQty / it.totalQty : 0;
    villaProgress[it.id] = {};
    villaDefs.forEach(v => { villaProgress[it.id][v[0]] = Math.round(Math.min(1, basePct * v[2]) * 100); });
  });

  // مستخلص تجريبي سابق (لتوضيح فكرة السجل) - بنود 9.6.1 و 9.6.2 مرفوعة بالكامل
  const m1lines = [
    {itemId:'9.6.1', desc:'تحضير الأسطح - دهان داخلي', unit:'م²', rate:3, totalQty:53301, prevQty:0, currQty:53301, cumQty:53301, amount:159903},
    {itemId:'9.6.2', desc:'بريمر إنتر برايم (الجزيرة)', unit:'م²', rate:2, totalQty:53301, prevQty:0, currQty:53301, cumQty:53301, amount:106602}
  ];
  const g1 = 266505, v1 = g1*0.15, r1 = g1*0.10;
  const mustakhlasat = [{
    id: 1, no:'MUS-001', date: daysAgo(35), status:'paid', lines:m1lines,
    gross:g1, vatRate:15, retRate:10, advRate:0, vat:v1, retention:r1, advance:0, net:g1+v1-r1,
    notes:'مستخلص تجريبي - أعمال التحضير والبريمر الداخلي',
    payments:[{id:501, date:daysAgo(18), amount:Math.round(g1+v1-r1), note:'حوالة بنكية'}]
  }];

  const workLogs = [
    {id:101, date:daysAgo(3), crew:'فرقة الدهانات أ', itemId:'9.6.3', villaNo:'455', qty:200, workers:4, note:'', applied:false, appliedQty:0},
    {id:102, date:daysAgo(2), crew:'فرقة الدهانات أ', itemId:'9.6.4', villaNo:'403', qty:150, workers:4, note:'', applied:false, appliedQty:0},
    {id:103, date:daysAgo(2), crew:'فرقة السور', itemId:'9.14', villaNo:'403', qty:90, workers:3, note:'', applied:false, appliedQty:0},
    {id:104, date:daysAgo(1), crew:'فرقة الدهانات أ', itemId:'9.6.3', villaNo:'454', qty:180, workers:4, note:'', applied:false, appliedQty:0},
    {id:105, date:daysAgo(1), crew:'فرقة الدهانات ب', itemId:'9.8', villaNo:'500', qty:120, workers:3, note:'', applied:false, appliedQty:0}
  ];

  return {
    managerUserId:null,
    seq:1000,
    info:{
      name:'مشروع SANG السكني - موقع القصيم (تجريبي)', client:'Saudi Binladen Group (SBG)', consultant:'Dar Al-Riyadh',
      contractor:'AZOOM UNITED CO. - عزوم المتحدة', totalVillas:96, vatRate:15, retentionRate:10, advanceRate:0,
      projectType:'residential', unitLabel:'فيلا', unitsTitle:'الفلل'
    },
    boqItems:items, villas, villaProgress, mustakhlasat, workLogs, blockerLog:[]
  };
}
