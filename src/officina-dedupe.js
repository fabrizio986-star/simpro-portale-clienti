const normalizeOfficeText = (value = "") => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

let dedupeScheduled = false;

function cardIdentity(card) {
  const client = normalizeOfficeText(card.querySelector("h3")?.textContent);
  const job = normalizeOfficeText(card.querySelector("p")?.textContent);
  const painter = normalizeOfficeText(card.querySelector("strong")?.textContent);
  return {
    strict: client && job && job !== "senza numero commessa" ? `${client}|${job}` : "",
    fallback: client && painter ? `${client}|${painter}` : "",
  };
}

function updateSectionCounter(section) {
  if (!section) return;
  const cards = section.querySelectorAll(".office-card");
  const counter = section.querySelector(".office-section-title span");
  if (counter) counter.textContent = String(cards.length);

  const grid = section.querySelector(".office-grid");
  const empty = grid?.querySelector(".office-empty");
  if (!cards.length && grid && !empty) {
    grid.innerHTML = '<div class="office-empty">Nessuna lavorazione.</div>';
  } else if (cards.length && empty) {
    empty.remove();
  }
}

function removePaintingDuplicates() {
  dedupeScheduled = false;
  const toTakeSection = document.querySelector(".office-section.to-take");
  const deliveredSection = document.querySelector(".office-section.delivered");
  const collectSection = document.querySelector(".office-section.to-collect");
  if (!toTakeSection || !deliveredSection) return;

  const movedCards = [
    ...deliveredSection.querySelectorAll(".office-card"),
    ...(collectSection ? collectSection.querySelectorAll(".office-card") : []),
  ];

  const strictMoved = new Set();
  const fallbackMoved = new Set();
  for (const card of movedCards) {
    const identity = cardIdentity(card);
    if (identity.strict) strictMoved.add(identity.strict);
    if (identity.fallback) fallbackMoved.add(identity.fallback);
  }

  toTakeSection.querySelectorAll(".office-card").forEach((card) => {
    const identity = cardIdentity(card);
    const duplicate = (identity.strict && strictMoved.has(identity.strict))
      || (!identity.strict && identity.fallback && fallbackMoved.has(identity.fallback));
    if (duplicate) card.remove();
  });

  updateSectionCounter(toTakeSection);

  const kpiCounter = document.querySelector(".office-kpis > div:first-child strong");
  if (kpiCounter) {
    kpiCounter.textContent = String(toTakeSection.querySelectorAll(".office-card").length);
  }
}

function schedulePaintingDedupe() {
  if (dedupeScheduled) return;
  dedupeScheduled = true;
  requestAnimationFrame(removePaintingDuplicates);
}

const officeRoot = document.querySelector("#root");
if (officeRoot) {
  new MutationObserver(schedulePaintingDedupe).observe(officeRoot, { childList: true, subtree: true });
}

document.addEventListener("DOMContentLoaded", schedulePaintingDedupe);
window.addEventListener("focus", schedulePaintingDedupe);
schedulePaintingDedupe();
