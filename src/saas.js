import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL='https://jrudwnrorufmxjtjtwip.supabase.co';
const SUPABASE_KEY='sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const app=document.querySelector('#app');
let orgId=null;
let currentEmployee=null;

function qs(s){return document.querySelector(s)}
function val(s){return qs(s)?.value?.trim()||''}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function fmtDate(d){if(!d)return '';return new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00'))}
function badge(status){const map={pending:'In attesa',approved:'Approvata',rejected:'Rifiutata',cancelled:'Annullata'};return `<span class="badge ${status}">${map[status]||status}</span>`}
function msg(t){const e=qs('#msg');if(e)e.textContent=t}

function topbar(title,subtitle=''){
  return `<header class="top"><div><div class="brand">FerieFlow</div>${subtitle?`<div class="topsub">${esc(subtitle)}</div>`:''}</div><div class="topactions"><span class="pill">${esc(title)}</span><button class="btn light" id="logout">Esci</button></div></header>`;
}
function wireLogout(){const b=qs('#logout');if(b)b.onclick=async()=>{await supabase.auth.signOut();renderLanding();};}

function renderLanding(){
app.innerHTML=`<div class="shell">
<header class="top marketing"><div class="brand">FerieFlow</div><div class="topactions"><button class="btn light" id="goLogin">Accedi</button></div></header>
<section class="hero landing"><div><span class="eyebrow">GESTIONE ASSENZE PER PMI</span><h1>Ferie e permessi, senza caos.</h1><p>Il collaboratore invia la richiesta dal telefono. Tu approvi in pochi secondi. Niente fogli, niente messaggi persi.</p><div class="heroactions"><button class="btn primary big" id="start">Inizia 14 giorni gratis</button><span class="micro">Carta richiesta · Nessun addebito oggi</span></div></div>
<div class="panel authbox"><div class="stack"><h2>Crea la tua azienda</h2><input class="input" id="email" placeholder="Email aziendale"><input class="input" id="password" type="password" placeholder="Password (min. 6 caratteri)"><input class="input" id="company" placeholder="Nome azienda"><button class="btn primary" id="signup">Crea account</button><button class="btn ghost" id="login">Ho già un account</button><div class="muted" id="msg"></div></div></div></section>
<section class="featuregrid"><div class="feature"><div class="icon">✓</div><h3>Richieste in 30 secondi</h3><p>Ferie, permessi e stato direttamente dal telefono.</p></div><div class="feature"><div class="icon">⚡</div><h3>Approvazioni immediate</h3><p>Il responsabile vede tutto e decide senza cercare chat o fogli.</p></div><div class="feature"><div class="icon">🔗</div><h3>Inviti automatici</h3><p>Inserisci il collaboratore e il sistema genera il suo accesso personale.</p></div></section>
<section class="pricing"><div><span class="eyebrow">PREZZI SEMPLICI</span><h2>Un piano che cresce con l'azienda.</h2></div><div class="pricegrid"><div class="pricecard"><b>Starter</b><strong>29 €<small>/mese</small></strong><span>fino a 10 collaboratori</span></div><div class="pricecard featured"><b>Business</b><strong>49 €<small>/mese</small></strong><span>fino a 30 collaboratori</span></div><div class="pricecard"><b>Pro</b><strong>79 €<small>/mese</small></strong><span>fino a 100 collaboratori</span></div></div></section>
</div>`;
qs('#start').onclick=()=>qs('#email').focus();qs('#goLogin').onclick=()=>qs('#email').focus();qs('#signup').onclick=signup;qs('#login').onclick=login;
}

async function signup(){const email=val('#email'),password=val('#password'),company=val('#company');if(!email||!password||!company)return msg('Compila email, password e nome azienda.');msg('Creo il tuo account...');const {data,error}=await supabase.auth.signUp({email,password});if(error)return msg(error.message);localStorage.setItem('ff_pending_company',company);if(!data.session)return msg('Controlla la tua email e conferma l’account. Poi torna qui e accedi.');await bootstrap(company);}
async function login(){const email=val('#email'),password=val('#password');if(!email||!password)return msg('Inserisci email e password.');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)return msg(error.message);await loadApp();}
async function bootstrap(name){const company=name||localStorage.getItem('ff_pending_company')||'La mia azienda';const {data,error}=await supabase.functions.invoke('saas-bootstrap',{body:{name:company}});if(error)return msg(error.message);orgId=data.organization?.id||data.organization_id;localStorage.removeItem('ff_pending_company');await loadApp();}

