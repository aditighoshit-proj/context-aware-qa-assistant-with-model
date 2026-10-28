const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("q");
const send = document.getElementById("send");

log.innerHTML = '<p class="empty">Ask a question to get started.</p>';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;   // textContent: never inject model output as HTML
  return n;
}

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
  if (r.retrieved && r.retrieved.length) {
    const d = el("details");
    d.append(el("summary", null, "Passages sent to the model"));
    const ul = el("ul");
    r.retrieved.forEach(x => ul.append(el("li", null, x)));
    d.append(ul);
    box.append(d);
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
  } catch (e) {
    render(box, { answerable: null, answer: e.message, sources: [], retrieved: [] });
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

document.querySelectorAll(".chip").forEach(c =>
  c.addEventListener("click", () => ask(c.dataset.q)));
