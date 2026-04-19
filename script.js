
// ── Firebase (Auth + Firestore) ───────────────────────────────────────────────
firebase.initializeApp({
  apiKey:            "AIzaSyA1XjyGGcTR-uIV6NHQZn9hWvWuaxglYkg",
  authDomain:        "ncs-peshawar.firebaseapp.com",
  projectId:         "ncs-peshawar",
  storageBucket:     "ncs-peshawar.firebasestorage.app",
  messagingSenderId: "704473416253",
  appId:             "1:704473416253:web:856efdad56803b583d2054"
});
const auth = firebase.auth();
const db   = firebase.firestore();
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

const C = {
  quizzes:  () => db.collection('quizzes'),
  results:  () => db.collection('results'),
  profiles: () => db.collection('profiles')
};

const S = {
  user:null, profile:null, editId:null,
  quiz:null, participant:null,
  qi:0, answers:{}, timer:null, tLeft:10,
  matchState: { selectedLeft: null, matched: {} }
};
const CIRC = 2 * Math.PI * 21;

// ── UI Helpers ────────────────────────────────────────────────────────────────
function goTo(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}
function show(id){document.getElementById(id).classList.remove('hidden');}
function hide(id){document.getElementById(id).classList.add('hidden');}
function setTxt(id,t){const el=document.getElementById(id);if(el)el.textContent=t;}
function toast(msg,type='success'){
  const el=document.getElementById('toast');
  el.textContent=(type==='success'?'✓ ':type==='error'?'✕ ':'ℹ ')+msg;
  el.className=`toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(window._tt);
  window._tt=setTimeout(()=>el.classList.add('hidden'),3500);
}
function showErr(id,msg){
  const el=document.getElementById(id);if(!el)return;
  el.textContent=msg;
  msg?el.classList.remove('hidden'):el.classList.add('hidden');
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function genCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join('');}
function busy(id,on){
  const b=document.getElementById(id);if(!b)return;
  b.disabled=on;const k='data-orig';
  if(on){b.setAttribute(k,b.textContent);b.textContent='Please wait...';}
  else{const o=b.getAttribute(k);if(o)b.textContent=o;}
}
function togglePw(id,btn){
  const el=document.getElementById(id);
  el.type=el.type==='password'?'text':'password';
  btn.textContent=el.type==='password'?'👁':'🙈';
}
function showModal(html){
  document.getElementById('modal-root').innerHTML=
    `<div class="mover" onclick="if(event.target.classList.contains('mover'))closeModal()"><div class="modal">${html}</div></div>`;
}
function closeModal(){document.getElementById('modal-root').innerHTML='';}
function fbMsg(code){
  return({'auth/email-already-in-use':'User already exists. Please sign in.','auth/invalid-email':'Please enter a valid email address.','auth/weak-password':'Password must be at least 6 characters.','auth/user-not-found':'Email or password is incorrect.','auth/wrong-password':'Email or password is incorrect.','auth/invalid-credential':'Email or password is incorrect.','auth/too-many-requests':'Too many attempts. Please wait a few minutes.','auth/network-request-failed':'Network error. Check your internet connection.','auth/operation-not-allowed':'Email/password sign-in is not enabled in Firebase Console.'})[code]||'Email or password is incorrect.';
}

// ── Timer / Points Controls ───────────────────────────────────────────────────
// NCS AI — uses script-questions.js bank (10k+ questions)
function _ncsAI_local(topic, qtype, count){
  if(typeof NCS_getQuestions === 'function'){
    return NCS_getQuestions(topic, qtype, count);
  }
  // Fallback if script-questions.js not loaded
  return [];
}
function updTimerVal(v){setTxt('timer-val-disp',v+' sec');}
function updDefPoints(v){setTxt('defpoints-val-disp',v+' pt'+(parseInt(v)>1?'s':''));}

// ── Auth ──────────────────────────────────────────────────────────────────────
function authTab(t){
  document.getElementById('atab-li').classList.toggle('active',t==='login');
  document.getElementById('atab-reg').classList.toggle('active',t==='register');
  t==='login'?(show('form-login'),hide('form-register')):(hide('form-login'),show('form-register'));
  showErr('li-err','');showErr('reg-err','');
}
async function doRegister(){
  const name=document.getElementById('reg-name').value.trim();
  const email=document.getElementById('reg-email').value.trim();
  const pass=document.getElementById('reg-pass').value;
  showErr('reg-err','');
  if(!name){showErr('reg-err','Please enter your full name.');return;}
  if(!email){showErr('reg-err','Please enter your email address.');return;}
  if(!pass||pass.length<6){showErr('reg-err','Password must be at least 6 characters.');return;}
  busy('reg-btn',true);
  try{
    const cred=await auth.createUserWithEmailAndPassword(email,pass);
    await cred.user.updateProfile({displayName:name});
    await C.profiles().doc(cred.user.uid).set({uid:cred.user.uid,name,email:email.toLowerCase(),createdAt:Date.now()});
  }catch(e){showErr('reg-err',fbMsg(e.code));busy('reg-btn',false);}
}
async function doLogin(){
  const email=document.getElementById('li-email').value.trim();
  const pass=document.getElementById('li-pass').value;
  showErr('li-err','');
  if(!email){showErr('li-err','Please enter your email.');return;}
  if(!pass){showErr('li-err','Please enter your password.');return;}
  busy('li-btn',true);
  try{await auth.signInWithEmailAndPassword(email,pass);}
  catch(e){showErr('li-err',fbMsg(e.code));busy('li-btn',false);}
}
function adminLogout(){auth.signOut();S.user=null;S.profile=null;goTo('screen-landing');}

let _authReady=false;
auth.onAuthStateChanged(async user=>{
  if(user){
    S.user=user;
    try{
      const doc=await C.profiles().doc(user.uid).get();
      S.profile=doc.exists?doc.data():{name:user.displayName||user.email,uid:user.uid,email:user.email};
    }catch(e){S.profile={name:user.displayName||user.email,uid:user.uid,email:user.email};}
    const cur=document.querySelector('.screen.active')?.id;
    if(cur==='screen-auth'||cur==='screen-init'){
      setTxt('admin-badge',S.profile.name);
      setTxt('admin-greeting',`Welcome, ${S.profile.name}`);
      goTo('screen-admin');renderQuizList();
    }
    busy('reg-btn',false);busy('li-btn',false);
  }else{
    const cur=document.querySelector('.screen.active')?.id;
    if(cur==='screen-admin'||cur==='screen-editor'||cur==='screen-init')goTo('screen-landing');
  }
  if(!_authReady){_authReady=true;}
});
setTimeout(()=>{if(!_authReady)goTo('screen-landing');},4000);

// ── Quiz List ─────────────────────────────────────────────────────────────────
async function renderQuizList(){
  if(!S.user)return;
  const c=document.getElementById('quiz-list');
  c.innerHTML='<div class="spinner"></div>';
  try{
    const snap=await C.quizzes().where('adminUid','==',S.user.uid).get();
    if(snap.empty){c.innerHTML=`<div style="text-align:center;padding:2.5rem;color:var(--text3)"><div style="font-size:2.3rem;margin-bottom:.65rem">📋</div><p>No quizzes yet. Create your first!</p></div>`;return;}
    const quizzes=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const counts={};
    await Promise.all(quizzes.map(async q=>{try{const rs=await C.results().where('quizId','==',q.id).get();counts[q.id]=rs.size;}catch(e){counts[q.id]=0;}}));
    c.innerHTML=quizzes.map(q=>{
      const badge=q.active?`<span class="badge bg">🟢 Live</span>`:`<span class="badge ba">Draft</span>`;
      const timerSec=q.timerSec||10;
      const totalPts=(q.questions||[]).reduce((s,qu)=>s+(qu.points||1),0);
      return`<div class="qi">
        <div class="qi-info">
          <div class="qi-title">${esc(q.title)}</div>
          <div class="qi-meta">Code: ${q.code} · ${(q.questions||[]).length} Qs · ${totalPts} pts · ${counts[q.id]||0} submissions · ⏱ ${timerSec}s/Q</div>
        </div>
        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
          ${badge}
          <button class="btn btn-g btn-sm btn-icon" onclick="editQuiz('${q.id}')">✏</button>
          <button class="btn btn-g btn-sm btn-icon" onclick="showCode('${q.code}','${esc(q.title)}')">🔑</button>
          <button class="${q.active?'btn btn-d':'btn btn-s'} btn-sm" onclick="toggleActive('${q.id}',${!q.active})">${q.active?'Stop':'Start'}</button>
          <button class="btn btn-d btn-sm btn-icon" onclick="delQuiz('${q.id}')">🗑</button>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    c.innerHTML=`<div style="padding:1rem;text-align:center"><p style="color:var(--red);margin-bottom:.5rem">⚠ ${e.message||'Could not load quizzes.'}</p><button class="btn btn-g btn-sm" onclick="renderQuizList()">Retry</button></div>`;
  }
}

