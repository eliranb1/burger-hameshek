/* =========================================================
   בורגר המשק – חלון מנהל
   איך זה עובד:
   - ההגדרות נשמרות בקובץ settings.json במאגר בגיטהאב.
   - כדי לכתוב לגיטהאב צריך "מפתח" (טוקן). המפתח שמור באתר רק כשהוא
     מוצפן בסיסמת המנהל (קובץ admin-lock.json). בלי הסיסמה אי אפשר לפתוח אותו.
   ========================================================= */
(function(){
const REPO="eliranb1/burger-hameshek", API="https://api.github.com/repos/"+REPO;
const DAYS=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const $=s=>document.querySelector(s);
let token=null, W=null, pendingImgs={}, tab="days";

/* ---------- סגנון ---------- */
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
.adm .tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:8px 10px;background:#efe3cd;border-bottom:1px solid #d9c7a8}
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

/* ---------- הצפנה (סיסמה ← מפתח) ---------- */
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function keyFrom(pw,salt){const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
async function lock(tok,pw){if(!(window.crypto&&crypto.subtle))throw new Error("הדפדפן לא תומך בהצפנה – נסו בכרום");const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},await keyFrom(pw,salt),new TextEncoder().encode(tok));
  return {v:1,salt:b64(salt),iv:b64(iv),ct:b64(ct)}}
async function unlock(L,pw){const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(L.iv)},await keyFrom(pw,unb64(L.salt)),unb64(L.ct));return new TextDecoder().decode(pt)}

/* ---------- גיטהאב ---------- */
function tf(url,opt={},ms=20000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
  return fetch(url,{...opt,signal:c.signal}).catch(e=>{throw new Error(e.name==="AbortError"?"אין תשובה מגיטהאב (בדקו אינטרנט ונסו שוב)":"תקלת רשת: "+e.message)}).finally(()=>clearTimeout(t))}
const H=()=>({Authorization:"Bearer "+token,Accept:"application/vnd.github+json"});
async function getRaw(path){const r=await tf(`${API}/contents/${path}?ref=main&t=${Date.now()}`,{headers:{Accept:"application/vnd.github.raw+json"},cache:"no-store"});return r.ok?r.json():null}
async function shaOf(path){const r=await tf(`${API}/contents/${path}?ref=main&t=${Date.now()}`,{headers:H(),cache:"no-store"});if(r.status===404)return null;if(!r.ok)throw new Error("קריאה מגיטהאב נכשלה (קוד "+r.status+")");return (await r.json()).sha}
async function put(path,b64content,message){
  const sha=await shaOf(path);const body={message,content:b64content,branch:"main"};if(sha)body.sha=sha;
  const r=await tf(`${API}/contents/${path}`,{method:"PUT",headers:H(),body:JSON.stringify(body)});
  if(r.status===401||r.status===403){let d="";try{d=(await r.json()).message||""}catch(_){}
    throw new Error(r.status===403?"גיטהאב סירב: למפתח אין הרשאת כתיבה למאגר ("+d+"). צריך במפתח: Repository access ← burger-hameshek, ו-Contents ← Read and write":"גיטהאב לא מכיר את המפתח ("+d+") – צריך מפתח חדש (לשונית 'הגדרות')")}
  if(!r.ok){let d="";try{d=(await r.json()).message||""}catch(_){}throw new Error("השמירה נכשלה (קוד "+r.status+") "+d)}
  let j=null;try{j=await r.json()}catch(_){}
  if(!j||!j.commit||!j.commit.sha||!j.content||!j.content.sha)throw new Error(BLOCKED);
  return j;
}
const BLOCKED="השמירה לא הגיעה לגיטהאב. משהו בדרך (כנראה מסנן אינטרנט בטלפון) חסם אותה. כלום לא נשמר.";
/* בדיקה עצמאית: קוראים מגיטהאב את הקובץ ומוודאים שזו הגרסה ששמרנו */
async function verify(path,blobSha){
  for(let i=0;i<4;i++){
    const r=await tf(`${API}/contents/${path}?ref=main&t=${Date.now()}`,{headers:H(),cache:"no-store"});
    if(r.ok){let j=null;try{j=await r.json()}catch(_){}if(j&&j.sha===blobSha)return true}
    await new Promise(z=>setTimeout(z,1500));
  }
  throw new Error("גיטהאב לא מראה את הקובץ ששמרנו – "+BLOCKED);
}
const jsonB64=o=>{const bytes=new TextEncoder().encode(JSON.stringify(o,null,2));let s="";bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s)};
async function testToken(tok){const r=await tf(API,{headers:{Authorization:"Bearer "+tok,Accept:"application/vnd.github+json"}});if(!r.ok)return false;const j=await r.json();return !j.permissions||j.permissions.push}

