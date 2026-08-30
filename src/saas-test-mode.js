import { createClient } from '@supabase/supabase-js';
const supabase=createClient('https://jrudwnrorufmxjtjtwip.supabase.co','sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs');
const allowedHosts=new Set(['ferieflow-preview-eko6r8gj1-geationale.vercel.app','ferieflow-preview-geationale.vercel.app']);
if(allowedHosts.has(location.host)){
  document.addEventListener('click',async(e)=>{
    const btn=e.target.closest('#signup');
    if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    const get=id=>document.querySelector(id)?.value?.trim()||'';
    const email=get('#email'),password=get('#password'),company=get('#company'),vat=get('#vat');
    const msg=document.querySelector('#msg');
    if(!email||!password||!company){if(msg)msg.textContent='Compila email, password e nome azienda.';return;}
    if(password.length<8){if(msg)msg.textContent='La password deve avere almeno 8 caratteri.';return;}
    if(msg)msg.textContent='Creo l’account di test...';
    const {data:reg,error:regErr}=await supabase.functions.invoke('saas-test-register',{body:{email,password}});
    if(regErr||reg?.error){if(msg)msg.textContent=reg?.error||regErr?.message||'Errore registrazione';return;}
    const {error:loginErr}=await supabase.auth.signInWithPassword({email,password});
    if(loginErr){if(msg)msg.textContent=loginErr.message;return;}
    const {data:boot,error:bootErr}=await supabase.functions.invoke('saas-bootstrap',{body:{name:company}});
    if(bootErr){if(msg)msg.textContent=bootErr.message;return;}
    const organization_id=boot?.organization?.id||boot?.organization_id;
    let device=localStorage.getItem('ff_device_id');if(!device){device=crypto.randomUUID();localStorage.setItem('ff_device_id',device)}
    const {error:trialErr}=await supabase.functions.invoke('saas-start-trial',{body:{organization_id,vat_number:vat||'',device_id:device}});
    if(trialErr){if(msg)msg.textContent=trialErr.message;return;}
    location.reload();
  },true);
}
