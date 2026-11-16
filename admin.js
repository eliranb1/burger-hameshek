/* =========================================================
   בורגר המשק – חלון מנהל (Firebase)
   - ההגדרות: Firestore, מסמך site/settings. תמונות משקאות: אוסף images.
   - כניסה: Firebase Auth עם סיסמה בלבד (המייל קבוע כאן).
   - כללי האבטחה ב-Firestore: כולם קוראים, רק המנהל כותב.
   ========================================================= */
(function(){
const MANAGER_EMAIL="manager@burger-hameshek.app";
const DAYS=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const $=s=>document.querySelector(s);
let W=null, pendingImgs={}, tab=window.BH_START_TAB||"orders", FB=null, ordersUnsub=null, ORD=[], seen=null;

const css=`
.adm[hidden],.adm-scrim[hidden]{display:none!important}
.adm-scrim{position:fixed;inset:0;background:rgba(10,6,3,.75);z-index:80}
.adm{position:fixed;top:0;bottom:0;left:0;width:min(460px,100%);z-index:90;background:#f7efe1;color:#24170e;display:flex;flex-direction:column;
  box-shadow:10px 0 40px rgba(0,0,0,.5);font-family:var(--body);font-size:17px}
.adm h2{font-family:var(--display);font-weight:400;font-size:24px;color:#24170e}
.adm-h{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:#24170e;color:#fff3dc}
.adm-h h2{color:#fff3dc}
.adm-h button{color:#fff3dc;font-size:26px;width:40px;height:40px}
.adm-b{flex:1;overflow-y:auto;padding:16px 18px 24px}
.adm-f{padding:12px 18px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #d9c7a8;background:#efe3cd}
.adm label{display:block;font-weight:700;margin:12px 0 5px}
.adm input,.adm select{width:100%;min-height:46px;padding:8px 12px;border-radius:9px;border:1.5px solid #cdb68f;background:#fff;color:#24170e;font:inherit}
.adm input:focus,.adm select:focus{outline:3px solid #f2b632;border-color:#b07a2a}
.adm .b{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border-radius:10px;font-weight:800;border:0;cursor:pointer;font:inherit;font-weight:800}
.adm .b-main{background:#24170e;color:#f2b632;width:100%}
.adm .b-line{background:#fff;border:1.5px solid #24170e;color:#24170e}
.adm .b-red{background:#fff;border:1.5px solid #b8321f;color:#b8321f}
.adm .tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:8px 10px;background:#efe3cd;border-bottom:1px solid #d9c7a8}
.adm .tabs button{min-height:42px;border-radius:8px;font-weight:800;color:#5a4330}
.adm .tabs button[aria-selected=true]{background:#24170e;color:#f2b632}
.adm .card{background:#fff;border:1px solid #e0cfb1;border-radius:12px;padding:12px 14px;margin-top:12px}
.adm .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.adm .muted{color:#7a6249;font-size:14.5px;font-weight:600}
.adm .wk b{font-size:16px}
.adm .pr{display:grid;grid-template-columns:1fr 96px;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid #eee2cc}
.adm .pr span{font-weight:700}
.adm .pr input{text-align:center;min-height:42px}
.adm .drk{display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center}
.adm .drk img{width:64px;height:72px;object-fit:contain;background:#f3ead9;border-radius:8px;cursor:pointer}
.adm .drk .acts{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}
.adm .tog{display:flex;align-items:center;gap:8px;font-weight:800;margin:0}
.adm .tog input{width:24px;height:24px;min-height:0}
.adm .msg{margin-top:10px;font-weight:800;min-height:1.4em}
.adm .msg.err{color:#b8321f}.adm .msg.ok{color:#2e6b3a}
.adm .steps{padding-inline-start:20px;line-height:1.7;font-size:15.5px}
.adm .changed{border-color:#f2b632;box-shadow:0 0 0 2px #f2b632}
.adm .ord{border-inline-start:6px solid #cdb68f}
.adm .ord.s-new{border-inline-start-color:#b8321f;background:#fff4f1}
.adm .ord.s-accepted{border-inline-start-color:#f2b632}
.adm .ord.s-out,.adm .ord.s-ready{border-inline-start-color:#2e6b3a}
.adm .ord.s-done,.adm .ord.s-rejected{opacity:.55}
.adm .ord h3{font-size:18px;font-weight:800;display:flex;justify-content:space-between;gap:8px}
.adm .ord pre{white-space:pre-wrap;font:inherit;font-size:15.5px;margin:8px 0;background:#f7efe1;border-radius:8px;padding:8px 10px}
.adm .ord .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.adm .ord .acts .b{min-height:44px;padding:0 12px}
.adm .ord .tag{font-size:14px;font-weight:800;padding:2px 10px;border-radius:99px;background:#24170e;color:#f2b632;white-space:nowrap}
.adm .ord a{color:#24170e;font-weight:800}
`;
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

/* ---------- מבנה ---------- */
const scrim=document.createElement("div");scrim.className="adm-scrim";scrim.hidden=true;
const pan=document.createElement("aside");pan.className="adm";pan.hidden=true;pan.setAttribute("role","dialog");pan.setAttribute("aria-modal","true");pan.setAttribute("aria-label","ניהול העסק");
pan.innerHTML=`<div class="adm-h"><h2>ניהול בורגר המשק</h2><button aria-label="סגירה" id="admX">×</button></div><div id="admTabs"></div><div class="adm-b" id="admB"></div><div class="adm-f" id="admF"></div>`;
document.body.append(scrim,pan);
scrim.onclick=close;pan.querySelector("#admX").onclick=close;
pan.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
function close(){pan.hidden=true;scrim.hidden=true;$("#adminBtn").focus()}
const B=()=>pan.querySelector("#admB"),F=()=>pan.querySelector("#admF"),T=()=>pan.querySelector("#admTabs");
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function msg(t,kind){const m=pan.querySelector(".msg");if(m){m.textContent=t;m.className="msg "+(kind||"")}}


/* ---------- Firebase ---------- */
async function fb(){
  if(FB)return FB;
  const V="https://www.gstatic.com/firebasejs/11.0.2/";
  const [app,auth,fs]=await Promise.all([import(V+"firebase-app.js"),import(V+"firebase-auth.js"),import(V+"firebase-firestore.js")]);
  const a=app.getApps().length?app.getApp():app.initializeApp(FIREBASE_CONFIG);
  FB={auth:auth.getAuth(a),A:auth,db:fs.getFirestore(a),F:fs};return FB;
}

/* ---------- כניסה ---------- */
async function open(){
  if(window.BH_START_TAB){tab=window.BH_START_TAB;window.BH_START_TAB=null}
  pan.hidden=false;scrim.hidden=false;T().innerHTML="";F().innerHTML="";
  B().innerHTML=`<p class="muted">טוען…</p>`;
  try{const {auth,A}=await fb();
    await new Promise(r=>{const u=A.onAuthStateChanged(auth,()=>{u();r()})});
    auth.currentUser?main():login();
  }catch(e){B().innerHTML=`<p class="msg err">לא הצלחתי להתחבר לשירות: ${esc(e.message)}</p>`}
}
function login(){
  B().innerHTML=`<form id="lf"><label for="apw">סיסמת מנהל</label><input id="apw" type="password" autocomplete="current-password" required><div class="msg"></div></form>`;
  F().innerHTML=`<button class="b b-main" form="lf">כניסה</button>`;
  setTimeout(()=>$("#apw").focus(),50);
  $("#lf").onsubmit=async e=>{e.preventDefault();msg("בודק…");
    try{const {auth,A}=await fb();await A.signInWithEmailAndPassword(auth,MANAGER_EMAIL,$("#apw").value);main()}
    catch(err){msg(/invalid|wrong|credential/i.test(err.code||"")?"סיסמה שגויה":/too-many/.test(err.code||"")?"יותר מדי ניסיונות – לחכות כמה דקות":"תקלה: "+(err.code||err.message),"err");$("#apw").select()}};
}

/* ---------- מסך ניהול ---------- */
async function main(){
  W=structuredClone(CFG);pendingImgs={};
  // פעם ראשונה: אם אין עדיין הגדרות ב-Firebase – מעלים את מה שיש באתר
  try{const {db,F}=await fb();const s=await F.getDoc(F.doc(db,"site","settings"));
    if(!s.exists()){await F.setDoc(F.doc(db,"site","settings"),pack(W));}}catch(e){}
  T().innerHTML=`<div class="tabs" role="tablist">${[["orders","הזמנות"],["days","ימי פתיחה"],["prices","מחירים"],["drinks","שתייה"],["more","הגדרות"]].map(([k,n])=>`<button role="tab" data-tab="${k}" aria-selected="${k===tab}">${n}</button>`).join("")}</div>`;
  T().onclick=e=>{const b=e.target.closest("[data-tab]");if(!b)return;collect();tab=b.dataset.tab;main2()};
  F().innerHTML=`<button class="b b-main" id="aSave">שמירה ופרסום באתר</button><div class="msg"></div>`;
  $("#aSave").onclick=saveAll;listenOrders();main2();
}
function main2(){T().querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===tab));F().hidden=tab==="orders";({orders,days,prices,drinks,more})[tab]()}

