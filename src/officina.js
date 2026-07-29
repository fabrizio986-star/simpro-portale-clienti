import { createClient } from "@supabase/supabase-js";
import "./officina.css";

const supabase = createClient(
  "https://jrudwnrorufmxjtjtwip.supabase.co",
  "sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs"
);

const root = document.querySelector("#root");
const OFFICE_EMAIL = "officina@simprolamiere.it";
const PAINTERS = ["DAMAS", "SOSAM", "METALLIKA", "GALLO"];
const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const formatDate = (value) => value ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value)) : "—";
const normalize = (value = "") => String(value || "").trim().toUpperCase();

function logo() {
  return '<img class="office-logo" src="https://www.simprolamiere.it/wp-content/uploads/2024/07/logo-simpro-128x128.png" alt="SIMPRO Lamiere">';
}

function loginPage(message = "") {
  root.innerHTML = `<main class="office-login"><form id="office-login-form" class="office-login-card">${logo()}<span>ACCESSO OFFICINA</span><h1>Situazione verniciature</h1><p>Accesso riservato al tablet dell'officina.</p><label>Email<input name="email" type="email" value="${OFFICE_EMAIL}" readonly></label><label>Password<input name="password" type="password" minlength="8" required autocomplete="current-password"></label><div id="office-message" class="office-message">${esc(message)}</div><button type="submit">Accedi</button><button type="button" class="secondary" id="office-signup">Crea accesso / reimposta account</button></form></main>`;
  const form = document.querySelector("#office-login-form");
  form.onsubmit = async (event) => {
    event.preventDefault();
    const password = new FormData(form).get("password");
    const { error } = await supabase.auth.signInWithPassword({ email: OFFICE_EMAIL, password });
    if (error) return loginPage(error.message);
    officePage();
  };
  document.querySelector("#office-signup").onclick = async () => {
    const password = String(new FormData(form).get("password") || "");
    if (password.length < 8) return loginPage("Inserisci prima una password di almeno 8 caratteri.");
    const { error } = await supabase.auth.signUp({ email: OFFICE_EMAIL, password });
    loginPage(error ? error.message : "Accesso creato. Controlla la casella email e conferma il collegamento.");
  };
}

function latestByJob(deliveries, jobs, clients) {
  const latest = new Map();
  const clientMap = new Map(clients.map((client) => [String(client.id), client.name]));
  for (const item of deliveries) {
    const code = String(item.job_code || "").trim().toLowerCase();
    const clientName = String(item.client_name || "").trim().toLowerCase();
    const job = jobs.find((entry) => code && String(entry.code || "").trim().toLowerCase() === code)
      || jobs.find((entry) => clientName && String(clientMap.get(String(entry.client_id)) || "").trim().toLowerCase() === clientName);
    const key = job?.id ? `job:${job.id}` : (code ? `code:${code}` : `delivery:${item.id}`);
    const previous = latest.get(key);
    if (!previous || new Date(item.updated_at || item.created_at || 0) > new Date(previous.updated_at || previous.created_at || 0)) latest.set(key, item);
  }
  return [...latest.values()];
}

function officeCard(item, jobs, clients) {
  const clientMap = new Map(clients.map((client) => [String(client.id), client.name]));
  const code = String(item.job_code || "").trim().toLowerCase();
  const job = jobs.find((entry) => code && String(entry.code || "").trim().toLowerCase() === code);
  const clientName = item.client_name || (job ? clientMap.get(String(job.client_id)) : "") || "Cliente";
  const painter = normalize(item.painter || job?.painter) || "NON ASSEGNATO";
  const status = item.material_status || "consegnato";
  const labels = { da_portare: "Da portare", in_viaggio: "In viaggio", consegnato: "Consegnato", ritirato: "Da rientrare", rientrato: "Rientrato in officina" };
  return `<article class="office-card" data-search="${esc(`${clientName} ${item.job_code || job?.code || ""} ${painter}`.toLowerCase())}"><div><span class="office-status status-${esc(status)}">${esc(labels[status] || status)}</span><h3>${esc(clientName)}</h3><p>${esc(item.job_code || job?.code || "Senza numero commessa")}</p><strong>${esc(painter)}</strong><small>Aggiornato: ${formatDate(item.updated_at || item.created_at)}</small>${item.notes ? `<small>Note: ${esc(item.notes)}</small>` : ""}</div>${item.photo_url ? `<a href="${esc(item.photo_url)}" target="_blank" rel="noopener"><img src="${esc(item.photo_url)}" alt="Foto lavorazione"></a>` : ""}</article>`;
}

