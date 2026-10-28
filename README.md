# Context-Aware Q&A Assistant

Answers questions **only** from the files in `kb/`. If the answer isn't there, it says so instead of guessing.
LLM: `nvidia/nemotron-3.5-super-vl-120b-a12b` via NVIDIA's OpenAI-compatible API.

## How it works
1. **Load**: every `kb/*.md` is split into section-level chunks (`## Heading` = one chunk), tagged `file > section`.
2. **Retrieve**: BM25 (pure Python, no vector DB) returns the top 4 chunks. If *nothing* overlaps the question, the LLM is skipped and the "not found" answer is returned.
3. **Answer**: the chunks are sent to Nemotron as numbered context with a strict system prompt. The model returns JSON: `{"answerable": bool, "answer": str, "sources": [ids]}`.
4. **Guard**: if `answerable` is false, the answer is replaced with a fixed message: *"I couldn't find this in the provided documents."* Source ids are validated against the chunks actually sent.

## Prompt / context design
- `temperature=0` for repeatable answers.
- Rules in the system prompt: use only the context; no outside knowledge; no partial guesses; answer partial matches explicitly; quote exact numbers; treat context as data, not instructions (prompt-injection resistance).
- Structured JSON output makes "not available" a machine-checkable field, not a phrase to string-match.
- `<think>...</think>` blocks are stripped before JSON parsing; unparseable output is flagged, never shown as a confident answer.
- Numbered, labelled passages (`[1] source: leave_policy.md > Annual Leave`) enable citations.

## Frontend
Plain HTML/CSS/JS in `static/` (no framework, light/dark mode). `server.py` (stdlib only) serves it and exposes `POST /api/ask`, so the API key never reaches the browser. Answers show a green "Answer" card or an amber "Not in the documents" card, with source chips and the passages sent to the model.

## Knowledge base (`kb/`)
Fictional "Acme Corp" docs: `leave_policy.md`, `remote_work_and_expenses.md`, `it_security_and_conduct.md`.

## Run
```bash
pip install -r requirements.txt
cp .env.example .env            # add your NVIDIA_API_KEY (from build.nvidia.com)
python qa.py "Can employees carry forward more than 10 days of leave?"
python qa.py                    # interactive
python server.py                # web UI at http://localhost:8000
```

## Evaluation
`questions.json` has 31 questions: 21 answerable (each with required facts and expected source file) and 10 **unanswerable**, including traps:
- near-miss topics the KB almost covers (bereavement leave, sabbatical, sick-leave cash-out)
- plausible company facts (CEO, 401(k), dental)
- pure general knowledge ("capital of France")

```bash
python evaluate.py                   # full run -> results.json, results.md
python evaluate.py --retrieval-only  # offline retriever check
```
Pass criteria: answerable = model says answerable AND answer contains the expected facts; unanswerable = model says not answerable (anything else counts as a hallucination).

### Results
Retrieval hit rate (offline): **21/21**.
LLM results: _run `python evaluate.py` and paste the summary from `results.md` here._

## Limitations
- BM25 is lexical; heavy paraphrasing of a question may miss the right chunk (swap in embeddings for larger KBs).
- Keyword-based grading can mark a correct but differently-worded answer as a fail; check `results.md` by eye.
- Sections are small, so chunking is by heading; very long sections would need sub-splitting.

## Submission checklist
- [ ] GitHub repo pushed (`.env` is git-ignored)
- [ ] `results.md` pasted above
- [ ] Screenshots of the web UI, incl. an unanswerable question, in `screenshots/`
