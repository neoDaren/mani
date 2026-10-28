import assert from 'node:assert/strict';
import { extractDate } from '../src/lib/dates';
import { periodRange } from '../src/lib/periods';
import { parseRequest } from '../src/lib/request';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../src/lib/categories';

// Среда, 28 октября 2026, 15:00
const now = new Date(2026, 9, 28, 15, 0);
const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

const dates: [string, number | null][] = [
  ['вчера такси 20 тысяч', day(2026, 9, 27)],
  ['позавчера обед 45к', day(2026, 9, 26)],
  ['в пятницу купил продукты 100 тысяч', day(2026, 9, 23)],
  ['в среду кофе 20к', day(2026, 9, 28)],
  ['3 октября аренда 2 млн', day(2026, 9, 3)],
  ['15 декабря подарок 300к', day(2025, 11, 15)],
  ['5 числа интернет 100 тысяч', day(2026, 9, 5)],
  ['такси 20 тысяч', null],
];
for (const [phrase, want] of dates) {
  const got = extractDate(phrase, now);
  assert.equal(got ? got.day.getTime() : null, want, `Дата: «${phrase}»`);
}

const accounts = [
  { id: 1, name: 'Наличные', kind: 'cash', isDefault: 0 as const },
  { id: 2, name: 'Uzcard', kind: 'card', isDefault: 1 as const },
  { id: 3, name: 'Humo', kind: 'card', isDefault: 0 as const },
  { id: 4, name: 'Payme', kind: 'wallet', isDefault: 0 as const },
];
const ctx = { accounts, categories: { expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES }, now };

const reqs: [string, Partial<ReturnType<typeof parseRequest>>][] = [
  ['Мани, добавь расход 50 тысяч на такси', { type: 'expense', amount: 50000, category: 'Транспорт', accountId: 2 }],
  ['3 октября заплатил аренду 2 миллиона с Humo', { amount: 2000000, category: 'Жильё', accountId: 3, occurredAt: new Date(2026, 9, 3, 12).getTime() }],
  ['вчера забыл записать: такси 20 тысяч наличными', { amount: 20000, accountId: 1, occurredAt: new Date(2026, 9, 27, 12).getTime() }],
  ['пришла зарплата 5 миллионов на хумо', { type: 'income', amount: 5000000, category: 'Зарплата', accountId: 3 }],
  ['обед 45000 через payme', { amount: 45000, category: 'Кафе и еда', accountId: 4 }],
  ['кофе 25к', { amount: 25000, accountId: 2, occurredAt: now.getTime() }],
];
for (const [phrase, want] of reqs) {
  const got = parseRequest(phrase, ctx);
  for (const [k, v] of Object.entries(want)) {
    assert.equal((got as any)[k], v, `Запрос «${phrase}»: поле ${k}`);
  }
}

// Неделя с понедельника, прошлый месяц
const [wf] = periodRange('week', now);
assert.equal(wf, day(2026, 9, 26));
const [mf, mt] = periodRange('month', now, -1);
assert.equal(mf, day(2026, 8, 1));
assert.equal(mt, day(2026, 9, 1));
const [yf] = periodRange('year', new Date(2026, 0, 1), 0);
assert.equal(yf, day(2026, 0, 1));
// Воскресенье — ещё та же неделя
assert.equal(periodRange('week', new Date(2026, 10, 1, 23))[0], day(2026, 9, 26));

console.log(`request: ${dates.length + reqs.length + 5} проверок пройдено`);
assert.equal(parseRequest('такси 30 тысяч с узкарта', ctx).accountId, 2);
assert.equal(parseRequest('кофе 20к пейми', ctx).accountId, 4);
const notes: [string, string][] = [
  ['Мани, добавь расход 50 тысяч на такси с Uzcard', 'Такси'],
  ['вчера обед 45к наличными', 'Обед'],
  ['пришла зарплата 5 млн на узкард', 'Зарплата'],
  ['купил подарок маме 300 тысяч', 'Подарок маме'],
  ['50000', ''],
];
for (const [phrase, want] of notes) assert.equal(parseRequest(phrase, ctx).note, want, `Заметка «${phrase}»`);
console.log('notes ok');
import { parseTransfer } from '../src/lib/request';
const tr: [string, { from: number | null; to: number | null; amount: number } | null][] = [
  ['перевёл 500 тысяч с Uzcard на Humo', { from: 2, to: 3, amount: 500000 }],
  ['перевел на хумо с узкарта 200к', { from: 2, to: 3, amount: 200000 }],
  ['скинул 100 тысяч с payme на humo', { from: 4, to: 3, amount: 100000 }],
  ['снял 300к с хумо', { from: 3, to: 1, amount: 300000 }],
  ['перекинул 50к с наличных на пейми', { from: 1, to: 4, amount: 50000 }],
  ['такси 20 тысяч с humo', null],
];
for (const [phrase, want] of tr) {
  const got = parseTransfer(phrase, ctx);
  assert.deepEqual(got && { from: got.from, to: got.to, amount: got.amount }, want, `Перевод «${phrase}»`);
}
console.log('transfers parse ok');
