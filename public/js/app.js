/* Interface do Bolso: renderização, interações e PWA. */

import {
  averageDailyExpense,
  biggestExpenseDay,
  countMonths,
  createDemoData,
  createEmptyData,
  currentMonthKey,
  DEFAULT_CATEGORY,
  escapeHTML,
  formatAmountInput,
  formatCurrency,
  formatDateForCSV,
  formatFullDate,
  formatGroupDate,
  formatShortDate,
  formatSignedCurrency,
  getCategories,
  getCategory,
  groupTransactionsByDate,
  isValidISODate,
  lastDateOfMonth,
  loadData,
  MAX_AMOUNT_CENTS,
  monthLabel,
  monthOnlyLabel,
  monthShortLabel,
  normalizeText,
  parseAmountInput,
  saveData,
  shiftMonth,
  sortTransactionsDesc,
  summarize,
  todayISO,
  totalsByCategory,
  transactionsForMonth,
  uid,
} from "./store.js";

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

const ROUTES = {
  dashboard: "inicio",
  transactions: "transacoes",
  insights: "analises",
  settings: "ajustes",
};

const VIEW_BY_HASH = Object.fromEntries(
  Object.entries(ROUTES).map(([view, hash]) => [hash, view]),
);

const TAB_ROUTES = {
  inicio: "dashboard",
  dashboard: "dashboard",
  transacoes: "transactions",
  transactions: "transactions",
  analises: "insights",
  insights: "insights",
  ajustes: "settings",
  settings: "settings",
};

const VIEW_TITLES = {
  dashboard: "Bolso — Finanças pessoais",
  transactions: "Transações — Bolso",
  insights: "Análises — Bolso",
  settings: "Ajustes — Bolso",
};

const THEME_KEY = window.BolsoTheme?.key || "bolso.theme";

const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const views = new Map($$(".view").map((view) => [view.dataset.view, view]));

const els = {
  app: $("#app"),
  fab: $("#fab"),
  greeting: $("#greeting"),
  demoBanner: $("#demoBanner"),
  monthLabels: $$("[data-month-label]"),
  monthShortLabels: $$("[data-month-short]"),
  nextMonthButtons: $$('[data-month-dir="1"]'),
  balanceTrend: $("#balanceTrend"),
  balanceValue: $("#balanceValue"),
  incomeValue: $("#incomeValue"),
  expenseValue: $("#expenseValue"),
  savingsLabel: $("#savingsLabel"),
  savingsRate: $("#savingsRate"),
  savingsProgress: $("#savingsProgress"),
  savingsBar: $("#savingsBar"),
  donutChart: $("#donutChart"),
  donutLegend: $("#donutLegend"),
  recentList: $("#recentList"),
  searchInput: $("#searchInput"),
  filterButtons: $$(".filter-chip"),
  transactionsMeta: $("#transactionsMeta"),
  transactionsList: $("#transactionsList"),
  transactionsEmpty: $("#transactionsEmpty"),
  transactionsEmptyTitle: $("#transactionsEmptyTitle"),
  transactionsEmptyText: $("#transactionsEmptyText"),
  transactionsEmptyBtn: $("#transactionsEmptyBtn"),
  insightHighlights: $("#insightHighlights"),
  monthlyChart: $("#monthlyChart"),
  breakdownTotal: $("#breakdownTotal"),
  categoryBreakdown: $("#categoryBreakdown"),
  installTopBtn: $("#installTopBtn"),
  offlinePill: $("#offlinePill"),
  offlineStateSidebar: $("#offlineStateSidebar"),
  sidebarConnection: $("#sidebarConnection"),
  installStatusText: $("#installStatusText"),
  installStatusBadge: $("#installStatusBadge"),
  installSettingsBtn: $("#installSettingsBtn"),
  connectionText: $("#connectionText"),
  connectionBadge: $("#connectionBadge"),
  storageSummary: $("#storageSummary"),
  exportBtn: $("#exportBtn"),
  themeRadios: $$('input[name="theme"]'),
  themeToggleButtons: $$('[data-action="toggle-theme"]'),
  transactionModal: $("#transactionModal"),
  transactionForm: $("#transactionForm"),
  sheetTitle: $("#sheetTitle"),
  sheetEyebrow: $("#sheetEyebrow"),
  sheetCloseBtn: $("#sheetCloseBtn"),
  amountInput: $("#amountInput"),
  amountError: $("#amountError"),
  descriptionInput: $("#descriptionInput"),
  descriptionError: $("#descriptionError"),
  dateInput: $("#dateInput"),
  dateError: $("#dateError"),
  categoryPicker: $("#categoryPicker"),
  typeButtons: $$(".type-switch__btn"),
  deleteTxBtn: $("#deleteTxBtn"),
  saveTxBtn: $("#saveTxBtn"),
  confirmModal: $("#confirmModal"),
  confirmTitle: $("#confirmTitle"),
  confirmText: $("#confirmText"),
  confirmIcon: $("#confirmIcon"),
  confirmOkBtn: $("#confirmOkBtn"),
  confirmCancelBtn: $("#confirmCancelBtn"),
  toastRegion: $("#toastRegion"),
};

const state = {
  data: loadData(),
  view: "dashboard",
  viewMonth: currentMonthKey(),
  filter: "all",
  search: "",
  editingId: null,
  txType: "expense",
  txCategory: DEFAULT_CATEGORY.expense,
  deferredPrompt: null,
};

let activeOverlay = null;
let lastFocusedElement = null;
let confirmAction = null;
let refreshing = false;
let updateNotified = false;
let persistenceRequested = false;

/* ---------- Utilidades de foco ---------- */

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function focusActiveHeading() {
  const view = views.get(state.view);
  const heading = view?.querySelector(".display-title");
  if (heading) heading.focus({ preventScroll: true });
}

function getFocusable(overlay) {
  return $$(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    overlay,
  ).filter((element) => element.getClientRects().length > 0);
}

function openOverlay(overlay, preferredFocus) {
  lastFocusedElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  activeOverlay = overlay;
  overlay.hidden = false;
  document.body.classList.add("no-scroll");
  if (els.app) els.app.inert = true;

  requestAnimationFrame(() => {
    overlay.classList.add("is-open");
    const target =
      preferredFocus && preferredFocus.getClientRects().length > 0
        ? preferredFocus
        : getFocusable(overlay)[0];
    if (target) target.focus({ preventScroll: true });
  });
}

