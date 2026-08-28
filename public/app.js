const state = {
  token: sessionStorage.getItem("kosha_token") || "",
  session: null,
  dashboard: null,
  assessment: null,
  analytics: null,
  expenses: [],
  portfolio: null,
  newsletter: null,
  aiInsight: null,
  form: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[character]));
const number = (value) => Number(value || 0);
const dateValue = (value = new Date()) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const monthValue = (value = new Date()) => dateValue(value).slice(0, 7);
const formatDate = (value) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
}).format(new Date(value));
const currency = (value, compact = false) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: state.dashboard?.profile?.preferred_currency || "INR",
  maximumFractionDigits: compact ? 1 : 0,
  notation: compact ? "compact" : "standard"
}).format(number(value));
const labelize = (value) => String(value || "").replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());

const api = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(body?.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
};

let toastTimer;
const toast = (message) => {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("visible"), 3500);
};

const setBusy = (button, busy, label = "Working…") => {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
  }
};

const showApp = () => {
  $("#authGate").hidden = true;
  $("#appShell").hidden = false;
};

const showAuth = () => {
  $("#authGate").hidden = false;
  $("#appShell").hidden = true;
};

const tolerateNotFound = async (path) => {
  try { return await api(path); } catch (error) { if (error.status === 404) return null; throw error; }
};

const loadWorkspace = async ({ announce = false } = {}) => {
  const results = await Promise.all([
    api("/auth/session"),
    api("/dashboard"),
    api("/advisor/assessment"),
    api("/expense-analytics/classification"),
    api("/expenses?limit=50"),
    tolerateNotFound("/portfolio/recommendation"),
    api("/portfolio/newsletter/current")
  ]);
  [state.session, state.dashboard, state.assessment, state.analytics] = results;
  state.expenses = results[4].items || [];
  state.portfolio = results[5];
  state.newsletter = results[6];
  renderWorkspace();
  showApp();
  switchView(viewFromHash(), { updateHistory: false });
  if (state.newsletter?.shouldDisplay) openNewsletter();
  if (announce) toast("Financial picture refreshed");
};

const renderWorkspace = () => {
  const profile = state.session?.user || state.dashboard?.profile || {};
  const name = profile.full_name || "Your profile";
  $("#sidebarName").textContent = name;
  $("#sidebarEmail").textContent = profile.email || "Connected";
  $("#avatar").textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map((item) => item[0]).join("").toUpperCase() || "KF";
  $("#todayLabel").textContent = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  renderHealth();
  renderMetrics();
  renderMonthlyChart();
  renderSpending();
  renderRecentExpenses();
  renderGoals();
  renderAdvisor();
  renderInflationDefaults();
  renderExpenseTable();
  renderPortfolio();
  $("#unreadDot").classList.toggle("visible", Boolean(state.newsletter?.shouldDisplay));
};

const renderHealth = () => {
  const health = state.assessment?.health;
  if (!health) return;
  const copy = {
    strong: ["Strong financial footing", "Your core systems are working. Focus on consistency and efficient goal funding."],
    stable: ["A stable base with room to improve", "Your finances are generally resilient, with a few focused opportunities."],
    needs_attention: ["A few areas need attention", "Following the prioritized actions can improve resilience and long-term progress."],
    vulnerable: ["Strengthen the foundation first", "Cash flow, debt, or liquidity needs attention before taking additional investment risk."]
  }[health.band] || ["Financial assessment", "Your personalized assessment is ready."];
  $("#healthScore").textContent = health.score;
  $("#scoreRing").style.setProperty("--score", health.score);
  $("#healthHeadline").textContent = copy[0];
  $("#healthSummary").textContent = copy[1];
  const action = state.assessment.actions?.[0];
  if (action) {
    $("#actionCategory").textContent = labelize(action.category);
    const signal = $("#nextActionCard .signal");
    signal.textContent = action.priority;
    signal.className = `signal ${action.priority}`;
    $("#actionTitle").textContent = action.title;
    $("#actionText").textContent = action.recommendation;
  }
};

