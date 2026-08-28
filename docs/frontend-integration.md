# Frontend integration

The production frontend is served from `public/` by the same Express process and implements these flows directly. The API remains client-agnostic, so React, Vue, mobile, or server-rendered clients can reuse the same contracts.

```js
export async function loadPortfolioBriefing(apiBaseUrl, token) {
  const response = await fetch(`${apiBaseUrl}/portfolio/newsletter/current`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) throw new Error("Unable to load portfolio briefing");
  const newsletter = await response.json();

  if (newsletter.shouldDisplay) {
    // Put this object into application state and render your banner/modal.
    return newsletter;
  }

  return null;
}

export async function markPortfolioBriefingRead(apiBaseUrl, token, newsletterId) {
  const response = await fetch(
    `${apiBaseUrl}/portfolio/newsletter/${newsletterId}/read`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!response.ok) throw new Error("Unable to acknowledge portfolio briefing");
  return response.json();
}
```

Recommended UI behavior:

1. Fetch the current newsletter after authentication completes.
2. Show an unread count or non-blocking banner when `shouldDisplay` is true.
3. Separate portfolio flags from provider headlines and show the disclaimer.
4. Open news links in a new tab with `rel="noopener noreferrer"`.
5. Call the read endpoint only after the briefing was actually shown or deliberately dismissed.
6. Do not describe provider sentiment as a prediction or automatically trigger transactions from it.

## Screenshot automatic-import flow

```js
export async function analyzeSpendingScreenshot(apiBaseUrl, token, file) {
  const form = new FormData();
  form.append("screenshot", file);
  const response = await fetch(`${apiBaseUrl}/expense-imports/screenshot`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if (!response.ok) throw new Error("Unable to analyze screenshot");
  return response.json();
}

export async function correctImportedExpense(apiBaseUrl, token, expenseId, changes) {
  const response = await fetch(`${apiBaseUrl}/expenses/${expenseId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(changes)
  });
  if (!response.ok) throw new Error("Unable to correct expense");
  return response.json();
}
```

The upload response contains `automaticallyLogged: true` and `loggedExpenses`. Refresh expense totals immediately and show a non-blocking “expenses added” notice. An optional Edit action may call `correctImportedExpense`; uploading must not wait for the user to select categories or confirm the import.
