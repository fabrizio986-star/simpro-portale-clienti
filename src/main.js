import { createClient } from "@supabase/supabase-js";
import "./styles.css";
import "./reminders.css";
import "./timeline.css";
import "./deletion.css";
import "./notifications.css";
import "./client-edit.css";

const SUPABASE_URL = "https://jrudwnrorufmxjtjtwip.supabase.co";
const SUPABASE_KEY = "sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs";
const CLIENT_PORTAL_URL =
  window.location.hostname === "clienti.simprolamiere.it"
    ? "https://clienti.simprolamiere.it/"
    : new URL("./", window.location.href).toString();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const root = document.querySelector("#root");

const workflowSteps = [
  { key: "materiale_ordinato", label: "Materiale ordinato" },
  { key: "inizio_lavorazione", label: "Inizio lavorazione" },
  { key: "fine_lavorazione", label: "Fine lavorazione" },
  { key: "zincatura", label: "In zincatura", optional: "has_galvanizing" },
  { key: "verniciatura", label: "In verniciatura", optional: "has_painting" },
  { key: "arrivo_officina", label: "Arrivo in officina" },
  { key: "controllo", label: "Controllo" },
  { key: "pronto_ritiro", label: "Pronto per il ritiro" },
];

const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

function logo() {
  return `<a class="brand" href="./" aria-label="SIMPRO Lamiere">
    <img src="https://www.simprolamiere.it/wp-content/uploads/2024/07/logo-simpro-128x128.png" alt="SIMPRO Lamiere">
  </a>`;
}

function notice(message, type = "ok") {
  const old = document.querySelector(".toast");
  if (old) old.remove();
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 3500);
}

function loginPage() {
  root.innerHTML = `
    <main class="login-page">
      <section class="login-intro">
        ${logo()}
        <div>
          <span class="eyebrow">PORTALE CLIENTI</span>
          <h1>Il tuo lavoro,<br>passo dopo passo.</h1>
          <p>Controlla in modo semplice e trasparente lo stato delle tue lavorazioni SIMPRO.</p>
        </div>
        <small>Precisione · Qualità · Trasparenza</small>
      </section>
      <section class="login-panel">
        <form id="login-form" class="login-card">
          <div class="mobile-logo">${logo()}</div>
          <span class="eyebrow red">ACCESSO SIMPRO</span>
          <h2>Area amministratore</h2>
          <p>Accesso riservato al personale autorizzato SIMPRO Lamiere.</p>
          <label>Email<input name="email" type="email" autocomplete="email" required></label>
          <label>Password<input name="password" type="password" minlength="8" autocomplete="current-password" required></label>
          <div id="auth-message" class="form-message"></div>
          <button class="primary" type="submit">Accedi <span>→</span></button>
          <button class="secondary" id="signup" type="button">Crea il primo accesso</button>
          <small class="help">I clienti entrano direttamente dal proprio link personale.</small>
        </form>
      </section>
    </main>`;

  const form = document.querySelector("#login-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.get("email"),
      password: data.get("password"),
    });
    if (error) return showAuth(error.message);
    adminPage();
  });
  document.querySelector("#signup").addEventListener("click", async () => {
    const data = new FormData(form);
    const email = String(data.get("email") || "");
    const password = String(data.get("password") || "");
    if (!email || password.length < 8) return showAuth("Inserisci email e una password di almeno 8 caratteri.");
    const { error } = await supabase.auth.signUp({ email, password });
    showAuth(error ? error.message : "Accesso creato. Controlla la tua email per confermarlo.", !error);
  });
}

function showAuth(message, ok = false) {
  const node = document.querySelector("#auth-message");
  node.textContent = message;
  node.className = `form-message ${ok ? "ok" : "error"}`;
}

