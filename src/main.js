import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const SUPABASE_URL = "https://jrudwnrorufmxjtjtwip.supabase.co";
const SUPABASE_KEY = "sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const root = document.querySelector("#root");

const phases = [
  "Ordine ricevuto",
  "Verifica tecnica",
  "Materiale ordinato",
  "In produzione",
  "Saldatura",
  "Zincatura",
  "Verniciatura",
  "Pronto",
  "Consegnato",
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
        ${jobs.length ? jobs.map(jobCard).join("") : `<div class="empty"><h2>Nessuna lavorazione presente</h2><p>Le nuove lavorazioni compariranno qui appena inserite da SIMPRO.</p></div>`}
      </section>
      <div class="privacy">🔒 Visualizzi esclusivamente le lavorazioni associate al tuo link personale.</div>
    </main>`;
}

function jobCard(job) {
  return `<article class="job-card">
    <div class="job-head"><span>${esc(job.code || "COMMESSA")}</span><b>${esc(job.phase)}</b></div>
    <h2>${esc(job.title)}</h2>
    <div class="progress-line"><strong>${Number(job.progress)}% completato</strong><span>Aggiornato: ${formatDate(job.updated_at)}</span></div>
    <div class="progress"><span style="width:${Number(job.progress)}%"></span></div>
    <div class="job-note"><span>Ultimo aggiornamento</span><p>${esc(job.note || "Nessuna nota disponibile.")}</p></div>
    <div class="job-foot"><span>Consegna prevista</span><strong>${esc(job.delivery || "Da programmare")}</strong></div>
  </article>`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
}

async function adminPage() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return loginPage();
  root.innerHTML = `<div class="loading">Caricamento pannello…</div>`;
  const [{ data: clients, error: clientError }, { data: jobs, error: jobError }] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
  ]);
  if (clientError || jobError) {
    root.innerHTML = `<main class="not-found">${logo()}<h1>Configurazione necessaria</h1><p>Il database del portale non è ancora configurato. Esegui il file <strong>supabase/schema.sql</strong> nel SQL Editor di Supabase.</p><button class="primary fit" id="logout">Esci</button></main>`;
    document.querySelector("#logout").onclick = () => supabase.auth.signOut().then(loginPage);
    return;
  }
  renderAdmin(clients || [], jobs || [], clients?.[0]?.id || null);
}

function renderAdmin(clients, jobs, selectedId) {
  const selected = clients.find((client) => client.id === selectedId) || clients[0] || null;
  const selectedJobs = selected ? jobs.filter((job) => job.client_id === selected.id) : [];
  root.innerHTML = `
    <header class="topbar">${logo()}<div class="account"><span><small>Amministratore</small><strong>SIMPRO Lamiere</strong></span><button id="logout">Esci</button></div></header>
    <main class="admin-layout">
      <aside class="sidebar">
        <span class="side-title">GESTIONE</span>
        <button class="active">▦ Clienti e lavorazioni</button>
        <div class="stat"><span>Clienti inseriti</span><strong>${clients.length}</strong></div>
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
            ${selected ? clientDetail(selected, selectedJobs) : `<div class="empty"><h2>Inserisci il primo cliente</h2><p>Premi “Nuovo cliente” per iniziare.</p></div>`}
          </section>
        </div>
      </section>
    </main>
    <div id="modal-root"></div>`;

  document.querySelector("#logout").onclick = () => supabase.auth.signOut().then(loginPage);
  document.querySelector("#new-client").onclick = () => newClientModal();
  document.querySelectorAll(".client-row").forEach((button) => button.onclick = () => renderAdmin(clients, jobs, button.dataset.id));
  const search = document.querySelector("#search");
  search.oninput = () => document.querySelectorAll(".client-row").forEach((row) => {
    row.hidden = !row.textContent.toLowerCase().includes(search.value.toLowerCase());
  });
  if (selected) {
    document.querySelector("#copy-link").onclick = () => copyClientLink(selected.access_token);
    document.querySelector("#new-job").onclick = () => newJobModal(selected.id);
    document.querySelector("#regenerate-link").onclick = () => regenerateLink(selected.id);
    document.querySelectorAll(".edit-job").forEach((button) => button.onclick = () => editJobModal(selectedJobs.find((job) => job.id === button.dataset.id)));
  }
}

function clientDetail(client, jobs) {
  return `<div class="detail-head">
      <div><small>CLIENTE</small><h2>${esc(client.name)}</h2><p>${esc(client.contact_name || "")}${client.email ? ` · ${esc(client.email)}` : ""}</p></div>
      <span class="status ${client.active ? "" : "off"}">${client.active ? "Attivo" : "Disattivato"}</span>
    </div>
    <div class="link-box"><span>LINK PERSONALE DEL CLIENTE</span><code>${esc(clientLink(client.access_token))}</code><div><button id="copy-link" class="primary fit">Copia link</button><button id="regenerate-link" class="secondary fit">Genera nuovo link</button></div></div>
    <div class="section-title"><div><h3>Lavorazioni</h3><span>${jobs.length} presenti</span></div><button id="new-job" class="primary fit">+ Aggiungi</button></div>
    <div class="work-list">
      ${jobs.length ? jobs.map((job) => `<button class="work-row edit-job" data-id="${job.id}"><span><strong>${esc(job.title)}</strong><small>${esc(job.code || "")} · ${esc(job.phase)}</small></span><b>${Number(job.progress)}%</b></button>`).join("") : `<div class="empty small"><p>Nessuna lavorazione inserita.</p></div>`}
    </div>`;
}

function clientLink(token) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
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

function newJobModal(clientId) {
  modal(`<span class="eyebrow red">NUOVA LAVORAZIONE</span><h2>Aggiungi lavorazione</h2>${jobForm()}`);
  document.querySelector("#job-form").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    data.client_id = clientId;
    data.progress = Number(data.progress);
    const { error } = await supabase.from("jobs").insert(data);
    if (error) return notice(error.message, "error");
    notice("Lavorazione aggiunta.");
    adminPage();
  };
}

function editJobModal(job) {
  modal(`<span class="eyebrow red">AGGIORNA LAVORAZIONE</span><h2>${esc(job.title)}</h2>${jobForm(job)}`);
  document.querySelector("#job-form").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    data.progress = Number(data.progress);
    data.updated_at = new Date().toISOString();
    const { error } = await supabase.from("jobs").update(data).eq("id", job.id);
    if (error) return notice(error.message, "error");
    notice("Aggiornamento salvato.");
    adminPage();
  };
}

function jobForm(job = {}) {
  return `<form id="job-form">
    <label>Descrizione<input name="title" required value="${esc(job.title)}" placeholder="Es. Cancello carrabile"></label>
    <label>Codice commessa<input name="code" value="${esc(job.code)}" placeholder="COM-2026-001"></label>
    <div class="form-grid">
      <label>Fase<select name="phase">${phases.map((phase) => `<option ${job.phase === phase ? "selected" : ""}>${phase}</option>`).join("")}</select></label>
      <label>Avanzamento %<input name="progress" type="number" min="0" max="100" value="${Number(job.progress || 0)}"></label>
    </div>
    <label>Consegna prevista<input name="delivery" value="${esc(job.delivery)}" placeholder="Es. Prima settimana di agosto"></label>
    <label>Nota visibile al cliente<textarea name="note" rows="4">${esc(job.note)}</textarea></label>
    <button class="primary" type="submit">Salva lavorazione</button>
  </form>`;
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
