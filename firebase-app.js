// ============================================================
//  JYSKE BANK — Firebase Realtime Database Edition
// ============================================================
import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, push, onValue, update, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── FIREBASE CONFIG ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBMf5Re76TUfpAQVh4kYIeSxnnTGxqMk6w",
  authDomain:        "astra-bank-15150.firebaseapp.com",
  databaseURL:       "https://astra-bank-15150-default-rtdb.firebaseio.com",
  projectId:         "astra-bank-15150",
  storageBucket:     "astra-bank-15150.firebasestorage.app",
  messagingSenderId: "880160537415",
  appId:             "1:880160537415:web:616e8d614f9685a64a2a62",
};

// ── CREDENTIALS ──────────────────────────────────────────────
const USERS = {
  admin:      { password: "Admin@2024",  role: "admin" },
  wesleynuno: { password: "Wesley@2024", role: "user"  },
  // Add more users: johndoe: { password: "Pass123", role: "user" },
};

const INITIAL_BAL = 47355.60;

// ── STATE ────────────────────────────────────────────────────
let app, db;
let currentUser     = null;
let isDemoMode      = false;
let currentWireType = "";
let allTxsCache     = []; // single source of truth for transactions
let allWiresCache   = []; // single source of truth for wires

// ★ ONE set of listeners — never duplicated
const L = {}; // listeners store

// Demo state
const D = {
  balance: INITIAL_BAL,
  txs:     defaultTxs(),
  logs:    [],
  wires:   [],
  status:  "active",
};

const $ = id => document.getElementById(id);

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(localStorage.getItem("jyske_theme") || "light");
  setCardDates();
  prefillDatetimes();
  if (firebaseConfig.apiKey.startsWith("PASTE")) {
    isDemoMode = true; hideLoader(); showPage("login"); return;
  }
  try {
    app = initializeApp(firebaseConfig);
    db  = getDatabase(app);
    await seed();
    hideLoader(); showPage("login");
  } catch(e) { console.error(e); isDemoMode = true; hideLoader(); showPage("login"); }
});

// ── SEED ─────────────────────────────────────────────────────
async function seed() {
  const b = await get(ref(db,"account/balance"));
  if (!b.exists()) await set(ref(db,"account/balance"), INITIAL_BAL);
  const s = await get(ref(db,"account/status"));
  if (!s.exists()) await set(ref(db,"account/status"),"active");
  const t = await get(ref(db,"transactions"));
  if (!t.exists()) for (const tx of defaultTxs()) await push(ref(db,"transactions"), tx);
}

function defaultTxs() {
  return [
    { name:"Wesley Nuno",  desc:"Contract Payment",     amount: 15000.00, type:"cr", icon:"👤", date:"24/02/2026", time:"4:05 PM",  ts:new Date("2026-02-24T16:05:00").getTime() },
    { name:"AT&T Mobile",  desc:"Internet / Phone Bill", amount:  -689.99, type:"dr", icon:"📱", date:"02/12/2025", time:"10:37 AM", ts:new Date("2025-12-02T10:37:00").getTime() },
    { name:"Wesley Nuno",  desc:"Contract Payment",     amount: 16500.00, type:"cr", icon:"👤", date:"28/11/2025", time:"12:46 PM", ts:new Date("2025-11-28T12:46:00").getTime() },
    { name:"Amazon.com",   desc:"Online Purchase",      amount:   -234.50, type:"dr", icon:"🛒", date:"15/11/2025", time:"3:22 PM",  ts:new Date("2025-11-15T15:22:00").getTime() },
    { name:"Payroll Inc.", desc:"Payroll / Salary",     amount:  8200.00, type:"cr", icon:"🏦", date:"01/11/2025", time:"9:00 AM",  ts:new Date("2025-11-01T09:00:00").getTime() },
    { name:"Netflix",      desc:"Subscription Fee",     amount:    -15.99, type:"dr", icon:"🎬", date:"01/10/2025", time:"8:00 AM",  ts:new Date("2025-10-01T08:00:00").getTime() },
    { name:"Wesley Nuno",  desc:"Wire Transfer",        amount: 22000.00, type:"cr", icon:"🏧", date:"15/09/2025", time:"2:10 PM",  ts:new Date("2025-09-15T14:10:00").getTime() },
    { name:"Landlord",     desc:"Rent / Mortgage",      amount:  -1800.00, type:"dr", icon:"🏠", date:"01/09/2025", time:"9:00 AM",  ts:new Date("2025-09-01T09:00:00").getTime() },
    { name:"Payroll Inc.", desc:"Payroll / Salary",     amount:  8200.00, type:"cr", icon:"🏦", date:"01/09/2025", time:"9:01 AM",  ts:new Date("2025-09-01T09:01:00").getTime() },
    { name:"Uber",         desc:"Transport / Fuel",     amount:    -42.50, type:"dr", icon:"🚗", date:"20/08/2025", time:"6:30 PM",  ts:new Date("2025-08-20T18:30:00").getTime() },
  ];
}

// ── DETACH ───────────────────────────────────────────────────
function detach() { Object.values(L).forEach(u=>{if(typeof u==="function")u();}); Object.keys(L).forEach(k=>delete L[k]); }