async function clientPage(token) {
  root.innerHTML = `<div class="loading">Caricamento area cliente…</div>`;
  const { data, error } = await supabase.rpc("get_client_portal", { p_token: token });
  if (error || !data) {
    root.innerHTML = `<main class="not-found">${logo()}<h1>Link non valido</h1><p>Il collegamento è scaduto o è stato disattivato. Contatta SIMPRO Lamiere.</p></main>`;
    return;
  }
  const client = data.client;
  const jobs = data.jobs || [];
  root.innerHTML = `
    <header class="topbar">${logo()}<div class="account"><small>Area personale</small><strong>${esc(client.name)}</strong></div></header>
    <main class="client-wrap">
      <section class="welcome">
        <span class="eyebrow red">LA TUA AREA PERSONALE</span>
        <h1>Buongiorno, ${esc(client.contact_name || client.name)}</h1>
        <p>Qui trovi lo stato aggiornato delle lavorazioni associate alla tua azienda.</p>
      </section>
      <section class="job-grid">
        ${jobs.length ? jobs.map((job) => jobCard(job, token)).join("") : `<div class="empty"><h2>Nessuna lavorazione presente</h2><p>Le nuove lavorazioni compariranno qui appena inserite da SIMPRO.</p></div>`}
      </section>
      <div class="privacy">🔒 Visualizzi esclusivamente le lavorazioni associate al tuo link personale.</div>
    </main>`;
  document.querySelectorAll(".send-reminder").forEach((button) => {
    button.onclick = () => sendReminder(token, button.dataset.job);
  });
}

function jobCard(job) {
  return `<article class="job-card">
    <div class="job-head"><span>${esc(job.code || "COMMESSA")}</span><b>${esc(job.phase)}</b></div>
    <h2>${esc(job.title)}</h2>
    <div class="progress-line"><strong>${Number(job.progress)}% completato</strong><span>Aggiornato: ${formatDate(job.updated_at)}</span></div>
    <div class="progress"><span style="width:${Number(job.progress)}%"></span></div>
    ${workflowTimeline(job)}
    <div class="job-note"><span>Ultimo aggiornamento</span><p>${esc(job.note || "Nessuna nota disponibile.")}</p></div>
    <div class="job-foot"><span>Consegna prevista</span><strong>${esc(job.delivery || "Da programmare")}</strong></div>
    <button class="reminder-btn send-reminder" data-job="${job.id}">🔔 Richiedi un aggiornamento</button>
  </article>`;
}

function applicableSteps(job) {
  return workflowSteps.filter((step) => !step.optional || Boolean(job[step.optional]));
}

function workflowTimeline(job) {
  const steps = applicableSteps(job);
  const activeIndex = Math.max(0, steps.findIndex((step) => step.key === job.current_step));
  return `<div class="timeline">
    <div class="timeline-title">STATO DELLA LAVORAZIONE</div>
    ${steps.map((step, index) => {
      const state = index < activeIndex ? "done" : index === activeIndex ? "current" : "pending";
      return `<div class="timeline-step ${state}"><span class="timeline-dot">${state === "done" ? "✓" : index + 1}</span><strong>${esc(step.label)}</strong>${state === "current" ? `<small>Aggiornato il ${formatDate(job.updated_at)}</small>` : ""}</div>`;
    }).join("")}
  </div>`;
}

async function sendReminder(token, jobId) {
  const message = prompt("Scrivi un breve messaggio per SIMPRO (facoltativo):", "Vorrei ricevere un aggiornamento su questa lavorazione.");
  if (message === null) return;
  const { data, error } = await supabase.rpc("submit_client_reminder", {
    p_token: token,
    p_job_id: jobId,
    p_message: message.trim().slice(0, 500),
  });
  if (error) return notice("Non è stato possibile inviare il sollecito.", "error");
  if (!data?.ok) return notice(data?.message || "Hai già inviato un sollecito recente.", "error");
  notice("Sollecito inviato a SIMPRO.");
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
}

async function adminPage() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return loginPage();
  root.innerHTML = `<div class="loading">Caricamento pannello…</div>`;
  const [{ data: clients, error: clientError }, { data: jobs, error: jobError }, { data: reminders, error: reminderError }] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("client_reminders").select("*").order("created_at", { ascending: false }),
  ]);
  if (clientError || jobError || reminderError) {
    root.innerHTML = `<main class="not-found">${logo()}<h1>Configurazione necessaria</h1><p>Il database del portale non è ancora configurato. Esegui il file <strong>supabase/schema.sql</strong> nel SQL Editor di Supabase.</p><button class="primary fit" id="logout">Esci</button></main>`;
    document.querySelector("#logout").onclick = () => supabase.auth.signOut().then(loginPage);
    return;
  }
  renderAdmin(clients || [], jobs || [], reminders || [], clients?.[0]?.id || null);
}