const renderMetrics = () => {
  const overview = state.dashboard?.overview || state.dashboard || {};
  const snapshot = state.assessment?.snapshot || {};
  $("[data-metric='netWorth']").textContent = currency(overview.netWorth, true);
  $("[data-metric='surplus']").textContent = currency(snapshot.estimatedMonthlySurplus, true);
  $("[data-metric='portfolio']").textContent = currency(snapshot.portfolioValue, true);
  $("[data-metric='savings']").textContent = currency(snapshot.potentialMonthlySavings, true);
  $("[data-metric-note='surplus']").textContent = `${number(snapshot.estimatedSavingsRate).toFixed(1)}% estimated savings rate`;
  $("[data-metric-note='portfolio']").textContent = `${currency(snapshot.unrealizedGain, true)} unrealized change`;
};

const renderMonthlyChart = () => {
  const items = state.dashboard?.charts?.monthlyTrend || state.dashboard?.monthlyTrend || [];
  const maximum = Math.max(...items.map((item) => number(item.total)), 1);
  $("#monthlyChart").innerHTML = items.map((item, index) => {
    const monthDate = new Date(`${item.month}-01T00:00:00`);
    const month = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(monthDate);
    const height = Math.max(3, (number(item.total) / maximum) * 82);
    return `<div class="bar-item ${index === items.length - 1 ? "current" : ""}"><b>${escapeHtml(currency(item.total, true))}</b><i style="height:${height}%"></i><span>${escapeHtml(month)}</span></div>`;
  }).join("") || '<div class="empty">Add expenses to see a monthly trend.</div>';
};

const classificationColors = { needs: "#91ad95", wants: "#e9aa3d", luxury: "#dc6b55", uncategorized: "#d9dedb" };
const renderSpending = () => {
  const period = state.analytics?.periods?.currentMonth || state.analytics?.selected;
  const breakdown = period?.breakdown || [];
  const total = number(period?.totalSpent);
  let cursor = 0;
  const stops = breakdown.map((item) => {
    const start = cursor;
    cursor += number(item.percentage);
    return `${classificationColors[item.type] || "#d9dedb"} ${start}% ${cursor}%`;
  });
  if (cursor < 100) stops.push(`#e6e8e5 ${cursor}% 100%`);
  $("#spendingDonut").style.background = `conic-gradient(${stops.join(",")})`;
  $("#donutTotal").textContent = currency(total, true);
  $("#spendingLegend").innerHTML = breakdown.map((item) => `<div class="legend-row"><i style="background:${classificationColors[item.type] || "#d9dedb"}"></i><span>${escapeHtml(labelize(item.type))}</span><b>${number(item.percentage).toFixed(0)}%</b></div>`).join("") || '<div class="empty">No classified expenses yet.</div>';
  const savings = state.analytics?.savingsEstimates || {};
  $("#monthlyPotential").textContent = currency(savings.currentMonthPotential);
  $("#annualPotential").textContent = currency(savings.annualizedPotential);
  $("#journeyPotential").textContent = currency(savings.investmentJourneyPotential);
};

const expenseRows = (expenses, includeEdit = false) => expenses.map((expense) => `<tr>
  <td><span class="expense-name"><b>${escapeHtml(expense.description)}</b><small>${escapeHtml(expense.category || expense.merchant || "Uncategorized")}</small></span></td>
  <td><i class="type-pill ${escapeHtml(expense.necessityType || "uncategorized")}">${escapeHtml(labelize(expense.necessityType || "uncategorized"))}</i></td>
  <td>${escapeHtml(formatDate(expense.date))}</td>
  <td class="numeric"><b>${escapeHtml(currency(expense.amount))}</b></td>
  ${includeEdit ? `<td class="numeric"><button class="edit-button" data-edit-expense="${escapeHtml(expense._id)}">Edit</button></td>` : ""}
</tr>`).join("");

const renderRecentExpenses = () => {
  const recent = state.dashboard?.lists?.recentTransactions || state.dashboard?.recentTransactions || [];
  $("#recentExpenses").innerHTML = expenseRows(recent.slice(0, 6)) || '<tr><td colspan="4" class="empty">No expenses recorded.</td></tr>';
};

const renderGoals = () => {
  const goals = state.dashboard?.lists?.activeGoals || state.dashboard?.activeGoals || [];
  $("#goalList").innerHTML = goals.slice(0, 3).map((goal) => `<div class="goal-row"><header><b>${escapeHtml(goal.title)}</b><span>${number(goal.progress).toFixed(0)}%</span></header><div class="progress"><i style="width:${Math.min(number(goal.progress), 100)}%"></i></div></div>`).join("") || '<div class="empty">Add a goal to track progress.</div>';
};