function closeOverlay(overlay = activeOverlay) {
  if (!overlay || activeOverlay !== overlay) return;

  activeOverlay = null;
  overlay.classList.remove("is-open");
  document.body.classList.remove("no-scroll");
  if (els.app) els.app.inert = false;
  if (overlay === els.confirmModal) confirmAction = null;

  window.setTimeout(() => {
    if (!overlay.classList.contains("is-open")) overlay.hidden = true;
  }, 280);

  if (lastFocusedElement && document.contains(lastFocusedElement)) {
    lastFocusedElement.focus({ preventScroll: true });
  }
  lastFocusedElement = null;
}

/* ---------- Tema ---------- */

function syncThemeUI() {
  const preference = window.BolsoTheme?.getPreference?.() || "system";
  const resolved = document.documentElement.dataset.theme === "dark" ? "dark" : "light";

  els.themeRadios.forEach((radio) => {
    radio.checked = radio.value === preference;
  });

  const nextLabel = resolved === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
  els.themeToggleButtons.forEach((button) => {
    button.setAttribute("aria-label", nextLabel);
    button.title = nextLabel;
  });

  const icon = $("#themeToggleIcon use");
  if (icon) icon.setAttribute("href", resolved === "dark" ? "#i-sun" : "#i-moon");
}

function setTheme(preference) {
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch (error) {
    /* Preferência aplicada apenas nesta sessão. */
  }
  window.BolsoTheme?.apply?.();
  syncThemeUI();
}

function toggleTheme() {
  const resolved = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  setTheme(resolved === "dark" ? "light" : "dark");
}

/* ---------- Conexão ---------- */

function updateConnectionUI() {
  const online = navigator.onLine;

  els.offlinePill.hidden = online;
  els.sidebarConnection.textContent = online ? "Tudo salvo localmente" : "Modo offline ativo";
  els.offlineStateSidebar.classList.toggle("is-offline", !online);

  els.connectionText.textContent = online
    ? "Você está online."
    : "Você está offline. O Bolso continua funcionando.";
  els.connectionBadge.textContent = online ? "Online" : "Offline";
  els.connectionBadge.classList.toggle("status-badge--success", online);
  els.connectionBadge.classList.toggle("status-badge--danger", !online);
}

/* ---------- Instalação (PWA) ---------- */

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    window.navigator.standalone === true
  );
}

function updateInstallUI() {
  const installed = isInstalled();
  const promptReady = Boolean(state.deferredPrompt);
  const canHelp = promptReady || isIOS;

  els.installTopBtn.hidden = installed || !canHelp;
  els.installSettingsBtn.hidden = installed;
  els.installSettingsBtn.textContent = promptReady ? "Instalar" : "Como instalar";

  els.installStatusBadge.classList.toggle("status-badge--success", installed || promptReady);

  if (installed) {
    els.installStatusText.textContent = "O Bolso está instalado neste dispositivo.";
    els.installStatusBadge.textContent = "Instalado";
    return;
  }

  if (promptReady) {
    els.installStatusText.textContent =
      "Instale agora e abra o Bolso em tela cheia, sem a barra do navegador.";
    els.installStatusBadge.textContent = "Disponível";
  } else if (isIOS) {
    els.installStatusText.textContent =
      "No Safari, toque em Compartilhar e escolha Adicionar à Tela de Início.";
    els.installStatusBadge.textContent = "PWA";
  } else {
    els.installStatusText.textContent =
      "Pelo menu do navegador, escolha Instalar aplicativo ou Adicionar à tela inicial.";
    els.installStatusBadge.textContent = "PWA";
  }
}

function showInstallHelp() {
  const title = isIOS ? "Instalar no iPhone ou iPad" : "Instalar o Bolso";
  const text = isIOS
    ? "A instalação é feita pelo Safari:\n\n1. Abra este site no Safari.\n2. Toque no botão Compartilhar.\n3. Escolha “Adicionar à Tela de Início”.\n4. Confirme em “Adicionar”."
    : "Use o menu do seu navegador:\n\n• Chrome ou Edge: procure “Instalar Bolso” no menu ⋮ ou na barra de endereço.\n• Safari: escolha Arquivo → Adicionar ao Dock.\n\nO Bolso abrirá como um aplicativo independente.";

  openConfirm({
    title,
    text,
    confirmText: "Entendi",
    hideCancel: true,
    danger: false,
    neutral: true,
  });
}

async function promptInstall() {
  if (isInstalled()) {
    showToast("O Bolso já está instalado neste dispositivo.", { type: "info" });
    return;
  }

  if (!state.deferredPrompt) {
    showInstallHelp();
    return;
  }

  const promptEvent = state.deferredPrompt;
  state.deferredPrompt = null;

  try {
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      showToast("Instalação iniciada. O Bolso vai aparecer na sua tela inicial.");
    }
  } catch (error) {
    showInstallHelp();
  }

  updateInstallUI();
}

/* ---------- Toasts ---------- */

function showToast(message, options = {}) {
  const {
    type = "success",
    actionLabel = "",
    onAction = null,
    duration = 3600,
  } = options;

  while (els.toastRegion.children.length >= 2) {
    els.toastRegion.firstElementChild?.remove();
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "status");

  const icon = document.createElement("span");
  icon.className = "toast__icon";
  icon.setAttribute("aria-hidden", "true");
  const iconName = type === "error" || type === "warning" ? "i-alert" : type === "info" ? "i-info" : "i-check";
  icon.innerHTML = `<svg class="icon"><use href="#${iconName}"></use></svg>`;

  const text = document.createElement("span");
  text.className = "toast__message";
  text.textContent = message;

  toast.append(icon, text);

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    window.clearTimeout(timer);
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 230);
  };

  if (actionLabel && typeof onAction === "function") {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "toast__action";
    action.textContent = actionLabel;
    action.addEventListener("click", () => {
      remove();
      onAction();
    });
    toast.append(action);
  }

  els.toastRegion.appendChild(toast);
  const timer = window.setTimeout(remove, Math.max(duration, 2000));
}

/* ---------- Armazenamento persistente ---------- */

function requestPersistence() {
  if (persistenceRequested || !navigator.storage?.persist) return;
  persistenceRequested = true;
  navigator.storage.persist().catch(() => {});
}

/* ---------- Cabeçalho e meses ---------- */