// ── AUTH ─────────────────────────────────────────────────────
window.doLogin = async function() {
  const user=$("loginUser").value.trim().toLowerCase(), pass=$("loginPass").value, err=$("loginError");
  err.classList.add("hidden");
  if (!user||!pass){showAlert(err,"Enter username and password.","error");return;}
  const cred=USERS[user];
  if (!cred||cred.password!==pass){showAlert(err,"Incorrect username or password.","error");await log("fail",user,"Failed login attempt");return;}
  currentUser={username:user,role:cred.role};
  await log("in",user,"Logged in successfully");
  $("loginUser").value=""; $("loginPass").value="";
  if (cred.role==="admin"){mountAdmin();showPage("admin");}
  else{mountUser();showPage("user");}
};

window.doLogout = async function() {
  if (currentUser) await log("out",currentUser.username,"Logged out");
  detach(); currentUser=null; showPage("login");
};

document.addEventListener("keydown",e=>{if(e.key==="Enter"&&$("loginPage").classList.contains("active"))doLogin();});

// ── MOUNT USER ───────────────────────────────────────────────
function mountUser() {
  $("userChip").textContent=currentUser.username.toUpperCase();
  if (isDemoMode) {
    applyStatus(D.status,"user"); updateBal("userBalance",D.balance);
    allTxsCache=[...D.txs]; renderTx("userTxList",sorted(allTxsCache));
    allWiresCache=[...D.wires]; renderUserWires(allWiresCache);
    return;
  }
  // ★ FIX: each listener stored and replaced — never duplicated
  if (L.status)  { L.status();  delete L.status; }
  if (L.balance) { L.balance(); delete L.balance; }
  if (L.txs)     { L.txs();     delete L.txs; }
  if (L.wires)   { L.wires();   delete L.wires; }

  L.status  = onValue(ref(db,"account/status"),  s=>applyStatus(s.exists()?s.val():"active","user"));
  L.balance = onValue(ref(db,"account/balance"), s=>updateBal("userBalance",s.exists()?s.val():0));
  L.txs     = onValue(ref(db,"transactions"), s=>{
    allTxsCache=[];
    s.forEach(c=>allTxsCache.push({id:c.key,...c.val()}));
    // ★ render ONE list only
    renderTx("userTxList",sorted(allTxsCache));
  });
  L.wires   = onValue(ref(db,"wires"), s=>{
    allWiresCache=[];
    s.forEach(c=>allWiresCache.push({id:c.key,...c.val()}));
    allWiresCache.sort((a,b)=>(b.ts||0)-(a.ts||0));
    renderUserWires(allWiresCache);
  });
}

// ── MOUNT ADMIN ──────────────────────────────────────────────
function mountAdmin() {
  if (isDemoMode) {
    applyStatus(D.status,"admin"); updateBal("adminBalance",D.balance);
    allTxsCache=[...D.txs];
    const s=sorted(allTxsCache);
    // ★ render adminTxList and editList from SAME data, ONE call each
    renderTx("adminTxList",s);
    renderEditList(s);
    allWiresCache=[...D.wires];
    renderAdminWires(allWiresCache);
    renderLogs(D.logs.slice().reverse());
    return;
  }
  if (L.status)  { L.status();  delete L.status; }
  if (L.balance) { L.balance(); delete L.balance; }
  if (L.txs)     { L.txs();     delete L.txs; }
  if (L.wires)   { L.wires();   delete L.wires; }
  if (L.logs)    { L.logs();    delete L.logs; }

  L.status  = onValue(ref(db,"account/status"),  s=>applyStatus(s.exists()?s.val():"active","admin"));
  L.balance = onValue(ref(db,"account/balance"), s=>updateBal("adminBalance",s.exists()?s.val():0));

  // ★ ONE listener for transactions — updates adminTxList AND editList together
  L.txs = onValue(ref(db,"transactions"), s=>{
    allTxsCache=[];
    s.forEach(c=>allTxsCache.push({id:c.key,...c.val()}));
    const sorted_a=sorted(allTxsCache);
    renderTx("adminTxList", sorted_a);    // ← only ONE list
    renderEditList(sorted_a);             // ← separate edit list
  });

  // ★ ONE listener for wires
  L.wires = onValue(ref(db,"wires"), s=>{
    allWiresCache=[];
    s.forEach(c=>allWiresCache.push({id:c.key,...c.val()}));
    allWiresCache.sort((a,b)=>(b.ts||0)-(a.ts||0));
    renderAdminWires(allWiresCache);
  });

  L.logs = onValue(ref(db,"logs"), s=>{
    const a=[]; s.forEach(c=>a.push({id:c.key,...c.val()}));
    a.sort((x,y)=>(y.ts||0)-(x.ts||0));
    renderLogs(a.slice(0,100));
  });
}

