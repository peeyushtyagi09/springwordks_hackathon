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

describe('ADDITIONAL API findings', () => {
  // ADDITIONAL A — GET /api/analytics · substring-vs-exact-match
  // server.js: l.agentId.includes(agent.id) in the analytics loop (distinct from bug 10)
  it('ADDITIONAL A: GET /api/analytics must count agents with === not includes (AG1 vs AG11)', async () => {
    const created = await postLog({
      agentId: 'AG11',
      candidateId: 'C1',
      date: '2026-07-20',
      minutes: 40,
    });
    assert.ok(
      created.status === 200 || created.status === 201,
      `precondition: AG11 log required so includes() collision is visible; got ${created.status}`,
    );

    const logsRes = await getLogs();
    const agents = (await api('/api/agents')).json;
    const expected = recomputeFromLogs(logsRes.json.data, agents);
    const { json: rows } = await getAnalytics();

    for (const row of rows) {
      const exp = expected.find((e) => e.agentId === row.agentId);
      assert.equal(
        row.entryCount,
        exp.entryCount,
        `ADDITIONAL A — ${row.agentId}: entryCount=${row.entryCount} but strict-equality ownership is ${exp.entryCount}. ` +
          `Analytics filters with l.agentId.includes(agent.id), so AG1 absorbs AG11 rows. Distinct from reported bug 10 (logs query filter).`,
      );
    }
  });

  // ADDITIONAL C — POST /api/logs · date is never validated
  // server.js: only presence checked; shares validation block with reported bug 5
  it('ADDITIONAL C: POST /api/logs must reject invalid and future dates', async () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
    const future = tomorrow.toISOString().slice(0, 10);

    const cases = [
      { date: future, label: 'future date' },
      { date: '10-09-2026', label: 'wrong format DD-MM-YYYY-style' },
      { date: '2026-13-45', label: 'impossible calendar date' },
    ];

    for (const { date, label } of cases) {
      const res = await postLog({
        agentId: 'AG1',
        candidateId: 'C1',
        date,
        minutes: 30,
      });
      assert.equal(
        res.status,
        400,
        `ADDITIONAL C — ${label} date=${date} returned ${res.status} instead of 400. ` +
          `Handler only checks presence; shares the POST validation block with reported bug 5.`,
      );
    }
  });

  // ADDITIONAL D — POST /api/logs · minutes is not type-checked
  // server.js: no Number.isInteger; "60" corrupts + aggregates via concatenation
  it('ADDITIONAL D: POST /api/logs must reject non-integer minutes (30.5 and "60")', async () => {
    const floatRes = await postLog({
      agentId: 'AG1',
      candidateId: 'C1',
      date: '2026-07-20',
      minutes: 30.5,
    });
    assert.equal(
      floatRes.status,
      400,
      `ADDITIONAL D — minutes=30.5 returned ${floatRes.status}. Spec requires an integer; shares validation block with bug 5.`,
    );

    const stringRes = await postLog({
      agentId: 'AG1',
      candidateId: 'C1',
      date: '2026-07-20',
      minutes: '60',
    });
    assert.equal(
      stringRes.status,
      400,
      `ADDITIONAL D — minutes="60" (string) returned ${stringRes.status}. ` +
        `A string operand turns every downstream + into concatenation and corrupts totals.`,
    );

    const list = await getLogs();
    const stringMinutes = (list.json.data || []).filter((l) => typeof l.minutes === 'string');
    assert.equal(
      stringMinutes.length,
      0,
      `ADDITIONAL D — stored logs still contain string minutes: ${JSON.stringify(stringMinutes)}. ` +
        `No stored minutes value may have type string.`,
    );
  });

  // ADDITIONAL G — GET /api/analytics · avgMinutes wrong divisor
  // server.js: ownMinutes / req.store.logs.length (mislocated attribution from bug 2)
  it('ADDITIONAL G: GET /api/analytics avgMinutes must divide by agent entryCount, not global logs.length', async () => {
    const logsRes = await getLogs();
    const agents = (await api('/api/agents')).json;
    const expected = recomputeFromLogs(logsRes.json.data, agents);
    const { json: rows } = await getAnalytics();

    for (const row of rows) {
      const exp = expected.find((e) => e.agentId === row.agentId);
      assert.ok(
        Math.abs(row.avgMinutes - exp.avgMinutes) < 1e-9,
        `ADDITIONAL G — ${row.agentId}: avgMinutes=${row.avgMinutes} but ownTotal/entryCount=${exp.avgMinutes} ` +
          `(${exp.totalMinutes}/${exp.entryCount || 0}). ` +
          `Handler divides ownMinutes by req.store.logs.length. This is the avgMinutes defect misattributed to reported bug 2.`,
      );
    }
  });
});