async function loadApp(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return renderLanding();
  const {data:membership}=await supabase.from('saas_memberships').select('organization_id,role').eq('user_id',user.id).maybeSingle();
  if(membership){orgId=membership.organization_id;return loadAdmin(membership.role);}
  const {data:employee}=await supabase.from('saas_employees').select('*').eq('auth_user_id',user.id).maybeSingle();
  if(employee){currentEmployee=employee;orgId=employee.organization_id;return loadEmployee();}
  return renderOnboarding();
}

function renderOnboarding(){app.innerHTML=`<div class="shell">${topbar('Nuova azienda')}<section class="hero compact"><div><span class="eyebrow">ULTIMO PASSAGGIO</span><h1>Configura la tua azienda</h1><p>Inserisci il nome e il sistema prepara il tuo spazio di lavoro.</p></div><div class="panel stack"><input class="input" id="company2" placeholder="Nome azienda"><button class="btn primary" id="createOrg">Continua</button><div id="msg" class="muted"></div></div></section></div>`;wireLogout();qs('#createOrg').onclick=()=>bootstrap(val('#company2'));}

async function loadAdmin(role){
 const [{data:org},{data:employees},{data:reqs},{data:settings}]=await Promise.all([
  supabase.from('saas_organizations').select('*').eq('id',orgId).single(),
  supabase.from('saas_employees').select('*').eq('organization_id',orgId).order('created_at'),
  supabase.from('saas_absence_requests').select('*,saas_employees(first_name,last_name)').eq('organization_id',orgId).order('created_at',{ascending:false}),
  supabase.from('saas_settings').select('*').eq('organization_id',orgId).maybeSingle()
 ]);
 renderAdmin(org,employees||[],reqs||[],settings||{},role);
}
function renderAdmin(org,employees,reqs,settings,role){
 const pending=reqs.filter(r=>r.status==='pending');
 const approved=reqs.filter(r=>r.status==='approved');
 app.innerHTML=`<div class="shell dashboard">${topbar(org.name,role==='owner'?'Proprietario':'Amministratore')}
 <main class="dashwrap"><section class="dashhead"><div><span class="eyebrow">PANORAMICA</span><h1>Ciao 👋</h1><p>Qui hai sotto controllo assenze, richieste e collaboratori.</p></div><button class="btn primary big" id="invite">+ Invita collaboratore</button></section>
 <section class="stats"><div class="stat"><span>Da approvare</span><strong>${pending.length}</strong><small>richieste in attesa</small></div><div class="stat"><span>Collaboratori</span><strong>${employees.length}</strong><small>attivi in azienda</small></div><div class="stat"><span>Approvate</span><strong>${approved.length}</strong><small>richieste totali</small></div><div class="stat accent"><span>Piano</span><strong>${esc(org.plan)}</strong><small>${org.trial_ends_at?'prova fino al '+fmtDate(org.trial_ends_at.slice(0,10)):'attivo'}</small></div></section>
 <section class="twocol"><div class="card"><div class="cardhead"><div><h3>Richieste</h3><p>Approva o rifiuta senza aprire altre schermate.</p></div></div><div class="requestlist">${reqs.slice(0,12).map(requestRow).join('')||'<div class="empty">Nessuna richiesta ancora.</div>'}</div></div>
 <div class="card"><div class="cardhead"><div><h3>Collaboratori</h3><p>Ogni collaboratore ha il suo accesso personale.</p></div></div><div>${employees.map(employeeRow).join('')||'<div class="empty">Invita il primo collaboratore.</div>'}</div></div></section>
 <section class="card settings"><div><h3>Regole aziendali</h3><p>Preavviso minimo attuale: <b>${settings.min_notice_days??5} giorni</b>.</p></div><div class="planbox"><span>Piano attuale</span><b>${esc(org.plan)}</b><button class="btn ghost" id="plans">Gestisci abbonamento</button></div></section>
 </main><div id="modal"></div></div>`;
 wireLogout();qs('#invite').onclick=showInvite;qs('#plans').onclick=showPlans;
 document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>decideRequest(b.dataset.approve,'approved'));
 document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>decideRequest(b.dataset.reject,'rejected'));
}
function employeeRow(e){return `<div class="employee"><div class="avatar">${esc((e.first_name||'?')[0])}${esc((e.last_name||'?')[0])}</div><div class="grow"><strong>${esc(e.first_name)} ${esc(e.last_name)}</strong><div class="muted">${esc(e.email||'Nessuna email')}</div></div><span class="badge approved">${e.auth_user_id?'Attivo':'Invitato'}</span></div>`;}
function requestRow(r){const n=r.saas_employees?`${r.saas_employees.first_name} ${r.saas_employees.last_name}`:'Collaboratore';return `<div class="request"><div class="grow"><div class="requesttitle"><strong>${esc(n)}</strong>${badge(r.status)}</div><div class="muted cap">${esc(r.request_type)} · ${fmtDate(r.start_date)}${r.end_date!==r.start_date?' → '+fmtDate(r.end_date):''}${r.start_time?' · '+r.start_time.slice(0,5)+'-'+(r.end_time||'').slice(0,5):''}</div>${r.reason?`<div class="reason">${esc(r.reason)}</div>`:''}</div>${r.status==='pending'?`<div class="actions"><button class="iconbtn yes" data-approve="${r.id}">✓</button><button class="iconbtn no" data-reject="${r.id}">×</button></div>`:''}</div>`;}
async function decideRequest(id,status){const note=status==='rejected'?prompt('Motivo del rifiuto (facoltativo):')||null:null;const {error}=await supabase.from('saas_absence_requests').update({status,admin_note:note,decided_at:new Date().toISOString()}).eq('id',id);if(error)return alert(error.message);await loadAdmin('admin');}