// ── FREEZE / UNFREEZE ─────────────────────────────────────────
function applyStatus(status,view) {
  const frozen=status==="frozen";
  if (view==="user") {
    $("frozenBanner")?.classList.toggle("hidden",!frozen);
    $("userBankCard")?.classList.toggle("card-frozen",frozen);
    const btn=$("transferBtn"); if(btn){btn.disabled=frozen;btn.style.opacity=frozen?"0.4":"";}
  }
  if (view==="admin") {
    const lbl=$("accountStatusLabel"); if(lbl){lbl.textContent=frozen?"🔒 Frozen":"✅ Active";lbl.className="ac-status "+(frozen?"frozen":"active");}
    $("btnFreeze")?.classList.toggle("hidden",frozen);
    $("btnUnfreeze")?.classList.toggle("hidden",!frozen);
  }
}
window.setAccountStatus = async function(status) {
  if (isDemoMode){D.status=status;applyStatus(status,"admin");demoLog("admin","admin",`Account ${status==="frozen"?"FROZEN":"UNFROZEN"}`);return;}
  try{await set(ref(db,"account/status"),status);await log("admin","admin",`Account ${status==="frozen"?"FROZEN":"UNFROZEN"}`);}catch(e){console.error(e);}
};

// ── TABS ─────────────────────────────────────────────────────
window.switchTab=function(tab){
  $("tabAdd").classList.toggle("active",tab==="add");$("tabSub").classList.toggle("active",tab==="sub");
  $("formAdd").classList.toggle("hidden",tab!=="add");$("formSub").classList.toggle("hidden",tab!=="sub");
};

// ── BALANCE MANAGEMENT ───────────────────────────────────────
window.submitBalance = async function(action) {
  const isAdd=action==="add";
  const amt=parseFloat($(isAdd?"addAmount":"subAmount").value);
  const name=$(isAdd?"addName":"subName").value.trim()||(isAdd?"Wesley Nuno":"Payee");
  const type=$(isAdd?"addType":"subType").value;
  const note=$(isAdd?"addNote":"subNote").value.trim();
  const dtVal=$(isAdd?"addDateTime":"subDateTime").value;
  const msgEl=$(isAdd?"addMsg":"subMsg");
  msgEl.classList.add("hidden");
  if (isNaN(amt)||amt<=0){showAlert(msgEl,"Enter a valid amount.","error");return;}
  const d=dtVal?new Date(dtVal):new Date();
  const txAmt=isAdd?amt:-amt, txType=isAdd?"cr":"dr";
  const desc=note?`${type} — ${note}`:type, icon=iconFor(type,isAdd);
  const txObj={name,desc,amount:txAmt,type:txType,icon,date:fmtDate(d),time:fmtTime(d),ts:d.getTime()};
  if (isDemoMode) {
    if (!isAdd&&amt>D.balance){showAlert(msgEl,"Insufficient balance.","error");return;}
    D.balance+=txAmt; updateBal("adminBalance",D.balance);
    D.txs.push(txObj); allTxsCache=[...D.txs];
    const s=sorted(allTxsCache); renderTx("adminTxList",s); renderEditList(s);
    demoLog("bal","admin",`${isAdd?"Added":"Deducted"} ${fmtMoney(amt)} — ${name}`);
    showAlert(msgEl,`✓ ${isAdd?"Added":"Deducted"} ${fmtMoney(amt)} successfully.`,"success");
    clearForm(isAdd); return;
  }
  try {
    const snap=await get(ref(db,"account/balance")); const cur=snap.exists()?snap.val():0;
    if (!isAdd&&amt>cur){showAlert(msgEl,"Insufficient balance.","error");return;}
    await set(ref(db,"account/balance"),parseFloat((cur+txAmt).toFixed(2)));
    await push(ref(db,"transactions"),txObj);
    await log("bal","admin",`${isAdd?"Added":"Deducted"} ${fmtMoney(amt)} — ${name}`);
    showAlert(msgEl,`✓ ${isAdd?"Added":"Deducted"} ${fmtMoney(amt)} successfully.`,"success");
    clearForm(isAdd);
  } catch(e){console.error(e);showAlert(msgEl,`Error: ${e.message}`,"error");}
};

function clearForm(isAdd) {
  [isAdd?"addName":"subName",isAdd?"addAmount":"subAmount",isAdd?"addNote":"subNote"].forEach(id=>{const e=$(id);if(e)e.value="";});
  prefillDatetimes();
}

// ── EDIT TX ──────────────────────────────────────────────────
function renderEditList(txs) {
  const el=$("adminEditTxList"); if(!el) return;
  if(!txs?.length){el.innerHTML=`<div class="tx-loading">No transactions yet.</div>`;return;}
  el.innerHTML=txs.map(tx=>`
    <div class="tx-item editable" onclick="openEditModal('${esc(tx.id||"")}','${esc(tx.name)}','${esc(tx.desc)}',${tx.amount},${tx.ts||Date.now()})">
      <div class="tx-av">${tx.icon||"👤"}</div>
      <div class="tx-body"><div class="tx-name">${tx.name}</div><div class="tx-desc">${tx.desc}</div><div class="edit-hint">Tap to edit</div></div>
      <div class="tx-right"><div class="tx-amt ${tx.type==="cr"?"cr":"dr"}">${tx.amount>0?"+":""}${fmtMoney(tx.amount)}</div><div class="tx-date">${tx.date} ${tx.time}</div></div>
    </div>`).join("");
}

