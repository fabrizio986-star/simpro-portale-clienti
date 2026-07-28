import { createClient } from "@supabase/supabase-js";
import "./styles.css";
import "./reminders.css";
import "./timeline.css";
import "./deletion.css";
import "./notifications.css";
import "./client-edit.css";
import "./status-visuals.css";
import "./admin-enhancements.css";

const SUPABASE_URL = "https://jrudwnrorufmxjtjtwip.supabase.co";
const SUPABASE_KEY = "sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs";
const CLIENT_PORTAL_URL = window.location.hostname === "clienti.simprolamiere.it" ? "https://clienti.simprolamiere.it/" : new URL("./", window.location.href).toString();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const root = document.querySelector("#root");

const completeSteps = [
  { key: "materiale_ordinato", label: "Materiale ordinato", icon: "📦", description: "Il materiale necessario è stato ordinato." },
  { key: "inizio_lavorazione", label: "Inizio lavorazione", icon: "⚙️", description: "La produzione della commessa è iniziata." },
  { key: "fine_lavorazione", label: "Fine lavorazione", icon: "🛠️", description: "La lavorazione principale è stata completata." },
  { key: "zincatura", label: "In zincatura", icon: "🛡️", description: "Il manufatto è in fase di zincatura.", optional: "has_galvanizing" },
  { key: "verniciatura", label: "In verniciatura", icon: "🎨", description: "Il manufatto è in fase di verniciatura.", optional: "has_painting" },
  { key: "arrivo_officina", label: "Arrivo in officina", icon: "🏭", description: "Il manufatto è rientrato nella nostra officina." },
  { key: "controllo", label: "Controllo qualità", icon: "🔍", description: "Stiamo effettuando il controllo finale." },
  { key: "in_attesa_cliente", label: "In attesa cliente", icon: "⏳", description: "Siamo in attesa di una conferma o di un riscontro dal cliente." },
  { key: "pronto_ritiro", label: "Pronto per il ritiro", icon: "✅", description: "La commessa è pronta per il ritiro o la consegna." },
];
const sheetSteps = [
  { key: "ordinazione", label: "Ordinazione", icon: "🧾", description: "La lamiera è stata ordinata." },
  { key: "lavorazione", label: "Lavorazione", icon: "⚙️", description: "La lamiera è in lavorazione." },
  { key: "piegatura", label: "Piegatura", icon: "📐", description: "La lamiera è in fase di piegatura." },
  { key: "verniciatura", label: "Verniciatura", icon: "🎨", description: "La lamiera è in verniciatura.", optional: "has_painting" },
  { key: "in_attesa_cliente", label: "In attesa cliente", icon: "⏳", description: "Siamo in attesa di una conferma o di un riscontro dal cliente." },
  { key: "pronto_ritiro", label: "Pronto per il ritiro", icon: "✅", description: "La lamiera è pronta per il ritiro." },
];
const priorities = { urgente: "🔴 Urgente", alta: "🟠 Alta", normale: "🟡 Normale", bassa: "🟢 Bassa" };
const WHATSAPP_NUMBER = "393780669899";
const whatsappLink = (text = "Buongiorno SIMPRO, vorrei informazioni sulla mia lavorazione.") => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
const painters = ["DAMAS", "SOSAM", "METALLIKA", "GALLO"];
let state = { clients: [], jobs: [], reminders: [], audit: [], paintDeliveries: [], jobPhotos: [], selectedId: null, view: "dashboard", quickFilter: "", paintFilter: "all" };

const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const formatDate = (value) => value ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value)) : "—";
const isoToday = () => new Date().toISOString().slice(0, 10);
const isReady = (job) => job.current_step === "pronto_ritiro";
const isOverdue = (job) => job.due_date && job.due_date < isoToday() && !isReady(job);
const stepsFor = (job) => (job.workflow_type === "lamiere" ? sheetSteps : completeSteps).filter((step) => !step.optional || Boolean(job[step.optional]));
const stepFor = (job) => stepsFor(job).find((step) => step.key === job.current_step) || stepsFor(job)[0];
const publicPhotoUrl = (path) => supabase.storage.from("job-photos").getPublicUrl(path).data.publicUrl;
const paintStatuses = {
  da_portare: "Da portare",
  in_viaggio: "In viaggio",
  consegnato: "Consegnato al verniciatore",
  ritirato: "Ritirato dal verniciatore",
  rientrato: "Rientrato in officina"
};
const normalizePainter = (value = "") => String(value || "").trim().toUpperCase();
function expectedPaintingJob(delivery) {
  const code = String(delivery?.job_code || "").trim().toLowerCase();
  const client = String(delivery?.client_name || "").trim().toLowerCase();
  if (code) {
    const exact = state.jobs.find((job) => String(job.code || "").trim().toLowerCase() === code);
    if (exact) return exact;
  }
  if (client) return state.jobs.find((job) => String(job.title || "").toLowerCase().includes(client) || String(job.code || "").toLowerCase().includes(client));
  return null;
}
function paintingMismatch(delivery) {
  const job = expectedPaintingJob(delivery);
  const expected = normalizePainter(job?.painter);
  const actual = normalizePainter(delivery?.painter);
  return { job, expected, actual, mismatch: Boolean(expected && actual && expected !== actual) };
}
function deliveryPainterFor(delivery) {
  const direct = normalizePainter(delivery?.painter);
  if (direct) return direct;
  return normalizePainter(expectedPaintingJob(delivery)?.painter);
}
async function compressImage(file, maxSize = 1600, quality = 0.78) {
  const originalName = String(file.name || "foto.jpg");
  const name = originalName.toLowerCase();
  const type = String(file.type || "").toLowerCase();
  const supported = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const extensionOk = /\.(jpe?g|png|webp|gif)$/.test(name);
  if (!type.startsWith("image/") && !extensionOk) throw new Error("Carica solo file immagine JPG, PNG, WebP o GIF.");
  if (type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/.test(name)) {
    throw new Error("Formato HEIC non supportato. Scatta in JPG oppure invia la foto su WhatsApp e ricarica il JPG.");
  }
  if (type && !supported.includes(type) && !extensionOk) {
    throw new Error("Formato foto non supportato. Usa JPG, PNG, WebP o GIF.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Foto troppo grande. Carica una foto sotto 10 MB.");
  }
  if (!file.size) throw new Error("La foto selezionata e vuota.");
  if (file.size <= 10 * 1024 * 1024 && (type === "image/gif" || extensionOk)) return file;
  try {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Non riesco a preparare la foto.");
    return new File([blob], originalName.replace(/\.[^.]+$/, ".jpg") || "foto.jpg", { type: "image/jpeg" });
  } catch (error) {
    throw new Error("La foto non puo essere letta dal browser. Usa una foto JPG o PNG.");
  }
}
async function uploadJobPhoto(job, file, caption = "") {
  const prepared = await compressImage(file);
  const ext = prepared.type === "image/png" ? "png" : prepared.type === "image/webp" ? "webp" : "jpg";
  const path = `jobs/${job.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, prepared, { contentType: prepared.type, cacheControl: "3600", upsert: false });
  if (uploadError) throw new Error(`Upload foto fallito: ${uploadError.message || "permessi storage non validi"}.`);
  const url = publicPhotoUrl(path);
  const { error } = await supabase.from("job_photos").insert({ job_id: job.id, storage_path: path, url, caption });
  if (error) throw new Error(`Foto caricata ma non salvata nella commessa: ${error.message || "tabella job_photos non valida"}.`);
  return { path, url };
}
async function uploadPaintingPhoto(file, fallbackCode = "verniciatura") {
  const prepared = await compressImage(file);
  const ext = prepared.type === "image/png" ? "png" : prepared.type === "image/webp" ? "webp" : "jpg";
  const safeCode = String(fallbackCode || "verniciatura").replace(/[^a-z0-9_-]/gi, "-").slice(0, 40) || "verniciatura";
  const path = `painting-deliveries/${safeCode}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, prepared, { contentType: prepared.type, cacheControl: "3600", upsert: false });
  if (uploadError) throw new Error(uploadError.message || "Upload foto fallito.");
  return { photo_storage_path: path, photo_url: publicPhotoUrl(path) };
}

function driverDeliveryRow(item) {
  return `<article class="driver-delivery-row">
    <div>
      <strong>${esc(item.client_name || "Cliente")}</strong>
      <small>${esc(item.job_code || "Senza codice")} · ${esc(item.painter || "Verniciatore non indicato")}</small>
      <span class="driver-status">${esc(paintStatuses[item.material_status] || item.material_status || "Consegnato")}</span>
      ${item.notes ? `<p>${esc(item.notes)}</p>` : ""}
      <small>Inserito il ${formatDate(item.created_at)}${item.driver_name ? ` · ${esc(item.driver_name)}` : ""}</small>
    </div>
    ${item.photo_url ? `<a class="driver-photo" href="${esc(item.photo_url)}" target="_blank" rel="noopener"><img src="${esc(item.photo_url)}" alt="Foto verniciatura"></a>` : ""}
  </article>`;
}
function driverSituationList(items = []) {
  if (!items.length) return `<div class="empty small"><p>Nessun movimento registrato.</p></div>`;
  return items.map(driverDeliveryRow).join("");
}

