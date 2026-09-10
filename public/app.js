let agentsCache = [];
let candidatesCache = [];

function showToast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : '');
  setTimeout(() => { el.className = 'toast hidden'; }, 2500);
}

/** YYYY-MM-DD → DD-MM-YYYY via regex (no Date round-trip). */
function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso || '');
}

function appendOption(select, value, label) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  select.appendChild(opt);
}

function appendTextCell(tr, text) {
  const td = document.createElement('td');
  td.textContent = text;
  tr.appendChild(td);
}

async function init() {
  const [agentsRes, candidatesRes] = await Promise.all([
    fetch('/api/agents').then((r) => r.json()),
    fetch('/api/candidates').then((r) => r.json()),
  ]);
  agentsCache = agentsRes;
  candidatesCache = candidatesRes;

  const agentSel = document.getElementById('agentId');
  const filterAgentSel = document.getElementById('filterAgentId');
  agentsCache.forEach((a) => {
    appendOption(agentSel, a.id, a.name);
    appendOption(filterAgentSel, a.id, a.name);
  });
  const candSel = document.getElementById('candidateId');
  candidatesCache.forEach((c) => {
    appendOption(candSel, c.id, c.name);
  });

  const dateInput = document.getElementById('date');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;

  loadLogs();
  loadAnalytics();
}

async function loadLogs() {
  const params = new URLSearchParams();
  const agentId = document.getElementById('filterAgentId').value;
  const date = document.getElementById('filterDate').value;
  if (agentId) params.set('agentId', agentId);
  if (date) params.set('date', date);
  const res = await fetch(`/api/logs?${params.toString()}`);
  const body = await res.json();
  const rows = document.getElementById('logRows');
  while (rows.firstChild) rows.removeChild(rows.firstChild);
  for (const log of body.data) {
    const agent = agentsCache.find((a) => a.id === log.agentId);
    const candidate = candidatesCache.find((c) => c.id === log.candidateId);
    const tr = document.createElement('tr');
    appendTextCell(tr, agent ? agent.name : log.agentId);
    appendTextCell(tr, candidate ? candidate.name : log.candidateId);
    appendTextCell(tr, formatDate(log.date));
    appendTextCell(tr, String(log.minutes));
    appendTextCell(tr, (log.minutes / 60).toFixed(1));
    rows.appendChild(tr);
  }
}

async function loadAnalytics() {
  const res = await fetch('/api/analytics');
  const rows = await res.json();
  const tbody = document.getElementById('analyticsRows');
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
  for (const r of rows) {
    const tr = document.createElement('tr');
    appendTextCell(tr, r.name);
    appendTextCell(tr, String(r.entryCount));
    appendTextCell(tr, Number(r.totalMinutes).toFixed(1));
    appendTextCell(tr, Number(r.totalHours).toFixed(1));
    appendTextCell(tr, String(Number(r.avgMinutes)));
    tbody.appendChild(tr);
  }
}

document.getElementById('logForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    agentId: document.getElementById('agentId').value,
    candidateId: document.getElementById('candidateId').value,
    date: document.getElementById('date').value,
    minutes: Number(document.getElementById('minutes').value),
  };
  const res = await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = 'Failed to add log';
    try {
      const body = await res.json();
      if (body && body.error) msg = body.error;
    } catch {
      /* keep default */
    }
    showToast(msg, true);
    return;
  }
  showToast('Log added!');
  loadLogs();
  loadAnalytics();
});

document.getElementById('filterAgentId').addEventListener('change', loadLogs);
document.getElementById('filterDate').addEventListener('change', loadLogs);
document.getElementById('clearFilter').addEventListener('click', () => {
  document.getElementById('filterAgentId').value = '';
  document.getElementById('filterDate').value = '';
  loadLogs();
});

// --- Tooling: reset button (not part of the app under test) ---
document.getElementById('resetBtn').addEventListener('click', async () => {
  await fetch('/api/reset', { method: 'POST' });
  loadLogs();
  loadAnalytics();
  showToast('Data reset');
});

init();
