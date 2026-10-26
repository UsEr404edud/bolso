/* Camada de dados do Bolso: categorias, armazenamento local e utilidades. */

export const STORAGE_KEY = "bolso.data.v1";
export const DATA_VERSION = 1;
export const MAX_AMOUNT_CENTS = 99999999999;

export const CATEGORY_GROUPS = {
  expense: [
    { id: "alimentacao", label: "Alimentação", icon: "i-utensils", color: "#e4784f" },
    { id: "moradia", label: "Moradia", icon: "i-house", color: "#6f8ce0" },
    { id: "transporte", label: "Transporte", icon: "i-car", color: "#d8a63a" },
    { id: "contas", label: "Contas", icon: "i-receipt", color: "#7d8c85" },
    { id: "lazer", label: "Lazer", icon: "i-sparkles", color: "#9577e0" },
    { id: "saude", label: "Saúde", icon: "i-heart", color: "#d9658e" },
    { id: "compras", label: "Compras", icon: "i-bag", color: "#cf9f43" },
    { id: "educacao", label: "Educação", icon: "i-book", color: "#4b9fa3" },
    { id: "outros", label: "Outros", icon: "i-dots", color: "#98a49d" },
  ],
  income: [
    { id: "salario", label: "Salário", icon: "i-briefcase", color: "#2e8264" },
    { id: "freelance", label: "Freelance", icon: "i-laptop", color: "#3c9c79" },
    { id: "investimentos", label: "Investimentos", icon: "i-trending-up", color: "#6f8ce0" },
    { id: "bonus", label: "Bônus", icon: "i-gift", color: "#cf9f43" },
    { id: "outros-renda", label: "Outros", icon: "i-dots", color: "#8a9a91" },
  ],
};

export const DEFAULT_CATEGORY = {
  expense: "alimentacao",
  income: "salario",
};

const CATEGORY_MAP = new Map();
Object.values(CATEGORY_GROUPS).flat().forEach((category) => {
  CATEGORY_MAP.set(category.id, category);
});

export function getCategories(type) {
  return CATEGORY_GROUPS[type] || CATEGORY_GROUPS.expense;
}

export function getCategory(id) {
  return CATEGORY_MAP.get(id) || CATEGORY_MAP.get("outros");
}

export function isCategoryForType(id, type) {
  return getCategories(type).some((category) => category.id === id);
}

/* ---------- Texto e números ---------- */

export function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const amountFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(cents) {
  const value = Number(cents) || 0;
  return brlFormatter.format(value / 100);
}

export function formatSignedCurrency(cents, type) {
  const sign = type === "income" ? "+" : "−";
  return `${sign} ${formatCurrency(Math.abs(cents))}`;
}

export function formatAmountInput(cents) {
  if (!cents) return "";
  return amountFormatter.format(cents / 100);
}

export function parseAmountInput(text) {
  const digits = String(text || "").replace(/\D/g, "").slice(0, 11);
  if (!digits) return 0;
  return Math.min(Number.parseInt(digits, 10) || 0, MAX_AMOUNT_CENTS);
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

/* ---------- Datas e meses ---------- */

const longMonthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const monthOnlyFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
});

const shortMonthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
});

const fullDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
});

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function dateToISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayISO() {
  return dateToISO(new Date());
}

export function currentMonthKey() {
  return todayISO().slice(0, 7);
}

export function parseISODate(isoDate) {
  if (typeof isoDate !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isValidISODate(isoDate) {
  return Boolean(parseISODate(isoDate));
}

export function shiftMonth(monthKey, delta) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1, 12);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function daysInMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0, 12).getDate();
}

export function dateForMonthDay(monthKey, day) {
  const clamped = Math.max(1, Math.min(Number(day) || 1, daysInMonth(monthKey)));
  return `${monthKey}-${pad2(clamped)}`;
}

export function lastDateOfMonth(monthKey) {
  return dateForMonthDay(monthKey, daysInMonth(monthKey));
}