function updateMonthLabels() {
  const current = currentMonthKey();
  const currentYear = current.slice(0, 4);
  const viewYear = state.viewMonth.slice(0, 4);

  els.monthLabels.forEach((label) => {
    label.textContent = monthLabel(state.viewMonth);
  });

  els.monthShortLabels.forEach((label) => {
    label.textContent =
      viewYear === currentYear
        ? monthOnlyLabel(state.viewMonth)
        : `${monthOnlyLabel(state.viewMonth)} de ${viewYear}`;
  });

  const isCurrent = state.viewMonth >= current;
  els.nextMonthButtons.forEach((button) => {
    button.disabled = isCurrent;
    button.setAttribute("aria-disabled", String(isCurrent));
  });
}

function formatNetValue(cents) {
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
  return `${sign}${sign ? " " : ""}${formatCurrency(Math.abs(cents))}`;
}

/* ---------- Visão geral ---------- */

function renderDashboard() {
  const monthTransactions = transactionsForMonth(state.data.transactions, state.viewMonth);
  const previousMonth = shiftMonth(state.viewMonth, -1);
  const previousTransactions = transactionsForMonth(state.data.transactions, previousMonth);
  const summary = summarize(monthTransactions);
  const previousSummary = summarize(previousTransactions);

  els.greeting.textContent = greetingForNow();
  els.demoBanner.hidden = !state.data.demo;

  els.balanceValue.textContent = formatCurrency(summary.balance);
  els.incomeValue.textContent = formatCurrency(summary.income);
  els.expenseValue.textContent = formatCurrency(summary.expense);

  renderBalanceTrend(summary, previousSummary, previousMonth);
  renderSavings(summary);
  renderDonut(monthTransactions, summary.expense);
  renderRecent(monthTransactions);
}

function renderBalanceTrend(summary, previousSummary, previousMonth) {
  if (summary.expense <= 0 || previousSummary.expense <= 0) {
    els.balanceTrend.hidden = true;
    return;
  }

  const change = Math.round(
    ((summary.expense - previousSummary.expense) / previousSummary.expense) * 100,
  );
  const increased = change > 0;
  const label =
    change === 0
      ? "Sem variação"
      : `${Math.abs(change)}% ${increased ? "a mais" : "a menos"}`;
  const icon = change === 0 ? "i-chart" : increased ? "i-trending-up" : "i-trending-down";

  els.balanceTrend.hidden = false;
  els.balanceTrend.classList.toggle("is-more", increased);
  els.balanceTrend.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${icon}"></use></svg><span>${escapeHTML(label)}</span>`;
  els.balanceTrend.setAttribute(
    "aria-label",
    `Despesas de ${monthLabel(state.viewMonth)} comparadas a ${monthLabel(previousMonth)}: ${label}.`,
  );
}

function renderSavings(summary) {
  let label = "Adicione receitas para ver sua taxa de poupança";
  let rateText = "—";
  let width = 0;
  let negative = false;
  let valueNow = 0;
  let valueText = "Sem receitas no mês";

  if (summary.income > 0 && summary.balance >= 0) {
    const saved = summary.savingsRate ?? 0;
    label = "Você guardou das receitas";
    rateText = `${saved}%`;
    width = Math.min(100, Math.max(0, saved));
    valueNow = width;
    valueText = `${saved}% das receitas guardadas`;
  } else if (summary.income > 0) {
    const deficit = Math.abs(summary.savingsRate ?? 0);
    label = "As despesas passaram das receitas";
    rateText = `−${deficit}%`;
    width = 100;
    negative = true;
    valueNow = 0;
    valueText = `Despesas ${deficit}% acima das receitas`;
  }

  els.savingsLabel.textContent = label;
  els.savingsRate.textContent = rateText;
  els.savingsBar.style.width = `${width}%`;
  els.savingsBar.classList.toggle("is-negative", negative);
  els.savingsProgress.setAttribute("aria-valuenow", String(Math.round(valueNow)));
  els.savingsProgress.setAttribute("aria-valuetext", valueText);
}

function renderDonut(transactions, totalExpense) {
  const categories = totalsByCategory(transactions, "expense");
  const monthName = monthOnlyLabel(state.viewMonth);

  if (!categories.length || totalExpense <= 0) {
    els.donutChart.innerHTML = `
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle cx="60" cy="60" r="47" fill="none" stroke="var(--surface-3)" stroke-width="13"></circle>
      </svg>
      <div class="donut__center">
        <span>Total gasto</span>
        <strong>${formatCurrency(0)}</strong>
        <small>sem despesas</small>
      </div>`;
    els.donutChart.setAttribute(
      "aria-label",
      `Nenhuma despesa registrada em ${monthLabel(state.viewMonth)}.`,
    );
    els.donutLegend.innerHTML = `<p class="legend-empty">Nenhuma despesa registrada em ${escapeHTML(monthName)}.</p>`;
    return;
  }

  let display = categories;
  if (categories.length > 4) {
    const top = categories.slice(0, 3);
    const restTotal = categories.slice(3).reduce((sum, category) => sum + category.amount, 0);
    display = [
      ...top,
      {
        id: "outras-categorias",
        label: "Outras categorias",
        color: "#98a49d",
        amount: restTotal,
      },
    ];
  }

  const circumference = 2 * Math.PI * 47;
  const gap = display.length > 1 ? 2.6 : 0;
  let offset = 0;

  const segments = display
    .map((category) => {
      const share = category.amount / totalExpense;
      const dash = Math.max(0, share * circumference - gap);
      const markup = `<circle class="donut__segment" cx="60" cy="60" r="47" fill="none" stroke="${category.color}" stroke-width="13" stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 60 60)"></circle>`;
      offset += share * circumference;
      return markup;
    })
    .join("");

  els.donutChart.innerHTML = `
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="47" fill="none" stroke="var(--surface-3)" stroke-width="13"></circle>
      ${segments}
    </svg>
    <div class="donut__center">
      <span>Total gasto</span>
      <strong>${formatCurrency(totalExpense)}</strong>
      <small>em ${escapeHTML(monthName)}</small>
    </div>`;

  const description = display
    .map(
      (category) =>
        `${category.label}: ${Math.round((category.amount / totalExpense) * 100)}%`,
    )
    .join(", ");

  els.donutChart.setAttribute(
    "aria-label",
    `Despesas de ${monthLabel(state.viewMonth)} por categoria. ${description}. Total de ${formatCurrency(totalExpense)}.`,
  );

  els.donutLegend.innerHTML = display
    .map((category) => {
      const percent = Math.round((category.amount / totalExpense) * 100);
      return `<div class="legend-row" title="${escapeHTML(category.label)}: ${formatCurrency(category.amount)} (${percent}%)">
        <span class="legend-dot" style="--dot-color:${category.color}" aria-hidden="true"></span>
        <span class="legend-name">${escapeHTML(category.label)}</span>
        <span class="legend-value">${percent}%</span>
      </div>`;
    })
    .join("");
}