function logo(clickable = true) { const image = `<img src="https://www.simprolamiere.it/wp-content/uploads/2024/07/logo-simpro-128x128.png" alt="SIMPRO Lamiere">`; return clickable ? `<a class="brand" href="./" aria-label="SIMPRO Lamiere">${image}</a>` : `<span class="brand" aria-label="SIMPRO Lamiere">${image}</span>`; }
function notice(message, type = "ok") { document.querySelector(".toast")?.remove(); const node = document.createElement("div"); node.className = `toast ${type}`; node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 3500); }
function showAuth(message, ok = false) { const node = document.querySelector("#auth-message"); node.textContent = message; node.className = `form-message ${ok ? "ok" : "error"}`; }

function loginPage() {
  root.innerHTML = `<main class="login-page"><section class="login-intro">${logo()}<div><span class="eyebrow">PORTALE CLIENTI</span><h1>Il tuo lavoro,<br>passo dopo passo.</h1><p>Controlla in modo semplice e trasparente lo stato delle tue lavorazioni SIMPRO.</p></div><small>Precisione · Qualità · Trasparenza</small></section><section class="login-panel"><form id="login-form" class="login-card"><div class="mobile-logo">${logo()}</div><span class="eyebrow red">ACCESSO SIMPRO</span><h2>Area amministratore</h2><p>Accesso riservato al personale autorizzato SIMPRO Lamiere.</p><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" minlength="8" autocomplete="current-password" required></label><div id="auth-message" class="form-message"></div><button class="primary" type="submit">Accedi <span>→</span></button><button class="secondary" id="signup" type="button">Crea il primo accesso</button><small class="help">I clienti entrano direttamente dal proprio link personale.</small></form></section></main>`;
  const form = document.querySelector("#login-form");
  form.onsubmit = async (event) => { event.preventDefault(); const data = new FormData(form); const { error } = await supabase.auth.signInWithPassword({ email: data.get("email"), password: data.get("password") }); if (error) return showAuth(error.message); adminPage(); };
  document.querySelector("#signup").onclick = async () => { const data = new FormData(form); const email = String(data.get("email") || ""); const password = String(data.get("password") || ""); if (!email || password.length < 8) return showAuth("Inserisci email e una password di almeno 8 caratteri."); const { error } = await supabase.auth.signUp({ email, password }); showAuth(error ? error.message : "Accesso creato. Controlla la tua email per confermarlo.", !error); };
}

async function clientPage(token) {
  root.innerHTML = `<div class="loading">Caricamento area cliente…</div>`;
  const { data, error } = await supabase.rpc("get_client_portal", { p_token: token });
  if (error || !data) { root.innerHTML = `<main class="not-found">${logo(false)}<h1>Link non valido</h1><p>Il collegamento è scaduto o è stato disattivato. Contatta SIMPRO Lamiere.</p></main>`; return; }
  const client = data.client; const jobs = data.jobs || []; const photosByJob = data.photos || {};
  root.innerHTML = `<header class="topbar">${logo(false)}<div class="account"><small>Area personale</small><strong>${esc(client.name)}</strong></div></header><main class="client-wrap"><section class="welcome"><span class="eyebrow red">LA TUA AREA PERSONALE</span><h1>Buongiorno, ${esc(client.contact_name || client.name)}</h1><p>Qui trovi lo stato aggiornato delle lavorazioni associate alla tua azienda.</p></section><section class="job-grid">${jobs.length ? jobs.map((job) => jobCard(job, photosByJob[job.id] || [])).join("") : `<div class="empty"><h2>Nessuna lavorazione presente</h2><p>Le nuove lavorazioni compariranno qui appena inserite da SIMPRO.</p></div>`}</section><a class="whatsapp-contact" href="${whatsappLink()}" target="_blank" rel="noopener">💬 Contattaci su WhatsApp</a><div class="privacy">🔒 Visualizzi esclusivamente le lavorazioni associate al tuo link personale.</div></main>`;
  document.querySelectorAll(".send-reminder").forEach((button) => button.onclick = () => sendReminder(token, button.dataset.job));
}
function jobCard(job, photos = []) { const current = stepFor(job); return `<article class="job-card"><div class="job-head"><span>${esc(job.code || "COMMESSA")}</span><b><span>${current.icon}</span>${esc(current.label)}</b></div><h2>${esc(job.title)}</h2><div class="status-visual status-${esc(current.key)}"><span class="status-illustration">${current.icon}</span><div><small>STATO ATTUALE</small><strong>${esc(current.label)}</strong><p>${esc(current.description)}</p></div></div><div class="progress-line"><strong>${Number(job.progress)}% completato</strong><span>Aggiornato: ${formatDate(job.updated_at)}</span></div><div class="progress"><span style="width:${Number(job.progress)}%"></span></div>${workflowTimeline(job)}<div class="job-note"><span>Ultimo aggiornamento</span><p>${esc(job.note || "Nessuna nota disponibile.")}</p></div>${job.payment_notice ? `<div class="payment-notice"><span>💳</span><div><small>AVVISO PAGAMENTO</small><strong>${esc(job.payment_notice)}</strong></div></div>` : ""}${photoGallery(photos)}${job.requires_installation ? `<div class="installation-badge"><span>🧰</span><div><small>SERVIZIO PREVISTO</small><strong>Installazione a cura di SIMPRO</strong></div></div>` : ""}<div class="job-foot"><span>Consegna prevista</span><strong>${esc(job.delivery || (job.due_date ? formatDate(job.due_date) : "Da programmare"))}</strong></div><button class="reminder-btn send-reminder" data-job="${job.id}">🔔 Richiedi un aggiornamento</button></article>`; }
function photoGallery(photos = []) {
  if (!photos.length) return "";
  return `<div class="photo-gallery"><div class="photo-title">FOTO COMMESSA</div><div class="photo-grid">${photos.map((photo) => `<a href="${esc(photo.url)}" target="_blank" rel="noopener"><img src="${esc(photo.url)}" alt="${esc(photo.caption || "Foto commessa")}"></a>`).join("")}</div></div>`;
}
function workflowTimeline(job) { const steps = stepsFor(job); const active = Math.max(0, steps.findIndex((step) => step.key === job.current_step)); return `<div class="timeline"><div class="timeline-title">STATO DELLA LAVORAZIONE</div>${steps.map((step, index) => { const status = index < active ? "done" : index === active ? "current" : "pending"; return `<div class="timeline-step ${status}"><span class="timeline-dot">${status === "done" ? "✓" : step.icon}</span><strong>${esc(step.label)}</strong>${status === "current" ? `<small>Aggiornato il ${formatDate(job.updated_at)}</small>` : ""}</div>`; }).join("")}</div>`; }
async function sendReminder(token, jobId) { const message = prompt("Scrivi un breve messaggio per SIMPRO (facoltativo):", "Vorrei ricevere un aggiornamento su questa lavorazione."); if (message === null) return; const { data, error } = await supabase.rpc("submit_client_reminder", { p_token: token, p_job_id: jobId, p_message: message.trim().slice(0, 500) }); if (error) return notice("Non è stato possibile inviare il sollecito.", "error"); if (!data?.ok) return notice(data?.message || "Hai già inviato un sollecito recente.", "error"); notice("Abbiamo ricevuto la tua richiesta. Ti aggiorneremo appena possibile."); }

async function adminPage() {
  const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return loginPage();
  root.innerHTML = `<div class="loading">Caricamento pannello…</div>`;
  const results = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("client_reminders").select("*").order("created_at", { ascending: false }),
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("painting_deliveries").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("job_photos").select("*").order("created_at", { ascending: false }).limit(500),
  ]);
  if (results[0].error || results[1].error || results[2].error) { root.innerHTML = `<main class="not-found">${logo()}<h1>Configurazione necessaria</h1><p>Esegui nel SQL Editor di Supabase il file <strong>supabase/migrations/20260727_portal_management.sql</strong>.</p><button class="primary fit" id="logout">Esci</button></main>`; document.querySelector("#logout").onclick = () => supabase.auth.signOut().then(loginPage); return; }
  state.clients = results[0].data || []; state.jobs = results[1].data || []; state.reminders = results[2].data || []; state.audit = results[3].data || []; state.paintDeliveries = results[4].data || []; state.jobPhotos = results[5].data || []; state.selectedId ||= state.clients[0]?.id || null; renderAdmin();
}

