import assert from 'node:assert/strict';
import { parsePhrase } from '../src/lib/parser';

type Case = [string, { type: string; amount: number; category: string }];

const cases: Case[] = [
  ['Мани, добавь расход 50 тысяч на такси', { type: 'expense', amount: 50000, category: 'Транспорт' }],
  ['потратил 50к на еду', { type: 'expense', amount: 50000, category: 'Кафе и еда' }],
  ['пятьдесят тысяч такси', { type: 'expense', amount: 50000, category: 'Транспорт' }],
  ['Мани добавь доход 1.5 млн зарплата', { type: 'income', amount: 1500000, category: 'Зарплата' }],
  ['получил полтора миллиона за проект', { type: 'income', amount: 1500000, category: 'Бизнес' }],
  ['купил продукты за 120 000 сум', { type: 'expense', amount: 120000, category: 'Продукты' }],
  ['расход 2 миллиона 300 тысяч аренда квартиры', { type: 'expense', amount: 2300000, category: 'Жильё' }],
  ['заплатил двадцать пять тысяч за интернет', { type: 'expense', amount: 25000, category: 'Связь' }],
  ['начисли 3 лям премию', { type: 'income', amount: 3000000, category: 'Зарплата' }],
  ['купил 2 кг яблок за 40 тысяч', { type: 'expense', amount: 40000, category: 'Другое' }],
  ['потратил 15000 в аптеке', { type: 'expense', amount: 15000, category: 'Здоровье' }],
  ['сто двадцать тысяч кроссовки', { type: 'expense', amount: 120000, category: 'Одежда' }],
  ['Мани, добавь 30 тысяч кофе', { type: 'expense', amount: 30000, category: 'Кафе и еда' }],
];

for (const [phrase, want] of cases) {
  const got = parsePhrase(phrase);
  assert.deepEqual(
    { type: got.type, amount: got.amount, category: got.category },
    want,
    `Фраза: «${phrase}»`,
  );
}

assert.equal(parsePhrase('привет как дела').amount, 0);
assert.equal(parsePhrase('добавь 10 тысяч').typeGuessed, true);
assert.equal(parsePhrase('расход 10 тысяч').typeGuessed, false);

console.log(`OK: ${cases.length + 3} проверок парсера пройдено`);