function showCode(code,title){
  showModal(`<div class="mh"><h3>Quiz Code</h3><button class="btn btn-g btn-sm btn-icon" onclick="closeModal()">✕</button></div>
    <p style="color:var(--text2);font-size:.88rem;margin-bottom:.35rem">${esc(title)}</p>
    <div class="cdisp">${code}</div>
    <p style="color:var(--text3);font-size:.78rem;text-align:center;margin-bottom:1rem">Share this code with participants anywhere in the world</p>
    <button class="btn btn-p btn-sm" onclick="navigator.clipboard?.writeText('${code}').then(()=>{toast('Copied!');closeModal()}).catch(()=>toast('Code: ${code}','info'))" style="width:100%;justify-content:center">📋 Copy Code</button>`);
}

async function toggleActive(id,val){
  try{await C.quizzes().doc(id).update({active:val});toast(val?'🟢 Quiz is now Live!':'Quiz stopped');renderQuizList();}
  catch(e){toast('Error — check connection','error');}
}

async function delQuiz(id){
  if(!confirm('Delete this quiz and all results?'))return;
  try{
    await C.quizzes().doc(id).delete();
    const rs=await C.results().where('quizId','==',id).get();
    if(!rs.empty){const b=db.batch();rs.forEach(d=>b.delete(d.ref));await b.commit();}
    toast('Deleted');renderQuizList();
  }catch(e){toast('Error deleting','error');}
}

// ── Editor ────────────────────────────────────────────────────────────────────
function openCreate(){
  S.editId=null;
  setTxt('editor-title','Create Quiz');
  document.getElementById('eq-title').value='';
  document.getElementById('eq-topic').value='';
  document.getElementById('eq-timer').value=10;
  updTimerVal(10);
  document.getElementById('eq-defpoints').value=1;
  updDefPoints(1);
  renderQBuilder([]);
  goTo('screen-editor');
}

async function editQuiz(id){
  try{
    const doc=await C.quizzes().doc(id).get();
    if(!doc.exists){toast('Quiz not found','error');return;}
    const q=doc.data();
    S.editId=id;
    setTxt('editor-title','Edit Quiz');
    document.getElementById('eq-title').value=q.title;
    document.getElementById('eq-topic').value=q.topic||'';
    const timer=q.timerSec||10;
    document.getElementById('eq-timer').value=timer;
    updTimerVal(timer);
    // Infer most common point value for the default slider
    const qs=q.questions||[];
    const commonPts=qs.length?Math.round(qs.reduce((s,qu)=>s+(qu.points||1),0)/qs.length):1;
    document.getElementById('eq-defpoints').value=commonPts;
    updDefPoints(commonPts);
    renderQBuilder(qs);
    goTo('screen-editor');
  }catch(e){toast('Error loading quiz','error');}
}

function renderQBuilder(qs){
  const c=document.getElementById('q-builder');
  if(!qs.length){
    c.innerHTML=`<div style="text-align:center;padding:1.75rem;color:var(--text3);border:1px dashed var(--border);border-radius:var(--r)"><p>No questions yet. Use AI or add manually below.</p></div>`;
    return;
  }
  c.innerHTML=qs.map((q,i)=>renderQCard(q,i)).join('');
}