export function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return capitalize(longMonthFormatter.format(new Date(year, month - 1, 1, 12)));
}

export function monthOnlyLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return monthOnlyFormatter.format(new Date(year, month - 1, 1, 12));
}

export function monthShortLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return shortMonthFormatter.format(new Date(year, month - 1, 1, 12)).replace(".", "");
}

export function shiftDateISO(isoDate, deltaDays) {
  const date = parseISODate(isoDate);
  if (!date) return isoDate;
  date.setDate(date.getDate() + deltaDays);
  return dateToISO(date);
}

export function formatGroupDate(isoDate) {
  if (isoDate === todayISO()) return "Hoje";
  if (isoDate === shiftDateISO(todayISO(), -1)) return "Ontem";

  const date = parseISODate(isoDate);
  if (!date) return isoDate;

  const includeYear = date.getFullYear() !== new Date().getFullYear();
  const formatter = includeYear
    ? new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : fullDateFormatter;

  return capitalize(formatter.format(date));
}

export function formatShortDate(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) return isoDate;
  const short = shortDateFormatter.format(date).replace(".", "");
  const includeYear = date.getFullYear() !== new Date().getFullYear();
  return includeYear ? `${short} ${date.getFullYear()}` : short;
}

export function formatFullDate(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) return isoDate;
  return capitalize(fullDateFormatter.format(date));
}

export function formatDateForCSV(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) return isoDate;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/* ---------- Transações ---------- */

export function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function transactionsForMonth(transactions, monthKey) {
  return transactions.filter((transaction) => transaction.date.slice(0, 7) === monthKey);
}

export function sortTransactionsDesc(transactions) {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

export function groupTransactionsByDate(transactions) {
  const groups = new Map();

  sortTransactionsDesc(transactions).forEach((transaction) => {
    if (!groups.has(transaction.date)) {
      groups.set(transaction.date, []);
    }
    groups.get(transaction.date).push(transaction);
  });

  return Array.from(groups, ([date, items]) => ({
    date,
    items,
    total: items.reduce(
      (sum, item) => sum + (item.type === "income" ? item.amount : -item.amount),
      0,
    ),
  }));
}

export function summarize(transactions) {
  let income = 0;
  let expense = 0;

  transactions.forEach((transaction) => {
    if (transaction.type === "income") income += transaction.amount;
    else expense += transaction.amount;
  });

  const balance = income - expense;
  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : null;

  return { income, expense, balance, savingsRate };
}

export function totalsByCategory(transactions, type = "expense") {
  const totals = new Map();

  transactions
    .filter((transaction) => transaction.type === type)
    .forEach((transaction) => {
      totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.amount);
    });

  return Array.from(totals, ([categoryId, amount]) => {
    const category = getCategory(categoryId);
    return { ...category, amount };
  }).sort((a, b) => b.amount - a.amount);
}

export function countMonths(transactions) {
  return new Set(transactions.map((transaction) => transaction.date.slice(0, 7))).size;
}

export function averageDailyExpense(transactions, monthKey) {
  const summary = summarize(transactions);
  const currentMonth = currentMonthKey();
  let days = daysInMonth(monthKey);

  if (monthKey === currentMonth) {
    days = Math.max(new Date().getDate(), 1);
  } else if (monthKey > currentMonth) {
    days = 1;
  }

  return Math.round(summary.expense / Math.max(days, 1));
}

export function biggestExpenseDay(transactions) {
  const totals = new Map();

  transactions
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => {
      totals.set(transaction.date, (totals.get(transaction.date) || 0) + transaction.amount);
    });

  const sorted = Array.from(totals).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]));
  if (!sorted.length) return null;
  return { date: sorted[0][0], amount: sorted[0][1] };
}

/* ---------- Persistência ---------- */