function showInvite(){qs('#modal').innerHTML=`<div class="overlay"><div class="modal"><div class="modalhead"><div><span class="eyebrow">NUOVO COLLABORATORE</span><h2>Invita una persona</h2></div><button class="x" id="close">×</button></div><div class="stack"><div class="two"><input class="input" id="fn" placeholder="Nome"><input class="input" id="ln" placeholder="Cognome"></div><input class="input" id="em" type="email" placeholder="Email"><button class="btn primary big" id="sendInvite">Genera e invia invito</button><div id="inviteMsg" class="muted"></div></div></div></div>`;qs('#close').onclick=()=>qs('#modal').innerHTML='';qs('#sendInvite').onclick=inviteEmployee;}
async function inviteEmployee(){const first_name=val('#fn'),last_name=val('#ln'),email=val('#em');if(!first_name||!last_name||!email)return qs('#inviteMsg').textContent='Compila nome, cognome ed email.';qs('#inviteMsg').textContent='Creo l’accesso...';const {data,error}=await supabase.functions.invoke('saas-invite-employee',{body:{organization_id:orgId,first_name,last_name,email,redirect_to:location.origin+'/saas.html'}});if(error){qs('#inviteMsg').textContent=error.message;return;}qs('#inviteMsg').innerHTML=`Invito creato e pronto. <button class="btn ghost" id="copy">Copia link per WhatsApp</button>`;qs('#copy').onclick=async()=>{await navigator.clipboard.writeText(data.invite_url||'');qs('#inviteMsg').textContent='Link copiato.';};}
function showPlans(){qs('#modal').innerHTML=`<div class="overlay"><div class="modal wide"><div class="modalhead"><div><span class="eyebrow">ABBONAMENTO</span><h2>Scegli il piano</h2></div><button class="x" id="close">×</button></div><div class="pricegrid"><div class="pricecard"><b>Starter</b><strong>29 €<small>/mese</small></strong><span>Fino a 10 collaboratori</span><button class="btn ghost" disabled>Carta al checkout</button></div><div class="pricecard featured"><b>Business</b><strong>49 €<small>/mese</small></strong><span>Fino a 30 collaboratori</span><button class="btn primary" disabled>Stripe da collegare</button></div><div class="pricecard"><b>Pro</b><strong>79 €<small>/mese</small></strong><span>Fino a 100 collaboratori</span><button class="btn ghost" disabled>Carta al checkout</button></div></div><p class="muted center">La struttura è pronta; il checkout si attiva appena viene collegato l’account Stripe dell’attività.</p></div></div>`;qs('#close').onclick=()=>qs('#modal').innerHTML='';}