window.openEditModal=function(id,name,desc,amount,ts){
  $("editTxId").value=id;$("editName").value=name;$("editDesc").value=desc;
  $("editAmount").value=amount;$("editDateTime").value=toDatetimeLocal(new Date(parseInt(ts)||Date.now()));
  $("editMsg").classList.add("hidden");$("editModal").classList.remove("hidden");
};
window.closeEditModal=e=>{if(e.target===$("editModal"))closeEditModalDirect();};
window.closeEditModalDirect=()=>$("editModal").classList.add("hidden");
window.saveEditTx=async function(){
  const id=$("editTxId").value,name=$("editName").value.trim(),desc=$("editDesc").value.trim();
  const amount=parseFloat($("editAmount").value),dtVal=$("editDateTime").value,msgEl=$("editMsg");
  msgEl.classList.add("hidden");
  if(!name||isNaN(amount)){showAlert(msgEl,"Name and amount required.","error");return;}
  const d=dtVal?new Date(dtVal):new Date(),txType=amount>=0?"cr":"dr";
  const upd={name,desc,amount,type:txType,date:fmtDate(d),time:fmtTime(d),ts:d.getTime()};
  if (isDemoMode){const i=D.txs.findIndex(t=>t.id===id||String(t.ts)===id);if(i!==-1)D.txs[i]={...D.txs[i],...upd};allTxsCache=[...D.txs];const s=sorted(allTxsCache);renderTx("adminTxList",s);renderEditList(s);closeEditModalDirect();return;}
  try{await update(ref(db,`transactions/${id}`),upd);closeEditModalDirect();}
  catch(e){showAlert(msgEl,"Failed to save.","error");}
};

// ── WIRE TRANSFER ─────────────────────────────────────────────
window.openTransferModal=function(){resetWire();$("transferModal").classList.remove("hidden");};
window.goToWireStep0=resetWire;
function resetWire(){["wireStep0","wireStep1","wireStep2","wireStep3"].forEach((id,i)=>$(id)?.classList.toggle("hidden",i!==0));$("wireError")?.classList.add("hidden");}

window.selectWireType=function(type){
  currentWireType=type; const dom=type==="domestic";
  $("wireFormTitle").textContent=dom?"🏦 Domestic Wire Transfer":"🌍 International Wire Transfer";
  $("wireFormBadge").textContent=`Step 1 of 2 — ${dom?"Domestic":"International"} Details`;
  $("wireTypeTag").textContent=dom?"🏦 DOMESTIC WIRE":"🌍 INTERNATIONAL WIRE";
  $("wireTypeTag").className=`wire-type-tag ${dom?"tag-domestic":"tag-international"}`;
  $("domesticFields").classList.toggle("hidden",!dom);
  $("internationalFields").classList.toggle("hidden",dom);
  $("wireCountryField").classList.toggle("hidden",dom);
  $("wireFeeVal").textContent=dom?"$15–$25":"$25–$45";
  $("wireTimeVal").textContent=dom?"Same/Next Business Day":"1–3 Business Days";
  $("wireStep0").classList.add("hidden");$("wireStep1").classList.remove("hidden");
  $("transferModal").querySelector(".wire-modal").scrollTop=0;
};

window.goBackWire=()=>{$("wireStep2").classList.add("hidden");$("wireStep1").classList.remove("hidden");};

window.submitWireStep1=function(){
  const err=$("wireError");err.classList.add("hidden");
  const dom=currentWireType==="domestic";
  const req=[{id:"wireRecipientName",label:"Recipient Full Name"},{id:"wireBankName",label:"Bank Name"},{id:"wireAmount",label:"Amount"},{id:"wireReference",label:"Transfer Purpose"},
    ...(dom?[{id:"wireDomesticAcct",label:"Account Number"},{id:"wireDomesticRouting",label:"Routing Number"},{id:"wireDomesticAddress",label:"Bank Address"}]
          :[{id:"wireCountry",label:"Recipient Country"},{id:"wireIban",label:"IBAN"},{id:"wireSwift",label:"SWIFT/BIC"}])];
  for(const f of req){if(!$(f.id)?.value.trim()){showAlert(err,`Please fill in: ${f.label}`,"error");$(f.id)?.focus();return;}}
  const amt=parseFloat($("wireAmount").value); if(isNaN(amt)||amt<=0){showAlert(err,"Enter a valid amount.","error");return;}
  const cur=$("wireCurrency").value;
  const rows=[
    {label:"Transfer Type",value:dom?"🏦 Domestic Wire":"🌍 International Wire"},
    {label:"From Account",value:"Wesley Nuno — **** 7662"},
    {label:"Recipient",value:$("wireRecipientName").value.trim()},
    {label:"Bank",value:$("wireBankName").value.trim()},
    ...(!dom?[{label:"Country",value:$("wireCountry").value}]:[]),
    ...(dom?[{label:"Account No.",value:$("wireDomesticAcct").value.trim()},{label:"Routing No.",value:$("wireDomesticRouting").value.trim()},{label:"Bank Address",value:$("wireDomesticAddress").value.trim()}]:[]),
    ...(!dom?[{label:"IBAN",value:$("wireIban").value.trim()},{label:"SWIFT/BIC",value:$("wireSwift").value.trim().toUpperCase()}]:[]),
    ...($("wireSortCode")?.value.trim()&&!dom?[{label:"Sort Code",value:$("wireSortCode").value.trim()}]:[]),
    {label:"Amount",value:`${fmtMoney(amt)} ${cur}`,isAmt:true},
    {label:"Reference",value:$("wireReference").value.trim()},
    ...($("wireNotes")?.value.trim()?[{label:"Notes",value:$("wireNotes").value.trim()}]:[]),
    {label:"Est. Fee",value:dom?"$15–$25":"$25–$45"},{label:"Processing",value:dom?"Same/Next Business Day":"1–3 Business Days"},
  ];
  $("wireConfirmCard").innerHTML=rows.map(r=>`<div class="confirm-row"><span class="confirm-label">${r.label}</span><span class="confirm-value ${r.isAmt?"confirm-amount":""}">${r.value}</span></div>`).join("");
  $("wireStep1").classList.add("hidden");$("wireStep2").classList.remove("hidden");
  $("transferModal").querySelector(".wire-modal").scrollTop=0;
};

