"""Serves the HTML/CSS frontend and a JSON API. The API key stays server-side."""
import json, os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import qa

STATIC = (Path(__file__).parent / "static").resolve()
TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8"}
ROOT = Path(__file__).parent
client = qa.get_client()

def kb_overview():
    """Documents, their sections, and the sample questions from questions.json."""
    qs = json.loads((ROOT / "questions.json").read_text())
    chunks = qa.load_kb()
    docs = []
    for p in sorted(qa.KB_DIR.glob("*.md")):
        title = p.read_text(encoding="utf-8").splitlines()[0].lstrip("# ").replace("GEOGO PVT LTD ", "").strip()
        docs.append({"file": p.name, "title": title,
                     "sections": [{"name": c.section, "text": c.text} for c in chunks if c.source == p.name and c.section != "Overview"],
                     "questions": [q["question"] for q in qs if q.get("source") == p.name]})
    return {"documents": docs, "not_in_docs": [q["question"] for q in qs if not q["answerable"]]}

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj).encode(), "application/json")

    def do_GET(self):
        if self.path == "/api/kb":
            return self._json(200, kb_overview())
        name = "index.html" if self.path in ("/", "") else self.path.split("?")[0].lstrip("/")
        f = (STATIC / name).resolve()
        if STATIC not in f.parents or not f.is_file():
            return self._send(404, b"Not found", "text/plain")
        self._send(200, f.read_bytes(), TYPES.get(f.suffix, "application/octet-stream"))

    def do_POST(self):
        if self.path != "/api/ask":
            return self._json(404, {"error": "not found"})
        try:
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            q = str(json.loads(body).get("question", "")).strip()[:500]
            if not q: raise ValueError
        except Exception:
            return self._json(400, {"error": "A question is required."})
        try:
            self._json(200, qa.ask(q, client=client))
        except Exception as e:
            self._json(502, {"error": f"LLM request failed: {e}"})

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"Open http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
