# TESTS.md — Phase 2 suite for the 14 reported bugs

Automated tests for the **14 defects** submitted in `my-bug-report.md` (Phase 1). Application code on `main` is untouched; these tests are expected to **fail** until branch `fix/all-bugs`.

Eight later discoveries live in `ADDITIONAL_FINDINGS.md` and `tests/additional/` — they are **not** part of this count of 14.

## How to run

```bash
npm install
npx playwright install chromium   # once, for UI specs

npm test                  # reported API only
npm run test:reported     # same
npm run test:ui           # reported UI (Playwright)
npm run test:api          # reported + additional API
npm run test:all          # all API then all Playwright specs
```

Default port is **3014**. The Node test harness spawns `server.js` automatically (skipped when `BASE_URL` is set or the port is already listening). Playwright uses the `webServer` block in `playwright.config.js`.

## Session cookie constraint

`isolation.js` keys an in-memory store on an `sid` cookie. Node’s `fetch` does not persist cookies, so a naive client gets a **new seeded store on every request**. A POST that “succeeds” then disappears from the next GET — and every create-then-assert test becomes meaningless.

`tests/helpers.mjs` keeps a cookie jar (`getSetCookie` → `Cookie: sid=…`). The **harness sanity** test asserts a POST is visible to the next GET; if it fails, treat the whole run as invalid.

Each test `beforeEach` calls `POST /api/reset` so the store returns to the five seeded rows.

## Corrections to the Phase 1 report

**Bug 14.** The report describes mass assignment via an undocumented `note` field. That is not what happens: `server.js` destructures only `agentId`, `candidateId`, `date`, and `minutes`, so `note` is discarded. The real mechanism is an **unvalidated `agentId`** later interpolated into `innerHTML` in `public/app.js`.

**Bug 2.** The report says the cumulative accumulator “surfaces in the `avgMinutes` field”. It does not — it surfaces in **`totalMinutes`**. `avgMinutes` is wrong for a separate reason (`ownMinutes / req.store.logs.length`); that divisor bug is **additional finding G**, not reported bug 2.

## Bug → test → root cause

| # | Test | Root-cause line |
|---|------|-----------------|
| 1 | `bug 1: … totalHours must equal totalMinutes / 60` | `server.js`: `const totalHours = totalMinutes * 60;` |
| 2 | `bug 2: … totalMinutes must be per-agent, not cumulative` | `server.js`: `let runningTotal = 0;` outside `.map()` |
| 3 | `bug 3: … totalMinutes must sum the filtered result` | `server.js`: reduce over `req.store.logs` not `result` |
| 4 | `bug 4: … reject missing candidateId` | `server.js`: `if (!agentId \|\| !agentId \|\| …)` |
| 5 | `bug 5: … reject minutes 0 and negatives` | `server.js`: `minutes == null \|\| minutes > 480` |
| 6 | `bug 6: … reject unknown agentId and candidateId` | `server.js`: no lookup against `agents` / `candidates` |
| 7 | `bug 7: … return 201 Created` | `server.js`: `res.status(200)` on create |
| 8 | `bug 8: Hours column … one decimal place` | `public/app.js`: `(log.minutes / 60).toFixed(0)` |
| 9 | `bug 9: … spell "Analytics"` | `public/index.html`: `<h2>Anlytics</h2>` |
| 10 | `bug 10: … must not include AG11` | `server.js`: `l.agentId.includes(req.query.agentId)` |
| 11 | `bug 11: … match without IST shift` | `server.js`: `shiftForIST()` |
| 12 | `bug 12: … error toast, not "Log added!"` | `public/app.js`: unconditional `showToast('Log added!')` |
| 13 | `bug 13: … refresh analytics` | `public/app.js`: `loadLogs()` without `loadAnalytics()` |
| 14 | `bug 14: … not persist raw HTML in agentId` | unvalidated `agentId` + `innerHTML` sink |

Controls that must **pass** on `main`: harness sanity; minutes `481` rejected; `1` and `480` accepted.

## Design rules

| Rule | Why |
|------|-----|
| Never hardcode expected aggregates | Recompute from `/api/logs` so the contract stays valid if seed data changes, but still fails on today’s bugs. |
| Prefer internal-consistency checks | e.g. `totalHours` vs `totalMinutes / 60` from the same payload needs no fixture knowledge. |
| Diagnostic failure messages | Name the arithmetic and the likely root cause so a failure is actionable. |
| Assert preconditions | e.g. create an AG11 row before the prefix-collision test so it cannot pass vacuously. |
| Cookie jar + reset | Isolate defects from session/store artefacts. |
| Real element ids only | Selectors match `public/index.html` (`#logForm`, `#minutes`, …). |
| Playwright `workers: 1` | One shared per-session store; parallel workers would race. |