window.confirmWire=async function(){
  const dom=currentWireType==="domestic";
  const refId="JB-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
  const wire={refId,status:"pending",wireType:currentWireType,submittedBy:currentUser?.username||"user",submittedAt:new Date().toLocaleString("en-GB"),ts:Date.now(),
    recipientName:$("wireRecipientName").value.trim(),bankName:$("wireBankName").value.trim(),
    country:dom?"Domestic":$("wireCountry").value,
    iban:dom?$("wireDomesticAcct").value.trim():$("wireIban").value.trim(),
    swift:dom?$("wireDomesticRouting").value.trim():$("wireSwift").value.trim().toUpperCase(),
    sortcode:dom?"":($("wireSortCode")?.value.trim()||""),
    bankAddress:dom?$("wireDomesticAddress").value.trim():($("wireBankAddress")?.value.trim()||""),
    amount:parseFloat($("wireAmount").value),currency:$("wireCurrency").value,
    reference:$("wireReference").value.trim(),notes:$("wireNotes")?.value.trim()||"",
  };
  if (isDemoMode){D.wires.unshift({...wire,id:refId});allWiresCache=[...D.wires];renderUserWires(allWiresCache);renderAdminWires(allWiresCache);demoLog("wire",currentUser?.username||"user",`Wire ${refId} submitted`);}
  else{try{await push(ref(db,"wires"),wire);await log("wire",currentUser?.username||"user",`Wire ${refId} — ${fmtMoney(wire.amount)} to ${wire.recipientName}`);}catch(e){console.error(e);}}
  $("wireRefId").textContent=refId;
  $("wireStep2").classList.add("hidden");$("wireStep3").classList.remove("hidden");
  $("transferModal").querySelector(".wire-modal").scrollTop=0;
};

window.closeWireSuccess=function(){
  ["wireRecipientName","wireBankName","wireDomesticAcct","wireDomesticRouting","wireDomesticAddress","wireIban","wireSwift","wireSortCode","wireBankAddress","wireAmount","wireReference","wireNotes"]
    .forEach(id=>{const e=$(id);if(e)e.value="";});
  $("wireCountry").value="";$("wireCurrency").value="USD";
  resetWire();$("transferModal").classList.add("hidden");
};

// ── RENDER USER WIRES ─────────────────────────────────────────
function renderUserWires(wires) {
  const sec=$("wireStatusSection"),el=$("userWireList");
  if(!sec||!el) return;
  sec.style.display=wires?.length?"block":"none";
  if(!wires?.length) return;
  el.innerHTML=wires.map(w=>{
    const pr=w.status==="pending",ap=w.status==="approved"||w.status==="processing",rj=w.status==="rejected";
    const cls=ap?"processing":w.status, icon=ap?"🔄":rj?"❌":"⏳";
    const msg=pr?`<div class="wsi-msg pending-msg">⏳ Your transfer request is pending review by our team.</div>`
              :ap?`<div class="wsi-msg processing-msg">🔄 <strong>Your transfer is being processed.</strong> Your transaction will be completed within 1 to 5 business days.</div>`
              :rj?`<div class="wsi-msg rejected-msg">❌ This transfer was declined. Please contact support.</div>`:"";
    return`<div class="wire-status-item ${cls}">
      <div class="wsi-top"><div class="wsi-left"><span class="wsi-icon">${icon}</span><div>
        <div class="wsi-name">To: <strong>${w.recipientName}</strong></div>
        <div class="wsi-bank">${w.bankName} · ${w.country}</div>
        <div class="wsi-type-badge ${w.wireType}">${w.wireType==="domestic"?"🏦 Domestic":"🌍 International"}</div>
      </div></div>
      <div class="wsi-right"><div class="wsi-amount">${fmtMoney(w.amount)} ${w.currency}</div>
        <div class="wsi-status-tag ${cls}">${ap?"PROCESSING":w.status.toUpperCase()}</div></div>
      </div>${msg}
      <div class="wsi-meta"><span>Ref: <strong>${w.refId}</strong></span><span>${w.submittedAt||""}</span></div>
    </div>`;
  }).join("");
  // also update wire sub-pages
  const wsl=$("wireStatusList"); if(wsl) wsl.innerHTML=el.innerHTML;
  const whl=$("wireHistoryList"); if(whl) whl.innerHTML=el.innerHTML;
}

