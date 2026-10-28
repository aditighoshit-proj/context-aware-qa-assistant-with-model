"""Runs questions.json through the system and writes results.json + results.md.
  python evaluate.py                  # full run (needs NVIDIA_API_KEY)
  python evaluate.py --retrieval-only # offline check of the retriever
"""
import json, sys, time
from pathlib import Path
import qa

questions = json.loads(Path("questions.json").read_text())
retrieval_only = "--retrieval-only" in sys.argv

if retrieval_only:
    ans = [q for q in questions if q["answerable"]]
    hit = 0
    for q in ans:
        files = [c.source for _, c in qa.get_retriever().search(q["question"], 4)]
        ok = q["source"] in files; hit += ok
        if not ok: print("MISS:", q["question"], files)
    print(f"Retrieval hit rate: {hit}/{len(ans)}")
    sys.exit()

client = qa.get_client()
rows = []
for q in questions:
    try: r = qa.ask(q["question"], client=client)
    except Exception as e: r = {"answerable": None, "answer": f"ERROR: {e}", "sources": [], "retrieved": []}
    if q["answerable"]:
        text = r["answer"].lower()
        ok = r["answerable"] is True and all(any(k in text for k in grp) for grp in q["must_include"])
        r["retrieval_hit"] = q["source"] in [x.split(" > ")[0] for x in r["retrieved"]]
    else:
        ok = r["answerable"] is False
    rows.append({"id": q["id"], "type": "answerable" if q["answerable"] else "unanswerable", "question": q["question"], "answer": r["answer"], "sources": r["sources"], "retrieval_hit": r.get("retrieval_hit"), "pass": ok})
    print(("PASS" if ok else "FAIL"), q["id"], q["question"])
    time.sleep(0.5)

A = [r for r in rows if r["type"] == "answerable"]; U = [r for r in rows if r["type"] == "unanswerable"]
summary = {"model": qa.MODEL, "total": len(rows), "overall_pass": sum(r["pass"] for r in rows),
           "answerable_pass": f'{sum(r["pass"] for r in A)}/{len(A)}',
           "unanswerable_correctly_refused": f'{sum(r["pass"] for r in U)}/{len(U)}',
           "retrieval_hit": f'{sum(bool(r["retrieval_hit"]) for r in A)}/{len(A)}'}
Path("results.json").write_text(json.dumps({"summary": summary, "rows": rows}, indent=2))
md = ["# Evaluation results", "", *[f"- **{k}**: {v}" for k, v in summary.items()], "",
      "| # | Type | Question | Answer | Sources | Pass |", "|---|---|---|---|---|---|"]
for r in rows:
    a = r["answer"].replace("|", "/").replace("\n", " ")[:160]
    md.append(f'| {r["id"]} | {r["type"]} | {r["question"]} | {a} | {"; ".join(r["sources"])} | {"✅" if r["pass"] else "❌"} |')
Path("results.md").write_text("\n".join(md))
print(json.dumps(summary, indent=2))
