import Dexie, { type Table } from 'dexie';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './lib/categories';

export type TxType = 'expense' | 'income' | 'adjustment' | 'transfer';
export type AccountKind = 'card' | 'cash' | 'wallet' | 'deposit' | 'other';

export interface Tx {
  id?: number;
  type: TxType;
  /** Сумма в сумах. Для expense/income/transfer > 0; для adjustment — разница со знаком */
  amount: number;
  category: string;
  note: string;
  /** Счёт операции; для перевода — счёт, с которого ушли деньги */
  accountId: number;
  /** Только для перевода: счёт, на который пришли деньги */
  toAccountId?: number;
  occurredAt: number;
  createdAt: number;
}

export interface Account {
  id?: number;
  name: string;
  kind: AccountKind;
  initialBalance: number;
  isDefault: 0 | 1;
  archivedAt: number | null;
  createdAt: number;
}

export interface Category {
  id?: number;
  type: 'expense' | 'income';
  name: string;
  order: number;
}

export const KIND_LABELS: Record<AccountKind, string> = {
  card: 'Карта',
  cash: 'Наличные',
  wallet: 'Кошелёк',
  deposit: 'Вклад',
  other: 'Другое',
};

export const KIND_ICONS: Record<AccountKind, string> = {
  card: '💳',
  cash: '💵',
  wallet: '📱',
  deposit: '🏦',
  other: '👛',
};

export class ManiDB extends Dexie {
  transactions!: Table<Tx, number>;
  accounts!: Table<Account, number>;
  categories!: Table<Category, number>;

  constructor(name = 'mani') {
    super(name);
    this.version(1).stores({
      transactions: '++id, occurredAt, accountId, type',
      accounts: '++id, name',
      categories: '++id, type',
    });
  }
}

export let db = new ManiDB();

/** Для тестов: отдельная база */
export function useDatabase(instance: ManiDB) {
  db = instance;
}

export class UserError extends Error {}

// ---------- Первый запуск ----------

export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', db.accounts, db.categories, async () => {
    if ((await db.categories.count()) === 0) {
      await db.categories.bulkAdd([
        ...EXPENSE_CATEGORIES.map((name, order) => ({ type: 'expense' as const, name, order })),
        ...INCOME_CATEGORIES.map((name, order) => ({ type: 'income' as const, name, order })),
      ]);
    }
    if ((await db.accounts.count()) === 0) {
      await db.accounts.add({
        name: 'Наличные',
        kind: 'cash',
        initialBalance: 0,
        isDefault: 1,
        archivedAt: null,
        createdAt: Date.now(),
      });
    }
  });
}

// ---------- Счета ----------

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  const all = await db.accounts.orderBy('id').toArray();
  return includeArchived ? all : all.filter((a) => a.archivedAt === null);
}

async function assertUniqueName(name: string, exceptId?: number) {
  const n = name.trim().toLowerCase();
  if (!n) throw new UserError('Введите название счёта');
  const clash = (await db.accounts.toArray()).find(
    (a) => a.name.trim().toLowerCase() === n && a.id !== exceptId,
  );
  if (clash) throw new UserError(`Счёт «${clash.name}» уже есть`);
}

export async function addAccount(input: {
  name: string;
  kind: AccountKind;
  initialBalance: number;
}): Promise<number> {
  await assertUniqueName(input.name);
  const isFirst = (await listAccounts()).length === 0;
  return db.accounts.add({
    name: input.name.trim(),
    kind: input.kind,
    initialBalance: Math.round(input.initialBalance),
    isDefault: isFirst ? 1 : 0,
    archivedAt: null,
    createdAt: Date.now(),
  });
}

export async function updateAccount(
  id: number,
  patch: Partial<Pick<Account, 'name' | 'kind' | 'initialBalance'>>,
) {
  if (patch.name !== undefined) {
    await assertUniqueName(patch.name, id);
    patch.name = patch.name.trim();
  }
  await db.accounts.update(id, patch);
}