// ── RENDER ADMIN WIRES ────────────────────────────────────────
function renderAdminWires(wires) {
  const el=$("adminWireList"); if(!el) return;
  if(!wires?.length){el.innerHTML=`<div class="tx-loading">No wire transfer requests yet.</div>`;return;}
  el.innerHTML=wires.map(w=>{
    const pend=w.status==="pending",dom=w.wireType==="domestic";
    const stCls=w.status==="approved"||w.status==="processing"?"processing":w.status;
    return`<div class="admin-wire-item ${w.status}">
      <div class="awi-header"><div class="awi-title-row">
        <span class="awi-ref">${w.refId}</span>
        <span class="wsi-type-badge ${w.wireType}">${dom?"🏦 Domestic":"🌍 International"}</span>
        <span class="wsi-status-tag ${stCls}">${stCls==="processing"?"PROCESSING":w.status.toUpperCase()}</span>
      </div><div class="awi-submitted">By <strong>${w.submittedBy}</strong> · ${w.submittedAt||""}</div></div>
      <div class="awi-grid">
        <div class="awi-row"><span class="awi-label">Recipient</span><span class="awi-val">${w.recipientName}</span></div>
        <div class="awi-row"><span class="awi-label">Bank</span><span class="awi-val">${w.bankName}</span></div>
        <div class="awi-row"><span class="awi-label">Country</span><span class="awi-val">${w.country}</span></div>
        <div class="awi-row"><span class="awi-label">${dom?"Account No.":"IBAN"}</span><span class="awi-val">${w.iban}</span></div>
        <div class="awi-row"><span class="awi-label">${dom?"Routing No.":"SWIFT/BIC"}</span><span class="awi-val">${w.swift}</span></div>
        ${w.sortcode?`<div class="awi-row"><span class="awi-label">Sort Code</span><span class="awi-val">${w.sortcode}</span></div>`:""}
        ${w.bankAddress?`<div class="awi-row"><span class="awi-label">Bank Address</span><span class="awi-val">${w.bankAddress}</span></div>`:""}
        <div class="awi-row"><span class="awi-label">Amount</span><span class="awi-val awi-amount">${fmtMoney(w.amount)} ${w.currency}</span></div>
        <div class="awi-row"><span class="awi-label">Reference</span><span class="awi-val">${w.reference}</span></div>
        ${w.notes?`<div class="awi-row"><span class="awi-label">Notes</span><span class="awi-val">${w.notes}</span></div>`:""}
      </div>
      ${pend?`<div class="awi-actions">
        <button class="btn-approve" onclick="handleWire('${w.id||w.refId}','approved')">✓ Approve</button>
        <button class="btn-reject" onclick="handleWire('${w.id||w.refId}','rejected')">✗ Decline</button>
      </div>`:`<div class="awi-decided">${stCls==="processing"?"🔄 Approved — Processing":"❌ Declined"} · ${w.decidedAt||""}</div>`}
    </div>`;
  }).join("");
}

window.handleWire=async function(id,action){
  const decidedAt=new Date().toLocaleString("en-GB");
  if (isDemoMode){const i=D.wires.findIndex(w=>w.id===id||w.refId===id);if(i!==-1){D.wires[i].status=action;D.wires[i].decidedAt=decidedAt;}allWiresCache=[...D.wires];renderAdminWires(allWiresCache);renderUserWires(allWiresCache);demoLog("admin","admin",`Wire ${id} ${action==="approved"?"APPROVED":"DECLINED"}`);return;}
  try{await update(ref(db,`wires/${id}`),{status:action,decidedAt});await log("admin","admin",`Wire ${id} ${action==="approved"?"APPROVED":"DECLINED"}`);}catch(e){console.error(e);}
};

// ── RENDER TX ─────────────────────────────────────────────────
function renderTx(cid,txs) {
  const el=$(cid); if(!el) return;
  if(!txs?.length){el.innerHTML=`<div class="tx-loading">No transactions yet.</div>`;return;}
  el.innerHTML=txs.map(tx=>`
    <div class="tx-item">
      <div class="tx-av">${tx.icon||"👤"}</div>
      <div class="tx-body"><div class="tx-name">${tx.name}</div><div class="tx-desc">${tx.desc}</div></div>
      <div class="tx-right"><div class="tx-amt ${tx.type==="cr"?"cr":"dr"}">${tx.amount>0?"+":""}${fmtMoney(tx.amount)}</div><div class="tx-date">${tx.date} ${tx.time}</div></div>
    </div>`).join("");
}

function renderLogs(logs) {
  const el=$("adminLogList"); if(!el) return;
  if(!logs?.length){el.innerHTML=`<div class="tx-loading">No activity yet.</div>`;return;}
  el.innerHTML=logs.map(l=>`
    <div class="log-item"><span class="log-tag ${l.type}">${labelFor(l.type)}</span><span class="log-who">${l.username}</span><span class="log-detail">${l.detail}</span><span class="log-time">${l.timeStr||""}</span></div>`).join("");
}
function labelFor(t){return{in:"LOGIN",out:"LOGOUT",bal:"BALANCE",fail:"FAILED",wire:"WIRE",admin:"ADMIN"}[t]||(t||"").toUpperCase();}