function renderQCard(q,i){
  const type=q.type||'mcq';
  let inner='';
  if(type==='mcq'){
    const L=['A','B','C','D'];
    const opts=(q.options||['','','','']).map((o,j)=>`
      <div class="oi ${q.correct===j?'ok':''}" id="oi${i}${j}" onclick="setCorrect(${i},${j})">
        <input type="radio" name="cr${i}" ${q.correct===j?'checked':''}/>
        <span style="font-size:.7rem;font-weight:500;color:var(--text2);font-family:var(--font-m);min-width:14px">${L[j]}</span>
        <input type="text" placeholder="Option ${L[j]}" value="${esc(o)}" onclick="event.stopPropagation()" style="flex:1"/>
      </div>`).join('');
    inner=`<div style="font-size:.7rem;color:var(--text2);margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.04em;font-weight:500">Options — click to mark correct</div><div class="og">${opts}</div>`;
  }else if(type==='truefalse'){
    const opts=['True','False'].map((o,j)=>`
      <div class="oi ${q.correct===j?'ok':''}" id="oi${i}${j}" onclick="setCorrect(${i},${j})" style="cursor:pointer">
        <input type="radio" name="cr${i}" ${q.correct===j?'checked':''}/>
        <span style="font-size:.88rem;font-weight:500">${o}</span>
      </div>`).join('');
    inner=`<div style="font-size:.7rem;color:var(--text2);margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.04em;font-weight:500">Select correct answer</div><div class="og">${opts}</div>`;
  }else if(type==='fill'){
    inner=`<div class="iw" style="margin:.5rem 0 0"><label>Correct Answer</label>
      <input type="text" class="fill-ans-input" placeholder="Type the correct answer..." value="${esc(q.answer||'')}"/></div>`;
  }else if(type==='match'){
    const pairs=(q.pairs||[{left:'',right:''}]);
    const pairsHtml=pairs.map((p,pi)=>`
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:.4rem;align-items:center;margin-bottom:.4rem">
        <input type="text" class="match-left" placeholder="Item ${pi+1}" value="${esc(p.left||'')}" style="background:var(--surface3);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:.42rem .7rem;font-size:.83rem;outline:none;width:100%"/>
        <span style="color:var(--text3);font-size:.8rem">↔</span>
        <input type="text" class="match-right" placeholder="Match ${pi+1}" value="${esc(p.right||'')}" style="background:var(--surface3);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:.42rem .7rem;font-size:.83rem;outline:none;width:100%"/>
      </div>`).join('');
    inner=`<div style="font-size:.7rem;color:var(--text2);margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.04em;font-weight:500">Matching Pairs</div>
      <div id="pairs-${i}">${pairsHtml}</div>
      <button class="btn btn-g btn-sm" style="margin-top:.4rem" onclick="addPair(${i})">+ Add Pair</button>`;
  }
  const typeLabel={mcq:'MCQ',truefalse:'True/False',fill:'Fill Blank',match:'Match Pairs'}[type];
  const pts=q.points||1;
  const ptsOpts=[1,2,3,4,5,6,7,8,9,10].map(v=>`<option value="${v}"${pts===v?' selected':''}>${v} pt${v>1?'s':''}</option>`).join('');
  return`<div class="qcard" id="qc${i}" data-type="${type}">
    <span class="qnum">Q${i+1}</span>
    <span class="qtype-badge">${typeLabel}</span>
    <div class="iw" style="margin:0 0 .5rem;padding-right:5rem"><label>Question ${i+1}</label>
      <textarea rows="2" placeholder="Type your question here...">${esc(q.text||'')}</textarea></div>
    ${inner}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.75rem;flex-wrap:wrap;gap:.5rem">
      <div style="display:flex;align-items:center;gap:.55rem">
        <span style="font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;font-weight:500">⭐ Points:</span>
        <select class="pts-select" style="background:var(--surface3);border:1px solid var(--border2);border-radius:7px;color:var(--accent3);font-family:var(--font-m);font-size:.8rem;font-weight:600;padding:.25rem .55rem;outline:none;cursor:pointer">${ptsOpts}</select>
      </div>
      <button class="btn btn-d btn-sm" onclick="removeQ(${i})">Remove</button>
    </div>
  </div>`;
}

function addPair(qi){
  const qs=getQs();
  if(!qs[qi])return;
  qs[qi].pairs=(qs[qi].pairs||[]);
  qs[qi].pairs.push({left:'',right:''});
  renderQBuilder(qs);
  setTimeout(()=>document.getElementById(`qc${qi}`)?.scrollIntoView({behavior:'smooth'}),80);
}

function getQs(){
  return Array.from(document.querySelectorAll('.qcard')).map(card=>{
    const type=card.dataset.type||'mcq';
    const text=card.querySelector('textarea').value.trim();
    const points=parseInt(card.querySelector('.pts-select')?.value||'1')||1;
    if(type==='mcq'){
      const opts=Array.from(card.querySelectorAll('.oi input[type=text]')).map(x=>x.value.trim());
      let correct=0;card.querySelectorAll('input[type=radio]').forEach((r,j)=>{if(r.checked)correct=j;});
      return{type,text,options:opts,correct,points};
    }else if(type==='truefalse'){
      let correct=0;card.querySelectorAll('input[type=radio]').forEach((r,j)=>{if(r.checked)correct=j;});
      return{type,text,options:['True','False'],correct,points};
    }else if(type==='fill'){
      const answer=card.querySelector('.fill-ans-input')?.value.trim()||'';
      return{type,text,answer,points};
    }else if(type==='match'){
      const lefts=Array.from(card.querySelectorAll('.match-left')).map(x=>x.value.trim());
      const rights=Array.from(card.querySelectorAll('.match-right')).map(x=>x.value.trim());
      const pairs=lefts.map((l,i)=>({left:l,right:rights[i]||''}));
      return{type,text,pairs,points};
    }
    return{type,text,points};
  });
}

function setCorrect(i,j){
  const card=document.getElementById(`qc${i}`);if(!card)return;
  card.querySelectorAll('.oi').forEach((el,k)=>{
    el.classList.toggle('ok',k===j);
    el.querySelector('input[type=radio]').checked=k===j;
  });
}
function removeQ(i){const q=getQs();q.splice(i,1);renderQBuilder(q);}
function addQ(type='mcq'){
  const q=getQs();
  if(q.length>=50){toast('Max 50 questions','error');return;}
  const defPts=parseInt(document.getElementById('eq-defpoints')?.value||'1')||1;
  const newQ={type,text:'',points:defPts};
  if(type==='mcq')Object.assign(newQ,{options:['','','',''],correct:0});
  else if(type==='truefalse')Object.assign(newQ,{options:['True','False'],correct:0});
  else if(type==='fill')Object.assign(newQ,{answer:''});
  else if(type==='match')Object.assign(newQ,{pairs:[{left:'',right:''},{left:'',right:''}]});
  q.push(newQ);
  renderQBuilder(q);
  setTimeout(()=>document.querySelectorAll('.qcard')[q.length-1]?.scrollIntoView({behavior:'smooth'}),80);
}

