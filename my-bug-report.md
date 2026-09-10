# My bug report — 14

You reported 14 confirmed bugs. For Phase 2, write an automated test that FAILS because of each one — fixing them is an optional bonus.

## 1. GET /api/analytics — wrong-arithmetic

Issue: The totalHours field in the analytics response is multiplying totalMinutes by 60 instead of dividing it by 60. The operator is incorrect. This affects every agent, so the analytics panel shows hours that are 3600 times higher than the actual value.
Expected vs actual: Expected: totalHours = totalMinutes / 60. For totalMinutes = 641.5606, totalHours should be around 10.6927.

Actual: totalHours is 38493.63636362736, which is exactly 641.5606 × 60.

This issue was reproduced for all four agents (priya Sharma, Rohan, Neha, and karan Nair), and each one returns the same inflated value.

## 2. GET /api/analytics — stale-or-mismatched-aggregate

Issue: The running total used by the analytics loop is initialised once before the loop instead of once per agent, so each agent inherits the accumulated minutes of every agent processed before it. The value surfaces in the avgMinutes field, rendered as the "Avg Minutes/Entry" column. The clearest proof is Karan Nair, who owns zero log entries but still reports a figure of 345.
Expected vs actual: Expected: each agent's figures derive from that agent's own logs only. Karan Nair has entryCount: 0, so every derived value for him must be 0. With the seeded data, avgMinutes should be 67.5 for Priya Sharma (135 / 2), 75 for Rohan Verma (150 / 2) and 60 for Neha Iyer (60 / 1). Actual: the column reads 135.0, 285.0, 345.0, 345.0 in agent order — a cumulative running total. Each value equals the previous one plus that agent's own minutes: Rohan's own logs sum to exactly 285 − 135 = 150 and Neha's to exactly 345 − 285 = 60. Karan Nair, with zero entries, reports 345.0 rather than 0.

## 3. GET /api/logs — stale-or-mismatched-aggregate

Issue: The totalMinutes returned by GET /api/logs is not updated according to the agentId filter. The data array is filtered correctly, but totalMinutes still includes minutes from other agents.
Expected vs actual: Expected:
For GET /api/logs?agentId=AG11, the response should contain only AG11's logs. Since AG11 (Karan Nair) has no log entries, the response should be:

{
  "data": [],
  "totalMinutes": 0
}

Actual:
The API returns:

{
  "data": [],
  "totalMinutes": 345
}

This shows that data is correctly filtered to zero entries, but totalMinutes is still 345. Therefore, totalMinutes is being calculated from logs belonging to other agents instead of only the filtered results.

## 4. POST /api/logs — missing-required-field

Issue: The candidateId field is missing from the required-field validation in POST /api/logs. Requests without agentId, date, or minutes are rejected, but a request without candidateId is accepted and a log entry is created without any candidate information.
Expected vs actual: Expected:
A POST /api/logs request without candidateId should return 400 Bad Request with the message:

agentId, candidateId, date and minutes are required

Actual:
The request is accepted with 200 OK and creates a record containing agentId, date, and minutes, but no candidateId. The created record is also included in the analytics.

## 5. POST /api/logs — missing-boundary-check

Issue: The minutes validation only checks the upper limit of 480 and does not properly enforce the lower limit of 1. Because of this, zero and negative minute values are accepted and saved as log entries. Negative values can also reduce an agent's total minutes.
Expected vs actual: Expected: minutes should be between 1 and 480 inclusive. Requests with minutes: 0 or minutes: -5 should return 400 Bad Request.

Actual: minutes: 0 and minutes: -5 are accepted with 200 OK and create log records. In comparison, minutes: 481 correctly returns 400 Bad Request with the message "minutes must be between 1 and 480". This shows that the upper limit is checked, but the lower limit is not.

## 6. POST /api/logs — missing-reference-or-state-check

Issue: The agentId and candidateId fields are not checked against the existing agents and candidates. Because of this, logs can be created using IDs that do not exist. These records can still be retrieved through the logs API but are not associated with a known agent in the analytics.
Expected vs actual: Expected: agentId and candidateId should be validated against the existing agent and candidate records before creating a log. If either ID does not exist, the API should return 400 Bad Request and should not create the log.

Actual: The API accepts unknown IDs and returns 200 OK. A request with agentId: "ZZ_NOPE" created record id: 11 even though ZZ_NOPE is not a valid agent ID. The created record can also be retrieved using GET /api/logs?agentId=ZZ_NOPE, confirming that the invalid reference is persisted. The same validation issue applies to an unknown candidateId.

## 7. POST /api/logs — wrong-status-code