// ── LOGS ─────────────────────────────────────────────────────
async function log(type,username,detail){
  const e={type,username,detail,ts:isDemoMode?Date.now():serverTimestamp(),timeStr:new Date().toLocaleString("en-GB")};
  if(isDemoMode){D.logs.push(e);return;}
  try{await push(ref(db,"logs"),e);}catch(e){console.warn(e);}
}
function demoLog(type,username,detail){
  D.logs.push({type,username,detail,ts:Date.now(),timeStr:new Date().toLocaleString("en-GB")});
  if(currentUser?.role==="admin")renderLogs(D.logs.slice().reverse());
}

// ── SIDE MENU & SUB PAGES ────────────────────────────────────
window.toggleMenu=function(){
  const m=$("sideMenu"),o=$("menuOverlay");
  if(!m) return;
  const opening=!m.classList.contains("open");
  m.classList.toggle("open",opening);
  o?.classList.toggle("hidden",!opening);
};

window.toggleDropdown=function(id){
  const dd=$(id); if(!dd) return;
  const isOpen=!dd.classList.contains("hidden");
  // close all other dropdowns first
  document.querySelectorAll(".side-dropdown").forEach(d=>{
    d.classList.add("hidden");
    const arrow=document.getElementById("arrow"+d.id.replace("dd",""));
    if(arrow) arrow.style.transform="";
  });
  if(!isOpen){
    dd.classList.remove("hidden");
    const arrow=document.getElementById("arrow"+id.replace("dd",""));
    if(arrow) arrow.style.transform="rotate(90deg)";
  }
};

window.openSubPage=function(pageId){
  $("sideMenu")?.classList.remove("open");
  $("menuOverlay")?.classList.add("hidden");
  const el=$(pageId); if(!el) return;
  el.classList.remove("hidden");
  setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),100);
  // populate activity page
  if(pageId==="pageAccountActivity"||pageId==="pageTxHistory"){
    const listId=pageId==="pageAccountActivity"?"activityTxList":"txHistoryList";
    renderTx(listId,sorted(allTxsCache));
  }
  if(pageId==="pageWireStatus"||pageId==="pageWireHistory"){
    const listId=pageId==="pageWireStatus"?"wireStatusList":"wireHistoryList";
    const el2=$(listId);
    if(el2&&allWiresCache.length){const wEl=$("userWireList");if(wEl)el2.innerHTML=wEl.innerHTML;}
    else if(el2) el2.innerHTML=`<div class="tx-loading">No wire requests yet.</div>`;
  }
};

window.goHome=function(){
  $("sideMenu")?.classList.remove("open");
  $("menuOverlay")?.classList.add("hidden");
  document.querySelectorAll(".sub-page").forEach(p=>p.classList.add("hidden"));
  window.scrollTo(0,0);
};

window.closeSubPage=function(id){$(id)?.classList.add("hidden");};

window.filterActivity=function(val,type){
  let txs=[...allTxsCache];
  if(type==="type"&&val!=="all") txs=txs.filter(t=>t.type===val);
  if(type==="period"){const days=parseInt(val),cutoff=Date.now()-days*864e5;txs=txs.filter(t=>(t.ts||0)>=cutoff);}
  renderTx("activityTxList",sorted(txs));
};

// ── NEW ACCOUNT ──────────────────────────────────────────────
window.selectAccountType=function(el,type){
  document.querySelectorAll(".account-type-card").forEach(c=>c.classList.remove("selected"));
  el.classList.add("selected");
  $("selectedAccountType").value=type;
  $("newAccountForm").classList.remove("hidden");
};
window.submitNewAccount=function(){
  const type=$("selectedAccountType").value,dob=$("naDob").value,purpose=$("naPurpose").value.trim(),deposit=parseFloat($("naDeposit").value),msgEl=$("naMsg");
  msgEl.classList.add("hidden");
  if(!dob||!purpose||isNaN(deposit)||deposit<100){showAlert(msgEl,"Please fill in all fields. Minimum deposit is $100.","error");return;}
  showAlert(msgEl,`✓ Your ${type} application has been submitted! Our team will contact you within 2–3 business days.`,"success");
  setTimeout(()=>{$("naDob").value="";$("naPurpose").value="";$("naDeposit").value="";$("newAccountForm").classList.add("hidden");document.querySelectorAll(".account-type-card").forEach(c=>c.classList.remove("selected"));}),3000;
};

// ── DISPUTE ──────────────────────────────────────────────────
window.submitDispute=function(){
  const date=$("disputeDate").value,amt=$("disputeAmt").value,name=$("disputeName").value.trim(),details=$("disputeDetails").value.trim(),msgEl=$("disputeMsg");
  msgEl.classList.add("hidden");
  if(!date||!amt||!name){showAlert(msgEl,"Please fill in all required fields.","error");return;}
  showAlert(msgEl,"✓ Your dispute has been submitted. Our team will investigate within 3–5 business days.","success");
};

// ── MESSAGES ─────────────────────────────────────────────────
window.sendMessage=function(){
  const sub=$("msgSubject").value.trim(),body=$("msgBody").value.trim(),msgEl=$("msgSentNote");
  msgEl.classList.add("hidden");
  if(!sub||!body){showAlert(msgEl,"Please enter a subject and message.","error");return;}
  showAlert(msgEl,"✓ Message sent! Our team will respond within 1 business day.","success");
  $("msgSubject").value="";$("msgBody").value="";
};