function nav() { const open = state.reminders.filter((item) => !item.handled).length; const pendingPaint = state.paintDeliveries.filter((item) => !item.checked).length; return `<aside class="sidebar"><span class="side-title">GESTIONE</span>${[["dashboard","▦ Dashboard"],["today","✓ Da fare oggi"],["clients","👥 Clienti e lavorazioni"],["painting","🎨 Verniciatura"],["stats","▥ Statistiche"],["admin","⚙ Amministrazione"]].map(([key,label]) => `<button class="nav-button ${state.view === key ? "active" : ""}" data-view="${key}">${label}${key === "today" && open ? `<b>${open}</b>` : ""}${key === "painting" && pendingPaint ? `<b>${pendingPaint}</b>` : ""}</button>`).join("")}<div class="stat"><span>Clienti inseriti</span><strong>${state.clients.length}</strong></div><div class="stat"><span>Lavorazioni attive</span><strong>${state.jobs.filter((job) => !isReady(job)).length}</strong></div></aside>`; }
function renderAdmin() { root.innerHTML = `<header class="topbar">${logo()}<div class="account"><span><small>Amministratore</small><strong>SIMPRO Lamiere</strong></span><button id="logout">Esci</button></div></header><main class="admin-layout">${nav()}<section class="admin-main">${viewContent()}</section></main><div id="modal-root"></div>`; document.querySelector("#logout").onclick = () => supabase.auth.signOut().then(loginPage); document.querySelectorAll(".nav-button").forEach((button) => button.onclick = () => { state.view = button.dataset.view; renderAdmin(); }); bindView(); }
function viewContent() { if (state.view === "clients") return clientsView(); if (state.view === "today") return todayView(); if (state.view === "painting") return paintingView(); if (state.view === "stats") return statsView(); if (state.view === "admin") return adminView(); return dashboardView(); }
function titleBlock(title, action = "") { return `<div class="admin-title"><div><span class="eyebrow red">PANNELLO AMMINISTRATORE</span><h1>${title}</h1></div>${action}</div>`; }
function kpi(label, value, icon, danger = false, filter = "") { const tag = filter ? "button" : "div"; return `<${tag} class="kpi ${danger ? "danger" : ""} ${filter ? "kpi-action" : ""}" ${filter ? `data-filter="${filter}" type="button"` : ""}><span>${icon}</span><div><small>${label}</small><strong>${value}</strong></div></${tag}>`; }

function dashboardView() {
  const ready = state.jobs.filter(isReady); const overdue = state.jobs.filter(isOverdue); const open = state.reminders.filter((item) => !item.handled); const todayUpdated = state.jobs.filter((job) => job.updated_at?.slice(0,10) === isoToday());
  const latest = [...state.jobs].sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0,7);
  return `${titleBlock("Dashboard", `<button class="primary fit" id="new-client">+ Nuovo cliente</button>`)}<div class="kpi-grid">${kpi("Clienti", state.clients.length, "👥", false, "all")}${kpi("In lavorazione", state.jobs.length-ready.length, "⚙️", false, "active")}${kpi("Pronte per ritiro", ready.length, "✅", false, "ready")}${kpi("Aggiornate oggi", todayUpdated.length, "📅", false, "updated_today")}${kpi("In ritardo", overdue.length, "⚠️", overdue.length>0, "overdue")}</div><div class="dashboard-grid"><section class="panel"><div class="panel-title"><h2>Da gestire</h2><span>${open.length + overdue.length}</span></div>${open.slice(0,4).map((item) => activityReminder(item)).join("")}${overdue.slice(0,4).map((job) => activityJob(job, "Scadenza superata")).join("") || (!open.length ? `<div class="empty small"><p>Nessuna urgenza.</p></div>` : "")}</section><section class="panel"><div class="panel-title"><h2>Ultimi aggiornamenti</h2><span>${latest.length}</span></div>${latest.map((job) => activityJob(job, stepFor(job).label)).join("") || `<div class="empty small"><p>Nessuna lavorazione.</p></div>`}</section></div>`;
}
function activityReminder(item) { const job = state.jobs.find((entry) => entry.id === item.job_id); const client = state.clients.find((entry) => entry.id === item.client_id); return `<button class="today-row open-client" data-client="${item.client_id}"><span><strong>🔔 ${esc(client?.name || "Cliente")}</strong><small>${esc(job?.title || "Lavorazione")} · ${formatDate(item.created_at)}</small></span><b>Apri</b></button>`; }
function activityJob(job, label) { const client = state.clients.find((entry) => entry.id === job.client_id); return `<button class="today-row open-client" data-client="${job.client_id}"><span><strong>${esc(job.title)}</strong><small>${esc(client?.name || "")} · ${esc(label)}</small></span><b>›</b></button>`; }

function todayView() {
  const reminders = state.reminders.filter((item) => !item.handled); const overdue = state.jobs.filter(isOverdue); const urgent = state.jobs.filter((job) => job.priority === "urgente" && !isReady(job)); const ready = state.jobs.filter(isReady); const todayDue = state.jobs.filter((job) => job.due_date === isoToday());
  const panel = (title, items, renderer) => `<section class="panel"><div class="panel-title"><h2>${title}</h2><span>${items.length}</span></div>${items.length ? items.map(renderer).join("") : `<div class="empty small"><p>Nessuna voce.</p></div>`}</section>`;
  return `${titleBlock("Da fare oggi")}<div class="today-grid">${panel("Solleciti clienti", reminders, activityReminder)}${panel("Scadenze di oggi", todayDue, (job) => activityJob(job, priorities[job.priority] || "Normale"))}${panel("Lavorazioni urgenti", urgent, (job) => activityJob(job, stepFor(job).label))}${panel("Lavorazioni in ritardo", overdue, (job) => activityJob(job, `Scaduta il ${formatDate(job.due_date)}`))}${panel("Pronte per ritiro", ready, (job) => activityJob(job, "Avvisare il cliente"))}</div>`;
}

function clientsView() {
  const selected = state.clients.find((client) => client.id === state.selectedId) || state.clients[0] || null; if (selected) state.selectedId = selected.id;
  const jobs = selected ? state.jobs.filter((job) => job.client_id === selected.id) : []; const reminders = selected ? state.reminders.filter((item) => item.client_id === selected.id && !item.handled) : []; const quick = state.quickFilter || "";
  return `${titleBlock("Clienti e lavorazioni", `<button class="primary fit" id="new-client">+ Nuovo cliente</button>`)}<section class="panel advanced-search"><div class="filter-grid"><label>Ricerca<input id="filter-text" placeholder="Cliente, commessa, telefono…"></label><label>Stato<select id="filter-status"><option value="" ${quick === "all" || !quick ? "selected" : ""}>Tutti</option><option value="active" ${quick === "active" ? "selected" : ""}>In lavorazione</option><option value="ready" ${quick === "ready" ? "selected" : ""}>Pronto ritiro</option><option value="updated_today" ${quick === "updated_today" ? "selected" : ""}>Aggiornati oggi</option><option value="overdue" ${quick === "overdue" ? "selected" : ""}>In ritardo</option></select></label><label>Priorità<select id="filter-priority"><option value="">Tutte</option>${Object.entries(priorities).map(([key,value]) => `<option value="${key}">${value}</option>`).join("")}</select></label><label>Timeline<select id="filter-workflow"><option value="">Tutte</option><option value="completa">Completa</option><option value="lamiere">Lamiere</option></select></label><label>Verniciatore<select id="filter-painter"><option value="">Tutti</option>${painters.map((value) => `<option>${value}</option>`).join("")}</select></label></div></section><div class="admin-grid"><section class="client-list"><div id="client-rows">${state.clients.map((client) => clientRow(client)).join("") || `<div class="empty small"><p>Nessun cliente inserito.</p></div>`}</div></section><section class="detail">${selected ? clientDetail(selected, jobs, reminders) : `<div class="empty"><h2>Inserisci il primo cliente</h2></div>`}</section></div>`;
}
function clientRow(client) { const jobs = state.jobs.filter((job) => job.client_id === client.id); return `<button class="client-row ${state.selectedId === client.id ? "selected" : ""}" data-id="${client.id}" data-search="${esc(`${client.name} ${client.contact_name || ""} ${client.email || ""} ${client.phone || ""}`.toLowerCase())}" data-priorities="${jobs.map((job) => job.priority).join(" ")}" data-workflows="${jobs.map((job) => job.workflow_type).join(" ")}" data-painters="${jobs.map((job) => job.painter).join(" ")}" data-ready="${jobs.some(isReady)}" data-active="${jobs.some((job) => !isReady(job))}" data-updated-today="${jobs.some((job) => job.updated_at?.slice(0,10) === isoToday())}" data-overdue="${jobs.some(isOverdue)}"><span><strong>${esc(client.name)}</strong><small>${esc(client.contact_name || client.email || client.phone || "")}</small></span><b>›</b></button>`; }
function priorityBadge(job) { const key = job.priority || "normale"; return `<i class="priority priority-${key}">${priorities[key]}</i>`; }
function clientDetail(client, jobs, reminders) { return `<div class="detail-head"><div><small>CLIENTE</small><h2>${esc(client.name)}</h2><p>${esc(client.contact_name || "")}${client.email ? ` · ${esc(client.email)}` : ""}${client.phone ? ` · ${esc(client.phone)}` : ""}</p></div><div class="client-actions"><span class="status ${client.active ? "" : "off"}">${client.active ? "Attivo" : "Disattivato"}</span><button id="edit-client" class="secondary fit">Modifica dati</button><button id="delete-client" class="danger fit">Elimina cliente</button></div></div>${reminders.length ? `<div class="reminders-box"><div class="reminders-title">🔔 SOLLECITI DEL CLIENTE</div>${reminders.map((item) => { const job = jobs.find((entry) => entry.id === item.job_id); return `<div class="reminder-row"><span><strong>${esc(job?.title || "Lavorazione")}</strong><small>${formatDate(item.created_at)} · ${esc(item.message || "Richiesta di aggiornamento")}</small></span><button class="handle-reminder" data-id="${item.id}">Segna gestito</button></div>`; }).join("")}</div>` : ""}<div class="link-box"><span>LINK PERSONALE DEL CLIENTE</span><code>${esc(clientLink(client.access_token))}</code><div><button id="copy-link" class="primary fit">Copia link</button><button id="regenerate-link" class="secondary fit">Genera nuovo link</button></div></div><div class="section-title"><div><h3>Lavorazioni</h3><span>${jobs.length} presenti</span></div><button id="new-job" class="primary fit">+ Aggiungi</button></div><div class="work-list">${jobs.length ? jobs.map((job) => { const step = stepFor(job); return `<button class="work-row edit-job ${isOverdue(job) ? "overdue" : ""}" data-id="${job.id}"><span class="work-icon">${step.icon}</span><span><strong>${esc(job.title)} ${priorityBadge(job)}</strong><small>${esc(job.code || "")} · ${esc(step.label)}${job.painter ? ` · ${esc(job.painter)}` : ""} · Aggiornato il ${formatDate(job.updated_at)}</small></span><b>${Number(job.progress)}%</b></button>`; }).join("") : `<div class="empty small"><p>Nessuna lavorazione inserita.</p></div>`}</div>`; }