/* ---------- הזמנות ---------- */
const SNAME={new:"חדשה",accepted:"בהכנה",out:"בדרך",ready:"מוכנה לאיסוף",done:"נמסרה",rejected:"בוטלה"};
function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)();[0,.25,.5].forEach(t=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=880;o.connect(g);g.connect(c.destination);g.gain.setValueAtTime(.3,c.currentTime+t);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+t+.2);o.start(c.currentTime+t);o.stop(c.currentTime+t+.22)});navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}}
async function listenOrders(){
  if(ordersUnsub)return;const {db,F}=await fb();
  const q=F.query(F.collection(db,"orders"),F.orderBy("createdAt","desc"),F.limit(40));
  ordersUnsub=F.onSnapshot(q,snap=>{
    ORD=snap.docs.map(d=>({id:d.id,...d.data()})).filter(o=>!o.createdAt||Date.now()-o.createdAt.toMillis()<36*3600e3);
    const ids=new Set(ORD.filter(o=>o.status==="new").map(o=>o.id));
    if(seen&&[...ids].some(i=>!seen.has(i)))beep();seen=ids;
    const n=ids.size,tb=T().querySelector('[data-tab="orders"]');if(tb)tb.textContent=n?`הזמנות (${n})`:"הזמנות";
    if(tab==="orders"&&!pan.hidden)orders();
  },e=>{if(tab==="orders")B().innerHTML=`<p class="msg err">לא הצלחתי לטעון הזמנות: ${esc(e.code||e.message)}</p>`});
}
const hm=t=>t?t.toDate().toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jerusalem"}):"";
function orders(){
  if(!ORD.length){B().innerHTML=`<p class="muted" style="margin-top:20px;text-align:center">עוד אין הזמנות. כשתיכנס הזמנה – היא תופיע כאן עם צלצול.</p>`;return}
  B().innerHTML=ORD.map(o=>{
    const left=o.readyAt?Math.ceil((o.readyAt.toMillis()-Date.now())/60000):null;
    let acts="";
    if(o.status==="new")acts=`<span class="muted" style="width:100%">אישור – מוכן בעוד:</span>${[10,15,20,30,45,60].map(m=>`<button class="b b-main" style="width:auto" data-o="${o.id}" data-a="acc" data-m="${m}">${m} דק'</button>`).join("")}<button class="b b-red" data-o="${o.id}" data-a="rej">ביטול</button>`;
    else if(o.status==="accepted")acts=`<button class="b b-line" data-o="${o.id}" data-a="ext" data-m="5">+5 דק'</button><button class="b b-line" data-o="${o.id}" data-a="ext" data-m="10">+10 דק'</button><button class="b b-main" style="width:auto" data-o="${o.id}" data-a="${o.how==="משלוח"?"out":"ready"}">${o.how==="משלוח"?"יצא למשלוח 🛵":"מוכן לאיסוף ✅"}</button><button class="b b-red" data-o="${o.id}" data-a="rej">ביטול</button>`;
    else if(o.status==="out"||o.status==="ready")acts=`<button class="b b-main" style="width:auto" data-o="${o.id}" data-a="done">נמסר ✓</button>`;
    return `<div class="card ord s-${o.status}"><h3><span>#${o.id.slice(0,5).toUpperCase()} · ${hm(o.createdAt)}</span><span class="tag">${SNAME[o.status]||o.status}${o.status==="accepted"&&left!==null?` · עוד ${Math.max(0,left)} דק'`:""}</span></h3>
      <div><b>${esc(o.name)}</b> · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></div>
      <div>${o.how==="משלוח"?`🛵 ${esc(o.town)}, ${esc(o.addr)}`:"🏠 איסוף עצמי"}${o.time?` · שעה רצויה ${esc(o.time)}`:""}</div>
      <pre>${esc((o.lines||[]).join("\n"))}</pre>
      <div><b>סה"כ ${o.total} ₪</b> · ${esc(o.pay)}${o.notes?`<br>הערות: ${esc(o.notes)}`:""}</div>
      <div class="acts">${acts}</div></div>`}).join("");
}
let rejArm=null;
pan.addEventListener("click",async e=>{
  const b=e.target.closest("[data-a]");if(!b||!pan.contains(b))return;
  const {db,F}=await fb(),ref=F.doc(db,"orders",b.dataset.o),o=ORD.find(x=>x.id===b.dataset.o),a=b.dataset.a,m=+b.dataset.m;
  if(a==="rej"&&rejArm!==b.dataset.o){rejArm=b.dataset.o;b.textContent="בטוח? לחץ שוב";return}
  const now=Date.now(),upd=
    a==="acc"?{status:"accepted",minutes:m,readyAt:F.Timestamp.fromMillis(now+m*60000)}:
    a==="ext"?{minutes:(o.minutes||0)+m,readyAt:F.Timestamp.fromMillis(Math.max(now,o.readyAt?o.readyAt.toMillis():now)+m*60000)}:
    {status:a==="rej"?"rejected":a};
  b.disabled=true;
  try{await F.updateDoc(ref,upd)}catch(err){b.disabled=false;alertMsg("לא נשמר: "+(err.code||err.message))}
});
function alertMsg(t){const d=document.createElement("p");d.className="msg err";d.textContent=t;B().prepend(d)}
setInterval(()=>{if(!pan.hidden&&tab==="orders"&&ORD.some(o=>o.status==="accepted"))orders()},30000);

/* ימי פתיחה */
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function ilNow(){return new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Jerusalem"}))}
function weeks(){const n=ilNow();n.setHours(0,0,0,0);n.setDate(n.getDate()-n.getDay());return Array.from({length:5},(_,i)=>{const s=new Date(n);s.setDate(n.getDate()+7*i);return s})}
function days(){
  const S=W.schedule;S.weeks=S.weeks||{};
  const dayOpts=sel=>DAYS.map((d,i)=>`<option value="${i}" ${sel!==""&&sel!==undefined&&sel!==null&&+sel===i?"selected":""}>יום ${d}</option>`).join("");
  let h=`<div class="card"><b>הקבוע – כל שבוע</b>
    <label for="dDay">יום פתיחה</label><select id="dDay">${dayOpts(S.day)}</select>
    <div class="row"><div><label for="dFrom">משעה</label><input id="dFrom" type="time" value="${S.from}"></div><div><label for="dTo">עד שעה</label><input id="dTo" type="time" value="${S.to}"></div></div></div>
    <h2 style="margin-top:20px">שינוי לשבוע מסוים</h2><p class="muted">השינוי מופיע באתר רק באותו שבוע. אחריו חוזרים אוטומטית לקבוע.</p>`;
  weeks().forEach((ws,i)=>{const k=ymd(ws),o=S.weeks[k]||{},e=new Date(ws);e.setDate(ws.getDate()+6);
    const ch=o.day!==undefined&&o.day!=="";
    h+=`<div class="card wk ${ch?"changed":""}" data-wk="${k}"><b>${i===0?"השבוע":i===1?"שבוע הבא":"שבוע"} · ${ws.getDate()}.${ws.getMonth()+1}–${e.getDate()}.${e.getMonth()+1}</b>
      <label>מתי פותחים</label><select class="wDay"><option value="">כרגיל (יום ${DAYS[S.day]})</option>${dayOpts(o.day)}<option value="closed" ${o.day==="closed"?"selected":""}>סגור השבוע</option></select>
      <div class="row"><div><label>משעה</label><input class="wFrom" type="time" value="${o.from||""}" placeholder="${S.from}"></div><div><label>עד שעה</label><input class="wTo" type="time" value="${o.to||""}" placeholder="${S.to}"></div></div>
      <p class="muted">שעות ריקות = השעות הקבועות</p></div>`});
  B().innerHTML=h;
  B().onchange=e=>{const c=e.target.closest(".wk");if(c)c.classList.toggle("changed",!!c.querySelector(".wDay").value)};
}
function collectDays(){
  if(!$("#dDay"))return;const S=W.schedule;
  S.day=+$("#dDay").value;S.from=$("#dFrom").value||"18:30";S.to=$("#dTo").value||"23:00";
  const keep={},first=ymd(weeks()[0]);
  Object.entries(S.weeks||{}).forEach(([k,v])=>{if(k>=first)keep[k]=v});
  B().querySelectorAll(".wk").forEach(c=>{const k=c.dataset.wk,d=c.querySelector(".wDay").value,f=c.querySelector(".wFrom").value,t=c.querySelector(".wTo").value;
    if(d===""&&!f&&!t)delete keep[k];else keep[k]={day:d===""?"":(d==="closed"?"closed":+d),...(f?{from:f}:{}),...(t?{to:t}:{})}});
  S.weeks=keep;
}

/* מחירים */
const PL={kinds:[["single","המבורגר"],["meal","ארוחה"],["couple","ארוחה זוגית"]],
  extras:[["patty","קציצת המבורגר נוספת"],["mush","פטריות"],["egg","ביצת עין"],["onion","בצל מטוגן"]],
  sides:[["fries","צ'יפס"],["rings","טבעות בצל"],["mix","מיקס צ'יפס + טבעות"],["mash","כדורי פירה"],["pastel","פסטל (6 יח')"],["eggroll","אגרול (3 יח')"],["schnitz","שניצלונים"]]};
function prices(){
  const P=W.prices,sec=(t,g)=>`<div class="card"><b>${t}</b>${PL[g].map(([k,n])=>`<div class="pr"><span>${n}</span><input type="number" inputmode="numeric" min="0" data-g="${g}" data-k="${k}" value="${P[g][k]}" aria-label="מחיר ${n}"></div>`).join("")}</div>`;
  B().innerHTML=sec("מנות","kinds")+`<div class="card"><b>שתייה</b><div class="pr"><span>כל משקה</span><input type="number" inputmode="numeric" min="0" id="pDrink" value="${P.drink}" aria-label="מחיר שתייה"></div></div>`+sec("תוספות לבורגר","extras")+sec("תוספות בצד","sides")+`<p class="muted" style="margin-top:10px">כל המחירים בשקלים</p>`;
}
function collectPrices(){if(!$("#pDrink"))return;B().querySelectorAll("[data-g]").forEach(i=>{const v=parseInt(i.value,10);if(!isNaN(v)&&v>=0)W.prices[i.dataset.g][i.dataset.k]=v});const d=parseInt($("#pDrink").value,10);if(!isNaN(d))W.prices.drink=d}

/* שתייה */
function imgOf(d){return pendingImgs[d.id]||drinkImg(d)}
function drinks(){
  B().innerHTML=`<p class="muted">לוחצים על התמונה כדי להחליף. "במלאי" כבוי = מופיע באתר כ"אזל".</p>`+W.drinks.map((d,i)=>`
   <div class="card drk" data-i="${i}"><img src="${esc(imgOf(d))}" alt="תמונת ${esc(d.name)} – לחצו להחלפה" role="button" tabindex="0" class="dImg">
   <div><label style="margin-top:0">שם</label><input class="dName" value="${esc(d.name)}"><div class="muted">${pendingImgs[d.id]?"⏳ תמונה חדשה – עוד לא נשמרה":d.img?"✓ תמונה שמורה":"בלי תמונה (בקבוק מצויר)"}</div></div>
   <div class="acts"><label class="tog"><input type="checkbox" class="dOn" ${d.on?"checked":""}>במלאי</label>
   <button class="b b-line dPic" type="button">תמונה</button>${d.img||pendingImgs[d.id]?`<button class="b b-line dNoPic" type="button">בלי תמונה</button>`:""}<button class="b b-red dDel" type="button">מחיקה</button></div></div>`).join("")
   +`<button class="b b-line" id="dAdd" style="width:100%;margin-top:12px">+ הוספת משקה</button><input type="file" accept="image/*" id="dFile" hidden>`;
  let target=null;
  B().onclick=e=>{const c=e.target.closest(".drk");
    if(e.target.id==="dAdd"){collectDrinks();W.drinks.push({id:"d"+Date.now().toString(36),name:"משקה חדש",img:"",on:true});drinks();const n=B().querySelectorAll(".dName");n[n.length-1].select();return}
    if(!c)return;const i=+c.dataset.i;
    if(e.target.closest(".dImg,.dPic")){collectDrinks();target=i;$("#dFile").click()}
    if(e.target.closest(".dNoPic")){collectDrinks();W.drinks[i].img="";delete pendingImgs[W.drinks[i].id];drinks()}
    if(e.target.closest(".dDel")){collectDrinks();if(confirmDel(W.drinks[i].name)){W.drinks.splice(i,1);drinks()}}};
  B().onkeydown=e=>{if(e.key==="Enter"&&e.target.classList.contains("dImg"))e.target.click()};
  $("#dFile").onchange=async e=>{const f=e.target.files[0];if(!f||target===null)return;pendingImgs[W.drinks[target].id]=await shrink(f);e.target.value="";drinks()};
}
function confirmDel(n){return window.confirm(`למחוק את "${n}"? (אם רק אזל – עדיף לכבות "במלאי")`)}
function collectDrinks(){B().querySelectorAll(".drk").forEach(c=>{const d=W.drinks[+c.dataset.i];if(!d)return;d.name=c.querySelector(".dName").value.trim()||d.name;d.on=c.querySelector(".dOn").checked})}
function shrink(file){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const m=400,s=Math.min(1,m/Math.max(img.width,img.height));
  const cv=document.createElement("canvas");cv.width=Math.round(img.width*s);cv.height=Math.round(img.height*s);
  const x=cv.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,cv.width,cv.height);x.drawImage(img,0,0,cv.width,cv.height);res(cv.toDataURL("image/jpeg",.84))};
  img.onerror=rej;img.src=URL.createObjectURL(file)})}

/* הגדרות */
/* הגדרות */
function more(){
  B().innerHTML=`<div class="card"><label for="mSauce" style="margin-top:0">כמה רטבים בצד מותר למנה</label><input id="mSauce" type="number" min="1" max="10" value="${W.sauceMax}"></div>
  <div class="card"><b>החלפת סיסמת מנהל</b>
   <label for="np1">סיסמה חדשה</label><input id="np1" type="password" autocomplete="new-password" minlength="8">
   <label for="np2">שוב את הסיסמה</label><input id="np2" type="password" autocomplete="new-password">
   <button class="b b-line" id="mPw" style="margin-top:10px">החלפה</button><div class="msg" id="pwMsg"></div></div>
  <div class="card"><button class="b b-line" id="mOut">יציאה מהניהול</button></div>`;
  $("#mPw").onclick=async()=>{const p1=$("#np1").value,p2=$("#np2").value,m=$("#pwMsg");
    if(p1.length<8){m.textContent="סיסמה של 8 תווים לפחות";m.className="msg err";return}
    if(p1!==p2){m.textContent="הסיסמאות לא זהות";m.className="msg err";return}
    try{const {auth,A}=await fb();await A.updatePassword(auth.currentUser,p1);m.textContent="הסיסמה הוחלפה ✓";m.className="msg ok";$("#np1").value=$("#np2").value=""}
    catch(e){m.textContent=/recent-login/.test(e.code||"")?"צריך לצאת ולהיכנס שוב, ואז להחליף":"תקלה: "+(e.code||e.message);m.className="msg err"}};
  $("#mOut").onclick=async()=>{const {auth,A}=await fb();await A.signOut(auth);close()};
}
function collectMore(){const m=$("#mSauce");if(m){const v=parseInt(m.value,10);if(v>0)W.sauceMax=v}}
function collect(){collectDays();collectPrices();collectDrinks();collectMore()}

/* ---------- שמירה ---------- */
function pack(w){return {prices:w.prices,schedule:w.schedule,sauceMax:w.sauceMax,drinks:w.drinks.map(({id,name,img,on})=>({id,name,img:img||"",on:!!on})),updated:new Date().toISOString()}}
async function saveAll(){
  collect();const btn=$("#aSave");btn.disabled=true;
  try{
    const {db,F}=await fb();
    const ids=Object.keys(pendingImgs);let n=0;
    for(const id of ids){msg(`מעלה תמונה ${++n} מתוך ${ids.length}…`);
      const key=id+"-"+Date.now().toString(36);
      await F.setDoc(F.doc(db,"images",key),{data:pendingImgs[id]});
      IMGS[key]=pendingImgs[id];
      const d=W.drinks.find(x=>x.id===id);if(d)d.img="fs:"+key;}
    msg("שומר…");
    const data=pack(W);
    await F.setDoc(F.doc(db,"site","settings"),data);
    msg("בודק מול השרת שהשמירה באמת שם…");
    const chk=await F.getDocFromServer(F.doc(db,"site","settings"));
    if(!chk.exists()||chk.data().updated!==data.updated)throw new Error("השרת לא מראה את השמירה – נסו שוב");
    pendingImgs={};
    msg("נשמר ונבדק ✓ השינוי כבר מופיע אצל הלקוחות","ok");
  }catch(err){msg(/permission/i.test(err.code||err.message)?"אין הרשאה לשמור – צריך להיכנס שוב":"השמירה נכשלה: "+(err.code||err.message),"err")}
  btn.disabled=false;
}
window.BHAdmin={open};
})();
