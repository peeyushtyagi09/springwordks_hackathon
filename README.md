# Effort Log Timesheet

Effort Log Timesheet is a full-stack tracking and analytics application built for recruitment and operations teams to record, monitor, and analyze agent effort spent on candidate evaluations and interviews.

---

## Overview

The application provides:
- **Effort Logging**: Quick submission form to log agent effort against specific candidates with strict validation.
- **Timesheet Entries**: Chronological listing of effort records formatted for review, displaying candidate, agent, localized date, minutes, and decimal hours.
- **Filter Controls**: Multi-parameter exact filtering by Agent and Date.
- **Agent Analytics Dashboard**: Real-time aggregated metrics per agent including total entries, total minutes, total hours, and average minutes per entry.
- **Session Isolation**: Multi-tenant in-memory store isolated per student/session via HTTP cookies (`sid`), with one-click sample data reset.

---

## Architecture & Tech Stack

- **Backend**: Node.js, Express 4.
- **Frontend**: Vanilla JavaScript (ES6+), semantic HTML5, CSS3. Zero frontend framework overhead; utilizes secure DOM construction methods (`textContent` / `createElement`) to prevent Cross-Site Scripting (XSS).
- **Session Isolation**: In-memory store mapped to session IDs (`sid` cookie) with automated TTL expiration (`isolation.js`).
- **Test Automation**:
  - **API Tests**: Node.js built-in test runner (`node:test`) with custom cookie-jar session harness.
  - **UI Tests**: Playwright Test for cross-browser end-to-end integration testing.

---

## Seed Data

The system initializes with seeded records for testing and demonstration:

### Agents
| Agent ID | Name |
| --- | --- |
| `AG1` | Priya Sharma |
| `AG2` | Rohan Verma |
| `AG3` | Neha Iyer |
| `AG11` | Karan Nair |

### Candidates
| Candidate ID | Name |
| --- | --- |
| `C1` | Aarav Gupta |
| `C2` | Ishaan Reddy |
| `C3` | Diya Rao |
| `C4` | Meera Menon |

### Initial Seed Logs
| ID | Agent | Candidate | Date | Minutes |
| --- | --- | --- | --- | --- |
| 1 | AG1 (Priya Sharma) | C1 (Aarav Gupta) | 2026-07-20 | 45 |
| 2 | AG1 (Priya Sharma) | C2 (Ishaan Reddy) | 2026-07-21 | 90 |
| 3 | AG2 (Rohan Verma) | C1 (Aarav Gupta) | 2026-07-20 | 30 |
| 4 | AG2 (Rohan Verma) | C3 (Diya Rao) | 2026-07-22 | 120 |
| 5 | AG3 (Neha Iyer) | C4 (Meera Menon) | 2026-07-21 | 60 |

---

## API Specification

All endpoints are prefixed with `/api` unless otherwise noted.

### 1. `GET /api/agents`
Returns list of all active agents.

- **Response `200 OK`**:
```json
[
  { "id": "AG1", "name": "Priya Sharma" },
  { "id": "AG2", "name": "Rohan Verma" },
  { "id": "AG3", "name": "Neha Iyer" },
  { "id": "AG11", "name": "Karan Nair" }
]
```

---

### 2. `GET /api/candidates`
Returns list of all active candidates.

- **Response `200 OK`**:
```json
[
  { "id": "C1", "name": "Aarav Gupta" },
  { "id": "C2", "name": "Ishaan Reddy" },
  { "id": "C3", "name": "Diya Rao" },
  { "id": "C4", "name": "Meera Menon" }
]
```

---

### 3. `GET /api/logs`
Lists effort logs with optional query filters and calculates total minutes of the filtered subset.

- **Query Parameters**:
  - `agentId` (optional, string): Exact match on agent ID (e.g. `AG1`).
  - `date` (optional, string): Exact calendar match in `YYYY-MM-DD` format (e.g. `2026-07-20`).
- **Response `200 OK`**:
```json
{
  "data": [
    {
      "id": 1,
      "agentId": "AG1",
      "candidateId": "C1",
      "date": "2026-07-20",
      "minutes": 45
    }
  ],
  "totalMinutes": 45
}
```

---

### 4. `POST /api/logs`
Creates a new effort log record.

- **Request Body (`application/json`)**:
```json
{
  "agentId": "AG1",
  "candidateId": "C1",
  "date": "2026-07-20",
  "minutes": 30
}
```
- **Validation Rules**:
  - `agentId`, `candidateId`, `date`, `minutes` are all required.
  - `minutes`: Must be an integer between 1 and 480 (inclusive).
  - `date`: Must be a valid ISO `YYYY-MM-DD` calendar date and cannot be in the future.
  - `agentId`: Must exist in `req.store.agents`.
  - `candidateId`: Must exist in `req.store.candidates`.
- **Response `201 Created`**:
```json
{
  "id": 6,
  "agentId": "AG1",
  "candidateId": "C1",
  "date": "2026-07-20",
  "minutes": 30
}
```
- **Error Response `400 Bad Request`**:
```json
{
  "error": "minutes must be between 1 and 480"
}
```

---

### 5. `GET /api/analytics`
Returns per-agent aggregated timesheet metrics.

- **Computation Rules**:
  - `entryCount`: Count of logs belonging strictly to `agent.id`.
  - `totalMinutes`: Sum of minutes for this agent's logs only.
  - `totalHours`: `totalMinutes / 60` (decimal value).
  - `avgMinutes`: `totalMinutes / entryCount` (or `0` if `entryCount` is 0).