function paintingView() {
  const link = new URL(CLIENT_PORTAL_URL); link.searchParams.set("autista", "1");
  const rows = state.paintDeliveries;
  const openRows = rows.filter((item) => !["rientrato"].includes(item.material_status || "") && !item.checked);
  const mismatchRows = rows.filter((item) => paintingMismatch(item).mismatch);
  const uncheckedRows = rows.filter((item) => !item.checked || paintingMismatch(item).mismatch);
  const noPhotoRows = rows.filter((item) => !item.photo_url);
  const controlRows = [...new Map([...mismatchRows, ...uncheckedRows, ...noPhotoRows].map((item) => [item.id, item])).values()];
  const byPainter = painters.map((painter) => [painter, rows.filter((item) => deliveryPainterFor(item) === painter && (item.material_status || "consegnato") !== "rientrato").length]);
  const statusLabel = (value) => paintStatuses[value || "consegnato"] || "Consegnato al verniciatore";
  const activeFilter = state.paintFilter || "all";
  const filterLabels = { all: "Tutti", open: "Movimenti aperti", unchecked: "Da controllare", mismatch: "Errore verniciatore", no_photo: "Senza foto", ...Object.fromEntries(painters.map((painter) => [`painter:${painter}`, painter])) };
  const filteredRows = rows.filter((item) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "open") return !["rientrato"].includes(item.material_status || "") && !item.checked;
    if (activeFilter === "unchecked") return !item.checked || paintingMismatch(item).mismatch;
    if (activeFilter === "mismatch") return paintingMismatch(item).mismatch;
    if (activeFilter === "no_photo") return !item.photo_url;
    if (activeFilter.startsWith("painter:")) return deliveryPainterFor(item) === normalizePainter(activeFilter.replace("painter:", ""));
    return true;
  });
  const paintKpi = (label, value, icon, filter, danger = false) => `<button class="kpi kpi-action paint-filter ${danger ? "danger" : ""} ${activeFilter === filter ? "active" : ""}" data-paint-filter="${esc(filter)}" type="button"><span>${icon}</span><div><small>${esc(label)}</small><strong>${value}</strong></div></button>`;
  const painterLaneItems = painters.map((painter) => {
    const laneRows = rows.filter((item) => deliveryPainterFor(item) === painter && (item.material_status || "consegnato") !== "rientrato");
    const cards = laneRows.slice(0, 8).map((item) => {
      const check = paintingMismatch(item);
      const status = statusLabel(item.material_status);
      return `<button class="painter-lane-card paint-filter ${check.mismatch || !item.checked ? "attention" : ""}" type="button" data-paint-filter="painter:${esc(painter)}">
        <strong>${esc(item.client_name || "Cliente")}</strong>
        <small>${esc(item.job_code || "Senza codice")} · ${esc(status)}</small>
        ${check.mismatch ? `<b>Errore: previsto ${esc(check.expected)}, inserito ${esc(check.actual)}</b>` : (!item.checked ? `<b>Da controllare</b>` : `<span>Controllato</span>`)}
      </button>`;
    }).join("");
    return `<article class="painter-lane">
      <button class="painter-lane-head paint-filter" type="button" data-paint-filter="painter:${esc(painter)}">
        <span>${esc(painter)}</span><strong>${laneRows.length}</strong>
      </button>
      <div class="painter-lane-list">${cards || `<div class="empty small"><p>Nessun materiale aperto.</p></div>`}</div>
    </article>`;
  }).join("");
  const items = filteredRows.map((item) => {
    const check = paintingMismatch(item);
    const related = check.job;
    const expected = check.expected;
    const mismatch = check.mismatch;
    return `<div class="paint-row ${item.checked ? "checked" : ""} ${mismatch ? "mismatch" : ""}">
      ${item.photo_url ? `<a class="paint-photo" href="${esc(item.photo_url)}" target="_blank" rel="noopener"><img src="${esc(item.photo_url)}" alt="Foto verniciatura"></a>` : `<div class="paint-photo empty-photo">No foto</div>`}
      <span>
        <strong>${esc(item.client_name)}${item.job_code ? ` · ${esc(item.job_code)}` : ""}</strong>
        <small><b>${esc(statusLabel(item.material_status))}</b> · ${esc(deliveryPainterFor(item) || item.painter || "Verniciatore non indicato")} · ${formatDate(item.created_at)}</small>
        ${item.driver_name ? `<small>Autista: ${esc(item.driver_name)}</small>` : ""}
        ${item.notes ? `<small>Note: ${esc(item.notes)}</small>` : ""}
        ${expected ? `<small class="${mismatch ? "paint-warning" : ""}">${mismatch ? "ATTENZIONE: " : ""}Previsto: ${esc(expected)} · Portato: ${esc(item.painter || "-")}${mismatch ? " - DA CONTROLLARE" : " - corretto"}</small>` : `<small>Nessun verniciatore assegnato nella scheda cliente.</small>`}
      </span>
      <div class="paint-actions">
        <select class="paint-status-select" data-id="${item.id}">
          ${Object.entries(paintStatuses).map(([key, label]) => `<option value="${key}" ${(item.material_status || "consegnato") === key ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        ${mismatch ? `<label class="paint-correct-label">Verniciatore corretto<select class="paint-correct-select" data-id="${item.id}">${painters.map((value) => `<option value="${value}" ${value === expected ? "selected" : ""}>${value}</option>`).join("")}</select></label>` : ""}
        <button class="secondary fit check-paint" data-id="${item.id}">${mismatch ? "Approva con correzione" : (item.checked ? "Controllato" : "Segna controllato")}</button>
        <button class="danger fit delete-paint" data-id="${item.id}">Elimina</button>
      </div>
    </div>`;
  }).join("");
  const controlPreview = controlRows.slice(0, 5).map((item) => {
    const check = paintingMismatch(item);
    const problems = [check.mismatch ? `Verniciatore errato: previsto ${check.expected}, inserito ${check.actual}` : "", !item.checked ? "Da approvare" : "", !item.photo_url ? "Foto mancante" : ""].filter(Boolean).join(" · ");
    return `<button class="painting-control-row paint-filter" type="button" data-paint-filter="${check.mismatch ? "mismatch" : (!item.photo_url ? "no_photo" : "unchecked")}"><span><strong>${esc(item.client_name || "Cliente")}${item.job_code ? ` · ${esc(item.job_code)}` : ""}</strong><small>${esc(problems || "Da controllare")}</small></span><b>Apri</b></button>`;
  }).join("");
  return `${titleBlock("Controllo verniciatura", `<div class="title-actions"><button class="primary fit" id="new-paint-delivery" type="button">+ Inserisci manualmente</button><a class="secondary fit driver-link" href="${link}" target="_blank" rel="noopener">Apri pagina autista</a></div>`)}
    <div class="kpi-grid paint-kpis">
      ${paintKpi("Tutti", rows.length, "▦", "all")}
      ${paintKpi("Movimenti aperti", openRows.length, "🎨", "open", openRows.length > 0)}
      ${paintKpi("Da controllare", uncheckedRows.length, "⚠️", "unchecked", uncheckedRows.length > 0)}
      ${paintKpi("Errori verniciatore", mismatchRows.length, "!", "mismatch", mismatchRows.length > 0)}
      ${paintKpi("Senza foto", noPhotoRows.length, "📷", "no_photo", noPhotoRows.length > 0)}
      ${byPainter.map(([label, value]) => paintKpi(label, value, "▦", `painter:${label}`)).join("")}
    </div>
    <section class="panel painting-control"><div class="panel-title"><h2>Controllo verniciatura</h2><span>${controlRows.length}</span></div>${controlRows.length ? controlPreview : `<div class="empty small"><p>Nessun controllo aperto.</p></div>`}</section>
    <section class="panel painter-board"><div class="panel-title"><h2>Vista per verniciatore</h2><span>Materiale aperto</span></div><div class="painter-lanes">${painterLaneItems}</div></section>
    <section class="panel"><div class="panel-title"><h2>Materiale in verniciatura</h2><span>${esc(filterLabels[activeFilter] || "Tutti")} · ${filteredRows.length}</span></div>${filteredRows.length ? items : `<div class="empty small"><p>Nessun movimento per questo filtro.</p></div>`}</section>`;
}
function statsView() {
  const totals = Object.fromEntries(Object.keys(priorities).map((key) => [key, state.jobs.filter((job) => job.priority === key).length])); const max = Math.max(1, ...Object.values(totals)); const complete = state.jobs.filter((job) => job.workflow_type !== "lamiere").length; const sheets = state.jobs.filter((job) => job.workflow_type === "lamiere").length; const ready = state.jobs.filter(isReady).length;
  return `${titleBlock("Statistiche")}<div class="kpi-grid">${kpi("Totale lavorazioni", state.jobs.length, "▦")}${kpi("Timeline completa", complete, "🏗️")}${kpi("Timeline lamiere", sheets, "📐")}${kpi("Pronte per ritiro", ready, "✅")}${kpi("In ritardo", state.jobs.filter(isOverdue).length, "⚠️", state.jobs.some(isOverdue))}</div><div class="dashboard-grid"><section class="panel"><div class="panel-title"><h2>Lavorazioni per priorità</h2></div>${Object.entries(priorities).map(([key,label]) => `<div class="bar-row"><div><span>${label}</span><strong>${totals[key]}</strong></div><div class="bar"><i style="width:${Math.round(totals[key]/max*100)}%"></i></div></div>`).join("")}</section><section class="panel"><div class="panel-title"><h2>Stato lavorazioni</h2></div>${[["In lavorazione",state.jobs.length-ready],["Pronte per ritiro",ready],["In ritardo",state.jobs.filter(isOverdue).length]].map(([label,value]) => `<div class="bar-row"><div><span>${label}</span><strong>${value}</strong></div><div class="bar"><i style="width:${state.jobs.length ? Math.round(value/state.jobs.length*100) : 0}%"></i></div></div>`).join("")}</section></div>`;
}
function adminView() { return `${titleBlock("Amministrazione")}<div class="dashboard-grid"><section class="panel"><div class="panel-title"><h2>Registro modifiche</h2><span>${state.audit.length}</span></div>${state.audit.length ? state.audit.slice(0,40).map((item) => `<div class="activity-row"><span><strong>${esc(item.description || item.action)}</strong><small>${esc(item.user_email || "Amministratore")}</small></span><small>${formatDate(item.created_at)}</small></div>`).join("") : `<div class="empty small"><p>Il registro inizierà con le prossime modifiche.</p></div>`}</section><section class="panel"><div class="panel-title"><h2>Configurazione</h2></div><div class="admin-info"><strong>Dati riservati</strong><p>Verniciatore e note amministrative sono disponibili esclusivamente nel pannello amministratore e non vengono inviati all’area cliente.</p></div><div class="admin-info"><strong>Backup</strong><p>I dati sono conservati su Supabase. È consigliata l’attivazione dei backup automatici dal pannello Supabase.</p></div><div class="admin-info"><strong>Permessi</strong><p>L’accesso amministrativo è limitato alle email presenti nella tabella admin_emails.</p></div></section></div>`; }

function bindView() {
  document.querySelector("#new-client")?.addEventListener("click", newClientModal); document.querySelectorAll(".paint-filter").forEach((button) => button.onclick = () => { state.paintFilter = button.dataset.paintFilter || "all"; state.view = "painting"; renderAdmin(); }); document.querySelectorAll(".kpi-action:not(.paint-filter)").forEach((button) => button.onclick = () => { state.quickFilter = button.dataset.filter || ""; state.view = "clients"; renderAdmin(); });
  document.querySelector("#new-paint-delivery")?.addEventListener("click", manualPaintingDeliveryModal);
  document.querySelectorAll(".open-client").forEach((button) => button.onclick = () => { state.selectedId = button.dataset.client; state.view = "clients"; renderAdmin(); });
  document.querySelectorAll(".check-paint").forEach((button) => button.onclick = () => {
    const correction = document.querySelector(`.paint-correct-select[data-id="${button.dataset.id}"]`)?.value || "";
    markPaintingChecked(button.dataset.id, correction);
  });
  document.querySelectorAll(".delete-paint").forEach((button) => button.onclick = () => deletePaintingDelivery(button.dataset.id));
  document.querySelectorAll(".paint-status-select").forEach((select) => select.onchange = () => updatePaintingStatus(select.dataset.id, select.value));
  document.querySelectorAll(".client-row").forEach((button) => button.onclick = () => { state.selectedId = button.dataset.id; renderAdmin(); });
  const applyFilters = () => { const text = document.querySelector("#filter-text")?.value.toLowerCase() || ""; const status = document.querySelector("#filter-status")?.value || ""; const priority = document.querySelector("#filter-priority")?.value || ""; const workflow = document.querySelector("#filter-workflow")?.value || ""; const painter = document.querySelector("#filter-painter")?.value || ""; document.querySelectorAll(".client-row").forEach((row) => { const statusOk = !status || status === "all" || (status === "ready" && row.dataset.ready === "true") || (status === "updated_today" && row.dataset.updatedToday === "true") || (status === "overdue" && row.dataset.overdue === "true") || (status === "active" && row.dataset.active === "true"); row.hidden = !(row.dataset.search.includes(text) && (!priority || row.dataset.priorities.includes(priority)) && (!workflow || row.dataset.workflows.includes(workflow)) && (!painter || row.dataset.painters.includes(painter)) && statusOk); }); };
  ["filter-text","filter-status","filter-priority","filter-workflow","filter-painter"].forEach((id) => document.querySelector(`#${id}`)?.addEventListener("input", () => { state.quickFilter = ""; applyFilters(); })); applyFilters();
  const selected = state.clients.find((client) => client.id === state.selectedId); if (!selected) return;
  const jobs = state.jobs.filter((job) => job.client_id === selected.id);
  document.querySelector("#edit-client")?.addEventListener("click", () => editClientModal(selected)); document.querySelector("#delete-client")?.addEventListener("click", () => deleteClient(selected, jobs.length)); document.querySelector("#copy-link")?.addEventListener("click", () => copyClientLink(selected.access_token)); document.querySelector("#regenerate-link")?.addEventListener("click", () => regenerateLink(selected.id)); document.querySelector("#new-job")?.addEventListener("click", () => newJobModal(selected.id)); document.querySelectorAll(".edit-job").forEach((button) => button.onclick = () => editJobModal(jobs.find((job) => job.id === button.dataset.id))); document.querySelectorAll(".handle-reminder").forEach((button) => button.onclick = () => markReminderHandled(button.dataset.id));
}

function modal(content) { document.querySelector("#modal-root").innerHTML = `<div class="modal-bg"><div class="modal"><button class="modal-close" type="button">×</button>${content}</div></div>`; document.querySelector(".modal-close").onclick = closeModal; }
function closeModal() { document.querySelector("#modal-root").innerHTML = ""; }
async function logAction(entityType, entityId, action, description) { await supabase.from("audit_log").insert({ entity_type: entityType, entity_id: entityId, action, description }); }
function clientLink(token) { const url = new URL(CLIENT_PORTAL_URL); url.searchParams.set("cliente", token); return url.toString(); }
async function copyClientLink(token) { await navigator.clipboard.writeText(clientLink(token)); notice("Link personale copiato."); }

function newClientModal() { modal(`<span class="eyebrow red">NUOVO CLIENTE</span><h2>Crea area cliente</h2><form id="client-form"><label>Ragione sociale<input name="name" required></label><label>Referente<input name="contact_name"></label><label>Email<input name="email" type="email"></label><label>Telefono<input name="phone"></label><button class="primary" type="submit">Crea cliente e link</button></form>`); document.querySelector("#client-form").onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); data.access_token = crypto.randomUUID(); const { data: inserted, error } = await supabase.from("clients").insert(data).select().single(); if (error) return notice(error.message, "error"); await logAction("client", inserted.id, "create", `Creato cliente ${inserted.name}`); notice("Cliente creato."); state.selectedId = inserted.id; state.view = "clients"; adminPage(); }; }
function editClientModal(client) { modal(`<span class="eyebrow red">DATI CLIENTE</span><h2>Modifica cliente</h2><form id="edit-client-form"><label>Ragione sociale<input name="name" required value="${esc(client.name)}"></label><label>Referente<input name="contact_name" value="${esc(client.contact_name)}"></label><label>Email<input name="email" type="email" value="${esc(client.email)}"></label><label>Telefono<input name="phone" value="${esc(client.phone)}"></label><div class="checks"><label><input name="active" type="checkbox" ${client.active ? "checked" : ""}> Area cliente attiva</label></div><button class="primary" type="submit">Salva dati cliente</button></form>`); document.querySelector("#edit-client-form").onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); data.active = data.active === "on"; data.updated_at = new Date().toISOString(); const { error } = await supabase.from("clients").update(data).eq("id", client.id); if (error) return notice(error.message, "error"); await logAction("client", client.id, "update", `Aggiornati dati cliente ${data.name}`); notice("Dati cliente aggiornati."); adminPage(); }; }
async function deleteClient(client, jobsCount) { if (!confirm(`Vuoi eliminare definitivamente "${client.name}"?\n\nVerranno eliminate anche ${jobsCount} lavorazioni collegate.`)) return; const verification = prompt(`Scrivi ELIMINA per confermare la cancellazione di "${client.name}".`); if (verification !== "ELIMINA") return notice("Cancellazione annullata.", "error"); const { error } = await supabase.from("clients").delete().eq("id", client.id); if (error) return notice(error.message, "error"); await logAction("client", client.id, "delete", `Eliminato cliente ${client.name}`); state.selectedId = null; notice("Cliente eliminato."); adminPage(); }

