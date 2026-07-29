import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const SUPABASE_URL = "https://jrudwnrorufmxjtjtwip.supabase.co";
const SUPABASE_KEY = "sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const root = document.querySelector("#root");
const painters = ["DAMAS", "SOSAM", "METALLIKA", "GALLO"];
const paintStatuses = {
  da_portare: "Da portare",
  in_viaggio: "In viaggio",
  consegnato: "Consegnato al verniciatore",
  ritirato: "Ritirato dal verniciatore",
  rientrato: "Rientrato in officina",
  previsto: "Previsto da scheda",
  "non assegnato": "Non assegnato"
};
const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const normalizePainter = (value = "") => String(value || "").trim().toUpperCase();
const painterFor = (item) => normalizePainter(item.delivery_painter || item.expected_painter);
const statusLabel = (value) => paintStatuses[value || ""] || value || "Non assegnato";
const formatDate = (value) => value ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value)) : "-";
const logo = () => '<a class="brand" href="./" aria-label="SIMPRO Lamiere"><img src="https://www.simprolamiere.it/wp-content/uploads/2024/07/logo-simpro-128x128.png" alt="SIMPRO Lamiere"></a>';
let rows = [];

function showAuth(message, ok = false) {
  const node = document.querySelector("#auth-message");
  if (!node) return;
  node.textContent = message;
  node.className = `form-message ${ok ? "ok" : "error"}`;
}

function loginPage() {
  root.innerHTML = `<main class="login-page"><section class="login-intro">${logo()}<div><span class="eyebrow">AREA CAPOFFICINA</span><h1>Controllo clienti<br>e verniciatura.</h1><p>Accesso riservato al capofficina SIMPRO.</p></div><small>Solo consultazione operativa</small></section><section class="login-panel"><form id="login-form" class="login-card"><div class="mobile-logo">${logo()}</div><span class="eyebrow red">ACCESSO CAPOFFICINA</span><h2>Entra nel pannello</h2><p>Cerca clienti, commesse e controlla dove sta il materiale in verniciatura.</p><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" minlength="8" autocomplete="current-password" required></label><div id="auth-message" class="form-message"></div><button class="primary" type="submit">Accedi <span>→</span></button><small class="help">Accesso limitato: sola visualizzazione.</small></form></section></main>`;
  document.querySelector("#login-form").onsubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({ email: data.get("email"), password: data.get("password") });
    if (error) return showAuth(error.message);
    loadPage();
  };
}

function photoButton(item) {
  if (!item.photo_url) return "";
  return `<a class="foreman-photo-link" href="${esc(item.photo_url)}" target="_blank" rel="noopener">
    <span>Foto autista</span>
    <img src="${esc(item.photo_url)}" alt="Foto caricata dall'autista">
  </a>`;
}

function row(item) {
  const search = [item.client_name, item.job_code, item.job_title, item.current_step_label, item.expected_painter, item.delivery_painter, item.painting_status_label].join(" ").toLowerCase();
  const warn = item.painter_mismatch || item.needs_check;
  const expected = normalizePainter(item.expected_painter);
  const delivered = normalizePainter(item.delivery_painter);
  const painterText = delivered ? `Portato a ${delivered}` : expected ? `Previsto ${expected}` : "Non assegnato";
  return `<article class="foreman-row" data-search="${esc(search)}">
    <div><strong>${esc(item.client_name || "Cliente")}</strong><span>${esc(item.job_code || "Senza codice")} · ${esc(item.job_title || "Lavorazione")}</span><small>Stato: ${esc(item.current_step_label || "Non indicato")} · Priorita: ${esc(item.priority_label || "Normale")}</small></div>
    <div class="foreman-paint ${warn ? "warn" : ""}"><small>Verniciatura</small><b>${esc(painterText)}</b><span>${esc(statusLabel(item.painting_status_label))}</span>${item.painter_mismatch ? `<em>ATTENZIONE: previsto ${esc(expected)}, portato a ${esc(delivered)}</em>` : ""}${item.needs_check && !item.painter_mismatch ? "<em>Da controllare</em>" : ""}</div>
    <div class="foreman-photo-cell">${photoButton(item)}</div>
    <div class="foreman-date"><small>Aggiornato</small><b>${formatDate(item.updated_at)}</b></div>
  </article>`;
}

function painterBoard(items) {
  return `<section class="panel painter-board"><div class="panel-title"><h2>Vista per verniciatore</h2><span>${items.length}</span></div><div class="painter-lanes">${painters.map((painter) => {
    const laneRows = items.filter((item) => painterFor(item) === painter && statusLabel(item.painting_status_label) !== "Rientrato in officina");
    const cards = laneRows.slice(0, 10).map((item) => {
      const warn = item.painter_mismatch || item.needs_check;
      const expected = normalizePainter(item.expected_painter);
      const delivered = normalizePainter(item.delivery_painter);
      return `<button class="painter-lane-card foreman-filter ${warn ? "attention" : ""}" type="button" data-filter="${esc(painter)}">
        <strong>${esc(item.client_name || "Cliente")}</strong>
        <small>${esc(item.job_code || "Senza codice")} · ${esc(item.job_title || "Lavorazione")}</small>
        <small>${esc(statusLabel(item.painting_status_label))}${item.photo_url ? " · Foto presente" : ""}</small>
        ${item.painter_mismatch ? `<b>Errore: previsto ${esc(expected)}, portato a ${esc(delivered)}</b>` : item.needs_check ? "<b>Da controllare</b>" : "<span>OK</span>"}
      </button>`;
    }).join("");
    return `<article class="painter-lane"><button class="painter-lane-head foreman-filter" type="button" data-filter="${esc(painter)}"><span>${esc(painter)}</span><strong>${laneRows.length}</strong></button><div class="painter-lane-list">${cards || '<div class="empty small"><p>Nessun materiale aperto.</p></div>'}</div></article>`;
  }).join("")}</div></section>`;
}

