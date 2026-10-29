const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("q");
const send = document.getElementById("send");

log.innerHTML = '<p class="empty">Pick a question from the Topics panel, or type your own.</p>';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;   // textContent: never inject text as HTML
  return n;
}

/* ---------- left panel: tabs ---------- */
function showTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.getElementById("pane-topics").hidden = name !== "topics";
  document.getElementById("pane-ctx").hidden = name !== "ctx";
}
document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => showTab(t.dataset.tab)));

/* ---------- left panel: knowledge base topics ---------- */
function questionButton(q) {
  const b = el("button", "q-btn", q);
  b.type = "button";
  b.addEventListener("click", () => ask(q));
  return b;
}

function renderKb(data) {
  const root = document.getElementById("kb");
  root.replaceChildren();
  data.documents.forEach((d, i) => {
    const doc = el("details", "doc");
    doc.open = i === 0;
    doc.append(el("summary", null, d.title));
    doc.append(el("p", "doc-file", d.file));
    doc.append(el("p", "group-label", "Questions you can ask"));
    d.questions.forEach(q => doc.append(questionButton(q)));
    doc.append(el("p", "group-label", "Sections in this document"));
    d.sections.forEach(s => {
      const sec = el("details", "section");
      sec.append(el("summary", null, s.name), el("p", "section-text", s.text));
      doc.append(sec);
    });
    root.append(doc);
  });
  if (data.not_in_docs && data.not_in_docs.length) {
    const doc = el("details", "doc not-in-docs");
    doc.append(el("summary", null, "Not in the documents"));
    doc.append(el("p", "doc-file", "The system should refuse these"));
    data.not_in_docs.forEach(q => doc.append(questionButton(q)));
    root.append(doc);
  }
}

fetch("/api/kb")
  .then(r => r.json())
  .then(renderKb)
  .catch(() => document.getElementById("kb").replaceChildren(el("p", "ctx-empty", "Could not load the knowledge base.")));

/* ---------- left panel: retrieved context ---------- */
function renderContext(r) {
  const root = document.getElementById("ctx");
  root.replaceChildren();
  if (!r.context || !r.context.length) {
    root.append(el("p", "ctx-empty", "No passages matched this question, so nothing was sent to the model."));
    return;
  }
  r.context.forEach(p => {
    const card = el("div", "passage" + (p.used ? " used" : ""));
    const head = el("div", "passage-head");
    head.append(el("span", "passage-label", `[${p.id}] ${p.label}`), el("span", "passage-score", `score ${p.score}`));
    card.append(head, el("p", "passage-text", p.text));
    if (p.used) card.append(el("span", "used-tag", "Used in answer"));
    root.append(card);
  });
}

/* ---------- chat ---------- */
function render(box, r) {
  const state = r.answerable === true ? "ok" : r.answerable === false ? "warn" : "err";
  const label = { ok: "Answer", warn: "Not in the documents", err: "Unclear model output" }[state];
  box.className = "msg-a " + state;
  box.replaceChildren(el("span", "badge", label), el("p", "answer", r.answer));
  if (r.sources && r.sources.length) {
    const s = el("div", "sources", "Sources:");
    r.sources.forEach(x => s.append(el("span", "src", x)));
    box.append(s);
  }
}

async function ask(question) {
  log.querySelector(".empty")?.remove();
  log.append(el("div", "msg-q", question));
  const box = el("div", "msg-a loading", "Thinking");
  log.append(box);
  box.scrollIntoView({ behavior: "smooth", block: "end" });
  send.disabled = true;
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    render(box, data);
    renderContext(data);
    showTab("ctx");
  } catch (e) {
    render(box, { answerable: null, answer: e.message, sources: [] });
  } finally {
    send.disabled = false;
    box.scrollIntoView({ behavior: "smooth", block: "end" });
  }
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  input.value = "";
  ask(q);
});