function normalizeTransaction(raw) {
  if (!raw || typeof raw !== "object") return null;

  const type = raw.type === "income" || raw.type === "expense" ? raw.type : null;
  if (!type) return null;

  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const date = typeof raw.date === "string" && isValidISODate(raw.date) ? raw.date : null;
  if (!date) return null;

  const rawDescription =
    typeof raw.description === "string" ? raw.description.trim().slice(0, 70) : "";
  const description = rawDescription || "Lançamento";

  const category = isCategoryForType(raw.category, type) ? raw.category : DEFAULT_CATEGORY[type];
  const id =
    typeof raw.id === "string" && raw.id.length > 0 && raw.id.length <= 100 ? raw.id : uid();
  const createdAt = Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now();

  return {
    id,
    type,
    amount: Math.min(Math.round(amount), MAX_AMOUNT_CENTS),
    description,
    category,
    date,
    createdAt,
  };
}

export function createEmptyData() {
  return {
    version: DATA_VERSION,
    demo: false,
    transactions: [],
  };
}

function normalizeData(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.transactions)) return null;

  const seenIds = new Set();
  const transactions = raw.transactions
    .slice(0, 5000)
    .map(normalizeTransaction)
    .filter(Boolean)
    .filter((transaction) => {
      if (seenIds.has(transaction.id)) return false;
      seenIds.add(transaction.id);
      return true;
    });

  return {
    version: DATA_VERSION,
    demo: Boolean(raw.demo),
    transactions,
  };
}

export function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const normalized = normalizeData(parsed);
      if (normalized) return normalized;
    }

    const demo = createDemoData();
    saveData(demo);
    return demo;
  } catch (error) {
    // Se o armazenamento estiver indisponível, o app segue em memória.
    return createDemoData();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: DATA_VERSION,
        demo: Boolean(data.demo),
        transactions: data.transactions,
      }),
    );
    return true;
  } catch (error) {
    return false;
  }
}

/* ---------- Dados de demonstração ---------- */

