// In-memory seed data. makeSeed() returns a fresh clone for each student's store.
function makeSeed() {
  const agents = [
    { id: 'AG1', name: 'Priya Sharma' },
    { id: 'AG2', name: 'Rohan Verma' },
    { id: 'AG3', name: 'Neha Iyer' },
    { id: 'AG11', name: 'Karan Nair' },
  ];

  const candidates = [
    { id: 'C1', name: 'Aarav Gupta' },
    { id: 'C2', name: 'Ishaan Reddy' },
    { id: 'C3', name: 'Diya Rao' },
    { id: 'C4', name: 'Meera Menon' },
  ];

  const logs = [
    { id: 1, agentId: 'AG1', candidateId: 'C1', date: '2026-07-20', minutes: 45 },
    { id: 2, agentId: 'AG1', candidateId: 'C2', date: '2026-07-21', minutes: 90 },
    { id: 3, agentId: 'AG2', candidateId: 'C1', date: '2026-07-20', minutes: 30 },
    { id: 4, agentId: 'AG2', candidateId: 'C3', date: '2026-07-22', minutes: 120 },
    { id: 5, agentId: 'AG3', candidateId: 'C4', date: '2026-07-21', minutes: 60 },
  ];

  return { agents, candidates, logs, nextLogId: logs.length + 1 };
}

module.exports = { makeSeed };