const renderAdvisor = () => {
  const assessment = state.assessment;
  if (!assessment) return;
  $("#completenessValue").textContent = `${assessment.dataCompleteness.percentage}%`;
  $("#completenessBar").style.width = `${assessment.dataCompleteness.percentage}%`;
  $("#dimensionGrid").innerHTML = assessment.health.dimensions.map((item) => `<article class="dimension-card card"><header><span>${escapeHtml(item.label)}</span><i class="${escapeHtml(item.status)}"></i></header><strong>${item.score}</strong><p>${escapeHtml(item.explanation)}</p></article>`).join("");
  $("#actionList").innerHTML = assessment.actions.map((action, index) => `<div class="action-row"><span class="action-number">${String(index + 1).padStart(2, "0")}</span><div><h4>${escapeHtml(action.title)} <i class="signal ${escapeHtml(action.priority)}">${escapeHtml(action.priority)}</i></h4><p>${escapeHtml(action.recommendation)}</p><p><b>Why:</b> ${escapeHtml(action.reason)}</p></div><span class="action-amount">${action.suggestedMonthlyAmount > 0 ? `${escapeHtml(currency(action.suggestedMonthlyAmount))}/mo` : ""}</span></div>`).join("") || '<div class="empty">Complete your profile to generate an action plan.</div>';
  const snapshotRows = [
    ["Monthly income", currency(assessment.snapshot.monthlyIncome)],
    ["Average spending", currency(assessment.snapshot.averageMonthlyExpenses)],
    ["Active EMIs", currency(assessment.snapshot.monthlyDebtPayments)],
    ["Estimated surplus", currency(assessment.snapshot.estimatedMonthlySurplus)],
    ["Savings rate", `${assessment.snapshot.estimatedSavingsRate}%`],
    ["Outstanding debt", currency(assessment.snapshot.outstandingDebt)],
    ["Goal funding", `${assessment.snapshot.goalFundingPercentage}%`]
  ];
  $("#advisorSnapshot").innerHTML = snapshotRows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
};

const renderInflationDefaults = () => {
  const profile = state.session?.user?.inflation_profile;
  if (!profile) return;
  $("#inflationRate").value = profile.inflationRate ?? 6;
  $("#expectedReturn").value = profile.expectedReturn ?? 10;
};

const generateAiInsight = async () => {
  const button = $("#aiInsightButton");
  setBusy(button, true, "Generating…");
  try {
    state.aiInsight = await api("/advisor/ai-insight", { method: "POST" });
    $("#aiInsightSummary").textContent = state.aiInsight.summary;
    $("#aiInsightPriorities").innerHTML = (state.aiInsight.priorities || []).map((item) =>
      `<div class="ai-priority"><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.explanation)}</p><small><strong>Next:</strong> ${escapeHtml(item.nextStep)}</small></div>`
    ).join("");
    toast("AI explanation generated");
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(button, false);
  }
};

const calculateInflation = async (event) => {
  event.preventDefault();
  const button = $("#inflationButton");
  setBusy(button, true, "Calculating…");
  try {
    const values = new FormData(event.currentTarget);
    const result = await api("/inflation/calculate", {
      method: "POST",
      body: JSON.stringify({
        currentAmount: number(values.get("currentAmount")),
        years: number(values.get("years")),
        inflationRate: number(values.get("inflationRate")),
        expectedReturn: number(values.get("expectedReturn")),
        saveAssumptions: true
      })
    });
    $("#inflationResultTitle").textContent = `${result.projection.years}-year projection at ${result.assumptions.inflationRate}% inflation`;
    $("#futureCost").textContent = currency(result.projection.futureCost);
    $("#purchasingPower").textContent = currency(result.projection.purchasingPower);
    $("#monthlyInvestment").textContent = `${currency(result.projection.monthlyInvestment)}/mo`;
    $("#realReturn").textContent = `${number(result.projection.realExpectedReturn).toFixed(2)}%`;
    $("#inflationNote").textContent = `${currency(result.projection.currentAmount)} today loses ${currency(result.projection.lossOfPurchasingPower)} of purchasing power over this period. ${result.disclaimer}`;
    if (state.session?.user) state.session.user.inflation_profile = result.assumptions;
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(button, false);
  }
};