export function createDemoData() {
  const transactions = [];
  const baseMonth = currentMonthKey();
  const todayDay = new Date().getDate();
  let order = 0;

  const add = (monthOffset, day, type, description, amount, category) => {
    const month = shiftMonth(baseMonth, monthOffset);
    let actualDay = day;

    if (monthOffset === 0) {
      actualDay = Math.min(day, todayDay);
    }

    const date = dateForMonthDay(month, actualDay);
    const [year, monthNumber] = month.split("-").map(Number);
    const createdAt =
      new Date(year, monthNumber - 1, Number(date.slice(8, 10)), 10, 0, 0, 0).getTime() +
      order * 1000;

    transactions.push({
      id: uid(),
      type,
      amount,
      description,
      category,
      date,
      createdAt,
    });
    order += 1;
  };

  // Mês atual — receitas
  add(0, 5, "income", "Salário", 520000, "salario");
  add(0, 22, "income", "Projeto freelance", 120000, "freelance");
  add(0, 24, "income", "Rendimentos", 8320, "investimentos");

  // Mês atual — despesas
  add(0, 7, "expense", "Aluguel", 145000, "moradia");
  add(0, 21, "expense", "Mercado do mês", 38970, "alimentacao");
  add(0, 12, "expense", "Conta de luz", 18735, "contas");
  add(0, 10, "expense", "Internet fibra", 9990, "contas");
  add(0, 23, "expense", "Café da manhã", 1680, "alimentacao");
  add(0, 25, "expense", "Uber para o trabalho", 4280, "transporte");
  add(0, 16, "expense", "Cinema e pipoca", 6400, "lazer");
  add(0, 19, "expense", "Farmácia", 5420, "saude");
  add(0, 14, "expense", "Tênis de corrida", 18990, "compras");
  add(0, 8, "expense", "Streaming", 3990, "lazer");

  // Mês anterior
  add(-1, 5, "income", "Salário", 520000, "salario");
  add(-1, 18, "income", "Freelance de design", 85000, "freelance");
  add(-1, 7, "expense", "Aluguel", 145000, "moradia");
  add(-1, 11, "expense", "Mercado do mês", 42350, "alimentacao");
  add(-1, 14, "expense", "Conta de energia", 17620, "contas");
  add(-1, 16, "expense", "Combustível", 18700, "transporte");
  add(-1, 20, "expense", "Jantar fora", 12900, "alimentacao");
  add(-1, 22, "expense", "Show de música", 22900, "lazer");
  add(-1, 24, "expense", "Consulta médica", 8900, "saude");
  add(-1, 26, "expense", "Camiseta nova", 13400, "compras");
  add(-1, 10, "expense", "Internet fibra", 9990, "contas");
  add(-1, 8, "expense", "Café e padaria", 2400, "alimentacao");

  // Dois meses atrás
  add(-2, 5, "income", "Salário", 520000, "salario");
  add(-2, 7, "expense", "Aluguel", 145000, "moradia");
  add(-2, 12, "expense", "Mercado do mês", 35870, "alimentacao");
  add(-2, 15, "expense", "Conta de energia", 16210, "contas");
  add(-2, 17, "expense", "Transporte por app", 15200, "transporte");
  add(-2, 19, "expense", "Cinema", 9800, "lazer");
  add(-2, 20, "expense", "Curso online", 12900, "educacao");
  add(-2, 23, "expense", "Tênis", 21700, "compras");
  add(-2, 10, "expense", "Internet fibra", 9990, "contas");
  add(-2, 8, "expense", "Feira da semana", 5870, "alimentacao");

  // Três meses atrás
  add(-3, 5, "income", "Salário", 520000, "salario");
  add(-3, 15, "income", "Projeto de consultoria", 150000, "freelance");
  add(-3, 20, "income", "Bônus trimestral", 50000, "bonus");
  add(-3, 7, "expense", "Aluguel", 145000, "moradia");
  add(-3, 11, "expense", "Mercado do mês", 49820, "alimentacao");
  add(-3, 13, "expense", "Conta de energia", 19210, "contas");
  add(-3, 16, "expense", "Combustível e pedágio", 28800, "transporte");
  add(-3, 18, "expense", "Dentista", 16800, "saude");
  add(-3, 21, "expense", "Viagem de fim de semana", 34900, "lazer");
  add(-3, 24, "expense", "Móveis para casa", 48900, "compras");
  add(-3, 25, "expense", "Curso de espanhol", 12900, "educacao");
  add(-3, 10, "expense", "Internet fibra", 9990, "contas");

  // Quatro meses atrás
  add(-4, 5, "income", "Salário", 520000, "salario");
  add(-4, 7, "expense", "Aluguel", 140000, "moradia");
  add(-4, 12, "expense", "Mercado do mês", 31200, "alimentacao");
  add(-4, 14, "expense", "Conta de energia", 15400, "contas");
  add(-4, 17, "expense", "Transporte público", 13200, "transporte");
  add(-4, 20, "expense", "Cinema e lanches", 8700, "lazer");
  add(-4, 22, "expense", "Streaming", 3990, "lazer");
  add(-4, 24, "expense", "Farmácia", 7200, "saude");
  add(-4, 26, "expense", "Livros", 8400, "educacao");

  // Cinco meses atrás
  add(-5, 5, "income", "Salário", 520000, "salario");
  add(-5, 7, "expense", "Aluguel", 140000, "moradia");
  add(-5, 13, "expense", "Mercado do mês", 44900, "alimentacao");
  add(-5, 15, "expense", "Conta de energia", 18800, "contas");
  add(-5, 17, "expense", "Transporte", 19200, "transporte");
  add(-5, 19, "expense", "Bar com amigos", 12700, "lazer");
  add(-5, 23, "expense", "Tênis e acessórios", 23900, "compras");
  add(-5, 25, "expense", "Consulta médica", 6400, "saude");
  add(-5, 10, "expense", "Internet fibra", 9990, "contas");

  return {
    version: DATA_VERSION,
    demo: true,
    transactions,
  };
}