/* ---------- כניסה ---------- */
async function open(){
  pan.hidden=false;scrim.hidden=false;T().innerHTML="";F().innerHTML="";
  if(token){main();return}
  try{const t=sessionStorage.getItem("bh-tok");if(t){token=t;main();return}}catch(e){}
  B().innerHTML=`<p class="muted">טוען…</p>`;
  const L=await getRaw("admin-lock.json").catch(()=>null);
  L?login(L):setup();
}
function login(L){
  B().innerHTML=`<form id="lf"><label for="apw">סיסמת מנהל</label><input id="apw" type="password" autocomplete="current-password" required><div class="msg"></div></form>`;
  F().innerHTML=`<button class="b b-main" form="lf">כניסה</button>`;
  setTimeout(()=>$("#apw").focus(),50);
  $("#lf").onsubmit=async e=>{e.preventDefault();msg("בודק…");
    try{token=await unlock(L,$("#apw").value);try{sessionStorage.setItem("bh-tok",token)}catch(_){}main()}
    catch(_){msg("סיסמה שגויה","err");$("#apw").select()}};
}
function setup(changing){
  B().innerHTML=`<h2>${changing?"החלפת מפתח או סיסמה":"הגדרה ראשונה"}</h2>
  <p class="muted" style="margin-top:6px">עושים את זה פעם אחת. צריך מפתח מגיטהאב שמרשה לאתר לשמור שינויים:</p>
  <ol class="steps"><li>נכנסים ל-github.com/settings/personal-access-tokens/new</li><li>שם: burger-admin · תוקף: הארוך ביותר</li><li>Repository access → Only select → burger-hameshek</li><li>Permissions → Contents → Read and write</li><li>Generate → מעתיקים את המפתח לכאן</li></ol>
  <form id="sf"><label for="atok">מפתח גיטהאב</label><input id="atok" dir="ltr" autocomplete="off" required>
  <label for="ap1">סיסמת מנהל חדשה</label><input id="ap1" type="password" autocomplete="new-password" minlength="8" required>
  <label for="ap2">שוב את הסיסמה</label><input id="ap2" type="password" autocomplete="new-password" required><div class="msg"></div></form>`;
  F().innerHTML=`<button class="b b-main" form="sf">שמירה</button>`;
  if(changing&&token)$("#atok").value=token;
  $("#sf").onsubmit=async e=>{e.preventDefault();
    const tok=$("#atok").value.trim(),p1=$("#ap1").value,p2=$("#ap2").value;
    if(p1.length<8)return msg("סיסמה של 8 תווים לפחות","err");
    if(p1!==p2)return msg("הסיסמאות לא זהות","err");
    msg("בודק את המפתח…");const btn=pan.querySelector("[form=sf]");btn.disabled=true;setTimeout(()=>btn.disabled=false,25000);
    const okTok=await testToken(tok).catch(e=>{msg(e.message,"err");return null});if(okTok===null)return;if(!okTok)return msg("המפתח לא עובד – בדקו שבחרתם את המאגר ו-Contents: Read and write","err");
    token=tok;
    try{msg("שלב 1 מתוך 2: מצפין את המפתח…");const L=await lock(tok,p1);
      msg("שלב 2 מתוך 2: שומר בגיטהאב…");const jl=await put("admin-lock.json",jsonB64(L),"admin: set password");await verify("admin-lock.json",jl.content.sha);try{sessionStorage.setItem("bh-tok",token)}catch(_){}
      msg("נשמר","ok");setTimeout(main,600)}catch(err){msg(err.message,"err")}};
}