function jobForm(job = {}, showNotification = false) {
  const workflow = job.workflow_type || "completa"; const allSteps = workflow === "lamiere" ? sheetSteps : completeSteps;
  return `<form id="job-form"><label>Descrizione<input name="title" required value="${esc(job.title)}" placeholder="Es. Cancello carrabile"></label><label>Codice commessa<input name="code" value="${esc(job.code)}" placeholder="COM-2026-001"></label><div class="form-grid"><label>Tipo timeline<select name="workflow_type" id="workflow-type"><option value="completa" ${workflow === "completa" ? "selected" : ""}>Lavorazione completa</option><option value="lamiere" ${workflow === "lamiere" ? "selected" : ""}>Lamiere</option></select></label><label>Priorità interna<select name="priority">${Object.entries(priorities).map(([key,value]) => `<option value="${key}" ${(job.priority || "normale") === key ? "selected" : ""}>${value}</option>`).join("")}</select></label></div><label>Step attuale<select name="current_step" id="current-step">${allSteps.map((step) => `<option value="${step.key}" ${job.current_step === step.key ? "selected" : ""}>${step.label}</option>`).join("")}</select></label><div class="checks"><label id="galvanizing-option"><input name="has_galvanizing" type="checkbox" ${job.has_galvanizing ? "checked" : ""}> Prevede zincatura</label><label><input name="has_painting" type="checkbox" ${job.has_painting ? "checked" : ""}> Prevede verniciatura</label><label id="installation-option"><input name="requires_installation" type="checkbox" ${job.requires_installation ? "checked" : ""}> Installazione prevista</label></div><div class="form-grid"><label>Data prevista<input name="due_date" type="date" value="${esc(job.due_date)}"></label><label>Verniciatore (solo amministratori)<select name="painter"><option value="">Non assegnato</option>${painters.map((value) => `<option ${job.painter === value ? "selected" : ""}>${value}</option>`).join("")}</select></label></div><label>Consegna prevista visibile al cliente<input name="delivery" value="${esc(job.delivery)}" placeholder="Es. Prima settimana di agosto"></label><label>Avviso pagamento visibile al cliente<input name="payment_notice" value="${esc(job.payment_notice)}" placeholder="Es. Saldo richiesto prima del ritiro"></label><label>Nota visibile al cliente<textarea name="note" rows="3">${esc(job.note)}</textarea></label><label>Note interne amministratore<textarea name="admin_notes" rows="3">${esc(job.admin_notes)}</textarea></label>${showNotification ? `<div class="checks notification-check"><label><input name="notify_client" type="checkbox"> Invia email al cliente dopo il salvataggio</label><small>L’email verrà inviata all’indirizzo presente nella scheda cliente.</small></div>` : ""}<button class="primary" type="submit">Salva lavorazione</button></form>`;
}
function bindWorkflowForm() { const type = document.querySelector("#workflow-type"); const step = document.querySelector("#current-step"); const refresh = () => { const steps = type.value === "lamiere" ? sheetSteps : completeSteps; const previous = step.value; step.innerHTML = steps.map((item) => `<option value="${item.key}">${item.label}</option>`).join(""); if (steps.some((item) => item.key === previous)) step.value = previous; document.querySelector("#galvanizing-option").hidden = type.value === "lamiere"; document.querySelector("#installation-option").hidden = type.value === "lamiere"; }; type.onchange = refresh; refresh(); }
function normalizeJobData(data) { data.workflow_type ||= "completa"; data.priority ||= "normale"; data.has_galvanizing = data.workflow_type === "completa" && data.has_galvanizing === "on"; data.has_painting = data.has_painting === "on"; data.requires_installation = data.workflow_type === "completa" && data.requires_installation === "on"; data.painter ||= null; data.due_date ||= null; const steps = (data.workflow_type === "lamiere" ? sheetSteps : completeSteps).filter((step) => !step.optional || data[step.optional]); if (!steps.some((step) => step.key === data.current_step)) data.current_step = steps[0].key; const index = Math.max(0, steps.findIndex((step) => step.key === data.current_step)); data.progress = Math.round(((index + 1) / steps.length) * 100); data.phase = steps[index]?.label || steps[0].label; }
async function ensurePaintingDeliveryForJob(job) {
  if (job.current_step !== "verniciatura" || !job.painter) return;
  const marker = `[AUTO-JOB:${job.id}]`;
  const exists = state.paintDeliveries.some((item) =>
    (job.code && String(item.job_code || "").trim().toLowerCase() === String(job.code).trim().toLowerCase()) ||
    String(item.notes || "").includes(marker)
  );
  if (exists) return;
  const client = state.clients.find((item) => item.id === job.client_id);
  const delivery = {
    job_code: job.code || "",
    client_name: client?.name || job.title,
    painter: job.painter,
    material_status: "consegnato",
    driver_name: "Inserimento automatico",
    notes: `${marker} Creato dal cambio stato della commessa.`,
    checked: true,
    checked_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from("painting_deliveries").insert(delivery).select().single();
  if (error) throw new Error(`Lavorazione salvata, ma non aggiunta in Verniciatura: ${error.message}`);
  state.paintDeliveries.unshift(data);
  await logAction("painting_delivery", data.id, "auto_create", `Inserita automaticamente in verniciatura ${job.code || job.title} presso ${job.painter}`);
}
function newJobModal(clientId) { modal(`<span class="eyebrow red">NUOVA LAVORAZIONE</span><h2>Aggiungi lavorazione</h2>${jobForm()}`); bindWorkflowForm(); document.querySelector("#job-form").onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); data.client_id = clientId; normalizeJobData(data); const { data: inserted, error } = await supabase.from("jobs").insert(data).select().single(); if (error) return notice(error.message, "error"); try { await ensurePaintingDeliveryForJob(inserted); } catch (syncError) { notice(syncError.message, "error"); } await logAction("job", inserted.id, "create", `Creata lavorazione ${inserted.title}`); notice("Lavorazione aggiunta."); adminPage(); }; }
function editJobModal(job) { const photos = state.jobPhotos.filter((photo) => photo.job_id === job.id); modal(`<span class="eyebrow red">AGGIORNA LAVORAZIONE</span><h2>${esc(job.title)}</h2>${jobForm(job, true)}${adminPhotoManager(job, photos)}<button class="danger" id="delete-job" type="button">Elimina lavorazione</button>`); bindWorkflowForm(); bindPhotoManager(job); document.querySelector("#job-form").onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); const notifyClient = data.notify_client === "on"; delete data.notify_client; normalizeJobData(data); data.updated_at = new Date().toISOString(); const { data: updated, error } = await supabase.from("jobs").update(data).eq("id", job.id).select().single(); if (error) return notice(error.message, "error"); try { await ensurePaintingDeliveryForJob(updated); } catch (syncError) { notice(syncError.message, "error"); } await logAction("job", job.id, "update", `Aggiornata lavorazione ${data.title}: ${data.phase}`); if (notifyClient) { const { error: emailError } = await supabase.functions.invoke("notify-client", { body: { job_id: job.id } }); notice(emailError ? "Aggiornamento salvato, ma email non inviata." : "Aggiornamento salvato ed email inviata.", emailError ? "error" : "ok"); } else notice("Aggiornamento salvato."); adminPage(); }; document.querySelector("#delete-job").onclick = async () => { if (!confirm(`Eliminare definitivamente la lavorazione "${job.title}"?`)) return; const { error } = await supabase.from("jobs").delete().eq("id", job.id); if (error) return notice(error.message, "error"); await logAction("job", job.id, "delete", `Eliminata lavorazione ${job.title}`); notice("Lavorazione eliminata."); adminPage(); }; }
function manualPaintingDeliveryModal() {
  const options = state.jobs.map((job) => {
    const client = state.clients.find((item) => item.id === job.client_id);
    return `<option value="${job.id}">${esc(client?.name || "Cliente")} · ${esc(job.code || job.title)}</option>`;
  }).join("");
  modal(`<span class="eyebrow red">VERNICIATURA</span><h2>Inserisci materiale manualmente</h2>
    <form id="manual-paint-form">
      <label>Cliente o commessa<select name="job_id" required><option value="">Seleziona</option>${options}</select></label>
      <div class="form-grid">
        <label>Verniciatore<select name="painter" required><option value="">Seleziona</option>${painters.map((value) => `<option>${value}</option>`).join("")}</select></label>
        <label>Stato materiale<select name="material_status">${Object.entries(paintStatuses).map(([key, label]) => `<option value="${key}" ${key === "consegnato" ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      </div>
      <label>Foto facoltativa<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"></label>
      <label>Note<textarea name="notes" rows="3" placeholder="Facoltativo"></textarea></label>
      <button class="primary" type="submit">Aggiungi in Verniciatura</button>
    </form>`);
  const form = document.querySelector("#manual-paint-form");
  form.job_id.onchange = () => {
    const job = state.jobs.find((item) => item.id === form.job_id.value);
    if (job?.painter) form.painter.value = job.painter;
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const job = state.jobs.find((item) => item.id === form.job_id.value);
    if (!job) return notice("Seleziona una commessa.", "error");
    const client = state.clients.find((item) => item.id === job.client_id);
    const payload = {
      job_code: job.code || "",
      client_name: client?.name || job.title,
      painter: form.painter.value,
      material_status: form.material_status.value,
      driver_name: "Inserimento manuale amministratore",
      notes: String(form.notes.value || "").trim(),
      checked: true,
      checked_at: new Date().toISOString()
    };
    try {
      const file = form.photo.files?.[0];
      if (file) Object.assign(payload, await uploadPaintingPhoto(file, job.code || job.id));
      const { data, error } = await supabase.from("painting_deliveries").insert(payload).select().single();
      if (error) throw error;
      state.paintDeliveries.unshift(data);
      await syncPaintingDeliveryToJob(data);
      await logAction("painting_delivery", data.id, "manual_create", `Inserito manualmente ${job.code || job.title} presso ${payload.painter}`);
      closeModal();
      notice("Materiale aggiunto in Verniciatura.");
      adminPage();
    } catch (error) {
      notice(error.message || "Inserimento non riuscito.", "error");
    }
  };
}
function adminPhotoManager(job, photos = []) {
  return `<section class="job-photo-manager"><div class="panel-title"><h3>Foto commessa</h3><span>${photos.length}</span></div><div class="admin-photo-grid">${photos.length ? photos.map((photo) => `<div class="admin-photo"><img src="${esc(photo.url)}" alt="${esc(photo.caption || "Foto commessa")}"><button type="button" class="delete-photo" data-id="${photo.id}" data-path="${esc(photo.storage_path)}">Elimina</button></div>`).join("") : `<p>Nessuna foto caricata.</p>`}</div><form id="photo-form" class="photo-upload"><label>Aggiungi foto<input name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" multiple></label><label>Didascalia facoltativa<input name="caption" placeholder="Es. Materiale rientrato dalla verniciatura"></label><button class="secondary" type="submit">Carica foto</button></form></section>`;
}
function bindPhotoManager(job) {
  document.querySelector("#photo-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const files = Array.from(form.photos.files || []);
    if (!files.length) return notice("Seleziona almeno una foto.", "error");
    const caption = String(form.caption.value || "").trim();
    try {
      for (const file of files) await uploadJobPhoto(job, file, caption);
    } catch (error) {
      return notice(error.message || "Caricamento foto non riuscito.", "error");
    }
    await logAction("job", job.id, "photos", `Caricate ${files.length} foto per ${job.title}`);
    notice("Foto caricate.");
    adminPage();
  });
  document.querySelectorAll(".delete-photo").forEach((button) => button.onclick = async () => {
    if (!confirm("Eliminare questa foto dalla commessa?")) return;
    const { error: removeError } = await supabase.storage.from("job-photos").remove([button.dataset.path]);
    if (removeError) return notice(removeError.message, "error");
    const { error } = await supabase.from("job_photos").delete().eq("id", button.dataset.id);
    if (error) return notice(error.message, "error");
    await logAction("job", job.id, "photos", `Eliminata foto da ${job.title}`);
    notice("Foto eliminata.");
    adminPage();
  });
}
async function markReminderHandled(id) { const { error } = await supabase.from("client_reminders").update({ handled: true, handled_at: new Date().toISOString() }).eq("id", id); if (error) return notice(error.message, "error"); await logAction("reminder", id, "handled", "Sollecito cliente segnato come gestito"); notice("Sollecito segnato come gestito."); adminPage(); }
function findPaintingJob(delivery) {
  return expectedPaintingJob(delivery);
}
function paintingJobPatch(job, delivery) {
  const materialStatus = delivery.material_status || "consegnato";
  const patch = {
    painter: paintingMismatch(delivery).mismatch ? job.painter || null : (delivery.painter || job.painter || null),
    has_painting: true,
    updated_at: new Date().toISOString()
  };
  if (materialStatus === "rientrato") patch.current_step = job.workflow_type === "lamiere" ? "pronto_ritiro" : "arrivo_officina";
  else if (["consegnato", "in_viaggio", "da_portare", "ritirato"].includes(materialStatus)) patch.current_step = "verniciatura";
  const nextJob = { ...job, ...patch };
  normalizeJobData(nextJob);
  patch.current_step = nextJob.current_step;
  patch.progress = nextJob.progress;
  patch.phase = nextJob.phase;
  const check = paintingMismatch(delivery);
  const warning = check.mismatch ? `ATTENZIONE verniciatore diverso: previsto ${check.expected}, portato a ${check.actual}. ` : "";
  const note = `${warning}Verniciatura: ${paintStatuses[materialStatus] || materialStatus} presso ${delivery.painter || "vernicatore non indicato"}${delivery.driver_name ? ` - autista ${delivery.driver_name}` : ""}${delivery.notes ? ` - note: ${delivery.notes}` : ""}`;
  patch.admin_notes = [job.admin_notes, note].filter(Boolean).join("\n");
  if (!job.note || String(job.note).includes("Verniciatura:")) patch.note = check.mismatch ? "Materiale in verniciatura da controllare con SIMPRO." : (materialStatus === "rientrato" ? "Materiale rientrato dalla verniciatura." : `Materiale in verniciatura presso ${delivery.painter}.`);
  return patch;
}
async function syncPaintingDeliveryToJob(delivery) {
  const job = findPaintingJob(delivery);
  if (!job) return { synced: false, message: "Movimento controllato, ma non ho trovato una commessa con quel codice." };
  const patch = paintingJobPatch(job, delivery);
  const { error } = await supabase.from("jobs").update(patch).eq("id", job.id);
  if (error) throw new Error(`Movimento aggiornato, ma scheda cliente non aggiornata: ${error.message}`);
  if (delivery.photo_url && delivery.photo_storage_path) {
    const already = state.jobPhotos.some((photo) => photo.job_id === job.id && photo.storage_path === delivery.photo_storage_path);
    if (!already) {
      const { error: photoError } = await supabase.from("job_photos").insert({
        job_id: job.id,
        storage_path: delivery.photo_storage_path,
        url: delivery.photo_url,
        caption: `Foto verniciatura ${delivery.painter || ""}`.trim()
      });
      if (photoError) throw new Error(`Scheda aggiornata, ma foto non collegata: ${photoError.message}`);
    }
  }
  await logAction("job", job.id, "painting_sync", `Aggiornata scheda da movimento verniciatura ${delivery.job_code || delivery.client_name || ""}`);
  return { synced: true, message: "Movimento controllato e scheda cliente aggiornata." };
}
async function markPaintingChecked(id, correctedPainter = "") {
  const delivery = state.paintDeliveries.find((item) => String(item.id) === String(id));
  if (!delivery) return notice("Movimento non trovato.", "error");
  const normalizedCorrection = normalizePainter(correctedPainter);
  let deliveryForCheck = delivery;
  if (normalizedCorrection) deliveryForCheck = { ...delivery, painter: normalizedCorrection };
  const check = paintingMismatch(deliveryForCheck);
  if (check.mismatch) {
    const { error } = await supabase.from("painting_deliveries").update({ checked: false, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return notice(error.message, "error");
    return notice(`ATTENZIONE: previsto ${check.expected}, selezionato ${check.actual}. Scegli il verniciatore corretto e poi approva.`, "error");
  }
  const patch = { checked: true, checked_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (normalizedCorrection) patch.painter = normalizedCorrection;
  const { data, error } = await supabase.from("painting_deliveries").update(patch).eq("id", id).select().single();
  if (error) return notice(error.message, "error");
  try {
    const result = await syncPaintingDeliveryToJob(data || { ...delivery, ...patch });
    await logAction("painting_delivery", id, "checked", `Consegna in verniciatura controllata${normalizedCorrection ? ` con verniciatore corretto ${normalizedCorrection}` : ""}`);
    notice(result.message, result.synced ? "ok" : "error");
  } catch (error) {
    notice(error.message || "Consegna controllata, ma scheda cliente non aggiornata.", "error");
  }
  adminPage();
}
async function updatePaintingStatus(id, material_status) {
  const delivery = state.paintDeliveries.find((item) => String(item.id) === String(id));
  const check = paintingMismatch(delivery);
  const patch = { material_status, updated_at: new Date().toISOString() };
  if (check.mismatch) patch.checked = false;
  if (material_status === "rientrato") { patch.checked = true; patch.checked_at = new Date().toISOString(); }
  const { data, error } = await supabase.from("painting_deliveries").update(patch).eq("id", id).select().single();
  if (error) return notice(error.message, "error");
  try {
    const result = await syncPaintingDeliveryToJob(data || { ...delivery, ...patch });
    await logAction("painting_delivery", id, "status", `Stato verniciatura aggiornato: ${paintStatuses[material_status] || material_status}`);
    notice(check.mismatch ? `ATTENZIONE: previsto ${check.expected}, portato a ${check.actual}. Movimento da controllare.` : (result.synced ? "Stato verniciatura e scheda cliente aggiornati." : result.message), check.mismatch ? "error" : (result.synced ? "ok" : "error"));
  } catch (error) {
    notice(error.message || "Stato aggiornato, ma scheda cliente non aggiornata.", "error");
  }
  adminPage();
}
async function deletePaintingDelivery(id) {
  const delivery = state.paintDeliveries.find((item) => String(item.id) === String(id));
  if (!delivery) return notice("Movimento non trovato.", "error");
  const label = [delivery.client_name, delivery.job_code, delivery.painter].filter(Boolean).join(" · ");
  if (!confirm(`Eliminare questo movimento dell'autista?\n\n${label || "Movimento verniciatura"}`)) return;
  if (delivery.photo_storage_path) {
    await supabase.storage.from("job-photos").remove([delivery.photo_storage_path]);
    await supabase.from("job_photos").delete().eq("storage_path", delivery.photo_storage_path);
  }
  const { error } = await supabase.from("painting_deliveries").delete().eq("id", id);
  if (error) return notice(error.message, "error");
  await logAction("painting_delivery", id, "delete", `Eliminato movimento autista ${label || id}`);
  notice("Movimento eliminato.");
  adminPage();
}

async function regenerateLink(clientId) { if (!confirm("Il vecchio link smetterà immediatamente di funzionare. Continuare?")) return; const token = crypto.randomUUID(); const { error } = await supabase.from("clients").update({ access_token: token }).eq("id", clientId); if (error) return notice(error.message, "error"); await navigator.clipboard.writeText(clientLink(token)); await logAction("client", clientId, "link", "Rigenerato link personale cliente"); notice("Nuovo link generato e copiato."); adminPage(); }

async function driverPage() {
  root.innerHTML = `<main class="driver-page"><section class="driver-card">${logo(false)}<span class="eyebrow red">ACCESSO AUTISTA</span><h1>Cerca commessa</h1><p>Cerca prima il cliente o il numero commessa, poi seleziona il lavoro corretto.</p><div class="driver-search"><label>Cerca cliente o commessa<input id="driver-search-input" type="search" placeholder="Es. Rossi, COM-2026-001"></label><div id="driver-search-results" class="driver-search-results"><div class="empty small"><p>Scrivi almeno 2 lettere o numeri per cercare.</p></div></div></div><form id="driver-form"><label>Codice cliente o commessa<input name="job_code" placeholder="Es. COM-2026-001"></label><label>Nome cliente<input name="client_name" required placeholder="Es. Rossi Srl"></label><label>Verniciatore<select name="painter" required><option value="">Seleziona</option>${painters.map((value) => `<option>${value}</option>`).join("")}</select></label><label>Stato materiale<select name="material_status" required>${Object.entries(paintStatuses).map(([key, label]) => `<option value="${key}" ${key === "consegnato" ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>Nome autista<input name="driver_name" placeholder="Facoltativo"></label><label>Foto commessa<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" capture="environment"><small>Obbligatoria solo quando porti/consegni il materiale. Si apre direttamente la fotocamera.</small></label><label>Note<textarea name="notes" rows="3" placeholder="Facoltativo"></textarea></label><div id="driver-selected-job" class="driver-selected-job" hidden></div><div id="driver-message" class="form-message"></div><button class="primary" type="submit">Registra movimento <span>→</span></button></form></section><section class="driver-card driver-situation"><div class="panel-title"><h2>Situazione materiale</h2><button class="secondary fit" id="driver-refresh" type="button">Aggiorna</button></div><div id="driver-list" class="driver-list"><div class="loading-inline">Caricamento movimenti...</div></div></section></main>`;
  let searchableJobs = [];
  const form = document.querySelector("#driver-form");
  const searchInput = document.querySelector("#driver-search-input");
  const resultsNode = document.querySelector("#driver-search-results");
  const selectedNode = document.querySelector("#driver-selected-job");

  const renderSearchResults = (query = "") => {
    const q = String(query || "").trim().toLowerCase();
    if (q.length < 2) {
      resultsNode.innerHTML = `<div class="empty small"><p>Scrivi almeno 2 lettere o numeri per cercare.</p></div>`;
      return;
    }
    const matches = searchableJobs.filter((job) => [job.code, job.client_name, job.title, job.painter].some((value) => String(value || "").toLowerCase().includes(q))).slice(0, 20);
    resultsNode.innerHTML = matches.length ? matches.map((job) => `<button class="driver-search-row" type="button" data-id="${esc(job.id)}"><strong>${esc(job.client_name || "Cliente non indicato")}</strong><span>${esc(job.code || "Senza codice")} · ${esc(job.title || "Lavorazione")}</span><small>Previsto: ${esc(job.painter || "vernicatore non assegnato")}</small></button>`).join("") : `<div class="empty small"><p>Nessuna commessa trovata. Puoi inserire i dati manualmente.</p></div>`;
    resultsNode.querySelectorAll(".driver-search-row").forEach((button) => button.onclick = () => {
      const job = searchableJobs.find((item) => String(item.id) === String(button.dataset.id));
      if (!job) return;
      form.job_code.value = job.code || "";
      form.client_name.value = job.client_name || job.title || "";
      if (job.painter && painters.includes(job.painter)) form.painter.value = job.painter;
      selectedNode.hidden = false;
      selectedNode.innerHTML = `<strong>Selezionato:</strong> ${esc(job.client_name || "Cliente")} · ${esc(job.code || "Senza codice")}<br><small>Verniciatore previsto: ${esc(job.painter || "non assegnato")}</small>`;
      resultsNode.innerHTML = `<div class="form-message ok">Commessa selezionata. Controlla verniciatore e stato materiale.</div>`;
    });
  };

  const loadDriverDeliveries = async () => {
    const list = document.querySelector("#driver-list");
    const { data, error } = await supabase.from("painting_deliveries").select("*").order("created_at", { ascending: false }).limit(80);
    list.innerHTML = error ? `<div class="form-message error">Non riesco a caricare la situazione. Avvisa l'ufficio.</div>` : driverSituationList(data || []);
  };

  document.querySelector("#driver-refresh").onclick = loadDriverDeliveries;
  searchInput.oninput = () => renderSearchResults(searchInput.value);
  const { data: jobsData, error: jobsError } = await supabase.rpc("driver_search_jobs");
  if (jobsError) {
    resultsNode.innerHTML = `<div class="form-message error">Ricerca non ancora attiva. Avvisa l'ufficio.</div>`;
  } else {
    searchableJobs = Array.isArray(jobsData) ? jobsData : [];
  }
  await loadDriverDeliveries();
  document.querySelector("#driver-form").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.job_code = String(data.job_code || "").trim(); data.client_name = String(data.client_name || "").trim(); data.driver_name = String(data.driver_name || "").trim(); data.notes = String(data.notes || "").trim();
    delete data.photo;
    const message = document.querySelector("#driver-message");
    try {
      const file = form.photo.files?.[0];
      const photoRequired = data.material_status === "consegnato";
      if (photoRequired && !file) throw new Error("La foto e obbligatoria quando porti/consegni il materiale. Scatta una foto prima di registrare il movimento.");
      if (file) Object.assign(data, await uploadPaintingPhoto(file, data.job_code || data.client_name));
      const { error } = await supabase.from("painting_deliveries").insert(data);
      if (error) throw new Error(error.message);
      form.reset(); selectedNode.hidden = true; searchInput.value = ""; renderSearchResults(""); message.textContent = "Movimento registrato correttamente."; message.className = "form-message ok"; await loadDriverDeliveries();
    } catch (error) {
      message.textContent = `Errore: ${error.message || "movimento non registrato"}. Avvisa l'ufficio.`; message.className = "form-message error";
    }
  };
}

async function start() { const params = new URLSearchParams(window.location.search); if (params.get("autista") === "1") return driverPage(); const token = params.get("cliente"); if (token) return clientPage(token); const { data } = await supabase.auth.getSession(); data.session ? adminPage() : loginPage(); }
start();