const renderExpenseTable = (query = "") => {
  const normalized = query.trim().toLowerCase();
  const filtered = state.expenses.filter((expense) => !normalized || [expense.description, expense.category, expense.merchant, expense.necessityType].some((value) => String(value || "").toLowerCase().includes(normalized)));
  $("#expenseTable").innerHTML = expenseRows(filtered, true) || '<tr><td colspan="5" class="empty">No matching expenses.</td></tr>';
};

const renderPortfolio = () => {
  const advisorPortfolio = state.assessment?.portfolio;
  $("#riskPill").textContent = advisorPortfolio ? `${labelize(advisorPortfolio.riskBand)} · ${advisorPortfolio.riskScore}/100` : "Questionnaire needed";
  const rows = advisorPortfolio?.rebalancing || [];
  $("#allocationList").innerHTML = rows.map((item) => `<div class="allocation-row"><span>${escapeHtml(labelize(item.bucket))}</span><div class="allocation-track"><i style="width:${Math.min(item.currentPercentage, 100)}%"></i><b style="width:${Math.min(item.targetPercentage, 100)}%"></b></div><span class="allocation-values">${item.currentPercentage}% / <b>${item.targetPercentage}%</b></span></div>`).join("") || '<div class="empty">Complete the questionnaire to compare allocation.</div>';
  const holdings = state.dashboard?.lists?.topInvestments || state.dashboard?.topInvestments || [];
  $("#holdingList").innerHTML = holdings.map((item) => `<div class="holding-row"><span><b>${escapeHtml(item.assetName)}</b><small>${escapeHtml(item.assetType)}</small></span><b>${escapeHtml(currency(item.currentValue, true))}</b></div>`).join("") || '<div class="empty">No investments recorded.</div>';
};