/* ---------- מסך ניהול ---------- */
function main(){
  W=structuredClone(CFG);pendingImgs={};
  T().innerHTML=`<div class="tabs" role="tablist">${[["days","ימי פתיחה"],["prices","מחירים"],["drinks","שתייה"],["more","הגדרות"]].map(([k,n])=>`<button role="tab" data-tab="${k}" aria-selected="${k===tab}">${n}</button>`).join("")}</div>`;
  T().onclick=e=>{const b=e.target.closest("[data-tab]");if(!b)return;collect();tab=b.dataset.tab;main2()};
  F().innerHTML=`<button class="b b-main" id="aSave">שמירה ופרסום באתר</button><div class="msg"></div>`;
  $("#aSave").onclick=saveAll;main2();
}
function main2(){T().querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===tab));({days,prices,drinks,more})[tab]()}

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
function imgOf(d){return pendingImgs[d.id]||(d.img?d.img:bottle(d))}
function drinks(){
  B().innerHTML=`<p class="muted">לוחצים על התמונה כדי להחליף. "במלאי" כבוי = מופיע באתר כ"אזל".</p>`+W.drinks.map((d,i)=>`
   <div class="card drk" data-i="${i}"><img src="${esc(imgOf(d))}" alt="תמונת ${esc(d.name)} – לחצו להחלפה" role="button" tabindex="0" class="dImg">
   <div><label style="margin-top:0">שם</label><input class="dName" value="${esc(d.name)}"><div class="muted">${pendingImgs[d.id]?"⏳ תמונה חדשה – עוד לא נשמרה":d.img?"✓ תמונה שמורה באתר":"בלי תמונה (בקבוק מצויר)"}</div></div>
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
function more(){
  B().innerHTML=`<div class="card"><label for="mSauce" style="margin-top:0">כמה רטבים בצד מותר למנה</label><input id="mSauce" type="number" min="1" max="10" value="${W.sauceMax}"></div>
  <div class="card"><b>סיסמה ומפתח</b><p class="muted">החלפת סיסמת המנהל, או הכנסת מפתח גיטהאב חדש כשהישן פג.</p><button class="b b-line" id="mPw" style="margin-top:8px">החלפת סיסמה / מפתח</button></div>
  <div class="card"><b>בדיקת חיבור לגיטהאב</b><p class="muted">בודק צעד-צעד אם אפשר לשמור, ומראה מה גיטהאב עונה.</p><button class="b b-line" id="mDiag" style="margin-top:8px">הרצת בדיקה</button><pre id="diag" style="white-space:pre-wrap;font-size:14px;margin-top:8px;direction:rtl"></pre></div>
  <div class="card"><button class="b b-line" id="mOut">יציאה מהניהול</button></div>`;
  $("#mDiag").onclick=diag;
  $("#mPw").onclick=()=>{T().innerHTML="";F().innerHTML="";setup(true)};
  $("#mOut").onclick=()=>{token=null;try{sessionStorage.removeItem("bh-tok")}catch(_){}close()};
}
async function diag(){
  const out=$("#diag"),line=t=>{out.textContent+=t+"\n"};out.textContent="";
  const step=async(name,fn)=>{const t0=Date.now();line("⏳ "+name+"…");
    try{const r=await fn();let body="";try{body=(await r.clone().json()).message||""}catch(_){}
      line(`${r.ok?"✓":"✗"} ${name}: קוד ${r.status}${body?" – "+body:""} (${((Date.now()-t0)/1000).toFixed(1)} שנ')`);return r}
    catch(e){line(`✗ ${name}: ${e.message} (${((Date.now()-t0)/1000).toFixed(1)} שנ')`);return null}};
  line("מפתח: "+(token?token.slice(0,15)+"…":"אין"));
  await step("1. קריאה בלי מפתח",()=>tf(API));
  await step("2. קריאה עם המפתח",()=>tf(API,{headers:H()}));
  const p="diag-test.txt";
  const g=await step("3. בדיקת קובץ בדיקה",()=>tf(`${API}/contents/${p}?ref=main&t=${Date.now()}`,{headers:H(),cache:"no-store"}));
  let sha=null;try{if(g&&g.ok)sha=(await g.json()).sha}catch(_){}
  const body={message:"admin: connection test",content:btoa(new Date().toISOString()),branch:"main"};if(sha)body.sha=sha;
  const w=await step("4. כתיבה לגיטהאב",()=>tf(`${API}/contents/${p}`,{method:"PUT",headers:H(),body:JSON.stringify(body)}));
  if(w&&w.ok){let j=null;try{j=await w.json()}catch(_){}line(j&&j.commit?"✓ גיטהאב אישר שמירה "+j.commit.sha.slice(0,7)+" – הכתיבה עובדת!":"✗ התשובה לא מגיטהאב – משהו בדרך חוסם")}
}
function collectMore(){const m=$("#mSauce");if(m){const v=parseInt(m.value,10);if(v>0)W.sauceMax=v}}
function collect(){collectDays();collectPrices();collectDrinks();collectMore()}

/* ---------- שמירה ---------- */
async function saveAll(){
  collect();const btn=$("#aSave");btn.disabled=true;
  try{
    const ids=Object.keys(pendingImgs);let n=0;
    for(const id of ids){msg(`מעלה תמונה ${++n} מתוך ${ids.length}…`);
      const path=`img/drinks/${id}-${Date.now().toString(36)}.jpg`;
      const ji=await put(path,pendingImgs[id].split(",")[1],"admin: drink image");
      msg(`בודק שתמונה ${n} באמת נשמרה…`);await verify(path,ji.content.sha);
      const d=W.drinks.find(x=>x.id===id);if(d)d.img=path;}
    msg("שומר הגדרות…");
    const js=await put("settings.json",jsonB64({prices:W.prices,schedule:W.schedule,sauceMax:W.sauceMax,drinks:W.drinks,updated:new Date().toISOString()}),"admin: update settings");
    msg("בודק מול גיטהאב שהשמירה באמת שם…");await verify("settings.json",js.content.sha);
    var proof=js.commit.sha.slice(0,7);
    // תמונות חדשות זמינות באתר אחרי דקה – בינתיים מציגים את מה שהועלה
    Object.entries(pendingImgs).forEach(([id,u])=>{const d=W.drinks.find(x=>x.id===id);if(d)d._preview=u});
    pendingImgs={};
    CFG=structuredClone(W);CFG.drinks.forEach(d=>{if(d._preview){d.img=d._preview}});W.drinks.forEach(d=>delete d._preview);
    renderAll();msg(`נשמר ונבדק ✓ גיטהאב אישר (מספר שמירה ${proof}). הלקוחות יראו תוך דקה-שתיים.`,"ok");
  }catch(err){msg(err.message,"err")}
  btn.disabled=false;
}
window.BHAdmin={open};
})();