function renderAdmin(clients, jobs, reminders, selectedId) {
  const selected = clients.find((client) => client.id === selectedId) || clients[0] || null;
  const selectedJobs = selected ? jobs.filter((job) => job.client_id === selected.id) : [];
  const selectedReminders = selected ? reminders.filter((item) => item.client_id === selected.id && !item.handled) : [];
  const openReminders = reminders.filter((item) => !item.handled);
  root.innerHTML = `
    <header class="topbar">${logo()}<div class="account"><span><small>Amministratore</small><strong>SIMPRO Lamiere</strong></span><button id="logout">Esci</button></div></header>
    <main class="admin-layout">
      <aside class="sidebar">
        <span class="side-title">GESTIONE</span>
        <button class="active">▦ Clienti e lavorazioni</button>
        <div class="stat"><span>Clienti inseriti</span><strong>${clients.length}</strong></div>
        <div class="stat reminder-stat"><span>Solleciti da gestire</span><strong>${openReminders.length}</strong></div>
      </aside>
      <section class="admin-main">
        <div class="admin-title"><div><span class="eyebrow red">PANNELLO AMMINISTRATORE</span><h1>Clienti e lavorazioni</h1></div><button class="primary fit" id="new-client">+ Nuovo cliente</button></div>
        <div class="admin-grid">
          <section class="client-list">
            <label class="search"><input id="search" placeholder="Cerca cliente…"></label>
            <div id="client-rows">
              ${clients.length ? clients.map(c => `<button class="client-row ${selected?.id === c.id ? "selected" : ""}" data-id="${c.id}"><span><strong>${esc(c.name)}</strong><small>${esc(c.contact_name || c.email || "")}</small></span><b>›</b></button>`).join("") : `<div class="empty small"><p>Nessun cliente inserito.</p></div>`}
            </div>
          </section>
          <section class="detail">
            ${selected ? clientDetail(selected, selectedJobs, selectedReminders) : `<div class="empty"><h2>Inserisci il primo cliente</h2><p>Premi “Nuovo cliente” per iniziare.</p></div>`}
          </section>
        </div>
      </section>
    </main>
    <div id="modal-root"></div>`;

  document.querySelector("#logout").onclick = () => supabase.auth.signOut().then(loginPage);
  document.querySelector("#new-client").onclick = () => newClientModal();
  document.querySelectorAll(".client-row").forEach((button) => button.onclick = () => renderAdmin(clients, jobs, reminders, button.dataset.id));
  const search = document.querySelector("#search");
  search.oninput = () => document.querySelectorAll(".client-row").forEach((row) => {
    row.hidden = !row.textContent.toLowerCase().includes(search.value.toLowerCase());
  });
  if (selected) {
    document.querySelector("#edit-client").onclick = () => editClientModal(selected);
    document.querySelector("#delete-client").onclick = () => deleteClient(selected, selectedJobs.length);
    document.querySelector("#copy-link").onclick = () => copyClientLink(selected.access_token);
    document.querySelector("#new-job").onclick = () => newJobModal(selected.id);
    document.querySelector("#regenerate-link").onclick = () => regenerateLink(selected.id);
    document.querySelectorAll(".edit-job").forEach((button) => button.onclick = () => editJobModal(selectedJobs.find((job) => job.id === button.dataset.id)));
    document.querySelectorAll(".handle-reminder").forEach((button) => button.onclick = () => markReminderHandled(button.dataset.id));
  }
}

function clientDetail(client, jobs, reminders) {
  return `<div class="detail-head">
      <div><small>CLIENTE</small><h2>${esc(client.name)}</h2><p>${esc(client.contact_name || "")}${client.email ? ` · ${esc(client.email)}` : ""}</p></div>
      <div class="client-actions">
        <span class="status ${client.active ? "" : "off"}">${client.active ? "Attivo" : "Disattivato"}</span>
        <button id="edit-client" class="secondary fit">Modifica dati</button>
        <button id="delete-client" class="danger fit" type="button">Elimina cliente</button>
      </div>
    </div>
    ${reminders.length ? `<div class="reminders-box"><div class="reminders-title">🔔 SOLLECITI DEL CLIENTE</div>${reminders.map((item) => {
      const job = jobs.find((entry) => entry.id === item.job_id);
      return `<div class="reminder-row"><span><strong>${esc(job?.title || "Lavorazione")}</strong><small>${formatDate(item.created_at)} · ${esc(item.message || "Richiesta di aggiornamento")}</small></span><button class="handle-reminder" data-id="${item.id}">Segna gestito</button></div>`;
    }).join("")}</div>` : ""}
    <div class="link-box"><span>LINK PERSONALE DEL CLIENTE</span><code>${esc(clientLink(client.access_token))}</code><div><button id="copy-link" class="primary fit">Copia link</button><button id="regenerate-link" class="secondary fit">Genera nuovo link</button></div></div>
    <div class="section-title"><div><h3>Lavorazioni</h3><span>${jobs.length} presenti</span></div><button id="new-job" class="primary fit">+ Aggiungi</button></div>
    <div class="work-list">
      ${jobs.length ? jobs.map((job) => `<button class="work-row edit-job" data-id="${job.id}"><span><strong>${esc(job.title)}</strong><small>${esc(job.code || "")} · ${esc(job.phase)} · Aggiornato il ${formatDate(job.updated_at)}</small></span><b>${Number(job.progress)}%</b></button>`).join("") : `<div class="empty small"><p>Nessuna lavorazione inserita.</p></div>`}
    </div>`;
}