async function loadEmployee(){
 const [{data:org},{data:reqs},{data:settings},{data:blocked}]=await Promise.all([
  supabase.from('saas_organizations').select('*').eq('id',orgId).single(),
  supabase.from('saas_absence_requests').select('*').eq('employee_id',currentEmployee.id).order('created_at',{ascending:false}),
  supabase.from('saas_settings').select('*').eq('organization_id',orgId).maybeSingle(),
  supabase.from('saas_blocked_days').select('*').eq('organization_id',orgId).order('blocked_date')
 ]);
 renderEmployee(org,reqs||[],settings||{},blocked||[]);
}
function renderEmployee(org,reqs,settings,blocked){
 const pending=reqs.filter(r=>r.status==='pending').length;const approved=reqs.filter(r=>r.status==='approved').length;
 app.innerHTML=`<div class="shell employeeapp">${topbar(org.name,'Area collaboratore')}<main class="mobilewrap"><section class="welcome"><span class="eyebrow">AREA PERSONALE</span><h1>Ciao ${esc(currentEmployee.first_name)} 👋</h1><p>Invia una richiesta e controlla subito lo stato.</p></section><section class="quickstats"><div><strong>${pending}</strong><span>In attesa</span></div><div><strong>${approved}</strong><span>Approvate</span></div></section><button class="btn primary requestbtn" id="newRequest">+ Nuova richiesta</button><section class="card"><div class="cardhead"><div><h3>Le mie richieste</h3><p>Storico aggiornato in tempo reale.</p></div></div>${reqs.map(r=>`<div class="request"><div class="grow"><div class="requesttitle"><strong class="cap">${esc(r.request_type)}</strong>${badge(r.status)}</div><div class="muted">${fmtDate(r.start_date)}${r.end_date!==r.start_date?' → '+fmtDate(r.end_date):''}</div>${r.admin_note?`<div class="reason">Nota: ${esc(r.admin_note)}</div>`:''}</div></div>`).join('')||'<div class="empty">Non hai ancora inviato richieste.</div>'}</section>${blocked.length?`<section class="notice"><b>Giorni non disponibili</b><span>${blocked.slice(0,5).map(x=>fmtDate(x.blocked_date)).join(' · ')}</span></section>`:''}<div class="policy">Preavviso minimo: ${settings.min_notice_days??5} giorni.</div></main><div id="modal"></div></div>`;wireLogout();qs('#newRequest').onclick=()=>showRequest(settings,blocked);}
function showRequest(settings,blocked){qs('#modal').innerHTML=`<div class="overlay"><div class="modal"><div class="modalhead"><div><span class="eyebrow">NUOVA RICHIESTA</span><h2>Ferie o permesso</h2></div><button class="x" id="close">×</button></div><div class="stack"><select class="input" id="rtype"><option value="ferie">Ferie</option><option value="permesso">Permesso</option></select><div class="two"><label>Dal<input class="input" type="date" id="from"></label><label>Al<input class="input" type="date" id="to"></label></div><div class="two timefields hidden" id="times"><label>Dalle<input class="input" type="time" id="startTime"></label><label>Alle<input class="input" type="time" id="endTime"></label></div><textarea class="input" id="reason" rows="3" placeholder="Motivazione o nota (facoltativa)"></textarea><button class="btn primary big" id="submitRequest">Invia richiesta</button><div id="requestMsg" class="muted"></div></div></div></div>`;qs('#close').onclick=()=>qs('#modal').innerHTML='';qs('#rtype').onchange=()=>{const p=val('#rtype')==='permesso';qs('#times').classList.toggle('hidden',!p);if(p)qs('#to').value=qs('#from').value;};qs('#from').onchange=()=>{if(val('#rtype')==='permesso')qs('#to').value=qs('#from').value;};qs('#submitRequest').onclick=()=>submitRequest(settings,blocked);}
async function submitRequest(settings,blocked){const type=val('#rtype'),from=val('#from'),to=val('#to')||from;if(!from||!to)return qs('#requestMsg').textContent='Seleziona le date.';const start=new Date(from+'T12:00:00'),today=new Date();today.setHours(12,0,0,0);const days=Math.floor((start-today)/86400000);if(days<(settings.min_notice_days??5))return qs('#requestMsg').textContent=`Serve un preavviso minimo di ${settings.min_notice_days??5} giorni.`;if(blocked.some(b=>b.blocked_date>=from&&b.blocked_date<=to))return qs('#requestMsg').textContent='Nel periodo scelto c’è almeno un giorno non disponibile.';if(type==='permesso'&&(!val('#startTime')||!val('#endTime')))return qs('#requestMsg').textContent='Inserisci orario di inizio e fine.';qs('#requestMsg').textContent='Invio richiesta...';const {error}=await supabase.from('saas_absence_requests').insert({organization_id:orgId,employee_id:currentEmployee.id,request_type:type,start_date:from,end_date:to,start_time:type==='permesso'?val('#startTime'):null,end_time:type==='permesso'?val('#endTime'):null,reason:val('#reason')||null,status:'pending'});if(error)return qs('#requestMsg').textContent=error.message;qs('#modal').innerHTML='';await loadEmployee();}

supabase.auth.onAuthStateChange((_event,session)=>{if(!session&&document.querySelector('.dashboard,.employeeapp'))renderLanding();});
loadApp();
