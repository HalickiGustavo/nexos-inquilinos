# Responsive audit suite

Playwright-based check that navigates every public + authenticated route at
**mobile (375px)**, **tablet (768px)** and **desktop (1280px)** viewports,
and fails when:

- the document scrolls horizontally (`scrollWidth > clientWidth`), or
- any element renders wider than the viewport, or
- the route returns HTTP ≥ 500.

A screenshot is captured for every route × viewport so layout breakage can
be inspected visually.

## Run locally

```bash
# 1. dev server must be running on :8080  (it is, in the Lovable sandbox)
# 2. (optional) export a Supabase session to also cover authenticated routes
#    — in the sandbox these vars are injected automatically:
#      LOVABLE_BROWSER_SUPABASE_STORAGE_KEY
#      LOVABLE_BROWSER_SUPABASE_SESSION_JSON
python3 tests/responsive/run.py
```

Exit code is `0` when every route passes, `1` otherwise.

## Output

`/tmp/browser/responsive/`
- `screenshots/<viewport>/<slug>.png` — one capture per route × viewport
- `report.json` — structured per-route results, including offending elements
- `summary.txt` — human-readable summary