async function officePage() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || String(auth.user.email || "").toLowerCase() !== OFFICE_EMAIL) {
    await supabase.auth.signOut();
    return loginPage("Questo accesso è riservato all'account officina.");
  }
  root.innerHTML = '<div class="office-loading">Caricamento situazione verniciature…</div>';
  const [{ data: clients, error: clientsError }, { data: jobs, error: jobsError }, { data: deliveries, error: deliveriesError }] = await Promise.all([
    supabase.from("clients").select("id,name"),
    supabase.from("jobs").select("id,client_id,title,code,current_step,painter,has_painting,updated_at,completed_at").is("completed_at", null),
    supabase.from("painting_deliveries").select("*").order("created_at", { ascending: false }).limit(300),
  ]);
  if (clientsError || jobsError || deliveriesError) return loginPage("Accesso non ancora autorizzato. Esegui la configurazione dell'account officina.");

  const latest = latestByJob(deliveries || [], jobs || [], clients || []);
  const plannedJobs = (jobs || []).filter((job) => job.has_painting && job.painter && !latest.some((item) => String(item.job_code || "").trim().toLowerCase() === String(job.code || "").trim().toLowerCase()));
  const planned = plannedJobs.map((job) => ({ id: `job-${job.id}`, job_code: job.code, client_name: (clients || []).find((client) => client.id === job.client_id)?.name, painter: job.painter, material_status: "da_portare", updated_at: job.updated_at }));
  const rows = [...planned, ...latest].filter((item) => item.material_status !== "rientrato");
  const toTake = rows.filter((item) => item.material_status === "da_portare");
  const delivered = rows.filter((item) => ["in_viaggio", "consegnato"].includes(item.material_status || "consegnato"));
  const toCollect = rows.filter((item) => item.material_status === "ritirato");

  const section = (title, items, className) => `<section class="office-section ${className}"><div class="office-section-title"><h2>${title}</h2><span>${items.length}</span></div><div class="office-grid">${items.length ? items.map((item) => officeCard(item, jobs || [], clients || [])).join("") : '<div class="office-empty">Nessuna lavorazione.</div>'}</div></section>`;
  root.innerHTML = `<header class="office-header">${logo()}<div><small>TABLET OFFICINA</small><h1>Verniciature</h1></div><button id="office-refresh">Aggiorna</button><button id="office-logout" class="secondary">Esci</button></header><main class="office-wrap"><div class="office-kpis"><div><small>Da portare</small><strong>${toTake.length}</strong></div><div><small>Dal verniciatore</small><strong>${delivered.length}</strong></div><div><small>Da ritirare</small><strong>${toCollect.length}</strong></div></div><label class="office-search">Cerca cliente o commessa<input id="office-search" type="search" placeholder="Scrivi nome o numero commessa"></label>${section("Da portare in verniciatura", toTake, "to-take")}${section("Consegnate ai verniciatori", delivered, "delivered")}${section("Da ritirare / rientrare", toCollect, "to-collect")}<section class="office-painters"><h2>Riepilogo per verniciatore</h2>${PAINTERS.map((painter) => `<div><span>${painter}</span><strong>${rows.filter((item) => normalize(item.painter) === painter).length}</strong></div>`).join("")}</section></main>`;
  document.querySelector("#office-refresh").onclick = officePage;
  document.querySelector("#office-logout").onclick = () => supabase.auth.signOut().then(() => loginPage());
  document.querySelector("#office-search").oninput = (event) => {
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll(".office-card").forEach((card) => card.hidden = !card.dataset.search.includes(query));
  };
}

const { data } = await supabase.auth.getSession();
data.session ? officePage() : loginPage();