async function markReminderHandled(id) {
  const { error } = await supabase.from("client_reminders").update({ handled: true, handled_at: new Date().toISOString() }).eq("id", id);
  if (error) return notice(error.message, "error");
  notice("Sollecito segnato come gestito.");
  adminPage();
}

function clientLink(token) {
  const url = new URL(CLIENT_PORTAL_URL);
  url.searchParams.set("cliente", token);
  return url.toString();
}

async function copyClientLink(token) {
  await navigator.clipboard.writeText(clientLink(token));
  notice("Link personale copiato.");
}

function modal(content) {
  document.querySelector("#modal-root").innerHTML = `<div class="modal-bg"><div class="modal"><button class="modal-close" type="button">×</button>${content}</div></div>`;
  document.querySelector(".modal-close").onclick = closeModal;
}

function closeModal() {
  document.querySelector("#modal-root").innerHTML = "";
}

function newClientModal() {
  modal(`<span class="eyebrow red">NUOVO CLIENTE</span><h2>Crea area cliente</h2>
    <form id="client-form">
      <label>Ragione sociale<input name="name" required></label>
      <label>Referente<input name="contact_name"></label>
      <label>Email<input name="email" type="email"></label>
      <label>Telefono<input name="phone"></label>
      <button class="primary" type="submit">Crea cliente e link</button>
    </form>`);
  document.querySelector("#client-form").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    data.access_token = crypto.randomUUID();
    const { error } = await supabase.from("clients").insert(data);
    if (error) return notice(error.message, "error");
    notice("Cliente creato.");
    adminPage();
  };
}

function editClientModal(client) {
  modal(`<span class="eyebrow red">DATI CLIENTE</span><h2>Modifica cliente</h2>
    <form id="edit-client-form">
      <label>Ragione sociale<input name="name" required value="${esc(client.name)}"></label>
      <label>Referente<input name="contact_name" value="${esc(client.contact_name)}"></label>
      <label>Email<input name="email" type="email" value="${esc(client.email)}"></label>
      <label>Telefono<input name="phone" value="${esc(client.phone)}"></label>
      <div class="checks">
        <label><input name="active" type="checkbox" ${client.active ? "checked" : ""}> Area cliente attiva</label>
      </div>
      <button class="primary" type="submit">Salva dati cliente</button>
    </form>`);
  document.querySelector("#edit-client-form").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    data.active = data.active === "on";
    data.updated_at = new Date().toISOString();
    const { error } = await supabase.from("clients").update(data).eq("id", client.id);
    if (error) return notice(error.message, "error");
    notice("Dati cliente aggiornati.");
    adminPage();
  };
}

async function deleteClient(client, jobsCount) {
  const jobsText = jobsCount === 1 ? "1 lavorazione collegata" : `${jobsCount} lavorazioni collegate`;
  const confirmed = confirm(
    `Vuoi eliminare definitivamente "${client.name}"?\n\nVerranno eliminati anche ${jobsText}, i solleciti e il link personale del cliente.`
  );
  if (!confirmed) return;

  const verification = prompt(
    `Questa operazione non può essere annullata.\nScrivi ELIMINA per confermare la cancellazione di "${client.name}".`
  );
  if (verification !== "ELIMINA") {
    if (verification !== null) notice("Cancellazione annullata: conferma non corretta.", "error");
    return;
  }

  const { error } = await supabase.from("clients").delete().eq("id", client.id);
  if (error) return notice(error.message, "error");
  notice(`Cliente "${client.name}" eliminato.`);
  adminPage();
}