const availableViews = new Set(["overview", "advisor", "inflation", "expenses", "portfolio", "setup"]);
const viewFromHash = () => {
  const requested = window.location.hash.replace(/^#/, "");
  return availableViews.has(requested) ? requested : "overview";
};

const switchView = (view, { updateHistory = true } = {}) => {
  const selectedView = availableViews.has(view) ? view : "overview";
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === selectedView));
  $$("[data-view-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === selectedView));
  const titles = { overview: "Financial overview", advisor: "Personal advisor", inflation: "Inflation calculator", expenses: "Spending intelligence", portfolio: "Portfolio intelligence", setup: "Financial setup" };
  $("#viewTitle").textContent = titles[selectedView];
  if (updateHistory && window.location.hash !== `#${selectedView}`) {
    history.pushState(null, "", `#${selectedView}`);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const field = (name, label, type = "text", options = {}) => ({ name, label, type, ...options });
const formDefinitions = {
  expense: {
    eyebrow: "Spending record", title: "Add an expense", method: "POST", endpoint: "/expenses",
    fields: [field("description", "Description"), field("amount", "Amount", "number", { min: 0.01, step: .01 }), field("category", "Category"), field("necessityType", "Classification", "select", { choices: ["needs", "wants", "luxury", "uncategorized"] }), field("merchant", "Merchant"), field("date", "Expense date", "date", { value: dateValue() })]
  },
  editExpense: {
    eyebrow: "Optional correction", title: "Correct imported expense", method: "PATCH",
    fields: [field("description", "Description"), field("amount", "Amount", "number", { min: 0.01, step: .01 }), field("category", "Category"), field("necessityType", "Classification", "select", { choices: ["needs", "wants", "luxury", "uncategorized"] }), field("merchant", "Merchant"), field("date", "Expense date", "date")]
  },
  profile: {
    eyebrow: "Financial identity", title: "Update income & profile", method: "PUT", endpoint: "/profile",
    fields: [field("full_name", "Full name"), field("monthly_income", "Monthly income", "number", { min: 0 }), field("target_savings", "Monthly savings target", "number", { min: 0 }), field("risk_profile", "Risk style", "select", { choices: ["conservative", "moderate", "aggressive"] }), field("occupation", "Occupation"), field("city", "City")]
  },
  budget: {
    eyebrow: "Spending guardrail", title: "Set monthly budget", method: "PUT", endpoint: "/budget",
    fields: [field("amount", "Overall budget", "number", { min: 0 }), field("month", "Month", "month", { value: monthValue() }), field("alertThreshold", "Alert at (%)", "number", { min: 1, max: 100, value: 80 }), field("category", "Budget category", "hidden", { value: "overall" })]
  },
  investment: {
    eyebrow: "Asset record", title: "Add an investment", method: "POST", endpoint: "/investments",
    fields: [field("assetName", "Asset name"), field("assetType", "Asset type", "select", { choices: ["Equity Mutual Fund", "Debt Mutual Fund", "Liquid Asset", "Real Estate / Land", "Gold ETF", "Fixed Deposit", "Other"] }), field("amountInvested", "Amount invested", "number", { min: 0 }), field("currentValue", "Current value", "number", { min: 0 }), field("riskLevel", "Risk level", "select", { choices: ["low", "moderate", "high"] }), field("purchaseDate", "Purchase date", "date", { value: dateValue() }), field("symbol", "Symbol (optional)"), field("platform", "Platform (optional)")]
  },
  loan: {
    eyebrow: "Liability record", title: "Add a loan", method: "POST", endpoint: "/loans",
    fields: [field("lender", "Lender"), field("loanType", "Loan type"), field("principalAmount", "Original principal", "number", { min: 0.01, step: .01 }), field("outstandingAmount", "Outstanding balance", "number", { min: 0 }), field("emi", "Monthly EMI", "number", { min: 0 }), field("interestRate", "Interest rate (%)", "number", { min: 0, step: .01 }), field("tenureMonths", "Remaining months", "number", { min: 0 }), field("nextDueDate", "Next due date", "date", { value: dateValue() }), field("secured", "Secured loan", "checkbox")]
  },
  goal: {
    eyebrow: "Goal record", title: "Add a financial goal", method: "POST", endpoint: "/goals",
    fields: [field("title", "Goal name"), field("goalType", "Goal type"), field("targetAmount", "Target amount", "number", { min: 0.01, step: .01 }), field("currentAmount", "Already saved", "number", { min: 0 }), field("monthlyContribution", "Monthly contribution", "number", { min: 0 }), field("expectedReturn", "Expected return (%)", "number", { min: 0 }), field("priority", "Priority", "select", { choices: ["low", "medium", "high"] }), field("targetDate", "Target date", "date", { value: dateValue(new Date(Date.now() + 365 * 86400000)) })]
  },
  questionnaire: {
    eyebrow: "Risk & capacity", title: "Build your allocation", method: "POST", endpoint: "/portfolio/recommendation",
    fields: [field("age", "Age", "number", { min: 18, max: 100 }), field("dependents", "Dependents", "number", { min: 0, value: 0 }), field("monthlyIncome", "Monthly income", "number", { min: 1 }), field("monthlyEssentialExpenses", "Essential monthly expenses", "number", { min: 0 }), field("monthlyDebtPayments", "Monthly debt payments", "number", { min: 0 }), field("liquidSavings", "Liquid savings", "number", { min: 0 }), field("investmentHorizonYears", "Investment horizon (years)", "number", { min: 1, max: 50 }), field("riskTolerance", "Risk tolerance", "select", { choices: ["conservative", "balanced", "growth"] }), field("incomeStability", "Income stability", "select", { choices: ["unstable", "variable", "stable"] }), field("investmentExperience", "Experience", "select", { choices: ["beginner", "intermediate", "experienced"] }), field("hasHealthInsurance", "Health insurance in place", "checkbox"), field("hasTermInsurance", "Term insurance in place", "checkbox"), field("preferredRealEstateAllocation", "Preferred land / real estate (%)", "number", { min: 0, max: 30 }), field("goals", "Goals (comma separated)", "text", { full: true })]
  }
};

const getDefaults = (type, record = {}) => {
  if (type === "profile") return state.session?.user || state.dashboard?.profile || {};
  if (type === "budget") {
    const overview = state.dashboard?.overview || state.dashboard || {};
    return {
      amount: overview.monthlyBudget || "",
      month: overview.budgetMonth || monthValue(),
      alertThreshold: overview.budgetAlertThreshold || 80,
      category: "overall"
    };
  }
  if (type === "questionnaire") return state.portfolio?.questionnaire || {
    monthlyIncome: state.assessment?.snapshot?.monthlyIncome || "",
    monthlyDebtPayments: state.assessment?.snapshot?.monthlyDebtPayments || 0,
    liquidSavings: state.assessment?.snapshot?.liquidSavings || 0,
    riskTolerance: "balanced",
    incomeStability: "stable",
    investmentExperience: "beginner"
  };
  return record;
};

const renderFormField = (definition, defaults) => {
  const rawValue = defaults[definition.name] ?? definition.value ?? "";
  const value = definition.name === "goals" && Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;
  const required = definition.type !== "checkbox" && !["symbol", "platform", "merchant", "goals", "occupation", "city"].includes(definition.name);
  if (definition.type === "hidden") return `<input type="hidden" name="${escapeHtml(definition.name)}" value="${escapeHtml(value)}">`;
  if (definition.type === "checkbox") return `<div class="form-field check-field ${definition.full ? "full" : ""}"><input id="field-${escapeHtml(definition.name)}" name="${escapeHtml(definition.name)}" type="checkbox" ${value ? "checked" : ""}><label for="field-${escapeHtml(definition.name)}">${escapeHtml(definition.label)}</label></div>`;
  let control;
  if (definition.type === "select") {
    control = `<select id="field-${escapeHtml(definition.name)}" name="${escapeHtml(definition.name)}" ${required ? "required" : ""}>${definition.choices.map((choice) => `<option value="${escapeHtml(choice)}" ${String(value) === choice ? "selected" : ""}>${escapeHtml(labelize(choice))}</option>`).join("")}</select>`;
  } else {
    control = `<input id="field-${escapeHtml(definition.name)}" name="${escapeHtml(definition.name)}" type="${escapeHtml(definition.type)}" value="${escapeHtml(definition.type === "date" && value ? dateValue(value) : value)}" ${definition.min !== undefined ? `min="${definition.min}"` : ""} ${definition.max !== undefined ? `max="${definition.max}"` : ""} ${definition.step !== undefined ? `step="${definition.step}"` : ""} ${required ? "required" : ""}>`;
  }
  return `<div class="form-field ${definition.full ? "full" : ""}"><label for="field-${escapeHtml(definition.name)}">${escapeHtml(definition.label)}</label>${control}</div>`;
};

const openForm = (type, record = null) => {
  const definition = formDefinitions[type];
  if (!definition) return;
  const defaults = getDefaults(type, record || {});
  state.form = {
    type,
    definition,
    endpoint: type === "editExpense" ? `/expenses/${record._id}` : definition.endpoint
  };
  $("#formEyebrow").textContent = definition.eyebrow;
  $("#formTitle").textContent = definition.title;
  $("#formFields").innerHTML = definition.fields.map((item) => renderFormField(item, defaults)).join("");
  $("#formDialog").showModal();
};

const submitRecordForm = async (event) => {
  event.preventDefault();
  if (!state.form) return;
  const submitButton = $("#formSubmit");
  setBusy(submitButton, true, "Saving…");
  try {
    const formData = new FormData(event.currentTarget);
    const payload = {};
    for (const definition of state.form.definition.fields) {
      if (definition.type === "checkbox") payload[definition.name] = formData.has(definition.name);
      else if (definition.type === "number") payload[definition.name] = number(formData.get(definition.name));
      else if (definition.name === "goals") payload[definition.name] = String(formData.get(definition.name) || "").split(",").map((item) => item.trim()).filter(Boolean);
      else payload[definition.name] = formData.get(definition.name);
    }
    await api(state.form.endpoint, { method: state.form.definition.method, body: JSON.stringify(payload) });
    $("#formDialog").close();
    toast("Financial information saved");
    await loadWorkspace();
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(submitButton, false);
  }
};

const uploadScreenshot = async (file) => {
  if (!file) return;
  const form = new FormData();
  form.append("screenshot", file);
  $("#uploadCard").classList.add("dragging");
  try {
    const result = await api("/expense-imports/screenshot", { method: "POST", body: form });
    toast(`${result.loggedExpenseCount} expense${result.loggedExpenseCount === 1 ? "" : "s"} classified and added automatically`);
    await loadWorkspace();
  } catch (error) {
    toast(error.message);
  } finally {
    $("#uploadCard").classList.remove("dragging");
    $("#screenshotInput").value = "";
  }
};

const openNewsletter = () => {
  const briefing = state.newsletter;
  if (!briefing) return;
  $("#briefingTitle").textContent = briefing.title || "Portfolio briefing";
  $("#briefingSummary").textContent = briefing.summary || "No material flags today.";
  $("#briefingFlags").innerHTML = (briefing.flags || []).map((flag) => `<div class="flag-row ${escapeHtml(flag.severity)}"><b>${escapeHtml(labelize(flag.severity))}</b><br>${escapeHtml(flag.message)}</div>`).join("") || '<div class="empty">No portfolio flags today.</div>';
  $("#briefingHeadlines").innerHTML = (briefing.headlines || []).slice(0, 5).map((headline) => {
    const url = /^https?:\/\//i.test(headline.url || "") ? headline.url : "#";
    return `<a class="headline-row" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(headline.title)}<small>${escapeHtml(headline.source || headline.sentiment || "Market context")}</small></a>`;
  }).join("");
  $("#briefingDisclaimer").textContent = briefing.disclaimer || "Headlines are context, not predictions.";
  $("#newsletterDialog").showModal();
};

const createDemoSession = async () => {
  const button = $("#demoButton");
  setBusy(button, true, "Preparing your demo…");
  try {
    const session = await api("/auth/demo", { method: "POST" });
    state.token = session.token;
    sessionStorage.setItem("kosha_token", state.token);
    await loadWorkspace();
  } catch (error) {
    toast(error.message === "Demo access is not enabled" ? "Demo access is disabled here. Use a valid API token." : error.message);
  } finally {
    setBusy(button, false);
  }
};

const connectToken = async (event) => {
  event.preventDefault();
  state.token = new FormData(event.currentTarget).get("token").trim();
  sessionStorage.setItem("kosha_token", state.token);
  try {
    await loadWorkspace();
  } catch (error) {
    state.token = "";
    sessionStorage.removeItem("kosha_token");
    toast(error.message);
  }
};

$("#demoButton").addEventListener("click", createDemoSession);
$("#tokenForm").addEventListener("submit", connectToken);
$("#signOutButton").addEventListener("click", () => {
  state.token = "";
  sessionStorage.removeItem("kosha_token");
  showAuth();
});
$("#refreshButton").addEventListener("click", async (event) => {
  setBusy(event.currentTarget, true, "Refreshing…");
  try { await loadWorkspace({ announce: true }); } catch (error) { toast(error.message); } finally { setBusy(event.currentTarget, false); }
});
$("#recordForm").addEventListener("submit", submitRecordForm);
$("#formCloseButton").addEventListener("click", () => $("#formDialog").close());
$("#formCancelButton").addEventListener("click", () => $("#formDialog").close());
$("#formDialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
window.addEventListener("hashchange", () => switchView(viewFromHash(), { updateHistory: false }));
$("#expenseSearch").addEventListener("input", (event) => renderExpenseTable(event.target.value));
$("#browseButton").addEventListener("click", () => $("#screenshotInput").click());
$("#screenshotInput").addEventListener("change", (event) => uploadScreenshot(event.target.files[0]));
$("#questionnaireButton").addEventListener("click", () => openForm("questionnaire"));
$("#aiInsightButton").addEventListener("click", generateAiInsight);
$("#inflationForm").addEventListener("submit", calculateInflation);
$("#newsletterButton").addEventListener("click", openNewsletter);
$("#closeBriefing").addEventListener("click", () => $("#newsletterDialog").close());
$("#markReadButton").addEventListener("click", async () => {
  try {
    if (state.newsletter?._id) await api(`/portfolio/newsletter/${state.newsletter._id}/read`, { method: "POST" });
    state.newsletter.shouldDisplay = false;
    $("#unreadDot").classList.remove("visible");
    $("#newsletterDialog").close();
  } catch (error) { toast(error.message); }
});

const uploadCard = $("#uploadCard");
["dragenter", "dragover"].forEach((eventName) => uploadCard.addEventListener(eventName, (event) => { event.preventDefault(); uploadCard.classList.add("dragging"); }));
["dragleave", "drop"].forEach((eventName) => uploadCard.addEventListener(eventName, (event) => { event.preventDefault(); uploadCard.classList.remove("dragging"); }));
uploadCard.addEventListener("drop", (event) => uploadScreenshot(event.dataTransfer.files[0]));

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-view]");
  const go = event.target.closest("[data-go-view]");
  const open = event.target.closest("[data-open-form]");
  const edit = event.target.closest("[data-edit-expense]");
  if (nav) switchView(nav.dataset.view);
  if (go) switchView(go.dataset.goView);
  if (open) openForm(open.dataset.openForm);
  if (edit) {
    const expense = state.expenses.find((item) => item._id === edit.dataset.editExpense);
    if (expense) openForm("editExpense", expense);
  }
});

if (state.token) {
  loadWorkspace().catch(() => {
    state.token = "";
    sessionStorage.removeItem("kosha_token");
    showAuth();
  });
} else {
  showAuth();
}