// ── CARD ACTIONS ─────────────────────────────────────────────
window.cardAction=function(action){
  const msgEl=$("cardActionMsg"); msgEl.classList.add("hidden");
  const messages={
    freeze:"✓ Card freeze request submitted. Your card will be frozen within minutes. Contact support to unfreeze.",
    pin:"✓ PIN change request submitted. You will receive an SMS with instructions within 24 hours.",
    replace:"✓ Replacement card requested. Delivery takes 5–7 business days to your registered address.",
    lost:"✓ Lost card report submitted. Your card has been blocked immediately. A replacement will be sent within 5–7 business days."
  };
  showAlert(msgEl,messages[action]||"Request submitted.","success");
};

// ── SETTINGS ─────────────────────────────────────────────────
window.toggleDarkMode=function(){
  const cur=document.documentElement.getAttribute("data-theme");
  const newTheme=cur==="dark"?"light":"dark";
  applyTheme(newTheme);
  const btn=$("darkModeToggle");if(btn){btn.textContent=newTheme==="dark"?"ON":"OFF";btn.classList.toggle("on",newTheme==="dark");}
};
window.toggleNotif=function(btn){
  const isOn=btn.textContent==="ON";
  btn.textContent=isOn?"OFF":"ON";
  btn.classList.toggle("on",!isOn);
};
window.changePassword=function(){
  const form=$("changePasswordForm");
  if(form) form.classList.toggle("hidden");
};
window.submitPasswordChange=function(){
  const cur=$("curPw").value,np=$("newPw").value,conf=$("confirmPw").value,msgEl=$("securityMsg");
  msgEl.classList.add("hidden");
  if(!cur||!np||!conf){showAlert(msgEl,"Please fill in all password fields.","error");return;}
  if(np!==conf){showAlert(msgEl,"New passwords do not match.","error");return;}
  if(np.length<8){showAlert(msgEl,"Password must be at least 8 characters.","error");return;}
  showAlert(msgEl,"✓ Password updated successfully.","success");
  $("curPw").value="";$("newPw").value="";$("confirmPw").value="";
  $("changePasswordForm").classList.add("hidden");
};

// ── MODALS ───────────────────────────────────────────────────
window.openSupportModal=()=>$("supportModal").classList.remove("hidden");
window.closeModal=(id,e)=>{if(e.target===$(id))$(id).classList.add("hidden");};
window.closeModalDirect=id=>$(id).classList.add("hidden");

// ── THEME ─────────────────────────────────────────────────────
function applyTheme(t){document.documentElement.setAttribute("data-theme",t);const ic=t==="dark"?"☀️":"🌙";["themeIconUser","themeIconAdmin"].forEach(id=>{const e=$(id);if(e)e.textContent=ic;});localStorage.setItem("jyske_theme",t);}
window.toggleTheme=()=>{const c=document.documentElement.getAttribute("data-theme");applyTheme(c==="dark"?"light":"dark");};

// ── UTILS ─────────────────────────────────────────────────────
function showPage(n){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(n+"Page").classList.add("active");window.scrollTo(0,0);}
function hideLoader(){const l=$("loadingScreen");l.classList.add("fade-out");setTimeout(()=>l.style.display="none",520);}
function showAlert(el,msg,type){el.textContent=msg;el.className=type==="success"?"alert alert-success":"alert alert-error";el.classList.remove("hidden");if(type==="success")setTimeout(()=>el.classList.add("hidden"),5000);}
function updateBal(id,v){const e=$(id);if(e)e.textContent=fmtMoney(v);}
function setCardDates(){const d=new Date(),s=`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;["userCardDate","adminCardDate"].forEach(id=>{const e=$(id);if(e)e.textContent=s;});}
function prefillDatetimes(){const n=toDatetimeLocal(new Date());["addDateTime","subDateTime"].forEach(id=>{const e=$(id);if(e)e.value=n;});}
function sorted(a){return[...a].sort((x,y)=>(y.ts||0)-(x.ts||0));}
function pad(n){return String(n).padStart(2,"0");}
function fmtDate(d){return`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;}
function fmtTime(d){return d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});}
function fmtMoney(n){return Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" $";}
function toDatetimeLocal(d){return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function esc(s){return(s||"").replace(/'/g,"&#39;").replace(/"/g,"&quot;");}
function iconFor(type,add){const m={"Contract Payment":"👤","Payroll / Salary":"🏦","Wire Transfer":"🏧","Invoice Payment":"📄","Freelance Income":"💼","Dividend Credit":"📈","Refund":"↩️","Gift / Personal Transfer":"🎁","Other Credit":"💰","Internet / Phone Bill":"📱","Utility Bill":"⚡","Rent / Mortgage":"🏠","Online Purchase":"🛒","Subscription Fee":"🔄","Medical / Health":"🏥","Groceries":"🛍️","Transport / Fuel":"🚗","Insurance Premium":"🛡️","Tax Payment":"🏛️","Service Fee":"💳","Wire Transfer Out":"🏧","Other Expense":"📋"};return m[type]||(add?"💰":"📋");}
window.scrollToSection=id=>$(id)?.scrollIntoView({behavior:"smooth",block:"start"});
window.togglePw=()=>{const i=$("loginPass");i.type=i.type==="password"?"text":"password";};