async function aiGen(){
  const topic=document.getElementById('eq-topic').value.trim();
  const qtype=document.getElementById('ai-qtype').value;
  const count=parseInt(document.getElementById('ai-count')?.value||'15');
  const defPts=parseInt(document.getElementById('eq-defpoints')?.value||'1')||1;
  if(!topic){toast('Enter a topic first','error');return;}
  show('ai-load');
  document.getElementById('ai-btn').disabled=true;
  document.getElementById('q-builder').innerHTML='';
  try{
    const qs=_ncsAI_local(topic,qtype,count);
    if(!Array.isArray(qs)||!qs.length)throw new Error('No questions generated');
    const typed=qs.map(q=>({...q,type:q.type||qtype,points:defPts}));
    renderQBuilder(typed.slice(0,50));
    toast(`🤖 NCS AI generated ${typed.slice(0,50).length} questions!`);
  }catch(e){
    console.error('NCS AI error:',e);
    const msg=e.message||'Unknown error';
    toast(`NCS AI: ${msg}`, 'error');
    renderQBuilder([]);
  }
  hide('ai-load');
  document.getElementById('ai-btn').disabled=false;
}

async function saveQuiz(){
  if(!S.user){toast('Not logged in','error');return;}
  const title=document.getElementById('eq-title').value.trim();
  const topic=document.getElementById('eq-topic').value.trim();
  const timerSec=parseInt(document.getElementById('eq-timer').value)||10;
  if(!title){toast('Enter a quiz title','error');return;}
  const questions=getQs().filter(q=>{
    if(!q.text)return false;
    if(q.type==='mcq')return q.options.every(o=>o);
    if(q.type==='truefalse')return true;
    if(q.type==='fill')return q.answer;
    if(q.type==='match')return q.pairs&&q.pairs.length>=2&&q.pairs.every(p=>p.left&&p.right);
    return true;
  });
  if(!questions.length){toast('Add at least one complete question','error');return;}
  busy('save-btn',true);
  try{
    if(S.editId){
      await C.quizzes().doc(S.editId).update({title,topic,questions,timerSec,updatedAt:Date.now()});
      toast('Quiz updated!');S.editId=null;
    }else{
      let code,tries=0;
      do{code=genCode();const sn=await C.quizzes().where('code','==',code).get();if(sn.empty)break;tries++;}while(tries<5);
      await C.quizzes().add({title,topic,code,questions,timerSec,adminUid:S.user.uid,adminName:S.profile?.name||S.user.email,active:false,createdAt:Date.now(),updatedAt:Date.now()});
      toast('Quiz saved! Hit Start to make it live.');
    }
    goTo('screen-admin');renderQuizList();
  }catch(e){toast(`Save failed: ${e.message||'Check connection'}`,'error');}
  busy('save-btn',false);
}

// ── Join & Take Quiz ──────────────────────────────────────────────────────────
async function joinQuiz(){
  const name=document.getElementById('p-name').value.trim();
  const code=document.getElementById('p-code').value.trim().toUpperCase();
  showErr('join-err','');
  if(!name){showErr('join-err','Please enter your name.');return;}
  if(code.length<5){showErr('join-err','Enter a valid 6-character quiz code.');return;}
  busy('join-btn',true);
  try{
    const snap=await C.quizzes().where('code','==',code).get();
    if(snap.empty){showErr('join-err',`Code "${code}" not found. Check with your instructor.`);busy('join-btn',false);return;}
    const quiz={id:snap.docs[0].id,...snap.docs[0].data()};
    if(!quiz.active){showErr('join-err','Quiz not active yet. Ask your instructor to start it.');busy('join-btn',false);return;}
    if(!quiz.questions?.length){showErr('join-err','Quiz has no questions yet.');busy('join-btn',false);return;}
    S.quiz=quiz;
    S.participant={name,id:'p'+Date.now()+Math.random().toString(36).slice(2,5)};
    S.qi=0;S.answers={};
    setTxt('q-plabel',name);setTxt('s-name',name);
    document.getElementById('p-code').value='';
    document.getElementById('p-name').value='';
    // Show music player when taking quiz
    document.getElementById('music-player').classList.remove('hidden');
    goTo('screen-quiz');renderQ();
  }catch(e){showErr('join-err','Connection error. Check internet and try again.');}
  busy('join-btn',false);
}

function renderQ(){
  const q=S.quiz.questions[S.qi];
  const total=S.quiz.questions.length;
  const timerSec=S.quiz.timerSec||10;
  setTxt('q-num',S.qi+1);setTxt('q-counter',`Q ${S.qi+1}/${total}`);
  setTxt('qtext',q.text);hide('next-btn');
  // type label
  const typeLabels={mcq:'Multiple Choice',truefalse:'True / False',fill:'Fill in the Blank',match:'Match the Pairs'};
  const pts=q.points||1;
  const typeLabelEl=document.getElementById('q-type-label');
  if(typeLabelEl){
    typeLabelEl.querySelector('span:first-child').textContent=typeLabels[q.type||'mcq']||'Multiple Choice';
  }
  // show points badge
  const ptsBadge=document.getElementById('q-pts-badge');
  if(ptsBadge){ptsBadge.textContent=`⭐ ${pts} pt${pts>1?'s':''}`;}
  // dots
  document.getElementById('pdots').innerHTML=S.quiz.questions.map((_,j)=>{
    let c='dot';
    if(j<S.qi&&S.answers[j]!==undefined)c+=' ans';
    else if(j<S.qi)c+=' skip';
    else if(j===S.qi)c+=' cur';
    return`<div class="${c}"></div>`;
  }).join('');
  // render question type
  const type=q.type||'mcq';
  S.matchState={selectedLeft:null,matched:{}};
  if(type==='mcq'||type==='truefalse'){
    const L=['A','B','C','D'];
    document.getElementById('qopts').innerHTML=q.options.map((o,j)=>
      `<div class="qopt" id="qo${j}" onclick="selAns(${j})">
        <div class="oletter">${type==='truefalse'?(j===0?'T':'F'):L[j]}</div>
        <div style="font-size:.9rem;color:var(--text)">${esc(o)}</div>
      </div>`).join('');
  }else if(type==='fill'){
    document.getElementById('qopts').innerHTML=`
      <input type="text" class="fill-input" id="fill-inp" placeholder="Type your answer here..." autocomplete="off"
        onkeypress="if(event.key==='Enter')submitFill()"/>
      <button class="btn btn-p btn-sm" style="margin-top:.75rem" onclick="submitFill()">Submit Answer</button>`;
    setTimeout(()=>document.getElementById('fill-inp')?.focus(),100);
  }else if(type==='match'){
    // shuffle right column
    const pairs=q.pairs||[];
    const rights=[...pairs.map(p=>p.right)].sort(()=>Math.random()-.5);
    window._matchPairs=pairs;window._matchRights=rights;
    let html=`<div class="match-wrap">
      <div class="match-col"><div class="match-label">Items</div>${pairs.map((p,i)=>`<div class="match-item" id="ml${i}" onclick="selectMatchLeft(${i})">${esc(p.left)}</div>`).join('')}</div>
      <div class="match-col"><div class="match-label">Match</div>${rights.map((r,i)=>`<div class="match-item" id="mr${i}" onclick="selectMatchRight(${i})">${esc(r)}</div>`).join('')}</div>
    </div>`;
    document.getElementById('qopts').innerHTML=html;
  }
  startTimer(timerSec);
}

