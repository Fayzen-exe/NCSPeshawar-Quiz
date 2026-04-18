
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

// Enable offline persistence so data survives refresh / flaky connections
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

// ── Firestore collection helpers ──────────────────────────────────────────────
const C = {
  quizzes:  () => db.collection('quizzes'),
  results:  () => db.collection('results'),
  profiles: () => db.collection('profiles')
};

// ── State ─────────────────────────────────────────────────────────────────────
const S = {
  user:null, profile:null, editId:null,
  quiz:null, participant:null,
  qi:0, answers:{}, timer:null, tLeft:10
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
  const el=document.getElementById(id);
  if(!el)return;
  el.textContent=msg;
  msg?el.classList.remove('hidden'):el.classList.add('hidden');
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function genCode(){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join('');
}
function busy(id,on){
  const b=document.getElementById(id);if(!b)return;
  b.disabled=on;
  const k='data-orig';
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

// Firebase error codes → exact required messages
function fbMsg(code){
  return({
    'auth/email-already-in-use': 'User already exists. Please sign in.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/user-not-found':       'Email or password is incorrect.',
    'auth/wrong-password':       'Email or password is incorrect.',
    'auth/invalid-credential':   'Email or password is incorrect.',
    'auth/too-many-requests':    'Too many attempts. Please wait a few minutes.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/operation-not-allowed':  'Email/password sign-in is not enabled. Enable it in the Firebase Console under Authentication → Sign-in methods.',
  })[code] || 'Email or password is incorrect.';
}

// ── Auth Tab ──────────────────────────────────────────────────────────────────
function authTab(t){
  document.getElementById('atab-li').classList.toggle('active',t==='login');
  document.getElementById('atab-reg').classList.toggle('active',t==='register');
  t==='login'?(show('form-login'),hide('form-register')):(hide('form-login'),show('form-register'));
  showErr('li-err','');showErr('reg-err','');
}

// ── Register ──────────────────────────────────────────────────────────────────
async function doRegister(){
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  showErr('reg-err','');
  if(!name){showErr('reg-err','Please enter your full name.');return;}
  if(!email){showErr('reg-err','Please enter your email address.');return;}
  if(!pass||pass.length<6){showErr('reg-err','Password must be at least 6 characters.');return;}
  busy('reg-btn',true);
  try{
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({displayName: name});
    // Save profile to Firestore so it persists across devices
    await C.profiles().doc(cred.user.uid).set({
      uid:       cred.user.uid,
      name,
      email:     email.toLowerCase(),
      createdAt: Date.now()
    });
    // onAuthStateChanged handles redirect
  }catch(e){
    showErr('reg-err', fbMsg(e.code));
    busy('reg-btn',false);
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function doLogin(){
  const email = document.getElementById('li-email').value.trim();
  const pass  = document.getElementById('li-pass').value;
  showErr('li-err','');
  if(!email){showErr('li-err','Please enter your email.');return;}
  if(!pass){showErr('li-err','Please enter your password.');return;}
  busy('li-btn',true);
  try{
    await auth.signInWithEmailAndPassword(email,pass);
    // onAuthStateChanged handles the rest
  }catch(e){
    showErr('li-err', fbMsg(e.code));
    busy('li-btn',false);
  }
}

function adminLogout(){ auth.signOut(); S.user=null; S.profile=null; goTo('screen-landing'); }

// ── Auth State Observer ───────────────────────────────────────────────────────
let _authReady = false;
auth.onAuthStateChanged(async user=>{
  if(user){
    S.user = user;
    // Load profile from Firestore (falls back to Auth display name)
    try{
      const doc = await C.profiles().doc(user.uid).get();
      S.profile = doc.exists
        ? doc.data()
        : { name: user.displayName || user.email, uid: user.uid, email: user.email };
    }catch(e){
      S.profile = { name: user.displayName || user.email, uid: user.uid, email: user.email };
    }
    const cur = document.querySelector('.screen.active')?.id;
    if(cur==='screen-auth' || cur==='screen-init'){
      setTxt('admin-badge',    S.profile.name);
      setTxt('admin-greeting', `Welcome, ${S.profile.name}`);
      goTo('screen-admin');
      renderQuizList();
    }
    busy('reg-btn', false);
    busy('li-btn',  false);
  }else{
    const cur = document.querySelector('.screen.active')?.id;
    if(cur==='screen-admin' || cur==='screen-editor' || cur==='screen-init') goTo('screen-landing');
  }
  if(!_authReady){ _authReady = true; }
});
// Fallback if Firebase takes too long
setTimeout(()=>{if(!_authReady){goTo('screen-landing');}},4000);

// ── Quiz List ─────────────────────────────────────────────────────────────────
async function renderQuizList(){
  if(!S.user)return;
  const c=document.getElementById('quiz-list');
  c.innerHTML='<div class="spinner"></div>';
  try{
    const snap=await C.quizzes().where('adminUid','==',S.user.uid).get();
    if(snap.empty){
      c.innerHTML=`<div style="text-align:center;padding:2.5rem;color:var(--text3)">
        <div style="font-size:2.3rem;margin-bottom:.65rem">📋</div>
        <p>No quizzes yet. Create your first!</p></div>`;
      return;
    }
    const quizzes=snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    // Count results per quiz
    const counts={};
    await Promise.all(quizzes.map(async q=>{
      try{const rs=await C.results().where('quizId','==',q.id).get();counts[q.id]=rs.size;}
      catch(e){counts[q.id]=0;}
    }));
    c.innerHTML=quizzes.map(q=>{
      const badge=q.active?`<span class="badge bg">🟢 Live</span>`:`<span class="badge ba">Draft</span>`;
      return`<div class="qi">
        <div class="qi-info">
          <div class="qi-title">${esc(q.title)}</div>
          <div class="qi-meta">Code: ${q.code} · ${(q.questions||[]).length} Qs · ${counts[q.id]||0} submissions</div>
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
    c.innerHTML=`<div style="padding:1rem;text-align:center">
      <p style="color:var(--red);margin-bottom:.5rem">⚠ ${e.message||'Could not load quizzes.'}</p>
      <button class="btn btn-g btn-sm" onclick="renderQuizList()">Retry</button></div>`;
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
    renderQBuilder(q.questions||[]);
    goTo('screen-editor');
  }catch(e){toast('Error loading quiz','error');}
}

function renderQBuilder(qs){
  const c=document.getElementById('q-builder');
  if(!qs.length){
    c.innerHTML=`<div style="text-align:center;padding:1.75rem;color:var(--text3);border:1px dashed var(--border);border-radius:var(--r)">
      <p>No questions yet. Use AI or add manually.</p></div>`;
    return;
  }
  c.innerHTML=qs.map((q,i)=>renderQCard(q,i)).join('');
}

function renderQCard(q,i){
  const L=['A','B','C','D'];
  const opts=(q.options||['','','','']).map((o,j)=>`
    <div class="oi ${q.correct===j?'ok':''}" id="oi${i}${j}" onclick="setCorrect(${i},${j})">
      <input type="radio" name="cr${i}" ${q.correct===j?'checked':''} onchange="setCorrect(${i},${j})"/>
      <span style="font-size:.7rem;font-weight:500;color:var(--text2);font-family:var(--font-m);min-width:14px">${L[j]}</span>
      <input type="text" placeholder="Option ${L[j]}" value="${esc(o)}" onclick="event.stopPropagation()" style="flex:1"/>
    </div>`).join('');
  return`<div class="qcard" id="qc${i}">
    <span class="qnum">Q${i+1}/30</span>
    <div class="iw" style="margin:0 0 .5rem"><label>Question ${i+1}</label>
      <textarea rows="2" placeholder="Type your question here...">${esc(q.text||'')}</textarea></div>
    <div style="font-size:.7rem;color:var(--text2);margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.04em;font-weight:500">Options — click to mark correct</div>
    <div class="og">${opts}</div>
    <div style="display:flex;justify-content:flex-end;margin-top:.65rem">
      <button class="btn btn-d btn-sm" onclick="removeQ(${i})">Remove</button></div>
  </div>`;
}

function getQs(){
  return Array.from(document.querySelectorAll('.qcard')).map(card=>{
    const text=card.querySelector('textarea').value.trim();
    const opts=Array.from(card.querySelectorAll('.oi input[type=text]')).map(x=>x.value.trim());
    let correct=0;
    card.querySelectorAll('input[type=radio]').forEach((r,j)=>{if(r.checked)correct=j;});
    return{text,options:opts,correct};
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
function addQ(){
  const q=getQs();
  if(q.length>=30){toast('Max 30 questions','error');return;}
  q.push({text:'',options:['','','',''],correct:0});
  renderQBuilder(q);
  setTimeout(()=>document.querySelectorAll('.qcard')[q.length-1]?.scrollIntoView({behavior:'smooth'}),80);
}

async function aiGen(){
  const topic=document.getElementById('eq-topic').value.trim();
  if(!topic){toast('Enter a topic first','error');return;}
  show('ai-load');
  document.getElementById('ai-btn').disabled=true;
  document.getElementById('q-builder').innerHTML='';
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:3000,
        messages:[{role:'user',content:`Generate exactly 15 MCQ questions about: "${topic}". Return ONLY a JSON array, no markdown. Format: [{"text":"question","options":["A","B","C","D"],"correct":0}] where correct is 0-based index. Vary difficulty.`}]})
    });
    const d=await r.json();
    let raw=d.content.map(b=>b.text||'').join('').replace(/```json|```/g,'').trim();
    const qs=JSON.parse(raw);
    if(!Array.isArray(qs))throw new Error();
    renderQBuilder(qs.slice(0,30));
    toast(`✨ Generated ${Math.min(qs.length,30)} questions!`);
  }catch(e){toast('AI failed. Add manually.','error');renderQBuilder([]);}
  hide('ai-load');
  document.getElementById('ai-btn').disabled=false;
}

async function saveQuiz(){
  if(!S.user){toast('Not logged in','error');return;}
  const title=document.getElementById('eq-title').value.trim();
  const topic=document.getElementById('eq-topic').value.trim();
  if(!title){toast('Enter a quiz title','error');return;}
  const questions=getQs().filter(q=>q.text&&q.options.every(o=>o));
  if(!questions.length){toast('Add at least one complete question','error');return;}
  busy('save-btn',true);
  try{
    if(S.editId){
      await C.quizzes().doc(S.editId).update({title,topic,questions,updatedAt:Date.now()});
      toast('Quiz updated!');S.editId=null;
    }else{
      let code,tries=0;
      do{code=genCode();const sn=await C.quizzes().where('code','==',code).get();if(sn.empty)break;tries++;}while(tries<5);
      await C.quizzes().add({
        title,topic,code,questions,
        adminUid:S.user.uid,
        adminName:S.profile?.name||S.user.email,
        active:false,createdAt:Date.now(),updatedAt:Date.now()
      });
      toast('Quiz saved! Hit Start to make it live.');
    }
    goTo('screen-admin');renderQuizList();
  }catch(e){
    toast(`Save failed: ${e.message||'Check connection'}`, 'error');
  }
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
    goTo('screen-quiz');renderQ();
  }catch(e){showErr('join-err','Connection error. Check internet and try again.');}
  busy('join-btn',false);
}

function renderQ(){
  const q=S.quiz.questions[S.qi];const total=S.quiz.questions.length;
  setTxt('q-num',S.qi+1);setTxt('q-counter',`Q ${S.qi+1}/${total}`);
  setTxt('qtext',q.text);hide('next-btn');
  document.getElementById('pdots').innerHTML=S.quiz.questions.map((_,j)=>{
    let c='dot';
    if(j<S.qi&&S.answers[j]!==undefined)c+=' ans';
    else if(j<S.qi)c+=' skip';
    else if(j===S.qi)c+=' cur';
    return`<div class="${c}"></div>`;
  }).join('');
  const L=['A','B','C','D'];
  document.getElementById('qopts').innerHTML=q.options.map((o,j)=>
    `<div class="qopt" id="qo${j}" onclick="selAns(${j})">
      <div class="oletter">${L[j]}</div>
      <div style="font-size:.9rem;color:var(--text)">${esc(o)}</div>
    </div>`).join('');
  startTimer();
}

function startTimer(){
  clearInterval(S.timer);S.tLeft=10;updTimer(10);
  S.timer=setInterval(()=>{S.tLeft--;updTimer(S.tLeft);if(S.tLeft<=0){clearInterval(S.timer);lockOpts();setTimeout(nextQ,700);}},1000);
}
function updTimer(t){
  const tc=document.getElementById('tc'),td=document.getElementById('tdisp');
  if(tc){tc.style.strokeDashoffset=CIRC*(1-t/10);tc.style.stroke=t<=3?'var(--red)':t<=5?'var(--amber)':'var(--accent)';}
  if(td){td.textContent=t;td.className='tnum'+(t<=3?' danger':t<=5?' warn':'');}
}
function selAns(j){
  if(S.answers[S.qi]!==undefined)return;
  clearInterval(S.timer);S.answers[S.qi]=j;
  document.querySelectorAll('.qopt').forEach((el,k)=>{el.classList.add('disabled');if(k===j)el.classList.add('sel');});
  show('next-btn');
}
function lockOpts(){document.querySelectorAll('.qopt').forEach(el=>el.classList.add('disabled'));}
function nextQ(){clearInterval(S.timer);if(S.qi<S.quiz.questions.length-1){S.qi++;renderQ();}else submitQuiz();}

async function submitQuiz(){
  let score=0;
  S.quiz.questions.forEach((q,i)=>{if(S.answers[i]===q.correct)score++;});
  try{
    await C.results().add({
      participantId:S.participant.id,participantName:S.participant.name,
      quizId:S.quiz.id,quizTitle:S.quiz.title,quizCode:S.quiz.code,
      adminUid:S.quiz.adminUid,score,total:S.quiz.questions.length,
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
      const results=rSnap.docs.map(d=>d.data()).sort((a,b)=>b.score-a.score||(a.submittedAt-b.submittedAt));
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
      const perfect=results.filter(r=>r.score===r.total).length;
      const qTotal=quiz.questions?.length||results[0]?.total||'?';
      html+=`<div class="card" style="margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;margin-bottom:.9rem">
          <h3 style="font-size:.96rem;font-weight:600;flex:1">${esc(quiz.title)}</h3>${badge}
          <span class="badge bp" style="font-family:var(--font-m)">${quiz.code}</span>
        </div>
        <div class="sgrid">
          <div class="sc"><div class="sv">${results.length}</div><div class="sl">Participants</div></div>
          <div class="sc"><div class="sv">${avg}</div><div class="sl">Avg Score</div></div>
          <div class="sc"><div class="sv">${high}/${qTotal}</div><div class="sl">Top Score</div></div>
          <div class="sc"><div class="sv">${perfect}</div><div class="sl">Perfect</div></div>
        </div>
        <div class="divider"></div>
        <div style="overflow-x:auto"><table class="rtbl">
          <thead><tr><th>#</th><th>Participant</th><th>Score</th><th>Bar</th><th>Time</th></tr></thead>
          <tbody>${results.map((r,i)=>{
            const rc=i===0?'r1':i===1?'r2':i===2?'r3':'rn';
            const pct=Math.round((r.score/(r.total||qTotal))*100);
            const col=pct>=70?'var(--green)':pct>=40?'var(--amber)':'var(--red)';
            const ini=r.participantName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
            const dt=new Date(r.submittedAt).toLocaleString();
            return`<tr>
              <td><span class="rnk ${rc}">${i+1}</span></td>
              <td><div style="display:flex;align-items:center;gap:.5rem"><div class="av">${ini}</div>
                <span style="font-weight:500">${esc(r.participantName)}</span></div></td>
              <td><span style="font-weight:600;color:${col}">${r.score}/${r.total||qTotal}</span></td>
              <td style="min-width:85px"><div class="sbarw"><div class="sbar" style="width:${pct}%"></div></div></td>
              <td style="color:var(--text3);font-size:.73rem;font-family:var(--font-m)">${dt}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>`;
    }
    wrap.innerHTML=html||`<p style="text-align:center;color:var(--text3);padding:2rem">No results yet.</p>`;
  }catch(e){
    wrap.innerHTML=`<div style="padding:1rem;text-align:center">
      <p style="color:var(--red);margin-bottom:.5rem">⚠ ${e.message||'Could not load results.'}</p>
      <button class="btn btn-g btn-sm" onclick="renderResults()">Retry</button></div>`;
  }
}

function switchTab(t){
  document.querySelectorAll('#admin-tabs .tab').forEach((el,i)=>
    el.classList.toggle('active',(i===0&&t==='quizzes')||(i===1&&t==='results')));
  t==='quizzes'?(show('tab-quizzes'),hide('tab-results')):(hide('tab-quizzes'),show('tab-results'));
  if(t==='results')renderResults();
}

window.addEventListener('popstate',e=>{e.preventDefault();history.pushState(null,'');});
history.pushState(null,'');
