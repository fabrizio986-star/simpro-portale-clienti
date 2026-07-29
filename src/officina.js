import { createClient } from "@supabase/supabase-js";
import "./officina.css";

const supabase = createClient(
  "https://jrudwnrorufmxjtjtwip.supabase.co",
  "sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs"
);

const root = document.querySelector("#root");
const PAINTERS = ["DAMAS", "SOSAM", "METALLIKA", "GALLO"];
const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const formatDate = (value) => value ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value)) : "—";
const normalize = (value = "") => String(value || "").trim().toUpperCase();
const searchText = (value = "") => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
let officeData = { clients: [], jobs: [], deliveries: [] };

function logo() {
  return '<img class="office-logo" src="https://www.simprolamiere.it/wp-content/uploads/2024/07/logo-simpro-128x128.png" alt="SIMPRO Lamiere">';
}

function errorPage(message) {
  root.innerHTML = `<main class="office-login"><section class="office-login-card">${logo()}<span>ACCESSO OFFICINA</span><h1>Link non valido</h1><p>${esc(message)}</p></section></main>`;
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

function resolveJob(item, jobs, clients) {
  const code = String(item.job_code || "").trim().toLowerCase();
  const clientName = String(item.client_name || "").trim().toLowerCase();
  const clientMap = new Map(clients.map((client) => [String(client.id), client.name]));
  return jobs.find((entry) => code && String(entry.code || "").trim().toLowerCase() === code)
    || jobs.find((entry) => clientName && String(clientMap.get(String(entry.client_id)) || "").trim().toLowerCase() === clientName)
    || null;
}

function officeCard(item, jobs, clients) {
  const job = resolveJob(item, jobs, clients);
  const client = clients.find((entry) => String(entry.id) === String(job?.client_id));
  const clientName = item.client_name || client?.name || "Cliente";
  const painter = normalize(item.painter || job?.painter) || "NON ASSEGNATO";
  const status = item.material_status || "consegnato";
  const labels = { da_portare: "Da portare", in_viaggio: "In viaggio", consegnato: "Consegnato", ritirato: "Da rientrare", rientrato: "Rientrato in officina" };
  const searchable = searchText([clientName, item.job_code, job?.code, job?.title, painter, item.notes, job?.note, job?.admin_notes].filter(Boolean).join(" "));
  return `<article class="office-card" data-search="${esc(searchable)}"><div><span class="office-status status-${esc(status)}">${esc(labels[status] || status)}</span><h3>${esc(clientName)}</h3><p>${esc(item.job_code || job?.code || "Senza numero commessa")}</p><strong>${esc(painter)}</strong><small>Aggiornato: ${formatDate(item.updated_at || item.created_at)}</small>${item.notes ? `<small>Note trasporto: ${esc(item.notes)}</small>` : ""}${job ? `<button class="open-office-client" data-client="${esc(job.client_id)}" type="button">Apri scheda cliente</button>` : ""}</div>${item.photo_url ? `<a href="${esc(item.photo_url)}" target="_blank" rel="noopener"><img src="${esc(item.photo_url)}" alt="Foto lavorazione"></a>` : ""}</article>`;
}

function clientSheet(clientId) {
  const client = officeData.clients.find((entry) => String(entry.id) === String(clientId));
  const jobs = officeData.jobs.filter((job) => String(job.client_id) === String(clientId));
  if (!client) return;
  const rows = jobs.map((job) => `<article class="office-job-detail"><div class="office-job-head"><div><small>${esc(job.code || "Senza numero commessa")}</small><h3>${esc(job.title || "Lavorazione")}</h3></div><span>${esc(job.painter || "Verniciatore non assegnato")}</span></div><div class="office-note"><strong>Note lavorazione</strong><p>${esc(job.note || "Nessuna nota inserita.")}</p></div><div class="office-note internal"><strong>Note interne officina</strong><p>${esc(job.admin_notes || "Nessuna nota interna inserita.")}</p></div><small>Aggiornato il ${formatDate(job.updated_at)}${job.due_date ? ` · Previsto ${formatDate(job.due_date)}` : ""}</small></article>`).join("");
  document.body.insertAdjacentHTML("beforeend", `<div class="office-modal-bg"><section class="office-modal"><button class="office-modal-close" type="button">×</button><span>SCHEDA CLIENTE</span><h2>${esc(client.name)}</h2><div class="office-job-list">${rows || '<div class="office-empty">Nessuna lavorazione collegata.</div>'}</div></section></div>`);
  document.querySelector(".office-modal-close").onclick = () => document.querySelector(".office-modal-bg")?.remove();
  document.querySelector(".office-modal-bg").onclick = (event) => { if (event.target.classList.contains("office-modal-bg")) event.currentTarget.remove(); };
}

function applyOfficeSearch(rawQuery) {
  const query = searchText(rawQuery);
  document.querySelectorAll(".office-section").forEach((section) => {
    let visible = 0;
    section.querySelectorAll(".office-card").forEach((card) => {
      const matches = !query || searchText(card.dataset.search).includes(query);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    const counter = section.querySelector(".office-section-title span");
    if (counter) counter.textContent = String(visible);
    section.hidden = Boolean(query) && visible === 0;
  });
}

async function officePage() {
  const token = new URLSearchParams(window.location.search).get("accesso");
  if (!token) return errorPage("Apri il collegamento riservato fornito da SIMPRO.");
  root.innerHTML = '<div class="office-loading">Caricamento situazione verniciature…</div>';

  const { data, error } = await supabase.rpc("get_officina_board", { p_token: token });
  if (error || !data?.ok) return errorPage("Il collegamento non è valido oppure è stato disattivato.");

  const clients = data.clients || [];
  const jobs = data.jobs || [];
  const deliveries = data.deliveries || [];
  officeData = { clients, jobs, deliveries };
  const latest = latestByJob(deliveries, jobs, clients);
  const plannedJobs = jobs.filter((job) => job.has_painting && job.painter && !latest.some((item) => String(item.job_code || "").trim().toLowerCase() === String(job.code || "").trim().toLowerCase()));
  const planned = plannedJobs.map((job) => ({ id: `job-${job.id}`, job_code: job.code, client_name: clients.find((client) => client.id === job.client_id)?.name, painter: job.painter, material_status: "da_portare", updated_at: job.updated_at }));
  const rows = [...planned, ...latest].filter((item) => item.material_status !== "rientrato");
  const toTake = rows.filter((item) => item.material_status === "da_portare");
  const delivered = rows.filter((item) => ["in_viaggio", "consegnato"].includes(item.material_status || "consegnato"));
  const toCollect = rows.filter((item) => item.material_status === "ritirato");

  const section = (title, items, className) => `<section class="office-section ${className}"><div class="office-section-title"><h2>${title}</h2><span>${items.length}</span></div><div class="office-grid">${items.length ? items.map((item) => officeCard(item, jobs, clients)).join("") : '<div class="office-empty">Nessuna lavorazione.</div>'}</div></section>`;
  root.innerHTML = `<header class="office-header">${logo()}<div><small>TABLET OFFICINA</small><h1>Verniciature</h1></div><button id="office-refresh">Aggiorna</button></header><main class="office-wrap"><div class="office-kpis"><div><small>Da portare</small><strong>${toTake.length}</strong></div><div><small>Dal verniciatore</small><strong>${delivered.length}</strong></div><div><small>Da ritirare</small><strong>${toCollect.length}</strong></div></div><label class="office-search">Cerca cliente, commessa o nota<input id="office-search" type="search" inputmode="search" autocomplete="off" placeholder="Scrivi nome, numero commessa o parola nelle note"></label>${section("Da portare in verniciatura", toTake, "to-take")}${section("Consegnate ai verniciatori", delivered, "delivered")}${section("Da ritirare / rientrare", toCollect, "to-collect")}<section class="office-painters"><h2>Riepilogo per verniciatore</h2>${PAINTERS.map((painter) => `<div><span>${painter}</span><strong>${rows.filter((item) => normalize(item.painter) === painter).length}</strong></div>`).join("")}</section></main>`;
  document.querySelector("#office-refresh").onclick = officePage;
  const searchInput = document.querySelector("#office-search");
  ["input", "keyup", "search", "change"].forEach((eventName) => searchInput.addEventListener(eventName, () => applyOfficeSearch(searchInput.value)));
  document.querySelectorAll(".open-office-client").forEach((button) => button.onclick = () => clientSheet(button.dataset.client));
}

officePage();