function render() {
  const inPainting = rows.filter((item) => item.current_step === "verniciatura");
  const checks = rows.filter((item) => item.needs_check);
  const errors = rows.filter((item) => item.painter_mismatch);
  const quickItems = [
    { label: "Da controllare", value: checks.length, filter: "errors", hot: checks.length > 0 },
    { label: "In verniciatura", value: inPainting.length, filter: "painting" },
    ...painters.map((painter) => ({ label: painter, value: inPainting.filter((item) => painterFor(item) === painter).length, filter: painter }))
  ];
  root.innerHTML = `<header class="topbar foreman-topbar">${logo()}<div class="account"><span><small>Capofficina</small><strong>SIMPRO Lamiere</strong></span><button id="logout">Esci</button></div></header><main class="foreman-page"><section class="admin-title foreman-title"><div><span class="eyebrow red">AREA CAPOFFICINA</span><h1>Controllo rapido</h1><p>Clienti, commesse e materiale in verniciatura.</p></div><button class="secondary fit" id="refresh">Aggiorna</button></section><section class="panel foreman-search-panel foreman-search-first"><label>Cerca subito<input id="search" type="search" inputmode="search" autocomplete="off" placeholder="Scrivi cliente, codice o verniciatore..."></label><div class="foreman-quick-actions">${quickItems.map((item) => `<button class="foreman-quick foreman-filter ${item.hot ? "hot" : ""}" data-filter="${esc(item.filter)}" type="button"><strong>${item.value}</strong><span>${esc(item.label)}</span></button>`).join("")}</div><details class="foreman-more-filters"><summary>Altri filtri</summary><div class="foreman-filters"><button class="secondary fit foreman-filter active" data-filter="all" type="button">Tutto</button><button class="secondary fit foreman-filter" data-filter="painting" type="button">Solo verniciatura</button><button class="secondary fit foreman-filter" data-filter="errors" type="button">Da controllare/errori</button>${painters.map((p) => `<button class="secondary fit foreman-filter" data-filter="${p}" type="button">${p}</button>`).join("")}</div></details></section><div class="kpi-grid foreman-kpis foreman-desktop-only"><div class="kpi"><span>•</span><div><small>Lavorazioni</small><strong>${rows.length}</strong></div></div><div class="kpi"><span>•</span><div><small>In verniciatura</small><strong>${inPainting.length}</strong></div></div><div class="kpi ${checks.length ? "danger" : ""}"><span>!</span><div><small>Da controllare</small><strong>${checks.length}</strong></div></div><div class="kpi ${errors.length ? "danger" : ""}"><span>!</span><div><small>Errori verniciatore</small><strong>${errors.length}</strong></div></div></div>${painterBoard(inPainting)}<section class="foreman-list">${rows.map(row).join("") || '<div class="empty"><p>Nessuna lavorazione presente.</p></div>'}</section></main>`;
  let active = "all";
  const apply = () => {
    const q = String(document.querySelector("#search").value || "").toLowerCase().trim();
    document.querySelectorAll(".foreman-row").forEach((node, index) => {
      const item = rows[index];
      const text = node.dataset.search || "";
      const okFilter = active === "all" || (active === "painting" && item.current_step === "verniciatura") || (active === "errors" && (item.needs_check || item.painter_mismatch)) || (painters.includes(active) && item.current_step === "verniciatura" && painterFor(item) === active);
      node.hidden = !(text.includes(q) && okFilter);
    });
  };
  const setActive = (filter) => {
    active = filter;
    document.querySelectorAll(".foreman-filter").forEach((item) => item.classList.toggle("active", item.dataset.filter === filter));
    apply();
    if (window.matchMedia("(max-width: 760px)").matches) {
      document.querySelector(".foreman-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  document.querySelector("#logout").onclick = () => supabase.auth.signOut().then(loginPage);
  document.querySelector("#refresh").onclick = loadPage;
  document.querySelector("#search").oninput = apply;
  document.querySelectorAll(".foreman-filter").forEach((button) => button.onclick = () => setActive(button.dataset.filter));
}

async function loadPage() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return loginPage();
  root.innerHTML = '<div class="loading">Caricamento area capofficina...</div>';
  const { data, error } = await supabase.rpc("foreman_dashboard");
  if (error) {
    root.innerHTML = `<main class="not-found">${logo()}<h1>Accesso non configurato</h1><p>Esegui la funzione SQL foreman_dashboard e crea l'utente capofficina.</p><button class="primary fit" id="logout">Esci</button></main>`;
    document.querySelector("#logout").onclick = () => supabase.auth.signOut().then(loginPage);
    return;
  }
  rows = Array.isArray(data) ? data : [];
  render();
}

loadPage();