Issue: Successful creation of a log returns 200 OK instead of 201 Created. The response body contains the created log record correctly, but the HTTP status code does not indicate that a new resource was created.
Expected vs actual: Expected: A successful POST /api/logs request should return 201 Created along with the created log record.

Actual: A successful POST /api/logs request returns 200 OK along with the created log record. This was reproduced on successful log creation requests, including records with IDs 6, 8, 9, 10, 11, and 13–15.

## 8. UI — wrong-format-display

Issue: The Hours column in the Entries table displays hours as whole numbers instead of showing minutes divided by 60 to one decimal place. Because of this, entries with less than one hour or half-hour values are displayed incorrectly.
Expected vs actual: Expected: Hours should be calculated as minutes / 60 and displayed to one decimal place. For example, 45 minutes should display as 0.8 hours, 90 minutes as 1.5, 30 minutes as 0.5, 120 minutes as 2.0, and 60 minutes as 1.0.

Actual: The Hours column displays 1, 2, 1, 2, and 1 for these entries. The values are being rounded to whole numbers, so 45 minutes is shown as 1 hour and 30 minutes is shown as 1 hour, which makes the displayed effort inaccurate.

## 9. UI — wrong-ui-copy-or-label

Issue: The heading of the analytics panel is misspelled. The displayed text is "Anlytics" instead of "Analytics".
Expected vs actual: Expected: The analytics panel heading should read "Analytics".

Actual: The heading reads "Anlytics", with the letter "a" missing from the second syllable. The incorrect heading is visible directly below the Entries table.

## 10. GET /api/logs — substring-vs-exact-match

Issue: The agentId query filter is not using an exact match. When filtering for AG1, the API also returns log entries belonging to AG11 because AG1 is treated as a matching prefix or substring. This causes logs from a different agent to be included in the response.
Expected vs actual: Expected: GET /api/logs?agentId=AG1 should return only log entries where agentId exactly matches AG1 (Priya Sharma). Entries belonging to AG11 (Karan Nair) should not be included.

Actual: The response for agentId=AG1 also includes log entries with agentId: "AG11" (Karan Nair). This shows that the filter is matching AG1 as a substring or prefix instead of performing an exact match.

## 11. GET /api/logs — wrong-date-time-handling

Issue: The date query filter does not match any existing log entries. When a valid date is provided, the API returns an empty result instead of returning the logs recorded on that date.
Expected vs actual: Expected: GET /api/logs?date=2026-07-20 should return the two entries dated 2026-07-20: Priya Sharma / Aarav Gupta (45 minutes) and Rohan Verma / Aarav Gupta (30 minutes).

Actual: The API returns an empty data array even though records with the date 2026-07-20 exist. The same issue occurs with other dates that exist in the logs. When the date filter is combined with a valid agentId filter, the otherwise matching results are also reduced to an empty array.

## 12. UI — missing-ui-feedback-guard

Issue: T3 — UI / frontend · missing-ui-feedback-guard

Not yet tested. Type 900 into Minutes and submit with the Network tab open.

Describe the issue

The success notification is shown without checking the response status, so a rejected request is reported to the user as a successful one. The entry is never created, but the user is told it was.

Expected vs actual

Expected: submitting 900 minutes returns 400 from the server, and the UI shows an error notification carrying the server's message. Actual: the request returns 400 but a success notification is displayed. The entries table does not gain a row, so the notification contradicts both the server response and the visible state.
Expected vs actual: Expected: Submitting 900 minutes should return 400 Bad Request, and the UI should display an error notification with the server's validation message. No new entry should be created.

Actual: The POST /api/logs request returns 400 Bad Request, but the UI displays a success notification. No new entry is added to the Entries table, so the notification incorrectly indicates that the log was created.

## 13. UI — state-not-persisted

Issue: The Analytics panel does not refresh after a new log is added. The new entry appears in the Entries table, but the Analytics data remains unchanged until the page is manually reloaded.
Expected vs actual: Expected: After successfully adding a valid log, the Analytics panel should immediately reflect the new entry, including the updated entry count and total minutes, without requiring a page reload.

Actual: The new log appears in the Entries table, but the Analytics values remain unchanged. After manually reloading the page, the Analytics panel updates and includes the new entry.

## 14. POST /api/logs — missing-sanitization

Issue: The endpoint accepts arbitrary undocumented fields in the request body and stores their contents without validation or escaping, so an HTML payload can be persisted and later rendered.
Expected vs actual: Expected: fields outside agentId, candidateId, date and minutes are ignored or rejected, and string content is escaped. Actual: POST /api/logs with an additional note: "<img src=x onerror=alert(1)>" returned 200 and created the record rather than rejecting or stripping the field.

