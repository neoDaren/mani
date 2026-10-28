import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {
  ManiDB, useDatabase, ensureSeed, listAccounts, addAccount, balances, addTx, updateTx, deleteTx,
  getStats, reconcile, removeAccount, exportBackup, importBackup, renameCategory, deleteCategory,
  listCategories, setDefaultAccount, exportCsv, UserError,
} from '../src/db';

async function main() {
  useDatabase(new ManiDB('test-' + Math.random()));
  await ensureSeed();
  await ensureSeed(); // повторный вызов ничего не дублирует
  let accs = await listAccounts();
  assert.equal(accs.length, 1);
  const cash = accs[0].id!;

  const uz = await addAccount({ name: 'Uzcard', kind: 'card', initialBalance: 1_000_000 });
  const credit = await addAccount({ name: 'Кредитка', kind: 'card', initialBalance: -500_000 });
  await assert.rejects(addAccount({ name: 'uzcard', kind: 'card', initialBalance: 0 }), UserError);

  const d = (dd: number, h = 12) => new Date(2026, 9, dd, h).getTime();
  const t1 = await addTx({ type: 'expense', amount: 50_000, category: 'Транспорт', note: '', accountId: uz, occurredAt: d(28) });
  await addTx({ type: 'income', amount: 5_000_000, category: 'Зарплата', note: '', accountId: uz, occurredAt: d(27) });
  const t3 = await addTx({ type: 'expense', amount: 20_000, category: 'Кафе и еда', note: '', accountId: cash, occurredAt: d(27) });
  await assert.rejects(addTx({ type: 'expense', amount: 0, category: 'X', note: '', accountId: cash, occurredAt: d(27) }), UserError);

  let b = await balances();
  assert.equal(b.get(uz), 1_000_000 - 50_000 + 5_000_000);
  assert.equal(b.get(cash), -20_000);
  assert.equal(b.get(credit), -500_000);

  // Статистика за 27 октября (забытая операция с прошлой датой)
  let s = await getStats(d(27, 0), d(28, 0));
  assert.deepEqual([s.expense, s.income], [20_000, 5_000_000]);
  s = await getStats(d(27, 0), d(28, 0), uz);
  assert.deepEqual([s.expense, s.income], [0, 5_000_000]);

  // Правка: расход становится доходом и переезжает на другой день и счёт
  await updateTx(t1, { type: 'income', amount: 60_000, category: 'Прочее', note: '', accountId: cash, occurredAt: d(26) });
  b = await balances();
  assert.equal(b.get(uz), 6_000_000);
  assert.equal(b.get(cash), 40_000);
  // Возврат значений — остатки прежние
  await updateTx(t1, { type: 'expense', amount: 50_000, category: 'Транспорт', note: '', accountId: uz, occurredAt: d(28) });
  b = await balances();
  assert.equal(b.get(uz), 5_950_000);
  assert.equal(b.get(cash), -20_000);

  // Сверка: корректировка меняет остаток, но не статистику
  const diff = await reconcile(uz, 5_900_000);
  assert.equal(diff, -50_000);
  b = await balances();
  assert.equal(b.get(uz), 5_900_000);
  s = await getStats(0, Date.now() + 1e9);
  assert.deepEqual([s.expense, s.income], [70_000, 5_000_000]);
  assert.equal(await reconcile(uz, 5_900_000), 0);

  // Удаление
  await deleteTx(t3);
  b = await balances();
  assert.equal(b.get(cash), 0);

  // Счёт с операциями архивируется, без операций — удаляется
  assert.equal(await removeAccount(credit), 'deleted');
  await setDefaultAccount(uz);
  assert.equal(await removeAccount(uz), 'archived');
  accs = await listAccounts();
  assert.deepEqual(accs.map((a) => a.id), [cash]);
  assert.equal(accs[0].isDefault, 1);
  await assert.rejects(removeAccount(cash), UserError);

  // Категории: переименование и удаление с переносом
  await renameCategory('expense', 'Транспорт', 'Такси и транспорт');
  let cats = await listCategories();
  assert.ok(cats.expense.includes('Такси и транспорт'));
  s = await getStats(0, Date.now() + 1e9);
  assert.equal(s.byCategory[0].category, 'Такси и транспорт');
  await deleteCategory('expense', 'Такси и транспорт', 'Другое');
  s = await getStats(0, Date.now() + 1e9);
  assert.equal(s.byCategory[0].category, 'Другое');

  // Копия: экспорт → чистая база → импорт
  const backup = JSON.parse(JSON.stringify(await exportBackup()));
  const before = [...(await balances()).entries()];
  useDatabase(new ManiDB('test-restore-' + Math.random()));
  await ensureSeed();
  const r = await importBackup(backup);
  assert.equal(r.transactions, 3);
  assert.deepEqual([...(await balances()).entries()], before);
  await assert.rejects(importBackup({ hello: 1 }), UserError);

  const csv = await exportCsv();
  assert.ok(csv.startsWith('﻿Дата;Тип;Сумма'));
  assert.equal(csv.split('\r\n').length, 4);

  console.log('db: все проверки пройдены');
}
main().catch((e) => { console.error(e); process.exit(1); });