- **Response `200 OK`**:
```json
[
  {
    "agentId": "AG1",
    "name": "Priya Sharma",
    "entryCount": 2,
    "totalMinutes": 135,
    "totalHours": 2.25,
    "avgMinutes": 67.5
  },
  {
    "agentId": "AG2",
    "name": "Rohan Verma",
    "entryCount": 2,
    "totalMinutes": 150,
    "totalHours": 2.5,
    "avgMinutes": 75
  },
  {
    "agentId": "AG3",
    "name": "Neha Iyer",
    "entryCount": 1,
    "totalMinutes": 60,
    "totalHours": 1,
    "avgMinutes": 60
  },
  {
    "agentId": "AG11",
    "name": "Karan Nair",
    "entryCount": 0,
    "totalMinutes": 0,
    "totalHours": 0,
    "avgMinutes": 0
  }
]
```

---

### 6. Tooling Endpoints
- `POST /api/reset`: Resets session store to initial seed data (`200 OK`).
- `GET /spec`: Renders this `README.md` as styled HTML.
- `GET /openapi.json`: Returns OpenAPI 3.0.3 specification JSON.

---

## Bug Audit & Resolution Summary

### Phase 1: 14 Reported Defects
| # | Area | Defect | Root Cause & Resolution |
| --- | --- | --- | --- |
| 1 | `GET /api/analytics` | `wrong-arithmetic` | `totalHours` was multiplying by 60 (`* 60`); fixed to divide by 60 (`/ 60`). |
| 2 | `GET /api/analytics` | `stale-or-mismatched-aggregate` | `runningTotal` variable was declared outside the agent loop; fixed by scoping aggregations per agent. |
| 3 | `GET /api/logs` | `stale-or-mismatched-aggregate` | `totalMinutes` reduced over entire `req.store.logs` instead of filtered `result`; fixed to sum `result`. |
| 4 | `POST /api/logs` | `missing-required-field` | Validation tested `agentId` twice and omitted `candidateId`; fixed to check `!candidateId`. |
| 5 | `POST /api/logs` | `missing-boundary-check` | Lower bound `<= 0` was not rejected; fixed to enforce `minutes < 1 \|\| minutes > 480`. |
| 6 | `POST /api/logs` | `missing-reference-or-state-check` | Arbitrary IDs allowed; fixed by validating `agentId` and `candidateId` against stored lists. |
| 7 | `POST /api/logs` | `wrong-status-code` | Creation returned `200 OK`; corrected to return `201 Created`. |
| 8 | UI | `wrong-format-display` | Hours rounded to whole integer via `toFixed(0)`; corrected to `toFixed(1)`. |
| 9 | UI | `wrong-ui-copy-or-label` | Analytics card heading had typo `<h2>Anlytics</h2>`; corrected to `<h2>Analytics</h2>`. |
| 10 | `GET /api/logs` | `substring-vs-exact-match` | Filter used `l.agentId.includes(query)`, causing `AG1` to leak `AG11`; fixed with strict `===`. |
| 11 | `GET /api/logs` | `wrong-date-time-handling` | Date filter applied `shiftForIST()`, moving target back 1 day; fixed to compare exact date strings. |
| 12 | UI | `missing-ui-feedback-guard` | Form submission always showed success toast on error; fixed to read response status and show error toast. |
| 13 | UI | `state-not-persisted` | Form submission refreshed logs but omitted `loadAnalytics()`; fixed to call both. |
| 14 | `POST /api/logs` / UI | `missing-sanitization` | Unvalidated inputs were rendered via `innerHTML`; fixed by using safe `textContent` DOM creation. |

### Phase 2: 8 Additional Discoveries
| Code | Area | Defect | Root Cause & Resolution |
| --- | --- | --- | --- |
| A | `GET /api/analytics` | `substring-vs-exact-match` | Filter used `l.agentId.includes(agent.id)`; fixed to `l.agentId === agent.id`. |
| B | UI | Analytics columns misplaced | Columns rendered `avgMinutes`, `totalHours`, `totalMinutes` out of order; fixed column binding order. |
| C | `POST /api/logs` | Invalid/future dates | Handler omitted date validity check; added `isValidDateString` validating format, calendar date, and future restriction. |
| D | `POST /api/logs` | Minutes non-integer type | Strings (`"60"`) and floats (`30.5`) accepted; added `Number.isInteger(minutes)` check. |
| E | UI | Missing HTML5 form validation | `#minutes` missing HTML5 attributes; added `min="1" max="480" step="1" required`. |
| F | UI | Hardcoded date default | `#date` hardcoded to `2026-07-24`; changed to dynamically default to current date. |
| G | `GET /api/analytics` | Wrong average divisor | `avgMinutes` divided by global log count instead of agent's log count; fixed divisor. |
| H | UI | Date format unlocalized | Table showed raw `YYYY-MM-DD`; added `formatDate` to format as `DD-MM-YYYY`. |

---

## Setup & Execution Guide

### Prerequisites
- **Node.js**: Version 18.14+ (for native `fetch` and `node:test`).
- **npm**: Version 9+.

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

Install Playwright Chromium browser binary:
```bash
npx playwright install chromium
```

### 2. Running the Application
Start the local server:
```bash
npm start
```
The server will start on [http://localhost:3014](http://localhost:3014).
Open the URL in your browser to interact with the UI. Click **📋 Spec** in the header to view this documentation rendered in-app.

### 3. Running Automated Tests

- **Run all tests (API + Playwright UI)**:
  ```bash
  npm run test:all
  ```

- **Run API tests only (Phase 1 + Phase 2)**:
  ```bash
  npm run test:api
  ```

- **Run reported API bug tests only (Phase 1)**:
  ```bash
  npm run test:reported
  ```

- **Run additional findings API tests (Phase 2)**:
  ```bash
  npm run test:additional
  ```

- **Run UI tests (Playwright)**:
  ```bash
  npm run test:ui
  npm run test:ui:additional
  ```