function transactionItemHTML(transaction, options = {}) {
  const category = getCategory(transaction.category);
  const typeLabel = transaction.type === "income" ? "Receita" : "Despesa";
  const meta = options.showDate
    ? `${category.label} · ${formatShortDate(transaction.date)}`
    : category.label;
  const ariaLabel = `${typeLabel}: ${transaction.description}, ${formatCurrency(transaction.amount)}, ${category.label}, ${formatFullDate(transaction.date)}. Toque para editar.`;
  const amountClass =
    transaction.type === "income" ? "tx-item__amount tx-item__amount--income" : "tx-item__amount";

  return `<button class="tx-item" type="button" data-tx-id="${escapeHTML(transaction.id)}" aria-label="${escapeHTML(ariaLabel)}">
    <span class="tx-item__badge" style="--cat-color:${category.color}" aria-hidden="true">
      <svg class="icon"><use href="#${category.icon}"></use></svg>
    </span>
    <span class="tx-item__body">
      <span class="tx-item__title">${escapeHTML(transaction.description)}</span>
      <span class="tx-item__meta">${escapeHTML(meta)}</span>
    </span>
    <span class="${amountClass}">${formatSignedCurrency(transaction.amount, transaction.type)}</span>
  </button>`;
}

function renderRecent(monthTransactions) {
  const recent = sortTransactionsDesc(monthTransactions).slice(0, 5);

  if (!recent.length) {
    els.recentList.innerHTML = `<p class="tx-list-empty">Nenhum lançamento em ${escapeHTML(monthOnlyLabel(state.viewMonth))}. Toque no <strong>+</strong> para começar.</p>`;
    return;
  }

  els.recentList.innerHTML = recent
    .map((transaction) => transactionItemHTML(transaction, { showDate: true }))
    .join("");
}

/* ---------- Transações ---------- */