function newJobModal(clientId) {
  modal(`<span class="eyebrow red">NUOVA LAVORAZIONE</span><h2>Aggiungi lavorazione</h2>${jobForm()}`);
  document.querySelector("#job-form").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    data.client_id = clientId;
    normalizeJobData(data);
    const { error } = await supabase.from("jobs").insert(data);
    if (error) return notice(error.message, "error");
    notice("Lavorazione aggiunta.");
    adminPage();
  };
}

function editJobModal(job) {
  modal(`<span class="eyebrow red">AGGIORNA LAVORAZIONE</span><h2>${esc(job.title)}</h2>${jobForm(job, true)}
    <button class="danger" id="delete-job" type="button">Elimina lavorazione</button>`);
  document.querySelector("#job-form").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const notifyClient = data.notify_client === "on";
    delete data.notify_client;
    normalizeJobData(data);
    data.updated_at = new Date().toISOString();
    const { error } = await supabase.from("jobs").update(data).eq("id", job.id);
    if (error) return notice(error.message, "error");
    if (notifyClient) {
      const { error: emailError } = await supabase.functions.invoke("notify-client", {
        body: { job_id: job.id },
      });
      if (emailError) {
        notice("Aggiornamento salvato, ma l’email non è stata inviata.", "error");
        return adminPage();
      }
      notice("Aggiornamento salvato ed email inviata.");
    } else {
      notice("Aggiornamento salvato.");
    }
    adminPage();
  };
  document.querySelector("#delete-job").onclick = async () => {
    if (!confirm(`Eliminare definitivamente la lavorazione "${job.title}"?`)) return;
    const { error } = await supabase.from("jobs").delete().eq("id", job.id);
    if (error) return notice(error.message, "error");
    notice("Lavorazione eliminata.");
    adminPage();
  };
}

function jobForm(job = {}, showNotification = false) {
  return `<form id="job-form">
    <label>Descrizione<input name="title" required value="${esc(job.title)}" placeholder="Es. Cancello carrabile"></label>
    <label>Codice commessa<input name="code" value="${esc(job.code)}" placeholder="COM-2026-001"></label>
    <label>Step attuale<select name="current_step">${workflowSteps.map((step) => `<option value="${step.key}" ${job.current_step === step.key ? "selected" : ""}>${step.label}</option>`).join("")}</select></label>
    <div class="checks">
      <label><input name="has_galvanizing" type="checkbox" ${job.has_galvanizing ? "checked" : ""}> Prevede zincatura</label>
      <label><input name="has_painting" type="checkbox" ${job.has_painting ? "checked" : ""}> Prevede verniciatura</label>
    </div>
    <label>Consegna prevista<input name="delivery" value="${esc(job.delivery)}" placeholder="Es. Prima settimana di agosto"></label>
    <label>Nota visibile al cliente<textarea name="note" rows="4">${esc(job.note)}</textarea></label>
    ${showNotification ? `<div class="checks notification-check">
      <label><input name="notify_client" type="checkbox"> Invia email al cliente dopo il salvataggio</label>
      <small>L’email verrà inviata all’indirizzo presente nella scheda cliente.</small>
    </div>` : ""}
    <button class="primary" type="submit">Salva lavorazione</button>
  </form>`;
}

function normalizeJobData(data) {
  data.has_galvanizing = data.has_galvanizing === "on";
  data.has_painting = data.has_painting === "on";
  const steps = workflowSteps.filter((step) => !step.optional || data[step.optional]);
  if (!steps.some((step) => step.key === data.current_step)) {
    data.current_step = steps.find((step) => step.key === "arrivo_officina")?.key || steps[0].key;
  }
  const activeIndex = Math.max(0, steps.findIndex((step) => step.key === data.current_step));
  data.progress = Math.round(((activeIndex + 1) / steps.length) * 100);
  data.phase = workflowSteps.find((step) => step.key === data.current_step)?.label || "Materiale ordinato";
}

async function regenerateLink(clientId) {
  if (!confirm("Il vecchio link smetterà immediatamente di funzionare. Continuare?")) return;
  const token = crypto.randomUUID();
  const { error } = await supabase.from("clients").update({ access_token: token }).eq("id", clientId);
  if (error) return notice(error.message, "error");
  await navigator.clipboard.writeText(clientLink(token));
  notice("Nuovo link generato e copiato.");
  adminPage();
}

async function start() {
  const token = new URLSearchParams(window.location.search).get("cliente");
  if (token) return clientPage(token);
  const { data } = await supabase.auth.getSession();
  data.session ? adminPage() : loginPage();
}

start();