export async function setDefaultAccount(id: number) {
  await db.transaction('rw', db.accounts, async () => {
    await db.accounts.toCollection().modify({ isDefault: 0 });
    await db.accounts.update(id, { isDefault: 1 });
  });
}

/** Счёт с операциями не удаляется, а архивируется */
export async function removeAccount(id: number): Promise<'deleted' | 'archived'> {
  const active = await listAccounts();
  if (active.length <= 1 && active[0]?.id === id) {
    throw new UserError('Нельзя убрать последний счёт');
  }
  return db.transaction('rw', db.accounts, db.transactions, async () => {
    const acc = await db.accounts.get(id);
    if (!acc) return 'deleted';
    const used =
      (await db.transactions.where('accountId').equals(id).count()) +
      (await db.transactions.filter((t) => t.toAccountId === id).count());
    if (used > 0) {
      await db.accounts.update(id, { archivedAt: Date.now(), isDefault: 0 });
    } else {
      await db.accounts.delete(id);
    }
    if (acc.isDefault) {
      const next = (await db.accounts.toArray()).find((a) => a.archivedAt === null && a.id !== id);
      if (next?.id) await db.accounts.update(next.id, { isDefault: 1 });
    }
    return used > 0 ? 'archived' : 'deleted';
  });
}

export async function restoreAccount(id: number) {
  await db.accounts.update(id, { archivedAt: null });
}

/** Остаток = начальный + доходы − расходы ± переводы + корректировки. Не хранится, всегда считается. */
export async function balances(): Promise<Map<number, number>> {
  const accounts = await db.accounts.toArray();
  const map = new Map<number, number>(accounts.map((a) => [a.id!, a.initialBalance]));
  const add = (id: number, d: number) => map.set(id, (map.get(id) ?? 0) + d);
  await db.transactions.each((t) => {
    if (t.type === 'transfer') {
      add(t.accountId, -t.amount);
      if (t.toAccountId) add(t.toAccountId, t.amount);
    } else {
      add(t.accountId, t.type === 'expense' ? -t.amount : t.amount);
    }
  });
  return map;
}

/** Сверка: создаёт корректировку на разницу. Возвращает разницу (0 — ничего не создано). */
export async function reconcile(accountId: number, actual: number): Promise<number> {
  const current = (await balances()).get(accountId) ?? 0;
  const diff = Math.round(actual) - current;
  if (diff === 0) return 0;
  const now = Date.now();
  await db.transactions.add({
    type: 'adjustment',
    amount: diff,
    category: 'Корректировка',
    note: 'Сверка остатка',
    accountId,
    occurredAt: now,
    createdAt: now,
  });
  return diff;
}

// ---------- Операции ----------

function validateTx(t: Omit<Tx, 'id' | 'createdAt'>) {
  if (t.type !== 'adjustment' && !(t.amount > 0)) throw new UserError('Введите сумму больше нуля');
  if (!Number.isFinite(t.amount)) throw new UserError('Неверная сумма');
  if (!t.accountId) throw new UserError('Выберите счёт');
  if (t.type === 'transfer') {
    if (!t.toAccountId) throw new UserError('Выберите, на какой счёт перевести');
    if (t.toAccountId === t.accountId) throw new UserError('Выберите два разных счёта');
    return;
  }
  if (!t.category.trim()) throw new UserError('Выберите категорию');
}

export const TRANSFER_CATEGORY = 'Перевод';

/** Перевод между своими счетами: не расход и не доход, меняет остатки обоих счетов */
export async function addTransfer(t: { from: number; to: number; amount: number; note?: string; occurredAt: number }) {
  return addTx({
    type: 'transfer', amount: t.amount, category: TRANSFER_CATEGORY, note: t.note ?? '',
    accountId: t.from, toAccountId: t.to, occurredAt: t.occurredAt,
  });
}

export async function updateTransfer(id: number, t: { from: number; to: number; amount: number; note?: string; occurredAt: number }) {
  return updateTx(id, {
    type: 'transfer', amount: t.amount, category: TRANSFER_CATEGORY, note: t.note ?? '',
    accountId: t.from, toAccountId: t.to, occurredAt: t.occurredAt,
  });
}

