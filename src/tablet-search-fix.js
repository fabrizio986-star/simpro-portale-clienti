import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jrudwnrorufmxjtjtwip.supabase.co";
const SUPABASE_KEY = "sb_publishable_RdYwFepv4SzTxHg2jiEVVg_nYFfQKxs";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let searchIndex = new Map();
let loading = null;

const normalize = (value = "") => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

async function loadSearchIndex() {
  if (loading) return loading;

  loading = (async () => {
    const [{ data: clients, error: clientsError }, { data: jobs, error: jobsError }] = await Promise.all([
      supabase.from("clients").select("id,name,contact_name,email,phone"),
      supabase.from("jobs").select("client_id,title,code,notes,painter,completed_at")
    ]);

    if (clientsError || jobsError) return;

    const nextIndex = new Map();
    for (const client of clients || []) {
      nextIndex.set(String(client.id), normalize([
        client.name,
        client.contact_name,
        client.email,
        client.phone
      ].filter(Boolean).join(" ")));
    }

    for (const job of jobs || []) {
      if (job.completed_at) continue;
      const id = String(job.client_id || "");
      if (!id) continue;
      const current = nextIndex.get(id) || "";
      nextIndex.set(id, `${current} ${normalize([
        job.title,
        job.code,
        job.notes,
        job.painter
      ].filter(Boolean).join(" "))}`.trim());
    }

    searchIndex = nextIndex;
  })().finally(() => {
    loading = null;
  });

  return loading;
}

function applyTabletSearch(input) {
  const query = normalize(input?.value);
  const rows = document.querySelectorAll(".client-row");
  if (!rows.length) return;

  rows.forEach((row) => {
    const id = String(row.dataset.id || "");
    const indexedText = searchIndex.get(id) || normalize(row.dataset.search || row.textContent);
    row.hidden = Boolean(query) && !indexedText.includes(query);
  });
}

async function handleSearch(input) {
  await loadSearchIndex();
  requestAnimationFrame(() => applyTabletSearch(input));
}

function bindCurrentSearch() {
  const input = document.querySelector("#filter-text");
  if (!input || input.dataset.tabletSearchFixed === "true") return;

  input.dataset.tabletSearchFixed = "true";
  input.setAttribute("autocomplete", "off");
  input.setAttribute("inputmode", "search");

  const run = () => handleSearch(input);
  input.addEventListener("input", run);
  input.addEventListener("keyup", run);
  input.addEventListener("change", run);
  input.addEventListener("search", run);
  input.addEventListener("compositionend", run);

  loadSearchIndex().then(() => applyTabletSearch(input));
}

const observer = new MutationObserver(() => bindCurrentSearch());
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener("focus", () => {
  searchIndex = new Map();
  loadSearchIndex().then(bindCurrentSearch);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    searchIndex = new Map();
    loadSearchIndex().then(bindCurrentSearch);
  }
});

bindCurrentSearch();