// Fill blank submit
function submitFill(){
  const inp=document.getElementById('fill-inp');
  if(!inp||inp.disabled)return;
  const val=inp.value.trim();
  if(!val)return;
  clearInterval(S.timer);
  S.answers[S.qi]=val;
  const q=S.quiz.questions[S.qi];
  const correct=val.toLowerCase()===String(q.answer||'').toLowerCase();
  inp.classList.add(correct?'correct':'wrong');
  inp.disabled=true;
  show('next-btn');
}

// Match pairs logic
function selectMatchLeft(i){
  if(S.matchState.matched[i]!==undefined)return;
  S.matchState.selectedLeft=i;
  document.querySelectorAll('[id^="ml"]').forEach((el,k)=>{
    el.classList.toggle('selected',k===i&&S.matchState.matched[k]===undefined);
  });
}
function selectMatchRight(ri){
  const li=S.matchState.selectedLeft;
  if(li===null||li===undefined)return;
  const rights=window._matchRights;
  const pairs=window._matchPairs;
  const rightVal=rights[ri];
  const correctRight=pairs[li].right;
  const isCorrect=rightVal===correctRight;
  if(isCorrect){
    S.matchState.matched[li]=ri;
    document.getElementById('ml'+li).classList.remove('selected');
    document.getElementById('ml'+li).classList.add('matched');
    document.getElementById('mr'+ri).classList.add('matched');
    S.matchState.selectedLeft=null;
    // check if all matched
    if(Object.keys(S.matchState.matched).length===pairs.length){
      clearInterval(S.timer);
      S.answers[S.qi]=S.matchState.matched;
      setTimeout(()=>show('next-btn'),300);
    }
  }else{
    const rl=document.getElementById('ml'+li);
    const rr=document.getElementById('mr'+ri);
    rl.classList.add('wrong-match');rr.classList.add('wrong-match');
    setTimeout(()=>{rl.classList.remove('wrong-match','selected');rr.classList.remove('wrong-match');S.matchState.selectedLeft=null;},600);
  }
}

function startTimer(sec){
  clearInterval(S.timer);S.tLeft=sec||10;updTimer(S.tLeft,sec);
  S.timer=setInterval(()=>{S.tLeft--;updTimer(S.tLeft,sec);if(S.tLeft<=0){clearInterval(S.timer);lockOpts();setTimeout(nextQ,700);}},1000);
}
function updTimer(t,total){
  const tc=document.getElementById('tc'),td=document.getElementById('tdisp');
  const tot=total||S.quiz?.timerSec||10;
  if(tc){tc.style.strokeDashoffset=CIRC*(1-t/tot);tc.style.stroke=t<=3?'var(--red)':t<=(tot*0.4)?'var(--amber)':'var(--accent)';}
  if(td){td.textContent=t;td.className='tnum'+(t<=3?' danger':t<=(tot*0.4)?' warn':'');}
}
function selAns(j){
  if(S.answers[S.qi]!==undefined)return;
  clearInterval(S.timer);S.answers[S.qi]=j;
  document.querySelectorAll('.qopt').forEach((el,k)=>{el.classList.add('disabled');if(k===j)el.classList.add('sel');});
  show('next-btn');
}
function lockOpts(){
  document.querySelectorAll('.qopt').forEach(el=>el.classList.add('disabled'));
  const fillInp=document.getElementById('fill-inp');
  if(fillInp)fillInp.disabled=true;
}
function nextQ(){clearInterval(S.timer);if(S.qi<S.quiz.questions.length-1){S.qi++;renderQ();}else submitQuiz();}

async function submitQuiz(){
  let score=0;
  let maxScore=0;
  S.quiz.questions.forEach((q,i)=>{
    const pts=q.points||1;
    maxScore+=pts;
    const ans=S.answers[i];
    if(ans===undefined)return;
    const type=q.type||'mcq';
    let correct=false;
    if(type==='mcq'||type==='truefalse')correct=(ans===q.correct);
    else if(type==='fill')correct=(String(ans).toLowerCase()===String(q.answer||'').toLowerCase());
    else if(type==='match')correct=(typeof ans==='object'&&Object.keys(ans).length===(q.pairs||[]).length);
    if(correct)score+=pts;
  });
  const total=S.quiz.questions.length;
  const pct=maxScore>0?Math.round((score/maxScore)*100):0;
  setTxt('s-score-big',`${score}/${maxScore} pts`);
  setTxt('s-score-pct',`${pct}% · ${total} questions`);
  try{
    await C.results().add({
      participantId:S.participant.id,participantName:S.participant.name,
      quizId:S.quiz.id,quizTitle:S.quiz.title,quizCode:S.quiz.code,
      adminUid:S.quiz.adminUid,score,maxScore,total,pct,
      answers:S.answers,submittedAt:Date.now()
    });
  }catch(e){console.warn('Result save error:',e.code);}
  goTo('screen-success');
}

