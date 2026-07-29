import { createClient } from "@supabase/supabase-js";
import "./painting-view.css";

const supabase = createClient(
  "https://jrudwnrorufmxjtjtwip.supabase.co",
  "sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs"
);

const PAINTERS = ["DAMAS", "SOSAM", "METALLIKA", "GALLO"];
const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
})[char]);

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
}

function ensurePaintingButton() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar || sidebar.querySelector('[data-view="painting"]')) return;

  const button = document.createElement("button");
  button.className = "nav-button";
  button.dataset.view = "painting";
  button.innerHTML = "🎨 Verniciatura";

  const statsButton = sidebar.querySelector('[data-view="stats"]');
  if (statsButton) sidebar.insertBefore(button, statsButton);
  else sidebar.append(button);

  button.addEventListener("click", showPaintingView);
}

async function showPaintingView() {
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.remove("active"));
  document.querySelector('[data-view="painting"]')?.classList.add("active");

  const main = document.querySelector(".admin-main");
  if (!main) return;
  main.innerHTML = '<div class="loading">Caricamento verniciature…</div>';

  const [{ data: clients, error: clientsError }, { data: jobs, error: jobsError }] = await Promise.all([
    supabase.from("clients").select("id,name"),
    supabase.from("jobs").select("id,client_id,title,code,current_step,painter,has_painting,workflow_type,updated_at,due_date,priority").order("updated_at", { ascending: false }),
  ]);

  if (clientsError || jobsError) {
    main.innerHTML = '<section class="panel"><h2>Errore di caricamento</h2><p>Non è stato possibile leggere le lavorazioni.</p></section>';
    return;
  }

  const clientMap = new Map((clients || []).map((client) => [client.id, client.name]));
  const paintingJobs = (jobs || []).filter((job) => job.current_step === "verniciatura");
  const assigned = paintingJobs.filter((job) => job.painter);
  const unassigned = paintingJobs.filter((job) => !job.painter);

  const card = (job) => {
    const status = job.current_step === "verniciatura" ? "In verniciatura" : job.current_step === "pronto_ritiro" ? "Pronto per ritiro" : "Prevista";
    return `<article class="painting-job">
      <div class="painting-job-head"><strong>${esc(job.title)}</strong><span>${esc(status)}</span></div>
      <p>${esc(clientMap.get(job.client_id) || "Cliente")} ${job.code ? `· ${esc(job.code)}` : ""}</p>
      <small>Aggiornato il ${formatDate(job.updated_at)}${job.due_date ? ` · Previsto ${formatDate(job.due_date)}` : ""}</small>
      <button class="open-painting-client" data-client="${job.client_id}">Apri scheda cliente</button>
    </article>`;
  };

  main.innerHTML = `<div class="admin-title"><div><span class="eyebrow red">PANNELLO AMMINISTRATORE</span><h1>Verniciatura</h1></div></div>
    <div class="painting-summary">
      <div class="kpi"><span>🎨</span><div><small>Materiale in elenco</small><strong>${paintingJobs.length}</strong></div></div>
      <div class="kpi"><span>🚚</span><div><small>Assegnato</small><strong>${assigned.length}</strong></div></div>
      <div class="kpi ${unassigned.length ? "danger" : ""}"><span>⚠️</span><div><small>Da assegnare</small><strong>${unassigned.length}</strong></div></div>
    </div>
    ${unassigned.length ? `<section class="panel painting-unassigned"><div class="panel-title"><h2>Da assegnare</h2><span>${unassigned.length}</span></div><div class="painting-list">${unassigned.map(card).join("")}</div></section>` : ""}
    <div class="painting-columns">
      ${PAINTERS.map((painter) => {
        const items = assigned.filter((job) => job.painter === painter);
        return `<section class="panel painting-column"><div class="panel-title"><h2>${painter}</h2><span>${items.length}</span></div><div class="painting-list">${items.length ? items.map(card).join("") : '<div class="empty small"><p>Nessun materiale.</p></div>'}</div></section>`;
      }).join("")}
    </div>`;

  document.querySelectorAll(".open-painting-client").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector('[data-view="clients"]')?.click();
      setTimeout(() => document.querySelector(`.client-row[data-id="${button.dataset.client}"]`)?.click(), 50);
    });
  });
}

const observer = new MutationObserver(ensurePaintingButton);
observer.observe(document.documentElement, { childList: true, subtree: true });
ensurePaintingButton();
