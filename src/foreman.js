import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const SUPABASE_URL = "https://jrudwnrorufmxjtjtwip.supabase.co";
const SUPABASE_KEY = "sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const root = document.querySelector("#root");
const painters = ["DAMAS", "SOSAM", "METALLIKA", "GALLO"];
const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
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

function row(item) {
  const search = [item.client_name, item.job_code, item.job_title, item.current_step_label, item.expected_painter, item.delivery_painter, item.painting_status_label].join(" ").toLowerCase();
  const warn = item.painter_mismatch || item.needs_check;
  return `<article class="foreman-row" data-search="${esc(search)}">
    <div><strong>${esc(item.client_name || "Cliente")}</strong><span>${esc(item.job_code || "Senza codice")} · ${esc(item.job_title || "Lavorazione")}</span><small>Stato: ${esc(item.current_step_label || "Non indicato")} · Priorita: ${esc(item.priority_label || "Normale")}</small></div>
    <div class="foreman-paint ${warn ? "warn" : ""}"><small>Verniciatura</small><b>${esc(item.painting_status_label || "Non assegnato")}</b>${item.painter_mismatch ? `<em>ATTENZIONE: previsto ${esc(item.expected_painter)}, portato a ${esc(item.delivery_painter)}</em>` : ""}</div>
    <div class="foreman-date"><small>Aggiornato</small><b>${formatDate(item.updated_at)}</b></div>
  </article>`;
}

function render() {
  const inPainting = rows.filter((item) => item.has_painting || item.expected_painter || item.current_step === "verniciatura");
  const checks = rows.filter((item) => item.needs_check);
  const errors = rows.filter((item) => item.painter_mismatch);
  root.innerHTML = `<header class="topbar">${logo()}<div class="account"><span><small>Capofficina</small><strong>SIMPRO Lamiere</strong></span><button id="logout">Esci</button></div></header><main class="foreman-page"><section class="admin-title foreman-title"><div><span class="eyebrow red">AREA CAPOFFICINA</span><h1>Stato clienti e verniciatura</h1></div><button class="secondary fit" id="refresh">Aggiorna</button></section><div class="kpi-grid foreman-kpis"><div class="kpi"><span>⚙</span><div><small>Lavorazioni</small><strong>${rows.length}</strong></div></div><div class="kpi"><span>🎨</span><div><small>In verniciatura</small><strong>${inPainting.length}</strong></div></div><div class="kpi ${checks.length ? "danger" : ""}"><span>!</span><div><small>Da controllare</small><strong>${checks.length}</strong></div></div><div class="kpi ${errors.length ? "danger" : ""}"><span>!</span><div><small>Errori verniciatore</small><strong>${errors.length}</strong></div></div></div><section class="panel foreman-search-panel"><label>Cerca cliente o commessa<input id="search" type="search" placeholder="Nome cliente, codice commessa, verniciatore..."></label><div class="foreman-filters"><button class="secondary fit foreman-filter active" data-filter="all" type="button">Tutto</button><button class="secondary fit foreman-filter" data-filter="painting" type="button">Solo verniciatura</button><button class="secondary fit foreman-filter" data-filter="errors" type="button">Da controllare/errori</button>${painters.map((p) => `<button class="secondary fit foreman-filter" data-filter="${p}" type="button">${p}</button>`).join("")}</div></section><section class="foreman-list">${rows.map(row).join("") || '<div class="empty"><p>Nessuna lavorazione presente.</p></div>'}</section></main>`;
  let active = "all";
  const apply = () => {
    const q = String(document.querySelector("#search").value || "").toLowerCase().trim();
    document.querySelectorAll(".foreman-row").forEach((node, index) => {
      const item = rows[index];
      const text = node.dataset.search || "";
      const okFilter = active === "all" || (active === "painting" && (item.has_painting || item.expected_painter || item.current_step === "verniciatura")) || (active === "errors" && (item.needs_check || item.painter_mismatch)) || (painters.includes(active) && text.includes(active.toLowerCase()));
      node.hidden = !(text.includes(q) && okFilter);
    });
  };
  document.querySelector("#logout").onclick = () => supabase.auth.signOut().then(loginPage);
  document.querySelector("#refresh").onclick = loadPage;
  document.querySelector("#search").oninput = apply;
  document.querySelectorAll(".foreman-filter").forEach((button) => button.onclick = () => {
    active = button.dataset.filter;
    document.querySelectorAll(".foreman-filter").forEach((item) => item.classList.toggle("active", item === button));
    apply();
  });
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