// ── Results ───────────────────────────────────────────────────────────────────
async function renderResults(){
  if(!S.user)return;
  const wrap=document.getElementById('results-wrap');
  wrap.innerHTML='<div class="spinner"></div>';
  try{
    const qSnap=await C.quizzes().where('adminUid','==',S.user.uid).get();
    if(qSnap.empty){wrap.innerHTML=`<div style="text-align:center;padding:2.5rem;color:var(--text3)"><div style="font-size:2rem;margin-bottom:.5rem">📊</div><p>No quizzes yet.</p></div>`;return;}
    const quizzes=qSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    let html='';
    for(const quiz of quizzes){
      const rSnap=await C.results().where('quizId','==',quiz.id).get();
      const results=rSnap.docs.map(d=>({docId:d.id,...d.data()})).sort((a,b)=>b.score-a.score||(a.submittedAt-b.submittedAt));
      const badge=quiz.active?`<span class="badge bg">🟢 Live</span>`:`<span class="badge ba">Draft</span>`;
      if(!results.length){
        html+=`<div class="card" style="margin-bottom:1rem">
          <div style="display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;margin-bottom:.35rem">
            <h3 style="font-size:.96rem;font-weight:600;flex:1">${esc(quiz.title)}</h3>${badge}
            <span class="badge bp" style="font-family:var(--font-m)">${quiz.code}</span>
          </div><p style="color:var(--text3);font-size:.82rem">No submissions yet.</p></div>`;
        continue;
      }
      const avg=(results.reduce((s,r)=>s+r.score,0)/results.length).toFixed(1);
      const high=Math.max(...results.map(r=>r.score));
      const perfect=results.filter(r=>r.score===(r.maxScore||r.total)).length;
      const qTotal=quiz.questions?.length||results[0]?.total||'?';
      const maxPts=quiz.questions?.reduce((s,q)=>s+(q.points||1),0)||qTotal;
      // export buttons
      const exportBtns=`<div class="export-row">
        <span>Export:</span>
        <button class="btn btn-b btn-sm" onclick="exportCSV('${quiz.id}','${esc(quiz.title)}')">📄 CSV</button>
        <button class="btn btn-b btn-sm" onclick="exportExcel('${quiz.id}','${esc(quiz.title)}')">📊 Excel</button>
        <button class="btn btn-b btn-sm" onclick="exportPDF('${quiz.id}','${esc(quiz.title)}')">📑 PDF</button>
      </div>`;
      // podium top 3
      let podiumHtml='';
      if(results.length>=2){
        const top=results.slice(0,3);
        const order=results.length>=3?[top[1],top[0],top[2]]:[top[1]?top[1]:null,top[0]].filter(Boolean);
        const classes=['p2','p1','p3'];
        const podLabels=['2nd','1st','3rd'];
        podiumHtml=`<div class="podium">`;
        order.forEach((r,idx)=>{
          if(!r)return;
          const origIdx=results.indexOf(r);
          const pc=origIdx===0?'p1':origIdx===1?'p2':'p3';
          const lbl=origIdx===0?'1st':origIdx===1?'2nd':'3rd';
          const ini=r.participantName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          podiumHtml+=`<div class="podium-item ${pc}">
            <div class="podium-avatar">${ini}</div>
            <div class="podium-name">${esc(r.participantName)}</div>
            <div class="podium-score">${r.score}/${r.total||qTotal}</div>
            <div class="podium-bar">${lbl}</div>
          </div>`;
        });
        podiumHtml+='</div>';
      }
      html+=`<div class="card" style="margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;margin-bottom:.9rem">
          <h3 style="font-size:.96rem;font-weight:600;flex:1">${esc(quiz.title)}</h3>${badge}
          <span class="badge bp" style="font-family:var(--font-m)">${quiz.code}</span>
        </div>
        ${exportBtns}
        <div class="sgrid">
          <div class="sc"><div class="sv">${results.length}</div><div class="sl">Participants</div></div>
          <div class="sc"><div class="sv">${avg}</div><div class="sl">Avg Points</div></div>
          <div class="sc"><div class="sv">${high}/${maxPts}</div><div class="sl">Top Score</div></div>
          <div class="sc"><div class="sv">${perfect}</div><div class="sl">Perfect</div></div>
        </div>
        ${podiumHtml}
        <div class="divider"></div>
        <div style="overflow-x:auto"><table class="rtbl">
          <thead><tr><th>#</th><th>Participant</th><th>Score</th><th>%</th><th>Bar</th><th>Time</th></tr></thead>
          <tbody>${results.map((r,i)=>{
            const rc=i===0?'r1':i===1?'r2':i===2?'r3':'rn';
            const rMax=r.maxScore||r.total||maxPts;
            const pct=Math.round((r.score/rMax)*100);
            const col=pct>=70?'var(--green)':pct>=40?'var(--amber)':'var(--red)';
            const ini=r.participantName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
            const dt=new Date(r.submittedAt).toLocaleString();
            return`<tr>
              <td><span class="rnk ${rc}">${i+1}</span></td>
              <td><div style="display:flex;align-items:center;gap:.5rem"><div class="av">${ini}</div><span style="font-weight:500">${esc(r.participantName)}</span></div></td>
              <td><span style="font-weight:600;color:${col}">${r.score}/${rMax} pts</span></td>
              <td><span style="color:${col};font-family:var(--font-m);font-size:.82rem">${pct}%</span></td>
              <td style="min-width:85px"><div class="sbarw"><div class="sbar" style="width:${pct}%"></div></div></td>
              <td style="color:var(--text3);font-size:.73rem;font-family:var(--font-m)">${dt}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>`;
    }
    wrap.innerHTML=html||`<p style="text-align:center;color:var(--text3);padding:2rem">No results yet.</p>`;
    // store results for export
    window._allResults=[];
    for(const quiz of quizzes){
      const rSnap=await C.results().where('quizId','==',quiz.id).get();
      rSnap.docs.forEach(d=>window._allResults.push({quizTitle:quiz.title,...d.data()}));
    }
  }catch(e){
    wrap.innerHTML=`<div style="padding:1rem;text-align:center"><p style="color:var(--red);margin-bottom:.5rem">⚠ ${e.message||'Could not load results.'}</p><button class="btn btn-g btn-sm" onclick="renderResults()">Retry</button></div>`;
  }
}

// ── Analytics Dashboard ───────────────────────────────────────────────────────
async function renderAnalytics(){
  if(!S.user)return;
  const wrap=document.getElementById('analytics-wrap');
  wrap.innerHTML='<div class="spinner"></div>';
  try{
    const qSnap=await C.quizzes().where('adminUid','==',S.user.uid).get();
    if(qSnap.empty){wrap.innerHTML=`<div style="text-align:center;padding:2.5rem;color:var(--text3)"><div style="font-size:2rem;margin-bottom:.5rem">🔬</div><p>No data yet. Create and share quizzes first!</p></div>`;return;}
    const quizzes=qSnap.docs.map(d=>({id:d.id,...d.data()}));
    let allResults=[];
    for(const q of quizzes){
      const rs=await C.results().where('quizId','==',q.id).get();
      rs.docs.forEach(d=>allResults.push({...d.data(),quiz:q}));
    }
    if(!allResults.length){wrap.innerHTML=`<div style="text-align:center;padding:2.5rem;color:var(--text3)"><p>No submissions yet.</p></div>`;return;}
    const totalPart=allResults.length;
    const avgAcc=(allResults.reduce((s,r)=>s+(r.pct||0),0)/totalPart).toFixed(1);
    const passRate=Math.round((allResults.filter(r=>(r.pct||0)>=50).length/totalPart)*100);
    const perfectCount=allResults.filter(r=>r.score>0&&r.score===(r.maxScore||r.total)).length;
    // per-question accuracy across all quizzes
    let qAccHtml='';
    for(const quiz of quizzes){
      const qs=quiz.questions||[];
      if(!qs.length)continue;
      const rs=allResults.filter(r=>r.quizId===quiz.id);
      if(!rs.length)continue;
      const qAccData=qs.map((q,qi)=>{
        const type=q.type||'mcq';
        let correct=0;
        rs.forEach(r=>{
          const ans=r.answers?.[qi];
          if(ans===undefined)return;
          if(type==='mcq'||type==='truefalse'){if(ans===q.correct)correct++;}
          else if(type==='fill'){if(String(ans).toLowerCase()===String(q.answer||'').toLowerCase())correct++;}
          else if(type==='match'){if(typeof ans==='object'&&Object.keys(ans).length===(q.pairs||[]).length)correct++;}
        });
        const pct=Math.round((correct/rs.length)*100);
        return{text:q.text,pct,correct,total:rs.length};
      });
      const typeColor=p=>p>=70?'var(--green)':p>=40?'var(--amber)':'var(--red)';
      qAccHtml+=`<div class="card" style="margin-bottom:1rem">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.85rem;color:var(--text2)">${esc(quiz.title)} — Per Question Accuracy</h4>
        ${qAccData.map((qa,i)=>`<div class="q-acc-row">
          <span style="color:var(--text3);font-family:var(--font-m);font-size:.72rem;min-width:28px">Q${i+1}</span>
          <div class="q-acc-text">${esc(qa.text)}</div>
          <div class="q-acc-bar"><div class="q-acc-fill" style="width:${qa.pct}%;background:${typeColor(qa.pct)}"></div></div>
          <span class="q-acc-pct" style="color:${typeColor(qa.pct)}">${qa.pct}%</span>
        </div>`).join('')}
      </div>`;
    }
    // player performance table — use maxScore for weighted accuracy
    const playerMap={};
    allResults.forEach(r=>{
      if(!playerMap[r.participantName])playerMap[r.participantName]={name:r.participantName,attempts:0,totalScore:0,totalMax:0};
      playerMap[r.participantName].attempts++;
      playerMap[r.participantName].totalScore+=r.score||0;
      playerMap[r.participantName].totalMax+=(r.maxScore||r.total||1);
    });
    const players=Object.values(playerMap).sort((a,b)=>(b.totalScore/b.totalMax)-(a.totalScore/a.totalMax));
    const playerRows=players.slice(0,20).map((p,i)=>{
      const acc=Math.round((p.totalScore/p.totalMax)*100);
      const col=acc>=70?'var(--green)':acc>=40?'var(--amber)':'var(--red)';
      const rc=i===0?'r1':i===1?'r2':i===2?'r3':'rn';
      const ini=p.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      return`<tr>
        <td><span class="rnk ${rc}">${i+1}</span></td>
        <td><div style="display:flex;align-items:center;gap:.5rem"><div class="av">${ini}</div><span style="font-weight:500">${esc(p.name)}</span></div></td>
        <td style="font-family:var(--font-m);font-size:.82rem">${p.attempts}</td>
        <td><span style="color:${col};font-family:var(--font-m);font-weight:600">${p.totalScore}/${p.totalMax} pts</span></td>
        <td><span style="color:${col};font-family:var(--font-m);font-size:.8rem">${acc}%</span></td>
        <td style="min-width:70px"><div class="sbarw"><div class="sbar" style="width:${acc}%"></div></div></td>
      </tr>`;
    }).join('');
    wrap.innerHTML=`
      <div class="analytics-grid">
        <div class="ana-card"><div class="ana-val">${totalPart}</div><div class="ana-lbl">Total Submissions</div></div>
        <div class="ana-card"><div class="ana-val">${avgAcc}%</div><div class="ana-lbl">Avg Accuracy</div></div>
        <div class="ana-card"><div class="ana-val">${passRate}%</div><div class="ana-lbl">Pass Rate (≥50%)</div></div>
        <div class="ana-card"><div class="ana-val">${perfectCount}</div><div class="ana-lbl">Perfect Scores</div></div>
        <div class="ana-card"><div class="ana-val">${quizzes.length}</div><div class="ana-lbl">Total Quizzes</div></div>
        <div class="ana-card"><div class="ana-val">${players.length}</div><div class="ana-lbl">Unique Players</div></div>
      </div>
      <div class="card" style="margin-bottom:1rem">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.9rem">🏆 Player Leaderboard</h4>
        <div style="overflow-x:auto"><table class="rtbl">
          <thead><tr><th>#</th><th>Player</th><th>Attempts</th><th>Total Points</th><th>Accuracy</th><th>Bar</th></tr></thead>
          <tbody>${playerRows}</tbody>
        </table></div>
      </div>
      ${qAccHtml}`;
  }catch(e){
    wrap.innerHTML=`<div style="padding:1rem;text-align:center"><p style="color:var(--red)">⚠ ${e.message}</p><button class="btn btn-g btn-sm" onclick="renderAnalytics()">Retry</button></div>`;
  }
}

// ── Export Functions ──────────────────────────────────────────────────────────
async function getResultsForQuiz(quizId){
  const rSnap=await C.results().where('quizId','==',quizId).get();
  return rSnap.docs.map(d=>d.data()).sort((a,b)=>b.score-a.score);
}

async function exportCSV(quizId,title){
  toast('Preparing CSV...','info');
  const results=await getResultsForQuiz(quizId);
  if(!results.length){toast('No results to export','error');return;}
  const header=['Rank','Name','Points Earned','Max Points','Percentage','Questions','Submitted At'];
  const rows=results.map((r,i)=>[
    i+1,
    r.participantName,
    r.score,
    r.maxScore||r.total,
    (r.pct||Math.round((r.score/(r.maxScore||r.total))*100))+'%',
    r.total,
    new Date(r.submittedAt).toLocaleString()
  ]);
  const csv=[header,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`${title.replace(/[^a-z0-9]/gi,'_')}_results.csv`;
  a.click();toast('CSV downloaded!');
}

async function exportExcel(quizId,title){
  toast('Preparing Excel...','info');
  const results=await getResultsForQuiz(quizId);
  if(!results.length){toast('No results to export','error');return;}
  const rows=results.map((r,i)=>{
    const maxPts=r.maxScore||r.total;
    const pct=r.pct||Math.round((r.score/maxPts)*100);
    return`<tr>
      <td>${i+1}</td><td>${r.participantName}</td>
      <td>${r.score}</td><td>${maxPts}</td>
      <td>${pct}%</td><td>${r.total}</td>
      <td>${new Date(r.submittedAt).toLocaleString()}</td>
    </tr>`;
  }).join('');
  const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8"><style>th{background:#7c6af7;color:#fff;padding:6px}td{padding:5px;border:1px solid #ccc}</style></head>
  <body><table><thead><tr><th>Rank</th><th>Name</th><th>Points Earned</th><th>Max Points</th><th>Percentage</th><th>Questions</th><th>Submitted At</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const blob=new Blob([html],{type:'application/vnd.ms-excel'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`${title.replace(/[^a-z0-9]/gi,'_')}_results.xls`;
  a.click();toast('Excel downloaded!');
}

async function exportPDF(quizId,title){
  toast('Preparing PDF...','info');
  const results=await getResultsForQuiz(quizId);
  if(!results.length){toast('No results to export','error');return;}
  const rows=results.map((r,i)=>{
    const maxPts=r.maxScore||r.total;
    const pct=r.pct||Math.round((r.score/maxPts)*100);
    const col=pct>=70?'#22d3a0':pct>=40?'#fbbf24':'#f87171';
    return`<tr>
      <td style="text-align:center">${i+1}</td>
      <td>${r.participantName}</td>
      <td style="text-align:center;font-weight:600;color:${col}">${r.score}/${maxPts} pts</td>
      <td style="text-align:center;color:${col}">${pct}%</td>
      <td style="font-size:11px">${new Date(r.submittedAt).toLocaleString()}</td>
    </tr>`;
  }).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:Arial,sans-serif;padding:30px;color:#222}
    h1{color:#7c6af7;font-size:20px;margin-bottom:4px}
    h2{font-size:14px;color:#666;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#7c6af7;color:#fff;padding:8px 10px;text-align:left}
    td{padding:7px 10px;border-bottom:1px solid #eee}
    tr:nth-child(even){background:#f9f9ff}
    .footer{margin-top:20px;color:#999;font-size:11px}
  </style></head><body>
  <h1>NCSPeshawar Quiz Results</h1>
  <h2>${title} — Generated: ${new Date().toLocaleString()}</h2>
  <table><thead><tr><th>#</th><th>Name</th><th>Points</th><th>%</th><th>Submitted</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="footer">Total participants: ${results.length} | Powered by NCSPeshawar</div>
  </body></html>`;
  const w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();setTimeout(()=>{w.focus();w.print();},500);toast('PDF print dialog opened!');}
  else toast('Allow popups to export PDF','error');
}

// ── Tab Switching ─────────────────────────────────────────────────────────────
function switchTab(t){
  const tabs=document.querySelectorAll('#admin-tabs .tab');
  tabs.forEach((el,i)=>el.classList.toggle('active',(i===0&&t==='quizzes')||(i===1&&t==='results')||(i===2&&t==='analytics')));
  ['tab-quizzes','tab-results','tab-analytics'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('tab-'+t)?.classList.remove('hidden');
  if(t==='results')renderResults();
  if(t==='analytics')renderAnalytics();
}

// ── Ambient Music Player ──────────────────────────────────────────────────────
let _audioCtx=null,_musicNodes=null,_musicPlaying=false,_musicVol=0.3;
function initAudio(){
  if(_audioCtx)return;
  _audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  _musicVol=parseFloat(document.getElementById('vol-slider').value)||0.3;
}
function createAmbientMusic(){
  if(!_audioCtx)return;
  if(_musicNodes){_musicNodes.forEach(n=>{try{n.stop();}catch(e){}});_musicNodes=null;}
  const t=_audioCtx.currentTime;
  const gain=_audioCtx.createGain();gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(_musicVol,t+2);
  gain.connect(_audioCtx.destination);
  const nodes=[];
  // Ambient pad: slow sine waves with slight detuning
  const freqs=[220,277.18,329.63,369.99,440];
  freqs.forEach((f,i)=>{
    const osc=_audioCtx.createOscillator();
    const oscGain=_audioCtx.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(f,t);
    oscGain.gain.setValueAtTime(0.06,t);
    // slow LFO for tremolo
    const lfo=_audioCtx.createOscillator();
    const lfoGain=_audioCtx.createGain();
    lfo.frequency.setValueAtTime(0.05+i*0.02,t);
    lfoGain.gain.setValueAtTime(0.03,t);
    lfo.connect(lfoGain);lfoGain.connect(oscGain.gain);
    osc.connect(oscGain);oscGain.connect(gain);
    osc.start(t+i*0.3);lfo.start(t);
    nodes.push(osc,lfo);
  });
  // Low sub drone
  const sub=_audioCtx.createOscillator();
  const subGain=_audioCtx.createGain();
  sub.type='triangle';sub.frequency.setValueAtTime(55,t);
  subGain.gain.setValueAtTime(0.04,t);
  sub.connect(subGain);subGain.connect(gain);sub.start(t+0.5);nodes.push(sub);
  // Soft high ping every ~4s
  function ping(){
    if(!_musicPlaying)return;
    const now=_audioCtx.currentTime;
    const p=_audioCtx.createOscillator();const pg=_audioCtx.createGain();
    p.type='sine';p.frequency.setValueAtTime(880,now);
    pg.gain.setValueAtTime(0,now);pg.gain.linearRampToValueAtTime(0.04,now+0.05);
    pg.gain.exponentialRampToValueAtTime(0.001,now+2.5);
    p.connect(pg);pg.connect(gain);p.start(now);p.stop(now+2.5);
    window._pingTimer=setTimeout(ping,3500+Math.random()*2000);
  }
  setTimeout(ping,1500);
  _musicNodes=nodes;
  // store gain ref for volume control
  window._musicGain=gain;
}
function toggleMusic(){
  initAudio();
  const btn=document.getElementById('music-toggle');
  const wave=document.getElementById('music-wave');
  if(_musicPlaying){
    _musicPlaying=false;
    clearTimeout(window._pingTimer);
    if(window._musicGain)window._musicGain.gain.linearRampToValueAtTime(0,_audioCtx.currentTime+1);
    setTimeout(()=>{if(_musicNodes){_musicNodes.forEach(n=>{try{n.stop();}catch(e){}});_musicNodes=null;}},1200);
    btn.textContent='▶';wave.classList.add('paused');
    setTxt('music-title','Ambient Focus');
  }else{
    _musicPlaying=true;
    if(_audioCtx.state==='suspended')_audioCtx.resume();
    createAmbientMusic();
    btn.textContent='⏸';wave.classList.remove('paused');
    setTxt('music-title','Playing...');
  }
}
function setVol(v){
  _musicVol=parseFloat(v);
  if(window._musicGain&&_audioCtx)window._musicGain.gain.setValueAtTime(_musicVol,_audioCtx.currentTime);
}

window.addEventListener('popstate',e=>{e.preventDefault();history.pushState(null,'');});
history.pushState(null,'');
