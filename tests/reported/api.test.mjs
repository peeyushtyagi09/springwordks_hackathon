import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  installServerHarness,
  getLogs,
  getAnalytics,
  postLog,
  api,
  recomputeFromLogs,
} from '../helpers.mjs';

installServerHarness();

describe('harness sanity', () => {
  it('harness sanity: POST is visible to the next GET (session cookie jar)', async () => {
    const created = await postLog({
      agentId: 'AG1',
      candidateId: 'C1',
      date: '2026-07-20',
      minutes: 15,
    });
    assert.ok(
      created.status === 200 || created.status === 201,
      `create should succeed for harness check, got ${created.status}`,
    );
    const list = await getLogs();
    const found = (list.json?.data || []).some((l) => l.id === created.json?.id);
    assert.ok(
      found,
      `Created log id=${created.json?.id} missing from subsequent GET /api/logs. ` +
        `A lost sid cookie means each request hits a fresh seeded store, which invalidates every other result in this run.`,
    );
  });
});

describe('reported API defects', () => {
  // BUG 1 — GET /api/analytics · wrong-arithmetic
  // server.js: const totalHours = totalMinutes * 60;  (multiplies where it must divide)
  it('bug 1: GET /api/analytics totalHours must equal totalMinutes / 60 (not × 60)', async () => {
    const { json: rows } = await getAnalytics();
    for (const row of rows) {
      const expected = row.totalMinutes / 60;
      assert.ok(
        Math.abs(row.totalHours - expected) < 1e-9,
        `bug 1 — ${row.agentId}: totalHours=${row.totalHours} but totalMinutes/60=${expected}. ` +
          `If totalHours ≈ totalMinutes×60 (${row.totalMinutes * 60}), the handler multiplies where it must divide.`,
      );
    }
  });

  // BUG 2 — GET /api/analytics · stale-or-mismatched-aggregate
  // server.js: let runningTotal = 0; sits outside .map(), so totalMinutes is cumulative
  it('bug 2: GET /api/analytics totalMinutes must be per-agent, not a cumulative runningTotal', async () => {
    const logsRes = await getLogs();
    const agents = (await api('/api/agents')).json;
    const expected = recomputeFromLogs(logsRes.json.data, agents);
    const { json: rows } = await getAnalytics();

    for (const row of rows) {
      const exp = expected.find((e) => e.agentId === row.agentId);
      assert.equal(
        row.totalMinutes,
        exp.totalMinutes,
        `bug 2 — ${row.agentId} owns ${exp.entryCount} log(s), so totalMinutes must be ${exp.totalMinutes} but was ${row.totalMinutes}. ` +
          (exp.entryCount === 0 && row.totalMinutes !== 0
            ? `A non-zero total for an agent with zero entries means the accumulator (runningTotal) is declared outside the per-agent loop.`
            : `Mismatched totals usually mean each agent inherits the previous agent's minutes via a shared runningTotal.`),
      );
    }
  });

  // BUG 3 — GET /api/logs · stale-or-mismatched-aggregate
  // server.js: totalMinutes reduces over req.store.logs instead of filtered result
  it('bug 3: GET /api/logs totalMinutes must sum the filtered result, not the whole store', async () => {
    const filtered = await getLogs('agentId=AG11');
    const recomputed = (filtered.json.data || []).reduce((s, l) => s + l.minutes, 0);
    assert.equal(
      filtered.json.totalMinutes,
      recomputed,
      `bug 3 — filtered data has ${filtered.json.data.length} row(s) summing to ${recomputed}, ` +
        `but totalMinutes=${filtered.json.totalMinutes}. Reducing over req.store.logs instead of the filtered result leaves the unfiltered seed total.`,
    );
  });

  // BUG 4 — POST /api/logs · missing-required-field
  // server.js: if (!agentId || !agentId || ...) — candidateId never checked
  it('bug 4: POST /api/logs must reject missing candidateId with 400', async () => {
    const before = await getLogs();
    const res = await postLog({
      agentId: 'AG1',
      date: '2026-07-20',
      minutes: 30,
    });
    assert.equal(
      res.status,
      400,
      `bug 4 — omitted candidateId returned ${res.status} instead of 400. ` +
        `Likely cause: validation tests agentId twice (!agentId || !agentId) and never checks candidateId.`,
    );
    const after = await getLogs();
    assert.equal(
      after.json.data.length,
      before.json.data.length,
      `bug 4 — omitted candidateId must not create a row; count ${before.json.data.length} → ${after.json.data.length}`,
    );
  });

  // BUG 5 — POST /api/logs · missing-boundary-check
  // server.js: if (minutes == null || minutes > 480) — no lower bound
  it('bug 5: POST /api/logs must reject minutes 0 and negatives (lower bound)', async () => {
    for (const minutes of [0, -5]) {
      const res = await postLog({
        agentId: 'AG1',
        candidateId: 'C1',
        date: '2026-07-20',
        minutes,
      });
      assert.equal(
        res.status,
        400,
        `bug 5 — minutes=${minutes} returned ${res.status} instead of 400. ` +
          `Condition minutes == null || minutes > 480 has no lower bound, so 0 and negatives are accepted.`,
      );
    }
  });

  it('bug 5 control: minutes 481 rejected; 1 and 480 accepted', async () => {
    const tooHigh = await postLog({
      agentId: 'AG1',
      candidateId: 'C1',
      date: '2026-07-20',
      minutes: 481,
    });
    assert.equal(tooHigh.status, 400, `control: 481 must be rejected, got ${tooHigh.status}`);

    for (const minutes of [1, 480]) {
      await api('/api/reset', { method: 'POST' });
      const ok = await postLog({
        agentId: 'AG1',
        candidateId: 'C1',
        date: '2026-07-20',
        minutes,
      });
      assert.ok(
        ok.status === 200 || ok.status === 201,
        `control: minutes=${minutes} must be accepted, got ${ok.status}`,
      );
    }
  });

  // BUG 6 — POST /api/logs · missing-reference-or-state-check
  // server.js: ids never compared against req.store.agents / .candidates
  it('bug 6: POST /api/logs must reject unknown agentId and candidateId', async () => {
    const badAgent = await postLog({
      agentId: 'ZZ_NOPE',
      candidateId: 'C1',
      date: '2026-07-20',
      minutes: 30,
    });
    assert.equal(
      badAgent.status,
      400,
      `bug 6 — unknown agentId ZZ_NOPE returned ${badAgent.status}. Ids are never compared against req.store.agents.`,
    );

    const badCand = await postLog({
      agentId: 'AG1',
      candidateId: 'C_NOPE',
      date: '2026-07-20',
      minutes: 30,
    });
    assert.equal(
      badCand.status,
      400,
      `bug 6 — unknown candidateId C_NOPE returned ${badCand.status}. Ids are never compared against req.store.candidates.`,
    );
  });

  // BUG 7 — POST /api/logs · wrong-status-code
  // server.js: res.status(200) on creation instead of 201
  it('bug 7: POST /api/logs must return 201 Created on success', async () => {
    const res = await postLog({
      agentId: 'AG1',
      candidateId: 'C1',
      date: '2026-07-20',
      minutes: 30,
    });
    assert.equal(
      res.status,
      201,
      `bug 7 — successful create returned ${res.status} instead of 201. Handler uses res.status(200) on creation.`,
    );
  });

  // BUG 10 — GET /api/logs · substring-vs-exact-match
  // server.js: l.agentId.includes(req.query.agentId) — "AG11".includes("AG1") is true
  it('bug 10: GET /api/logs?agentId=AG1 must not include AG11 (exact match, not includes)', async () => {
    const precondition = await postLog({
      agentId: 'AG11',
      candidateId: 'C1',
      date: '2026-07-20',
      minutes: 25,
    });
    assert.ok(
      precondition.status === 200 || precondition.status === 201,
      `precondition: need an AG11 row so the prefix collision is visible; create returned ${precondition.status}`,
    );

    const filtered = await getLogs('agentId=AG1');
    const ids = (filtered.json.data || []).map((l) => l.agentId);
    const leaked = ids.filter((id) => id !== 'AG1');
    assert.equal(
      leaked.length,
      0,
      `bug 10 — filter agentId=AG1 returned foreign ids [${leaked.join(', ')}]. ` +
        `l.agentId.includes(query) makes "AG11".includes("AG1") true; use strict equality.`,
    );
    assert.ok(
      ids.length > 0,
      'precondition: AG1 must still own seeded rows after creating AG11',
    );
  });

  // BUG 11 — GET /api/logs · wrong-date-time-handling
  // server.js: shiftForIST() subtracts 330 minutes from UTC midnight, so the
  // comparison target lands one calendar day early.
  it('bug 11: GET /api/logs?date= must match stored YYYY-MM-DD without IST shift', async () => {
    const target = '2026-07-20';
    const all = await getLogs();
    const expected = (all.json.data || []).filter((l) => l.date === target);
    assert.ok(
      expected.length > 0,
      `precondition: seed must contain rows dated ${target}`,
    );

    const filtered = await getLogs(`date=${target}`);
    assert.equal(
      filtered.json.data.length,
      expected.length,
      `bug 11 — date=${target} should return ${expected.length} row(s) but got ${filtered.json.data.length}. ` +
        `shiftForIST() subtracts 330 minutes from UTC midnight, moving the comparison target back one calendar day.`,
    );
  });

  // BUG 14 — POST /api/logs · missing-sanitization
  // Unvalidated agentId stored; public/app.js interpolates it into innerHTML.
  it('bug 14: POST /api/logs must not persist raw HTML in agentId (XSS via innerHTML sink)', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    const res = await postLog({
      agentId: payload,
      candidateId: 'C1',
      date: '2026-07-20',
      minutes: 30,
    });
    assert.equal(
      res.status,
      400,
      `bug 14 — agentId=${JSON.stringify(payload)} returned ${res.status} and body=${JSON.stringify(res.json)}. ` +
        `Unvalidated agentId is stored and public/app.js interpolates it into innerHTML, turning markup into live DOM. ` +
        `(Correction to Phase 1 report: undocumented note is destructured away; the real vector is agentId + innerHTML.)`,
    );
  });
});
