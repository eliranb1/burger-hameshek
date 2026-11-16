/* =========================================================
   בורגר המשק – מסך שליח
   כניסה: טלפון + סיסמה שהמנהל קבע (Firebase Auth).
   השליח רואה משלוחים של היום, לוחץ "אספתי" (רק כשמוכן, אלא אם המנהל
   איפשר לפני) ו"נמסר". הראשון שלוחץ "אספתי" לוקח – אי אפשר לאסוף שוב.
   ========================================================= */
(function(){
const $=s=>document.querySelector(s);
let FB=null, me=null, unsub=null, LIST=[], tick=null;

const css=`
.cr-scrim{position:fixed;inset:0;background:rgba(10,6,3,.8);z-index:80}
.cr{position:fixed;inset:0;z-index:90;background:#1f140c;color:#fff3dc;display:flex;flex-direction:column;font-family:var(--body)}
.cr[hidden],.cr-scrim[hidden]{display:none!important}
.cr-h{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#2c1d12;border-bottom:1px solid rgba(233,212,173,.18)}
.cr-h h2{font-family:var(--display);font-weight:400;font-size:22px}
.cr-h button{color:#e9d4ad;font-size:15px;font-weight:700;min-height:40px;padding:0 10px}
.cr-b{flex:1;overflow-y:auto;padding:14px 16px 30px;max-width:640px;width:100%;margin:0 auto}
.cr label{display:block;font-weight:700;margin:12px 0 6px}
.cr input{width:100%;min-height:52px;padding:10px 14px;border-radius:10px;background:rgba(0,0,0,.3);border:1.5px solid rgba(233,212,173,.25);color:#fff3dc;font:inherit}
.cr input:focus{border-color:#f2b632;outline:none}
.cr .go{width:100%;min-height:54px;border-radius:12px;background:#f2b632;color:#1f140c;font-weight:800;font-size:18px;margin-top:16px}
.cr .msg{margin-top:10px;font-weight:800;min-height:1.4em}.cr .err{color:#ff9b87}.cr .ok{color:#7fd38c}
.cr h3{font-family:var(--display);font-weight:400;font-size:20px;color:#f2b632;margin:18px 0 8px}
.cr .o{background:#2c1d12;border:1px solid rgba(233,212,173,.18);border-radius:14px;padding:14px;margin-bottom:12px}
.cr .o.ready{border-color:#f2b632;box-shadow:0 0 0 2px rgba(242,182,50,.35)}
.cr .o .top{display:flex;justify-content:space-between;gap:8px;font-weight:800}
.cr .o .tag{font-size:14px;padding:2px 10px;border-radius:99px;background:rgba(233,212,173,.12);white-space:nowrap}
.cr .o .addr{font-size:19px;font-weight:800;margin-top:6px}
.cr .o pre{white-space:pre-wrap;font:inherit;font-size:15px;color:#e9d4ad;margin-top:8px}
.cr .o .acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.cr .o .acts a,.cr .o .acts button{display:flex;align-items:center;justify-content:center;min-height:50px;border-radius:10px;font-weight:800;text-decoration:none;border:2px solid #e9d4ad;color:#fff3dc}
.cr .o .acts .main{grid-column:1/-1;background:#f2b632;border-color:#f2b632;color:#1f140c;font-size:18px}
.cr .o .acts .main:disabled{opacity:.4}
.cr .muted{color:#e9d4ad;font-weight:600;font-size:15px}
`;
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
const scrim=document.createElement("div");scrim.className="cr-scrim";scrim.hidden=true;
const pan=document.createElement("section");pan.className="cr";pan.hidden=true;pan.setAttribute("role","dialog");pan.setAttribute("aria-modal","true");pan.setAttribute("aria-label","מסך שליח");
pan.innerHTML=`<div class="cr-h"><h2>🛵 מסך שליח</h2><div><button id="crOut" hidden>יציאה</button><button id="crX" aria-label="סגירה">סגירה ✕</button></div></div><div class="cr-b" id="crB"></div>`;
document.body.append(scrim,pan);
const B=()=>$("#crB");
$("#crX").onclick=close;
function close(){pan.hidden=true;scrim.hidden=true;if(unsub){unsub();unsub=null}clearInterval(tick)}
const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

async function fb(){
  if(FB)return FB;
  const V="https://www.gstatic.com/firebasejs/11.0.2/";
  const [app,auth,fs]=await Promise.all([import(V+"firebase-app.js"),import(V+"firebase-auth.js"),import(V+"firebase-firestore.js")]);
  const a=app.getApps().length?app.getApp():app.initializeApp(FIREBASE_CONFIG);
  FB={auth:auth.getAuth(a),A:auth,db:fs.getFirestore(a),F:fs};return FB;
}
async function open(){
  pan.hidden=false;scrim.hidden=false;B().innerHTML=`<p class="muted">טוען…</p>`;
  try{const {auth,A,db,F}=await fb();
    await new Promise(r=>{const u=A.onAuthStateChanged(auth,()=>{u();r()})});
    if(auth.currentUser){const d=await F.getDoc(F.doc(db,"couriers",auth.currentUser.uid)).catch(()=>null);
      if(d&&d.exists()){me={uid:auth.currentUser.uid,...d.data()};return list()}}
    login();
  }catch(e){B().innerHTML=`<p class="msg err">תקלה בחיבור: ${esc(e.message)}</p>`}
}
function login(){
  $("#crOut").hidden=true;
  B().innerHTML=`<form id="crF"><p class="muted">נכנסים עם הטלפון והסיסמה שקיבלתם מבורגר המשק.</p>
    <label for="crP">טלפון</label><input id="crP" type="tel" inputmode="tel" autocomplete="username" dir="ltr" style="text-align:right">
    <label for="crW">סיסמה</label><input id="crW" type="password" autocomplete="current-password">
    <button class="go">כניסה</button><div class="msg" id="crM"></div></form>`;
  setTimeout(()=>$("#crP").focus(),50);
  $("#crF").onsubmit=async e=>{e.preventDefault();const m=$("#crM");m.textContent="בודק…";m.className="msg";
    const phone=$("#crP").value.replace(/\D/g,"");
    try{const {auth,A,db,F}=await fb();
      const k=await F.getDoc(F.doc(db,"courierKeys",phone));
      if(!k.exists())throw {code:"no-courier"};
      await A.signInWithEmailAndPassword(auth,k.data().email,$("#crW").value);
      const d=await F.getDoc(F.doc(db,"couriers",auth.currentUser.uid));
      if(!d.exists()){await A.signOut(auth);throw {code:"no-courier"}}
      me={uid:auth.currentUser.uid,...d.data()};list();
    }catch(err){m.className="msg err";m.textContent=err.code==="no-courier"?"הטלפון לא רשום כשליח – לפנות למנהל":/invalid|wrong|credential/.test(err.code||"")?"סיסמה שגויה":/too-many/.test(err.code||"")?"יותר מדי ניסיונות – לחכות כמה דקות":"תקלה: "+(err.code||err.message)}};
}
async function list(){
  $("#crOut").hidden=false;
  $("#crOut").onclick=async()=>{const {auth,A}=await fb();await A.signOut(auth);me=null;if(unsub){unsub();unsub=null}login()};
  B().innerHTML=`<p class="muted">שלום ${esc(me.name)} 👋 טוען משלוחים…</p>`;
  const {db,F}=await fb();
  if(unsub)unsub();
  const q=F.query(F.collection(db,"orders"),F.where("status","in",["accepted","ready","pickup_pending","out"]));
  unsub=F.onSnapshot(q,sn=>{LIST=sn.docs.map(d=>({id:d.id,...d.data()})).filter(o=>o.how==="משלוח");render()},
    e=>{B().innerHTML=`<p class="msg err">אין הרשאה לראות משלוחים (${esc(e.code||"")}) – לפנות למנהל</p>`});
  clearInterval(tick);tick=setInterval(render,30000);
}
function render(){
  if(!me)return;
  const ops=(typeof CFG!=="undefined"&&CFG.ops)||{},early=!!ops.earlyPickup;
  const mine=LIST.filter(o=>o.courierUid===me.uid&&(o.status==="out"||o.status==="pickup_pending"));
  const avail=LIST.filter(o=>!o.courierUid&&(o.status==="ready"||o.status==="accepted"))
    .sort((a,b)=>(a.status==="ready"?0:1)-(b.status==="ready"?0:1)||(a.readyAt?a.readyAt.toMillis():9e15)-(b.readyAt?b.readyAt.toMillis():9e15));
  const left=o=>o.readyAt?Math.max(0,Math.ceil((o.readyAt.toMillis()-Date.now())/60000)):null;
  const card=(o,kind)=>{
    const addr=`${o.addr||""}, ${o.town||""}`,canPick=o.status==="ready"||early;
    let tag=o.status==="ready"?"✅ מוכנה":o.status==="accepted"?`🔥 בהכנה${left(o)!==null?` · עוד ${left(o)} דק'`:""}`:o.status==="pickup_pending"?"⏳ מחכה לאישור מנהל":"🛵 אצלך";
    let main="";
    if(kind==="avail")main=`<button class="main" data-pick="${o.id}" ${canPick?"":"disabled"}>${canPick?"אספתי 🛵":"אפשר לאסוף רק כשמוכנה"}</button>`;
    if(kind==="mine"&&o.status==="out")main=`<button class="main" data-done="${o.id}">נמסר ✓</button>`;
    return `<div class="o ${o.status==="ready"?"ready":""}"><div class="top"><span>#${o.id.slice(0,5).toUpperCase()} · ${esc(o.name)}</span><span class="tag">${tag}</span></div>
      <div class="addr">📍 ${esc(addr)}</div>
      <div class="muted">⏰ ${o.slot&&o.slot!=="ASAP"?esc(o.slot):"כמה שיותר מוקדם"} · לגבות: <b>${o.total} ₪</b> (${esc(o.pay)})${o.notes?`<br>הערות: ${esc(o.notes)}`:""}</div>
      <pre>${esc((o.lines||[]).join("\n"))}</pre>
      <div class="acts"><a href="tel:${esc(o.phone)}">📞 ללקוח</a><a href="https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes" target="_blank" rel="noopener">🧭 ניווט</a>${main}</div></div>`};
  B().innerHTML=`<p class="muted">שלום ${esc(me.name)} 👋</p>
    <h3>אצלי (${mine.length})</h3>${mine.map(o=>card(o,"mine")).join("")||`<p class="muted">אין משלוחים אצלך כרגע.</p>`}
    <h3>לאיסוף (${avail.length})</h3>${avail.map(o=>card(o,"avail")).join("")||`<p class="muted">אין כרגע משלוחים לאיסוף. המסך מתעדכן לבד.</p>`}
    <div class="msg" id="crMsg"></div>`;
}
pan.addEventListener("click",async e=>{
  const p=e.target.closest("[data-pick]"),d=e.target.closest("[data-done]");if(!p&&!d)return;
  const {db,F}=await fb(),m=$("#crMsg"),btn=p||d;btn.disabled=true;
  try{
    if(p){const ref=F.doc(db,"orders",p.dataset.pick),approve=!!((typeof CFG!=="undefined"&&CFG.ops)||{}).approvePickup;
      // טרנזקציה: אם מישהו אחר כבר אסף – נכשל ולא דורס
      await F.runTransaction(db,async t=>{const cur=await t.get(ref);const o=cur.data();
        if(!o||o.courierUid)throw {code:"taken"};
        t.update(ref,{status:approve?"pickup_pending":"out",courierUid:me.uid,courierName:me.name,courierPhone:me.phone,pickedAt:F.serverTimestamp()})});
    }else{await F.updateDoc(F.doc(db,"orders",d.dataset.done),{status:"done",deliveredAt:F.serverTimestamp()})}
  }catch(err){btn.disabled=false;if(m){m.className="msg err";m.textContent=err.code==="taken"?"שליח אחר כבר אסף את ההזמנה הזו":/permission/.test(err.code||"")?"אי אפשר – ההזמנה עוד לא מוכנה או שכבר נאספה":"תקלה: "+(err.code||err.message)}}
});
window.BHCourier={open};
})();
