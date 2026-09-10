# ADDITIONAL_FINDINGS.md — eight Phase 2 discoveries

These **eight** defects were found **during Phase 2** while reading the source. They were **not** part of the Phase 1 submission in `my-bug-report.md` and are documented separately so the reported count of **14** stays accurate.

They are covered only under `tests/additional/` (test names prefixed `ADDITIONAL`).

## How to run

```bash
npm run test:additional          # API findings A, C, D, G
npm run test:ui:additional       # UI findings B, E, F, H
```

## Findings

### A — `GET /api/analytics` · substring-vs-exact-match

- **Root cause:** `server.js` analytics filter `l.agentId.includes(agent.id)` — AG1 absorbs AG11 rows.
- **Found by:** reading the analytics loop after Phase 1; same mistake as bug 10, different endpoint/path.
- **Test:** `ADDITIONAL A: GET /api/analytics must count agents with === not includes`
- **Overlap:** **Genuinely independent** of reported bug 10 (logs query filter). Same class of bug, separate code path.

### B — UI · analytics columns bound to the wrong fields

- **Root cause:** `public/app.js` `loadAnalytics` renders `avgMinutes` then `totalHours` then `totalMinutes` under headings Total Minutes / Total Hours / Avg Minutes/Entry.
- **Found by:** comparing table headings in `index.html` to the `innerHTML` column order.
- **Test:** `ADDITIONAL B: analytics columns must match heading field names`

### C — `POST /api/logs` · date is never validated

- **Root cause:** handler checks only that `date` is present; accepts `2026-13-45`, `10-09-2026`, and future dates.
- **Found by:** reading POST validation against the OpenAPI/spec date rules.
- **Test:** `ADDITIONAL C: POST /api/logs must reject invalid and future dates`
- **Overlap:** **Shares the validation block with reported bug 5** — additional missing rules on the same handler, not an independent code path.

### D — `POST /api/logs` · `minutes` is not type-checked

- **Root cause:** no `Number.isInteger` check; `30.5` and `"60"` are stored. String minutes corrupt `+` aggregates via concatenation.
- **Found by:** reading the minutes guard next to bug 5’s boundary hole.
- **Test:** `ADDITIONAL D: POST /api/logs must reject non-integer minutes`
- **Overlap:** **Shares the validation block with reported bug 5** (and finding C).

### E — UI · no client-side validation on the form

- **Root cause:** `#minutes` has placeholder only — no `min` / `max` / `step` / `required`.
- **Found by:** inspecting `public/index.html` inputs against the spec’s client-validation requirement.
- **Test:** `ADDITIONAL E: #minutes must expose min/max/step/required`

### F — UI · the date field defaults to a hardcoded date

- **Root cause:** `<input type="date" id="date" value="2026-07-24">` in `index.html`.
- **Found by:** reading the form markup.
- **Test:** `ADDITIONAL F: #date must default to today or empty`

### G — `GET /api/analytics` · `avgMinutes` divides by the global row count

- **Root cause:** `ownMinutes / req.store.logs.length` instead of `ownMinutes / agentLogs.length`.
- **Found by:** tracing why seed AG1 shows 27 instead of 67.5 after correcting the bug 2 field attribution.
- **Test:** `ADDITIONAL G: … avgMinutes must divide by agent entryCount`
- **Overlap:** **This is the line reported bug 2 mislocated.** Bug 2 correctly spotted wrong analytics output but blamed `avgMinutes`; the cumulative bug is `totalMinutes`. G is the actual `avgMinutes` defect.

### H — UI · the Date column is not reformatted

- **Root cause:** `public/app.js` renders `<td>${log.date}</td>` (raw `YYYY-MM-DD`); spec wants `DD-MM-YYYY`.
- **Found by:** reading `loadLogs` next to the Hours `toFixed` bug.
- **Test:** `ADDITIONAL H: Date column must be DD-MM-YYYY`
- **Overlap:** **Sits beside reported bug 8** in the same render function, but is a distinct line and a distinct spec violation. Bug 8 covers only Hours.