function renderTransactions() {
  const monthTransactions = transactionsForMonth(state.data.transactions, state.viewMonth);
  const search = normalizeText(state.search);

  const filtered = monthTransactions.filter((transaction) => {
    if (state.filter !== "all" && transaction.type !== state.filter) return false;
    if (!search) return true;
    const category = getCategory(transaction.category);
    return normalizeText(`${transaction.description} ${category.label}`).includes(search);
  });

  els.filterButtons.forEach((button) => {
    const active = button.dataset.filter === state.filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const summary = summarize(filtered);
  const count = filtered.length;
  const hasFilters = state.filter !== "all" || Boolean(search);
  let meta = "Nenhum lançamento";

  if (count > 0) {
    if (state.filter === "expense") {
      meta = `${count} ${count === 1 ? "despesa" : "despesas"} · ${formatCurrency(summary.expense)}`;
    } else if (state.filter === "income") {
      meta = `${count} ${count === 1 ? "receita" : "receitas"} · ${formatCurrency(summary.income)}`;
    } else {
      meta = `${count} ${count === 1 ? "lançamento" : "lançamentos"} · ${formatNetValue(summary.balance)}`;
    }
  } else if (hasFilters) {
    meta = "Nenhum resultado";
  }

  els.transactionsMeta.textContent = meta;

  if (!count) {
    els.transactionsList.hidden = true;
    els.transactionsList.innerHTML = "";
    els.transactionsEmpty.hidden = false;
    els.transactionsEmptyTitle.textContent = hasFilters
      ? "Nada encontrado"
      : "Nenhuma transação por aqui";
    els.transactionsEmptyText.textContent = hasFilters
      ? "Tente outro termo de busca ou ajuste os filtros para ver seus lançamentos."
      : "Adicione seu primeiro lançamento para começar a acompanhar sua vida financeira.";
    els.transactionsEmptyBtn.hidden = hasFilters;
    return;
  }

  els.transactionsEmpty.hidden = true;
  els.transactionsList.hidden = false;

  const groups = groupTransactionsByDate(filtered);
  els.transactionsList.innerHTML = groups
    .map((group) => {
      const groupDate = formatGroupDate(group.date);
      return `<section class="tx-group" aria-label="${escapeHTML(groupDate)}">
        <div class="tx-group__head">
          <span class="tx-group__date">${escapeHTML(groupDate)}</span>
          <span class="tx-group__total">${formatNetValue(group.total)}</span>
        </div>
        <div class="tx-group__card">
          ${group.items.map((transaction) => transactionItemHTML(transaction)).join("")}
        </div>
      </section>`;
    })
    .join("");
}

/* ---------- Análises ---------- */

function insightCardHTML({ icon, label, value, detail, tone = "", valueIsText = false }) {
  return `<article class="insight-card">
    <span class="insight-card__icon ${tone}" aria-hidden="true">
      <svg class="icon"><use href="#${icon}"></use></svg>
    </span>
    <span class="insight-card__label">${escapeHTML(label)}</span>
    <strong class="insight-card__value${valueIsText ? " is-text" : ""}" title="${escapeHTML(value)}">${escapeHTML(value)}</strong>
    <span class="insight-card__detail">${escapeHTML(detail)}</span>
  </article>`;
}

function renderInsights() {
  const transactions = transactionsForMonth(state.data.transactions, state.viewMonth);
  const summary = summarize(transactions);
  const previousMonth = shiftMonth(state.viewMonth, -1);
  const previousSummary = summarize(
    transactionsForMonth(state.data.transactions, previousMonth),
  );
  const categories = totalsByCategory(transactions, "expense");
  const topCategory = categories[0];
  const average = averageDailyExpense(transactions, state.viewMonth);
  const biggestDay = biggestExpenseDay(transactions);

  let comparisonIcon = "i-chart";
  let comparisonValue = "—";
  let comparisonDetail = "Sem base de comparação";
  let comparisonTone = "";

  if (summary.expense > 0 && previousSummary.expense > 0) {
    const change = Math.round(
      ((summary.expense - previousSummary.expense) / previousSummary.expense) * 100,
    );
    comparisonIcon =
      change < 0 ? "i-trending-down" : change > 0 ? "i-trending-up" : "i-chart";
    comparisonTone = change > 0 ? "is-expense" : "";
    comparisonValue = `${Math.abs(change)}%`;
    comparisonDetail =
      change === 0
        ? `Igual a ${monthOnlyLabel(previousMonth)}`
        : `${change < 0 ? "A menos" : "A mais"} que ${monthOnlyLabel(previousMonth)}`;
  }

  els.insightHighlights.innerHTML = [
    insightCardHTML({
      icon: comparisonIcon,
      label: "Variação de despesas",
      value: comparisonValue,
      detail: comparisonDetail,
      tone: comparisonTone,
    }),
    insightCardHTML({
      icon: "i-tag",
      label: "Maior categoria",
      value: topCategory ? topCategory.label : "—",
      detail: topCategory ? formatCurrency(topCategory.amount) : "Sem despesas neste mês",
      tone: "is-accent",
      valueIsText: true,
    }),
    insightCardHTML({
      icon: "i-calendar",
      label: "Gasto médio por dia",
      value: summary.expense > 0 ? formatCurrency(average) : "—",
      detail: summary.expense > 0 ? "no mês selecionado" : "Sem despesas neste mês",
    }),
    insightCardHTML({
      icon: "i-receipt",
      label: "Dia de maior gasto",
      value: biggestDay ? formatShortDate(biggestDay.date) : "—",
      detail: biggestDay ? formatCurrency(biggestDay.amount) : "Nenhum gasto registrado",
      tone: "is-expense",
    }),
  ].join("");

  renderMonthlyChart();
  renderCategoryBreakdown(categories, summary.expense);
}

function renderMonthlyChart() {
  const months = [];

  for (let offset = -5; offset <= 0; offset += 1) {
    const month = shiftMonth(state.viewMonth, offset);
    const summary = summarize(transactionsForMonth(state.data.transactions, month));
    months.push({ month, ...summary });
  }

  const maxValue = Math.max(
    1,
    ...months.flatMap((month) => [month.income, month.expense]),
  );
  const hasData = months.some((month) => month.income > 0 || month.expense > 0);

  els.monthlyChart.setAttribute("role", "img");

  if (!hasData) {
    els.monthlyChart.setAttribute(
      "aria-label",
      "Sem movimentações nos últimos seis meses.",
    );
    els.monthlyChart.innerHTML =
      '<p class="chart-empty">Sem movimentações nos últimos seis meses.</p>';
    return;
  }

  const description = months
    .map(
      (month) =>
        `${monthLabel(month.month)}: receitas ${formatCurrency(month.income)} e despesas ${formatCurrency(month.expense)}`,
    )
    .join("; ");

  els.monthlyChart.setAttribute(
    "aria-label",
    `Receitas e despesas dos últimos seis meses. ${description}.`,
  );

  els.monthlyChart.innerHTML = months
    .map((month) => {
      const incomeHeight = Math.round((month.income / maxValue) * 100);
      const expenseHeight = Math.round((month.expense / maxValue) * 100);
      const current = month.month === state.viewMonth;

      return `<div class="bar-group${current ? " is-current" : ""}">
        <div class="bar-group__pair">
          <span class="bar bar--income${month.income === 0 ? " is-zero" : ""}" style="height:${incomeHeight}%" title="${escapeHTML(formatCurrency(month.income))} em receitas"></span>
          <span class="bar bar--expense${month.expense === 0 ? " is-zero" : ""}" style="height:${expenseHeight}%" title="${escapeHTML(formatCurrency(month.expense))} em despesas"></span>
        </div>
        <span class="bar-group__label">${escapeHTML(monthShortLabel(month.month))}</span>
      </div>`;
    })
    .join("");
}

function renderCategoryBreakdown(categories, totalExpense) {
  els.breakdownTotal.textContent = formatCurrency(totalExpense);

  if (!categories.length || totalExpense <= 0) {
    els.categoryBreakdown.innerHTML =
      '<p class="breakdown-empty">Nenhuma despesa registrada neste mês. Que tal começar a acompanhar por aqui?</p>';
    return;
  }

  els.categoryBreakdown.innerHTML = categories
    .map((category) => {
      const percent = Math.round((category.amount / totalExpense) * 100);
      return `<div class="breakdown-row">
        <div class="breakdown-row__top">
          <span class="breakdown-row__name">
            <span class="legend-dot" style="--dot-color:${category.color}" aria-hidden="true"></span>
            ${escapeHTML(category.label)}
          </span>
          <span class="breakdown-row__values">
            <span class="breakdown-row__percent">${percent}%</span>
            <span class="breakdown-row__amount">${formatCurrency(category.amount)}</span>
          </span>
        </div>
        <div class="breakdown-row__track" role="progressbar" aria-label="${escapeHTML(category.label)}: ${percent}% das despesas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
          <div class="breakdown-row__fill" style="--cat-color:${category.color};width:${percent}%"></div>
        </div>
      </div>`;
    })
    .join("");
}

/* ---------- Ajustes ---------- */

function renderSettings() {
  const total = state.data.transactions.length;

  if (total === 0) {
    els.storageSummary.textContent =
      "Nenhum lançamento salvo. Seus próximos dados aparecerão aqui.";
  } else {
    const months = countMonths(state.data.transactions);
    const entries = `${total} ${total === 1 ? "lançamento" : "lançamentos"}`;
    const period = `${months} ${months === 1 ? "mês" : "meses"}`;
    const demoNote = state.data.demo ? " Inclui dados de exemplo." : "";
    els.storageSummary.textContent = `${entries} em ${period}.${demoNote}`;
  }

  els.exportBtn.disabled = total === 0;
  syncThemeUI();
}

/* ---------- Modal de confirmação ---------- */

function openConfirm({
  title,
  text,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = true,
  neutral = false,
  hideCancel = false,
  onConfirm = null,
}) {
  els.confirmTitle.textContent = title;
  els.confirmText.textContent = text;
  els.confirmOkBtn.textContent = confirmText;
  els.confirmCancelBtn.textContent = cancelText;
  els.confirmCancelBtn.hidden = hideCancel;
  els.confirmOkBtn.classList.toggle("is-danger", danger && !neutral);
  els.confirmIcon.classList.toggle("is-neutral", neutral);

  const icon = els.confirmIcon.querySelector("use");
  if (icon) icon.setAttribute("href", neutral ? "#i-info" : "#i-alert");

  confirmAction = typeof onConfirm === "function" ? onConfirm : null;
  openOverlay(
    els.confirmModal,
    hideCancel ? els.confirmOkBtn : els.confirmCancelBtn,
  );
}

/* ---------- Formulário de transação ---------- */

function clearAllFieldErrors() {
  const pairs = [
    [els.amountInput, els.amountError],
    [els.descriptionInput, els.descriptionError],
    [els.dateInput, els.dateError],
  ];

  pairs.forEach(([input, error]) => {
    error.hidden = true;
    input.removeAttribute("aria-invalid");
  });
}

function setFieldError(input, error, message) {
  error.textContent = message;
  error.hidden = false;
  input.setAttribute("aria-invalid", "true");
}

function clearFieldError(input, error) {
  error.hidden = true;
  input.removeAttribute("aria-invalid");
}

function setAmountValue(cents) {
  els.amountInput.value = cents > 0 ? formatAmountInput(cents) : "";
}

function updateTypeUI() {
  els.typeButtons.forEach((button) => {
    const active = button.dataset.type === state.txType;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderCategoryPicker() {
  const categories = getCategories(state.txType);
  if (!categories.some((category) => category.id === state.txCategory)) {
    state.txCategory = DEFAULT_CATEGORY[state.txType];
  }

  els.categoryPicker.innerHTML = categories
    .map((category) => {
      const active = category.id === state.txCategory;
      return `<button class="category-option${active ? " is-active" : ""}" type="button" data-category="${category.id}" aria-pressed="${active}" style="--cat-color:${category.color}">
        <span class="category-option__icon" aria-hidden="true">
          <svg class="icon"><use href="#${category.icon}"></use></svg>
        </span>
        <span>${escapeHTML(category.label)}</span>
      </button>`;
    })
    .join("");
}

function openTransactionSheet({ transaction = null, type = "expense" } = {}) {
  const editing = Boolean(transaction);

  state.editingId = editing ? transaction.id : null;
  state.txType = editing ? transaction.type : type === "income" ? "income" : "expense";
  state.txCategory =
    editing && getCategories(transaction.type).some((item) => item.id === transaction.category)
      ? transaction.category
      : DEFAULT_CATEGORY[state.txType];

  clearAllFieldErrors();
  els.dateInput.max = todayISO();

  if (editing) {
    els.sheetEyebrow.textContent = "Editar lançamento";
    els.sheetTitle.textContent = "Editar transação";
    els.saveTxBtn.textContent = "Salvar alterações";
    els.deleteTxBtn.hidden = false;
    setAmountValue(transaction.amount);
    els.descriptionInput.value = transaction.description;
    els.dateInput.value = transaction.date;
  } else {
    els.sheetEyebrow.textContent = "Novo lançamento";
    els.sheetTitle.textContent = "Adicionar transação";
    els.saveTxBtn.textContent = "Salvar lançamento";
    els.deleteTxBtn.hidden = true;
    setAmountValue(0);
    els.descriptionInput.value = "";
    els.dateInput.value =
      state.viewMonth === currentMonthKey()
        ? todayISO()
        : lastDateOfMonth(state.viewMonth);
  }

  updateTypeUI();
  renderCategoryPicker();
  openOverlay(els.transactionModal, els.amountInput);
}

function handleAmountInput() {
  const digits = els.amountInput.value.replace(/\D/g, "").slice(0, 11);

  if (!digits) {
    els.amountInput.value = "";
  } else {
    const cents = Math.min(Number.parseInt(digits, 10) || 0, MAX_AMOUNT_CENTS);
    els.amountInput.value = formatAmountInput(cents);
  }

  clearFieldError(els.amountInput, els.amountError);
}

function handleTransactionSubmit(event) {
  event.preventDefault();
  clearAllFieldErrors();

  const amount = parseAmountInput(els.amountInput.value);
  const description = els.descriptionInput.value.trim().replace(/\s+/g, " ").slice(0, 70);
  const date = els.dateInput.value;
  const today = todayISO();
  let firstInvalid = null;

  if (amount <= 0) {
    setFieldError(els.amountInput, els.amountError, "Informe um valor maior que zero.");
    firstInvalid = firstInvalid || els.amountInput;
  }

  if (!description) {
    setFieldError(
      els.descriptionInput,
      els.descriptionError,
      "Dê um nome para este lançamento.",
    );
    firstInvalid = firstInvalid || els.descriptionInput;
  }

  if (!isValidISODate(date)) {
    setFieldError(els.dateInput, els.dateError, "Escolha uma data válida.");
    firstInvalid = firstInvalid || els.dateInput;
  } else if (date > today) {
    setFieldError(els.dateInput, els.dateError, "Escolha uma data até hoje.");
    firstInvalid = firstInvalid || els.dateInput;
  }

  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }

  const editing = Boolean(state.editingId);
  const now = Date.now();

  if (editing) {
    const transaction = state.data.transactions.find((item) => item.id === state.editingId);
    if (!transaction) {
      closeOverlay(els.transactionModal);
      showToast("Este lançamento não foi encontrado.", { type: "error" });
      renderAll();
      return;
    }

    Object.assign(transaction, {
      type: state.txType,
      amount,
      description,
      category: state.txCategory,
      date,
    });
  } else {
    state.data.transactions.push({
      id: uid(),
      type: state.txType,
      amount,
      description,
      category: state.txCategory,
      date,
      createdAt: now,
    });
  }

  state.viewMonth = date.slice(0, 7);
  state.editingId = null;

  const saved = saveData(state.data);
  closeOverlay(els.transactionModal);
  renderAll();

  if (!document.activeElement || document.activeElement === document.body) {
    focusActiveHeading();
  }

  if (!saved) {
    showToast(
      "O lançamento ficou nesta sessão, mas não foi possível salvar no dispositivo.",
      { type: "error", duration: 6000 },
    );
    return;
  }

  requestPersistence();
  showToast(editing ? "Lançamento atualizado." : "Lançamento adicionado.");
}

function deleteCurrentTransaction() {
  const id = state.editingId;
  const index = state.data.transactions.findIndex((item) => item.id === id);
  if (index < 0) return;

  const [removed] = state.data.transactions.splice(index, 1);
  const saved = saveData(state.data);
  state.editingId = null;
  closeOverlay(els.transactionModal);
  renderAll();

  if (!document.activeElement || document.activeElement === document.body) {
    focusActiveHeading();
  }

  if (!saved) {
    showToast("Lançamento removido, mas não foi possível salvar a alteração.", {
      type: "error",
      duration: 6000,
    });
    return;
  }

  showToast("Lançamento excluído.", {
    actionLabel: "Desfazer",
    duration: 6500,
    onAction: () => {
      state.data.transactions.push(removed);
      if (saveData(state.data)) {
        renderAll();
        showToast("Lançamento restaurado.");
      } else {
        showToast("Não foi possível restaurar o lançamento.", { type: "error" });
      }
    },
  });
}

/* ---------- Exportação CSV ---------- */

function csvCell(value) {
  const text = String(value ?? "");
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function exportTransactions() {
  const transactions = [...state.data.transactions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
  );

  if (!transactions.length) {
    showToast("Ainda não há lançamentos para exportar.", { type: "info" });
    return;
  }

  const header = ["Data", "Tipo", "Descrição", "Categoria", "Valor (R$)"];
  const rows = transactions.map((transaction) => [
    formatDateForCSV(transaction.date),
    transaction.type === "income" ? "Receita" : "Despesa",
    transaction.description,
    getCategory(transaction.category).label,
    (transaction.amount / 100).toFixed(2).replace(".", ","),
  ]);

  const csv = `\uFEFF${[header, ...rows]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n")}`;

  try {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bolso-transacoes-${todayISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    showToast("Arquivo CSV exportado. Confira seus downloads.");
  } catch (error) {
    showToast("Não foi possível gerar o arquivo CSV.", { type: "error" });
  }
}

/* ---------- Ações sobre os dados ---------- */

function resetSessionFilters() {
  state.filter = "all";
  state.search = "";
  state.viewMonth = currentMonthKey();
  state.editingId = null;
  if (els.searchInput) els.searchInput.value = "";
}

function clearAllData({ demoOnly = false } = {}) {
  state.data = createEmptyData();
  const saved = saveData(state.data);
  resetSessionFilters();
  renderAll();

  if (!saved) {
    showToast("Dados limpos nesta sessão, mas não foi possível salvar.", { type: "error" });
    return;
  }

  showToast(
    demoOnly
      ? "Pronto! Agora o Bolso é todo seu."
      : "Todos os dados foram apagados.",
  );
}

function requestClearData() {
  const total = state.data.transactions.length;
  if (total === 0) {
    showToast("Não há lançamentos para apagar.", { type: "info" });
    return;
  }

  openConfirm({
    title: "Apagar todos os dados?",
    text: `Os ${total} lançamentos salvos neste dispositivo serão removidos. Essa ação não pode ser desfeita.`,
    confirmText: "Apagar tudo",
    danger: true,
    onConfirm: () => clearAllData(),
  });
}

function requestClearDemo() {
  if (!state.data.demo) return;

  openConfirm({
    title: "Começar do zero?",
    text: "Os dados de exemplo e qualquer lançamento feito durante a demonstração serão apagados. Depois, é só adicionar os seus.",
    confirmText: "Começar do zero",
    danger: true,
    onConfirm: () => clearAllData({ demoOnly: true }),
  });
}

function requestLoadDemo() {
  if (state.data.demo) {
    showToast("Os dados de exemplo já estão carregados.", { type: "info" });
    return;
  }

  const load = () => {
    state.data = createDemoData();
    const saved = saveData(state.data);
    resetSessionFilters();
    renderAll();

    if (!saved) {
      showToast("Exemplo carregado nesta sessão, mas não foi possível salvar.", {
        type: "error",
      });
      return;
    }

    showToast("Dados de exemplo carregados. Explore à vontade.", { type: "info" });
  };

  if (state.data.transactions.length === 0) {
    load();
    return;
  }

  openConfirm({
    title: "Substituir seus dados?",
    text: "Seus lançamentos atuais serão substituídos por dados de exemplo. Exporte um CSV antes de continuar, se quiser guardá-los.",
    confirmText: "Carregar exemplo",
    danger: true,
    onConfirm: load,
  });
}

/* ---------- Ações da interface ---------- */

function handleAction(action) {
  switch (action) {
    case "toggle-theme":
      toggleTheme();
      break;
    case "install":
      promptInstall();
      break;
    case "current-month":
      goToCurrentMonth();
      break;
    case "clear-demo":
      requestClearDemo();
      break;
    case "new-expense":
      openTransactionSheet({ type: "expense" });
      break;
    case "new-income":
      openTransactionSheet({ type: "income" });
      break;
    case "export":
      exportTransactions();
      break;
    case "clear-data":
      requestClearData();
      break;
    case "load-demo":
      requestLoadDemo();
      break;
    default:
      break;
  }
}

/* ---------- Navegação ---------- */

function viewFromHash(hash) {
  const clean = String(hash || "")
    .replace(/^#\/?/, "")
    .toLowerCase();
  return VIEW_BY_HASH[clean] || null;
}

function navigate(view) {
  if (!ROUTES[view]) view = "dashboard";
  const target = `#${ROUTES[view]}`;

  if (window.location.hash === target) {
    switchView(view, { focus: true, scroll: true });
    return;
  }

  window.location.hash = target;
}

function switchView(view, { focus = true, scroll = true } = {}) {
  if (!views.has(view)) view = "dashboard";
  state.view = view;

  views.forEach((section, name) => {
    section.hidden = name !== view;
  });

  $$("[data-nav]").forEach((button) => {
    const active = button.dataset.nav === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  els.app.dataset.view = view;
  document.title = VIEW_TITLES[view];

  if (focus) {
    const heading = views.get(view)?.querySelector(".display-title");
    if (heading) heading.focus({ preventScroll: true });
  }

  if (scroll) window.scrollTo(0, 0);
}

function handleHashChange() {
  const view = viewFromHash(window.location.hash);
  if (!view) {
    navigate("dashboard");
    return;
  }
  switchView(view, { focus: true, scroll: true });
}

function renderMonthViews() {
  updateMonthLabels();
  renderDashboard();
  renderTransactions();
  renderInsights();
}

function changeMonth(direction) {
  const next = shiftMonth(state.viewMonth, direction);
  if (next > currentMonthKey()) return;
  state.viewMonth = next;
  renderMonthViews();
}

function goToCurrentMonth() {
  if (state.viewMonth === currentMonthKey()) return;
  state.viewMonth = currentMonthKey();
  renderMonthViews();
}

/* ---------- Renderização completa ---------- */

function renderAll() {
  updateMonthLabels();
  renderDashboard();
  renderTransactions();
  renderInsights();
  renderSettings();
  updateConnectionUI();
  updateInstallUI();
  syncThemeUI();
}

/* ---------- PWA e service worker ---------- */

function showUpdateToast(worker) {
  if (updateNotified) return;
  updateNotified = true;

  showToast("Uma nova versão do Bolso está disponível.", {
    type: "info",
    actionLabel: "Atualizar",
    duration: 15000,
    onAction: () => {
      worker.postMessage({ type: "SKIP_WAITING" });
    },
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register("./sw.js", { scope: "./", updateViaCache: "none" })
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateToast(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast(worker);
          }
        });
      });
    })
    .catch((error) => {
      console.warn("Service worker não registrado:", error);
    });
}

/* ---------- Eventos ---------- */

function handleDocumentClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const actionElement = target.closest("[data-action]");
  if (actionElement) {
    event.preventDefault();
    handleAction(actionElement.dataset.action);
    return;
  }

  const navElement = target.closest("[data-nav]");
  if (navElement) {
    event.preventDefault();
    navigate(navElement.dataset.nav);
    return;
  }

  const gotoElement = target.closest("[data-goto]");
  if (gotoElement) {
    event.preventDefault();
    navigate(gotoElement.dataset.goto);
    return;
  }

  const monthElement = target.closest("[data-month-dir]");
  if (monthElement) {
    event.preventDefault();
    changeMonth(Number(monthElement.dataset.monthDir));
    return;
  }

  const filterElement = target.closest("[data-filter]");
  if (filterElement) {
    event.preventDefault();
    state.filter = filterElement.dataset.filter || "all";
    renderTransactions();
    return;
  }

  const transactionElement = target.closest("[data-tx-id]");
  if (transactionElement) {
    event.preventDefault();
    const transaction = state.data.transactions.find(
      (item) => item.id === transactionElement.dataset.txId,
    );
    if (transaction) openTransactionSheet({ transaction });
  }
}

function bindEvents() {
  document.addEventListener("click", handleDocumentClick);

  els.fab.addEventListener("click", () => {
    openTransactionSheet({ type: "expense" });
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value;
    renderTransactions();
  });

  els.themeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) setTheme(radio.value);
    });
  });

  els.typeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.txType = button.dataset.type === "income" ? "income" : "expense";
      state.txCategory = DEFAULT_CATEGORY[state.txType];
      updateTypeUI();
      renderCategoryPicker();
    });
  });

  els.categoryPicker.addEventListener("click", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-category]")
      : null;
    if (!target) return;
    state.txCategory = target.dataset.category;
    renderCategoryPicker();
  });

  els.amountInput.addEventListener("input", handleAmountInput);
  els.amountInput.addEventListener("focus", () => {
    if (els.amountInput.value) els.amountInput.select();
  });

  els.descriptionInput.addEventListener("input", () => {
    clearFieldError(els.descriptionInput, els.descriptionError);
  });

  els.dateInput.addEventListener("change", () => {
    clearFieldError(els.dateInput, els.dateError);
  });

  els.transactionForm.addEventListener("submit", handleTransactionSubmit);
  els.deleteTxBtn.addEventListener("click", deleteCurrentTransaction);

  els.sheetCloseBtn.addEventListener("click", () => {
    closeOverlay(els.transactionModal);
  });

  els.transactionModal.addEventListener("click", (event) => {
    if (event.target === els.transactionModal) closeOverlay(els.transactionModal);
  });

  els.confirmCancelBtn.addEventListener("click", () => {
    closeOverlay(els.confirmModal);
  });

  els.confirmOkBtn.addEventListener("click", () => {
    const action = confirmAction;
    closeOverlay(els.confirmModal);
    if (action) action();
  });

  els.confirmModal.addEventListener("click", (event) => {
    if (event.target === els.confirmModal) closeOverlay(els.confirmModal);
  });

  document.addEventListener("keydown", (event) => {
    if (!activeOverlay) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = getFocusable(activeOverlay);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !activeOverlay.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !activeOverlay.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("online", () => {
    updateConnectionUI();
    showToast("Conexão restabelecida.", { type: "success" });
  });

  window.addEventListener("offline", () => {
    updateConnectionUI();
    showToast("Sem internet. Seus dados continuam disponíveis.", {
      type: "warning",
      duration: 4500,
    });
  });

  window.addEventListener("bolso:themechange", syncThemeUI);

  window.addEventListener("hashchange", handleHashChange);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    updateInstallUI();
  });

  window.addEventListener("appinstalled", () => {
    state.deferredPrompt = null;
    updateInstallUI();
    showToast("Pronto! O Bolso está na sua tela inicial.", { type: "success" });
  });

  const displayMode = window.matchMedia("(display-mode: standalone)");
  if (displayMode.addEventListener) {
    displayMode.addEventListener("change", updateInstallUI);
  } else if (displayMode.addListener) {
    displayMode.addListener(updateInstallUI);
  }
}

/* ---------- Inicialização ---------- */

function init() {
  bindEvents();
  syncThemeUI();
  updateConnectionUI();
  updateInstallUI();

  const params = new URLSearchParams(window.location.search);
  const action = params.get("action");
  let initialView = viewFromHash(window.location.hash);

  if (!initialView) {
    const tab = params.get("tab");
    if (tab && TAB_ROUTES[tab]) initialView = TAB_ROUTES[tab];
  }

  if (!initialView) initialView = "dashboard";

  const targetHash = `#${ROUTES[initialView]}`;
  if (window.location.hash !== targetHash) {
    replaceUrl(`${window.location.pathname}${targetHash}`);
  }

  renderAll();
  switchView(initialView, { focus: false, scroll: false });

  if (action === "new-expense" || action === "new-income") {
    const type = action === "new-income" ? "income" : "expense";
    window.setTimeout(() => openTransactionSheet({ type }), 260);
  }

  if (window.location.search) {
    replaceUrl(`${window.location.pathname}${window.location.hash}`);
  }

  registerServiceWorker();
}

function replaceUrl(url) {
  try {
    window.history.replaceState(null, "", url);
  } catch (error) {
    /* Histórico indisponível: a URL continua funcionando. */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