export async function addTx(t: Omit<Tx, 'id' | 'createdAt'>): Promise<number> {
  validateTx(t);
  return db.transactions.add({ ...t, amount: Math.round(t.amount), createdAt: Date.now() });
}

export async function updateTx(id: number, t: Omit<Tx, 'id' | 'createdAt'>) {
  validateTx(t);
  await db.transactions.update(id, { ...t, amount: Math.round(t.amount) });
}

export async function deleteTx(id: number) {
  await db.transactions.delete(id);
}

export async function listTx(filter: { accountId?: number; from?: number; to?: number } = {}) {
  const from = filter.from ?? 0;
  const to = filter.to ?? Number.MAX_SAFE_INTEGER;
  const rows = await db.transactions.where('occurredAt').between(from, to, true, false).toArray();
  return rows
    .filter((t) => filter.accountId === undefined || t.accountId === filter.accountId || t.toAccountId === filter.accountId)
    .sort((a, b) => b.occurredAt - a.occurredAt || b.id! - a.id!);
}

export interface PeriodStats {
  expense: number;
  income: number;
  /** Расходы по категориям, от большей к меньшей */
  byCategory: { category: string; total: number }[];
  incomeByCategory: { category: string; total: number }[];
}

/** Корректировки и переводы не входят в расходы и доходы */
export async function getStats(from: number, to: number, accountId?: number): Promise<PeriodStats> {
  const rows = await listTx({ from, to, accountId });
  let expense = 0;
  let income = 0;
  const exp = new Map<string, number>();
  const inc = new Map<string, number>();
  for (const t of rows) {
    if (accountId !== undefined && t.accountId !== accountId) continue;
    if (t.type === 'expense') {
      expense += t.amount;
      exp.set(t.category, (exp.get(t.category) ?? 0) + t.amount);
    } else if (t.type === 'income') {
      income += t.amount;
      inc.set(t.category, (inc.get(t.category) ?? 0) + t.amount);
    }
  }
  const sorted = (m: Map<string, number>) =>
    [...m.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  return { expense, income, byCategory: sorted(exp), incomeByCategory: sorted(inc) };
}

/** Суммы по корзинам периода: дни недели/месяца или месяцы года */
export async function getSeries(
  buckets: [number, number][],
  type: 'expense' | 'income',
  accountId?: number,
): Promise<number[]> {
  if (buckets.length === 0) return [];
  const rows = await listTx({ from: buckets[0][0], to: buckets[buckets.length - 1][1], accountId });
  const out = buckets.map(() => 0);
  for (const t of rows) {
    if (t.type !== type || (accountId !== undefined && t.accountId !== accountId)) continue;
    const i = buckets.findIndex(([a, b]) => t.occurredAt >= a && t.occurredAt < b);
    if (i >= 0) out[i] += t.amount;
  }
  return out;
}

// ---------- Категории ----------

export async function listCategories(): Promise<{ expense: string[]; income: string[] }> {
  const all = await db.categories.toArray();
  const pick = (type: 'expense' | 'income') =>
    all.filter((c) => c.type === type).sort((a, b) => a.order - b.order).map((c) => c.name);
  return { expense: pick('expense'), income: pick('income') };
}

export async function addCategory(type: 'expense' | 'income', name: string) {
  const n = name.trim();
  if (!n) throw new UserError('Введите название категории');
  const existing = await db.categories.where('type').equals(type).toArray();
  if (existing.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
    throw new UserError(`Категория «${n}» уже есть`);
  }
  const order = Math.max(-1, ...existing.map((c) => c.order)) + 1;
  await db.categories.add({ type, name: n, order });
}

/** Переименование меняет категорию и во всех операциях этого типа */
export async function renameCategory(type: 'expense' | 'income', from: string, to: string) {
  const n = to.trim();
  if (!n) throw new UserError('Введите название категории');
  if (n === from) return;
  await db.transaction('rw', db.categories, db.transactions, async () => {
    const list = await db.categories.where('type').equals(type).toArray();
    if (list.some((c) => c.name.toLowerCase() === n.toLowerCase() && c.name !== from)) {
      throw new UserError(`Категория «${n}» уже есть`);
    }
    const cat = list.find((c) => c.name === from);
    if (cat) await db.categories.update(cat.id!, { name: n });
    await db.transactions
      .filter((t) => t.type === type && t.category === from)
      .modify({ category: n });
  });
}

/** Удаление: операции этой категории переносятся в moveTo */
export async function deleteCategory(type: 'expense' | 'income', name: string, moveTo: string) {
  await db.transaction('rw', db.categories, db.transactions, async () => {
    const list = await db.categories.where('type').equals(type).toArray();
    if (list.length <= 1) throw new UserError('Нельзя удалить последнюю категорию');
    const cat = list.find((c) => c.name === name);
    if (cat) await db.categories.delete(cat.id!);
    await db.transactions
      .filter((t) => t.type === type && t.category === name)
      .modify({ category: moveTo });
  });
}

// ---------- Резервная копия ----------

export interface Backup {
  app: 'mani';
  version: 1;
  exportedAt: number;
  accounts: Account[];
  categories: Category[];
  transactions: Tx[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'mani',
    version: 1,
    exportedAt: Date.now(),
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
  };
}

export function validateBackup(data: unknown): Backup {
  const b = data as Backup;
  if (!b || b.app !== 'mani' || b.version !== 1) {
    throw new UserError('Это не файл резервной копии «Мани»');
  }
  if (!Array.isArray(b.accounts) || !Array.isArray(b.categories) || !Array.isArray(b.transactions)) {
    throw new UserError('Файл копии повреждён');
  }
  const ids = new Set(b.accounts.map((a) => a.id));
  if (b.accounts.length === 0) throw new UserError('В копии нет счетов');
  for (const t of b.transactions) {
    if (t.type === 'transfer' && !ids.has(t.toAccountId)) {
      throw new UserError('Файл копии повреждён: перевод без счёта');
    }
    if (!ids.has(t.accountId) || typeof t.amount !== 'number' || typeof t.occurredAt !== 'number') {
      throw new UserError('Файл копии повреждён: операция без счёта или суммы');
    }
  }
  return b;
}

/** Полностью заменяет данные содержимым копии */
export async function importBackup(data: unknown): Promise<{ transactions: number; accounts: number }> {
  const b = validateBackup(data);
  await db.transaction('rw', db.accounts, db.categories, db.transactions, async () => {
    await Promise.all([db.accounts.clear(), db.categories.clear(), db.transactions.clear()]);
    await db.accounts.bulkAdd(b.accounts);
    await db.categories.bulkAdd(b.categories);
    await db.transactions.bulkAdd(b.transactions);
  });
  return { transactions: b.transactions.length, accounts: b.accounts.length };
}

export async function exportCsv(): Promise<string> {
  const accounts = new Map((await db.accounts.toArray()).map((a) => [a.id, a.name]));
  const rows = await listTx();
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const typeName = { expense: 'Расход', income: 'Доход', adjustment: 'Корректировка', transfer: 'Перевод' };
  const lines = ['Дата;Тип;Сумма;Категория;Счёт;Заметка'];
  for (const t of rows.reverse()) {
    const d = new Date(t.occurredAt);
    const p = (n: number) => String(n).padStart(2, '0');
    const date = `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    lines.push(
      [
        date, typeName[t.type], String(t.amount), esc(t.category),
        esc(t.type === 'transfer'
          ? `${accounts.get(t.accountId) ?? ''} → ${accounts.get(t.toAccountId!) ?? ''}`
          : (accounts.get(t.accountId) ?? '')),
        esc(t.note),
      ].join(';'),
    );
  }
  // BOM — чтобы Excel и Numbers открыли кириллицу без искажений
  return '﻿' + lines.join('\r\n');
}
