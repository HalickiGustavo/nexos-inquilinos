"""Responsive audit suite.

Navigates every public + authenticated route in 3 viewports (mobile, tablet,
desktop) and asserts there is no horizontal overflow. Captures screenshots
and console errors per route × viewport.

Usage (from project root, dev server already running on :8080):
    python3 tests/responsive/run.py

Outputs to /tmp/browser/responsive/:
  - screenshots/<viewport>/<slug>.png
  - report.json  (per-route results)
  - summary.txt  (human summary, printed at the end)

Auth: uses LOVABLE_BROWSER_SUPABASE_* env vars to restore a Supabase session.
If absent, only public routes are audited.
"""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
OUT = Path("/tmp/browser/responsive")
SHOTS = OUT / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

VIEWPORTS = [
    ("mobile",  375, 800),
    ("tablet",  768, 1024),
    ("desktop", 1280, 900),
]

PUBLIC_ROUTES = ["/login", "/cadastro"]
AUTH_ROUTES = [
    "/dashboard", "/properties", "/tenants", "/contracts", "/maintenances",
    "/financials", "/conta-corrente", "/integrations", "/admin/integracoes",
    "/tenant", "/tenant/financeiro", "/tenant/contrato",
    "/tenant/manutencoes", "/tenant/alertas",
    "/manager", "/manager/crm", "/manager/carteira", "/manager/financeiro",
    "/manager/alertas", "/manager/equipe", "/manager/portais",
    "/manager/vistorias", "/manager/dimob", "/manager/integracao",
    "/manager/migrar-dados",
]


def slug(route: str) -> str:
    return route.strip("/").replace("/", "_") or "root"


async def restore_session(page):
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if not (storage_key and session_json):
        return False
    await page.goto(BASE + "/login", wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
    )
    return True


async def audit_route(page, route: str, viewport_name: str):
    console_errors: list[str] = []
    def on_console(msg):
        if msg.type == "error":
            console_errors.append(msg.text[:300])
    page.on("console", on_console)

    result = {"route": route, "viewport": viewport_name, "ok": True, "issues": []}
    try:
        resp = await page.goto(BASE + route, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(800)  # let layout settle / async data render skeletons
        status = resp.status if resp else 0
        if status >= 500:
            result["ok"] = False
            result["issues"].append(f"HTTP {status}")

        metrics = await page.evaluate(
            """() => ({
                scrollW: document.documentElement.scrollWidth,
                clientW: document.documentElement.clientWidth,
                bodyScrollW: document.body ? document.body.scrollWidth : 0,
            })"""
        )
        overflow = metrics["scrollW"] - metrics["clientW"]
        result["overflowPx"] = overflow
        if overflow > 2:  # tolerate sub-pixel rounding
            result["ok"] = False
            result["issues"].append(f"horizontal overflow {overflow}px")

        # detect any descendant element wider than viewport (catches isolated culprits)
        wide = await page.evaluate(
            """(vw) => {
                const offenders = [];
                const all = document.querySelectorAll('body *');
                for (const el of all) {
                    const r = el.getBoundingClientRect();
                    if (r.width > vw + 2 && r.height > 0) {
                        offenders.push({
                            tag: el.tagName.toLowerCase(),
                            cls: (el.className || '').toString().slice(0, 80),
                            w: Math.round(r.width),
                        });
                        if (offenders.length >= 5) break;
                    }
                }
                return offenders;
            }""",
            metrics["clientW"],
        )
        if wide:
            result["wideElements"] = wide
            result["ok"] = False
            result["issues"].append(f"{len(wide)} element(s) wider than viewport")

        shot_dir = SHOTS / viewport_name
        shot_dir.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(shot_dir / f"{slug(route)}.png"))
    except Exception as e:
        result["ok"] = False
        result["issues"].append(f"exception: {type(e).__name__}: {e}")
    finally:
        page.remove_listener("console", on_console)
        if console_errors:
            result["consoleErrors"] = console_errors[:5]
    return result


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        all_results = []

        for vp_name, vw, vh in VIEWPORTS:
            context = await browser.new_context(viewport={"width": vw, "height": vh})
            page = await context.new_page()
            authed = await restore_session(page)
            routes = list(PUBLIC_ROUTES)
            if authed:
                routes += AUTH_ROUTES
            for r in routes:
                res = await audit_route(page, r, vp_name)
                all_results.append(res)
                tag = "OK " if res["ok"] else "FAIL"
                print(f"[{vp_name:7}] {tag} {r}  overflow={res.get('overflowPx', '?')}px  {';'.join(res['issues']) if res['issues'] else ''}")
            await context.close()

        await browser.close()

        (OUT / "report.json").write_text(json.dumps(all_results, indent=2))
        failures = [r for r in all_results if not r["ok"]]
        summary = [
            f"Routes audited: {len(all_results)}",
            f"Failures: {len(failures)}",
        ]
        for f in failures:
            summary.append(f" - [{f['viewport']}] {f['route']}: {'; '.join(f['issues'])}")
        text = "\n".join(summary)
        (OUT / "summary.txt").write_text(text)
        print("\n" + text)
        sys.exit(0 if not failures else 1)


asyncio.run(main())
