// ============================================================
//  JYSKE BANK — Firebase Realtime Database Edition
// ============================================================
import { initializeApp }      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
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
  wesleynunc: { password: "Wesley@2024", role: "user"  },
};

const HOLDER_NAME    = "WESLEY NUNO";
const INITIAL_BAL    = 47355.60;

// ── STATE ────────────────────────────────────────────────────
let app, db;
let currentUser     = null;
let isDemoMode      = false;
let currentWireType = "";

// Firebase listeners — kept so we can detach them on logout
const listeners = {};

// Demo state
let D = {
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

  if (firebaseConfig.apiKey.startsWith("PASTE_")) {
    isDemoMode = true; hideLoader(); showSetupBanner(); showPage("login"); return;
  }
  try {
    app = initializeApp(firebaseConfig);
    db  = getDatabase(app);
    await seed();
    hideLoader(); showPage("login");
  } catch(e) {
    console.error(e); isDemoMode = true; hideLoader(); showPage("login");
  }
});

// ── SEED (runs once when DB is empty) ────────────────────────
async function seed() {
  const b = await get(ref(db,"account/balance"));
  if (!b.exists()) await set(ref(db,"account/balance"), INITIAL_BAL);
  const s = await get(ref(db,"account/status"));
  if (!s.exists()) await set(ref(db,"account/status"), "active");
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

// ── DETACH all Firebase listeners ────────────────────────────
function detach() {
  Object.values(listeners).forEach(u => { if (typeof u === "function") u(); });
  Object.keys(listeners).forEach(k => delete listeners[k]);
}

// ── AUTH ─────────────────────────────────────────────────────
window.doLogin = async function() {
  const user = $("loginUser").value.trim().toLowerCase();
  const pass = $("loginPass").value;
  const err  = $("loginError");
  err.classList.add("hidden");
  if (!user || !pass) { showAlert(err,"Enter username and password.","error"); return; }
  const cred = USERS[user];
  if (!cred || cred.password !== pass) {
    showAlert(err,"Incorrect username or password.","error");
    await log("fail", user, "Failed login attempt"); return;
  }
  currentUser = { username: user, role: cred.role };
  await log("in", user, "Logged in successfully");
  $("loginUser").value = ""; $("loginPass").value = "";
  if (cred.role === "admin") { mountAdmin(); showPage("admin"); }
  else                       { mountUser();  showPage("user");  }
};

window.doLogout = async function() {
  if (currentUser) await log("out", currentUser.username, "Logged out");
  detach(); currentUser = null; showPage("login");
};

document.addEventListener("keydown", e => {
  if (e.key === "Enter" && $("loginPage").classList.contains("active")) doLogin();
});

// ── MOUNT USER ───────────────────────────────────────────────
function mountUser() {
  $("userChip").textContent = currentUser.username.toUpperCase();
  if (isDemoMode) {
    applyStatus(D.status,"user");
    updateBal("userBalance", D.balance);
    renderTx("userTxList", sorted(D.txs));
    renderUserWires(D.wires);
    return;
  }
  // ★ ONE listener per path — stored so they can be detached
  listeners.status  = onValue(ref(db,"account/status"),  s => applyStatus(s.exists()?s.val():"active","user"));
  listeners.balance = onValue(ref(db,"account/balance"), s => updateBal("userBalance", s.exists()?s.val():0));
  listeners.txs     = onValue(ref(db,"transactions"),    s => {
    const a=[]; s.forEach(c=>a.push({id:c.key,...c.val()}));
    renderTx("userTxList", sorted(a));
  });
  listeners.wires   = onValue(ref(db,"wires"), s => {
    const a=[]; s.forEach(c=>a.push({id:c.key,...c.val()}));
    a.sort((x,y)=>(y.ts||0)-(x.ts||0));
    renderUserWires(a);
  });
}

// ── MOUNT ADMIN ──────────────────────────────────────────────
function mountAdmin() {
  if (isDemoMode) {
    applyStatus(D.status,"admin");
    updateBal("adminBalance", D.balance);
    const s=sorted(D.txs);
    // ★ FIX: render edit list and tx list from SAME data, ONE call each
    renderTx("adminTxList", s);
    renderEditList(s);
    renderAdminWires(D.wires);
    renderLogs(D.logs.slice().reverse());
    return;
  }
  listeners.status  = onValue(ref(db,"account/status"),  s => applyStatus(s.exists()?s.val():"active","admin"));
  listeners.balance = onValue(ref(db,"account/balance"), s => updateBal("adminBalance", s.exists()?s.val():0));

  // ★ FIX: ONE listener for transactions, updates BOTH lists together
  listeners.txs = onValue(ref(db,"transactions"), s => {
    const a=[]; s.forEach(c=>a.push({id:c.key,...c.val()}));
    const sorted_a = sorted(a);
    renderTx("adminTxList", sorted_a);
    renderEditList(sorted_a);
  });

  // ★ FIX: ONE listener for wires
  listeners.wires = onValue(ref(db,"wires"), s => {
    const a=[]; s.forEach(c=>a.push({id:c.key,...c.val()}));
    a.sort((x,y)=>(y.ts||0)-(x.ts||0));
    renderAdminWires(a);
  });

  listeners.logs = onValue(ref(db,"logs"), s => {
    const a=[]; s.forEach(c=>a.push({id:c.key,...c.val()}));
    a.sort((x,y)=>(y.ts||0)-(x.ts||0));
    renderLogs(a.slice(0,100));
  });
}

// ── FREEZE / UNFREEZE ─────────────────────────────────────────
function applyStatus(status, view) {
  const frozen = status === "frozen";
  if (view === "user") {
    $("frozenBanner")?.classList.toggle("hidden", !frozen);
    $("userBankCard")?.classList.toggle("card-frozen", frozen);
    const btn = $("transferBtn");
    if (btn) { btn.disabled = frozen; btn.style.opacity = frozen ? "0.4" : ""; }
  }
  if (view === "admin") {
    const lbl = $("accountStatusLabel");
    if (lbl) { lbl.textContent = frozen?"🔒 Frozen":"✅ Active"; lbl.className="ac-status "+(frozen?"frozen":"active"); }
    $("btnFreeze")?.classList.toggle("hidden", frozen);
    $("btnUnfreeze")?.classList.toggle("hidden", !frozen);
  }
}

window.setAccountStatus = async function(status) {
  if (isDemoMode) { D.status=status; applyStatus(status,"admin"); demoLog("admin","admin",`Account ${status==="frozen"?"FROZEN":"UNFROZEN"}`); return; }
  try { await set(ref(db,"account/status"),status); await log("admin","admin",`Account ${status==="frozen"?"FROZEN":"UNFROZEN"}`); }
  catch(e){ console.error(e); }
};

// ── TABS ─────────────────────────────────────────────────────
window.switchTab = function(tab) {
  $("tabAdd").classList.toggle("active",tab==="add"); $("tabSub").classList.toggle("active",tab==="sub");
  $("formAdd").classList.toggle("hidden",tab!=="add"); $("formSub").classList.toggle("hidden",tab!=="sub");
};

// ── BALANCE MANAGEMENT ───────────────────────────────────────
window.submitBalance = async function(action) {
  const isAdd  = action==="add";
  const amt    = parseFloat($(isAdd?"addAmount":"subAmount").value);
  const name   = $(isAdd?"addName":"subName").value.trim() || (isAdd?"Wesley Nuno":"Payee");
  const type   = $(isAdd?"addType":"subType").value;
  const note   = $(isAdd?"addNote":"subNote").value.trim();
  const dtVal  = $(isAdd?"addDateTime":"subDateTime").value;
  const msgEl  = $(isAdd?"addMsg":"subMsg");
  msgEl.classList.add("hidden");
  if (isNaN(amt)||amt<=0) { showAlert(msgEl,"Enter a valid amount.","error"); return; }

  const d=dtVal?new Date(dtVal):new Date();
  const txAmt=isAdd?amt:-amt, txType=isAdd?"cr":"dr";
  const desc=note?`${type} — ${note}`:type, icon=iconFor(type,isAdd);
  const txObj={name,desc,amount:txAmt,type:txType,icon,date:fmtDate(d),time:fmtTime(d),ts:d.getTime()};

  if (isDemoMode) {
    if (!isAdd&&amt>D.balance){showAlert(msgEl,"Insufficient balance.","error");return;}
    D.balance+=txAmt; updateBal("adminBalance",D.balance);
    D.txs.push(txObj); const s=sorted(D.txs); renderTx("adminTxList",s); renderEditList(s);
    demoLog("bal","admin",`${isAdd?"Added":"Deducted"} ${fmtMoney(amt)} — ${name}`);
    showAlert(msgEl,`✓ ${isAdd?"Added":"Deducted"} ${fmtMoney(amt)} successfully.`,"success");
    clearForm(isAdd); return;
  }

  try {
    // ★ FIX: read-then-write — most reliable, no silent failures
    const snap = await get(ref(db,"account/balance"));
    const cur  = snap.exists() ? snap.val() : 0;
    if (!isAdd && amt > cur) { showAlert(msgEl,"Insufficient balance.","error"); return; }
    // Write balance and transaction in sequence
    await set(ref(db,"account/balance"), parseFloat((cur+txAmt).toFixed(2)));
    await push(ref(db,"transactions"), txObj);
    await log("bal","admin",`${isAdd?"Added":"Deducted"} ${fmtMoney(amt)} — ${name}`);
    showAlert(msgEl,`✓ ${isAdd?"Added":"Deducted"} ${fmtMoney(amt)} successfully.`,"success");
    clearForm(isAdd);
  } catch(e) { console.error(e); showAlert(msgEl,`Error: ${e.message}`,"error"); }
};

function clearForm(isAdd) {
  [isAdd?"addName":"subName",isAdd?"addAmount":"subAmount",isAdd?"addNote":"subNote"]
    .forEach(id=>$(id)&&($(id).value=""));
  prefillDatetimes();
}

// ── EDIT TRANSACTION ─────────────────────────────────────────
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

window.openEditModal = function(id,name,desc,amount,ts) {
  $("editTxId").value=id; $("editName").value=name; $("editDesc").value=desc;
  $("editAmount").value=amount; $("editDateTime").value=toDatetimeLocal(new Date(parseInt(ts)||Date.now()));
  $("editMsg").classList.add("hidden"); $("editModal").classList.remove("hidden");
};
window.closeEditModal       = e => { if(e.target===$("editModal")) closeEditModalDirect(); };
window.closeEditModalDirect = () => $("editModal").classList.add("hidden");

window.saveEditTx = async function() {
  const id=$("editTxId").value, name=$("editName").value.trim(), desc=$("editDesc").value.trim();
  const amount=parseFloat($("editAmount").value), dtVal=$("editDateTime").value, msgEl=$("editMsg");
  msgEl.classList.add("hidden");
  if(!name||isNaN(amount)){showAlert(msgEl,"Name and amount required.","error");return;}
  const d=dtVal?new Date(dtVal):new Date(), txType=amount>=0?"cr":"dr";
  const upd={name,desc,amount,type:txType,date:fmtDate(d),time:fmtTime(d),ts:d.getTime()};
  if(isDemoMode){
    const i=D.txs.findIndex(t=>t.id===id||String(t.ts)===id);
    if(i!==-1) D.txs[i]={...D.txs[i],...upd};
    const s=sorted(D.txs); renderTx("adminTxList",s); renderEditList(s); closeEditModalDirect(); return;
  }
  try { await update(ref(db,`transactions/${id}`),upd); closeEditModalDirect(); }
  catch(e){ showAlert(msgEl,"Failed to save.","error"); }
};

// ── WIRE TRANSFER ─────────────────────────────────────────────
window.openTransferModal = function() { resetWire(); $("transferModal").classList.remove("hidden"); };
window.goToWireStep0 = resetWire;
function resetWire() {
  ["wireStep0","wireStep1","wireStep2","wireStep3"].forEach((id,i)=>$(id)?.classList.toggle("hidden",i!==0));
  $("wireError")?.classList.add("hidden");
}

window.selectWireType = function(type) {
  currentWireType = type;
  const dom = type==="domestic";
  $("wireFormTitle").textContent = dom?"🏦 Domestic Wire Transfer":"🌍 International Wire Transfer";
  $("wireFormBadge").textContent = `Step 1 of 2 — ${dom?"Domestic":"International"} Details`;
  $("wireTypeTag").textContent   = dom?"🏦 DOMESTIC WIRE":"🌍 INTERNATIONAL WIRE";
  $("wireTypeTag").className     = `wire-type-tag ${dom?"tag-domestic":"tag-international"}`;
  $("domesticFields").classList.toggle("hidden",!dom);
  $("internationalFields").classList.toggle("hidden",dom);
  $("wireCountryField").classList.toggle("hidden",dom);
  $("wireFeeVal").textContent  = dom?"$15 – $25":"$25 – $45";
  $("wireTimeVal").textContent = dom?"Same / Next Business Day":"1–3 Business Days";
  $("wireStep0").classList.add("hidden");
  $("wireStep1").classList.remove("hidden");
  $("transferModal").querySelector(".wire-modal").scrollTop=0;
};

window.goBackWire = () => { $("wireStep2").classList.add("hidden"); $("wireStep1").classList.remove("hidden"); };

window.submitWireStep1 = function() {
  const err=$("wireError"); err.classList.add("hidden");
  const dom=currentWireType==="domestic";
  const req=[
    {id:"wireRecipientName",label:"Recipient Full Name"},
    {id:"wireBankName",label:"Bank Name"},
    {id:"wireAmount",label:"Amount"},
    {id:"wireReference",label:"Transfer Purpose"},
    ...(dom?[{id:"wireDomesticAcct",label:"Account Number"},{id:"wireDomesticRouting",label:"Routing Number"},{id:"wireDomesticAddress",label:"Bank Address"}]
          :[{id:"wireCountry",label:"Recipient Country"},{id:"wireIban",label:"IBAN / Account Number"},{id:"wireSwift",label:"SWIFT / BIC"}])
  ];
  for (const f of req) { if(!$(f.id)?.value.trim()){showAlert(err,`Please fill in: ${f.label}`,"error");$(f.id)?.focus();return;} }
  const amt=parseFloat($("wireAmount").value);
  if(isNaN(amt)||amt<=0){showAlert(err,"Enter a valid amount.","error");return;}
  const cur=$("wireCurrency").value;
  const rows=[
    {label:"Transfer Type",value:dom?"🏦 Domestic Wire":"🌍 International Wire"},
    {label:"From Account", value:`Wesley Nuno — **** 7662`},
    {label:"Recipient",    value:$("wireRecipientName").value.trim()},
    {label:"Bank",         value:$("wireBankName").value.trim()},
    ...(!dom?[{label:"Country",value:$("wireCountry").value}]:[]),
    ...(dom?[{label:"Account No.",value:$("wireDomesticAcct").value.trim()},{label:"Routing No.",value:$("wireDomesticRouting").value.trim()},{label:"Bank Address",value:$("wireDomesticAddress").value.trim()}]:[]),
    ...(!dom?[{label:"IBAN",value:$("wireIban").value.trim()},{label:"SWIFT/BIC",value:$("wireSwift").value.trim().toUpperCase()}]:[]),
    ...($("wireSortCode")?.value.trim()&&!dom?[{label:"Sort Code",value:$("wireSortCode").value.trim()}]:[]),
    {label:"Amount",value:`${fmtMoney(amt)} ${cur}`,isAmt:true},
    {label:"Reference",value:$("wireReference").value.trim()},
    ...($("wireNotes")?.value.trim()?[{label:"Notes",value:$("wireNotes").value.trim()}]:[]),
    {label:"Est. Fee",value:dom?"$15 – $25":"$25 – $45"},
    {label:"Processing",value:dom?"Same / Next Business Day":"1–3 Business Days"},
  ];
  $("wireConfirmCard").innerHTML=rows.map(r=>`<div class="confirm-row"><span class="confirm-label">${r.label}</span><span class="confirm-value ${r.isAmt?"confirm-amount":""}">${r.value}</span></div>`).join("");
  $("wireStep1").classList.add("hidden"); $("wireStep2").classList.remove("hidden");
  $("transferModal").querySelector(".wire-modal").scrollTop=0;
};

window.confirmWire = async function() {
  const dom=currentWireType==="domestic";
  const refId="JB-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
  const wire={
    refId, status:"pending", wireType:currentWireType,
    submittedBy:currentUser?.username||"user",
    submittedAt:new Date().toLocaleString("en-GB"), ts:Date.now(),
    recipientName:$("wireRecipientName").value.trim(),
    bankName:$("wireBankName").value.trim(),
    country:dom?"Domestic":$("wireCountry").value,
    iban:dom?$("wireDomesticAcct").value.trim():$("wireIban").value.trim(),
    swift:dom?$("wireDomesticRouting").value.trim():$("wireSwift").value.trim().toUpperCase(),
    sortcode:dom?"":($("wireSortCode")?.value.trim()||""),
    bankAddress:dom?$("wireDomesticAddress").value.trim():($("wireBankAddress")?.value.trim()||""),
    amount:parseFloat($("wireAmount").value),
    currency:$("wireCurrency").value,
    reference:$("wireReference").value.trim(),
    notes:$("wireNotes")?.value.trim()||"",
  };
  if(isDemoMode){
    D.wires.unshift({...wire,id:refId});
    renderUserWires(D.wires); renderAdminWires(D.wires);
    demoLog("wire",currentUser?.username||"user",`Wire ${refId} submitted — ${fmtMoney(wire.amount)} to ${wire.recipientName}`);
  } else {
    try {
      // ★ FIX: push wire to Firebase so admin listener picks it up
      await push(ref(db,"wires"), wire);
      await log("wire",currentUser?.username||"user",`Wire ${refId} — ${fmtMoney(wire.amount)} ${wire.currency} to ${wire.recipientName}`);
    } catch(e){ console.error(e); }
  }
  $("wireRefId").textContent=refId;
  $("wireStep2").classList.add("hidden"); $("wireStep3").classList.remove("hidden");
  $("transferModal").querySelector(".wire-modal").scrollTop=0;
};

window.closeWireSuccess = function() {
  ["wireRecipientName","wireBankName","wireDomesticAcct","wireDomesticRouting","wireDomesticAddress",
   "wireIban","wireSwift","wireSortCode","wireBankAddress","wireAmount","wireReference","wireNotes"]
    .forEach(id=>{const e=$(id);if(e)e.value="";});
  $("wireCountry").value=""; $("wireCurrency").value="USD";
  resetWire(); $("transferModal").classList.add("hidden");
};

// ── RENDER USER WIRES ────────────────────────────────────────
function renderUserWires(wires) {
  const sec=$("wireStatusSection"), el=$("userWireList");
  if(!sec||!el) return;
  sec.style.display=wires?.length?"block":"none";
  if(!wires?.length) return;
  el.innerHTML=wires.map(w=>{
    const pr=w.status==="pending", ap=w.status==="approved"||w.status==="processing", rj=w.status==="rejected";
    const cls=ap?"processing":w.status;
    const icon=ap?"🔄":rj?"❌":"⏳";
    const msg=pr?`<div class="wsi-msg pending-msg">⏳ Your transfer request is pending review by our team.</div>`
              :ap?`<div class="wsi-msg processing-msg">🔄 <strong>Your transfer is being processed.</strong> Your transaction will be completed within 1 to 5 business days.</div>`
              :rj?`<div class="wsi-msg rejected-msg">❌ This transfer was declined. Please contact support for more information.</div>`:"";
    return`<div class="wire-status-item ${cls}">
      <div class="wsi-top">
        <div class="wsi-left"><span class="wsi-icon">${icon}</span>
          <div><div class="wsi-name">To: <strong>${w.recipientName}</strong></div>
          <div class="wsi-bank">${w.bankName} · ${w.country}</div>
          <div class="wsi-type-badge ${w.wireType}">${w.wireType==="domestic"?"🏦 Domestic":"🌍 International"}</div></div>
        </div>
        <div class="wsi-right"><div class="wsi-amount">${fmtMoney(w.amount)} ${w.currency}</div>
          <div class="wsi-status-tag ${cls}">${ap?"PROCESSING":w.status.toUpperCase()}</div></div>
      </div>${msg}
      <div class="wsi-meta"><span>Ref: <strong>${w.refId}</strong></span><span>${w.submittedAt||""}</span></div>
    </div>`;
  }).join("");
}

// ── RENDER ADMIN WIRES ───────────────────────────────────────
function renderAdminWires(wires) {
  const el=$("adminWireList"); if(!el) return;
  if(!wires?.length){el.innerHTML=`<div class="tx-loading">No wire transfer requests yet.</div>`;return;}
  el.innerHTML=wires.map(w=>{
    const pend=w.status==="pending", dom=w.wireType==="domestic";
    const stCls=w.status==="approved"||w.status==="processing"?"processing":w.status;
    return`<div class="admin-wire-item ${w.status}">
      <div class="awi-header">
        <div class="awi-title-row">
          <span class="awi-ref">${w.refId}</span>
          <span class="wsi-type-badge ${w.wireType}">${dom?"🏦 Domestic":"🌍 International"}</span>
          <span class="wsi-status-tag ${stCls}">${stCls==="processing"?"PROCESSING":w.status.toUpperCase()}</span>
        </div>
        <div class="awi-submitted">By <strong>${w.submittedBy}</strong> · ${w.submittedAt||""}</div>
      </div>
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
        <button class="btn-reject"  onclick="handleWire('${w.id||w.refId}','rejected')">✗ Decline</button>
      </div>`:`<div class="awi-decided">${stCls==="processing"?"🔄 Approved — Now Processing":"❌ Declined"} · ${w.decidedAt||""}</div>`}
    </div>`;
  }).join("");
}

// ── APPROVE / REJECT WIRE ────────────────────────────────────
window.handleWire = async function(id, action) {
  const decidedAt=new Date().toLocaleString("en-GB");
  if(isDemoMode){
    const i=D.wires.findIndex(w=>w.id===id||w.refId===id);
    if(i!==-1){D.wires[i].status=action;D.wires[i].decidedAt=decidedAt;}
    renderAdminWires([...D.wires]); renderUserWires([...D.wires]);
    demoLog("admin","admin",`Wire ${id} ${action==="approved"?"APPROVED":"DECLINED"}`); return;
  }
  try {
    await update(ref(db,`wires/${id}`),{status:action,decidedAt});
    await log("admin","admin",`Wire ${id} ${action==="approved"?"APPROVED":"DECLINED"}`);
  } catch(e){console.error(e);}
};

// ── RENDER TX LIST ───────────────────────────────────────────
function renderTx(cid, txs) {
  const el=$(cid); if(!el) return;
  if(!txs?.length){el.innerHTML=`<div class="tx-loading">No transactions yet.</div>`;return;}
  el.innerHTML=txs.map(tx=>`
    <div class="tx-item">
      <div class="tx-av">${tx.icon||"👤"}</div>
      <div class="tx-body"><div class="tx-name">${tx.name}</div><div class="tx-desc">${tx.desc}</div></div>
      <div class="tx-right">
        <div class="tx-amt ${tx.type==="cr"?"cr":"dr"}">${tx.amount>0?"+":""}${fmtMoney(tx.amount)}</div>
        <div class="tx-date">${tx.date} ${tx.time}</div>
      </div>
    </div>`).join("");
}

function renderLogs(logs) {
  const el=$("adminLogList"); if(!el) return;
  if(!logs?.length){el.innerHTML=`<div class="tx-loading">No activity yet.</div>`;return;}
  el.innerHTML=logs.map(l=>`
    <div class="log-item">
      <span class="log-tag ${l.type}">${labelFor(l.type)}</span>
      <span class="log-who">${l.username}</span>
      <span class="log-detail">${l.detail}</span>
      <span class="log-time">${l.timeStr||""}</span>
    </div>`).join("");
}
function labelFor(t){return{in:"LOGIN",out:"LOGOUT",bal:"BALANCE",fail:"FAILED",wire:"WIRE",admin:"ADMIN"}[t]||(t||"").toUpperCase();}

// ── LOGS ─────────────────────────────────────────────────────
async function log(type, username, detail) {
  const e={type,username,detail,ts:isDemoMode?Date.now():serverTimestamp(),timeStr:new Date().toLocaleString("en-GB")};
  if(isDemoMode){D.logs.push(e);return;}
  try{await push(ref(db,"logs"),e);}catch(e){console.warn(e);}
}
function demoLog(type,username,detail){
  D.logs.push({type,username,detail,ts:Date.now(),timeStr:new Date().toLocaleString("en-GB")});
  if(currentUser?.role==="admin") renderLogs(D.logs.slice().reverse());
}

// ── MODALS (non-wire) ────────────────────────────────────────
window.openSupportModal     = ()=>$("supportModal").classList.remove("hidden");
window.closeModal           = (id,e)=>{if(e.target===$(id))$(id).classList.add("hidden");};
window.closeModalDirect     = id=>$(id).classList.add("hidden");

// ── SIDE MENU ────────────────────────────────────────────────
window.toggleMenu = function() {
  const m=$("sideMenu"); if(!m) return;
  m.classList.toggle("open");
};
window.openPage = function(page) {
  $("sideMenu")?.classList.remove("open");
  // hide all sub-pages, show requested
  ["pageAccountActivity","pageEstatements","pageMessages","pageDirectDeposit",
   "pageCardServices","pageSettings"].forEach(id=>{
    const el=$(id); if(el) el.classList.add("hidden");
  });
  const target=$(page); if(target) target.classList.remove("hidden");
  target?.scrollIntoView({behavior:"smooth",block:"start"});
};

// ── THEME ─────────────────────────────────────────────────────
function applyTheme(t){
  document.documentElement.setAttribute("data-theme",t);
  const ic=t==="dark"?"☀️":"🌙";
  ["themeIconUser","themeIconAdmin"].forEach(id=>{const e=$(id);if(e)e.textContent=ic;});
  localStorage.setItem("jyske_theme",t);
}
window.toggleTheme=()=>{const c=document.documentElement.getAttribute("data-theme");applyTheme(c==="dark"?"light":"dark");};

// ── UTILS ─────────────────────────────────────────────────────
function showPage(n){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(n+"Page").classList.add("active");window.scrollTo(0,0);}
function hideLoader(){const l=$("loadingScreen");l.classList.add("fade-out");setTimeout(()=>l.style.display="none",520);}
function showAlert(el,msg,type){el.textContent=msg;el.className=type==="success"?"alert alert-success":"alert alert-error";el.classList.remove("hidden");if(type==="success")setTimeout(()=>el.classList.add("hidden"),4500);}
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
function showSetupBanner(){const b=document.createElement("div");b.className="setup-banner";b.innerHTML=`⚠️ <strong>Firebase not configured.</strong> Demo mode active.`;document.querySelector(".login-wrap").insertBefore(b,document.querySelector(".login-card"));}
window.scrollToSection=id=>$(id)?.scrollIntoView({behavior:"smooth",block:"start"});
window.togglePw=()=>{const i=$("loginPass");i.type=i.type==="password"?"text":"password";};

// ── SUB-PAGES ────────────────────────────────────────────────
window.openPage = function(page) {
  // Close menu
  $("sideMenu")?.classList.remove("open");
  $("menuOverlay")?.classList.add("hidden");

  if (page === "pageHome") {
    // Hide all sub-pages, scroll to top
    ["pageAccountActivity","pageEstatements","pageMessages",
     "pageDirectDeposit","pageCardServices","pageSettings"]
      .forEach(id => $(id)?.classList.add("hidden"));
    window.scrollTo(0,0);
    // Update active nav item
    document.querySelectorAll(".side-nav-item").forEach(b => b.classList.remove("active"));
    document.querySelector(".side-nav-item")?.classList.add("active");
    return;
  }

  // Show the selected sub-page
  const target = $(page);
  if (!target) return;
  target.classList.remove("hidden");
  target.scrollIntoView({behavior:"smooth", block:"start"});

  // If account activity, populate with transactions
  if (page === "pageAccountActivity") {
    if (isDemoMode) {
      renderTx("activityTxList", sorted(D.txs));
    } else if (db) {
      get(ref(db,"transactions")).then(snap => {
        const a=[]; snap.forEach(c=>a.push({id:c.key,...c.val()}));
        renderTx("activityTxList", sorted(a));
      });
    }
  }

  // Update active nav
  document.querySelectorAll(".side-nav-item").forEach(b => b.classList.remove("active"));
  event?.target?.closest(".side-nav-item")?.classList.add("active");
};

window.closePage = function(id) {
  $(id)?.classList.add("hidden");
};

window.toggleMenu = function() {
  const m=$("sideMenu"), o=$("menuOverlay");
  if(!m) return;
  const opening = !m.classList.contains("open");
  m.classList.toggle("open", opening);
  o?.classList.toggle("hidden", !opening);
};

window.toggleThemeFromSettings = function() {
  const cur = document.documentElement.getAttribute("data-theme");
  const newTheme = cur==="dark"?"light":"dark";
  applyTheme(newTheme);
  const btn=$("darkModeToggle");
  if(btn) btn.textContent = newTheme==="dark"?"ON":"OFF";
};
