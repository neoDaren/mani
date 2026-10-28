import {
  DEFAULT_EXPENSE,
  DEFAULT_INCOME,
  EXPENSE_RULES,
  INCOME_RULES,
  TxType,
} from './categories';

export interface ParsedEntry {
  type: TxType;
  amount: number; // 0 если сумма не распознана
  category: string;
  note: string;
  typeGuessed: boolean; // тип не назван явно, взят «расход» по умолчанию
}

const NUMBER_WORDS: Record<string, number> = {
  ноль: 0, один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5,
  шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11,
  двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15,
  шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
  двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60,
  семьдесят: 70, восемьдесят: 80, девяносто: 90, сто: 100, двести: 200,
  триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700,
  восемьсот: 800, девятьсот: 900, полтора: 1.5, полторы: 1.5,
};

const CURRENCY = /^(сум|сума|сумов|сумы|сумма|som|uzs|so'm)$/;
const INCOME_STEMS = [
  'доход', 'получил', 'получила', 'зарплат', 'начисл', 'заработал', 'заработала',
  'пришл', 'поступил', 'аванс', 'премию', 'выручк', 'кэшбэк', 'кешбэк', 'пополн',
  'перевели', 'вернул', 'вернули',
];
const EXPENSE_STEMS = [
  'расход', 'потратил', 'потратила', 'купил', 'купила', 'заплатил', 'заплатила',
  'оплатил', 'оплатила', 'отдал', 'отдала', 'списал', 'трата', 'затрат', 'минус',
];

function multiplierOf(token: string): number {
  if (/^(тысяч\p{L}*|тыс|тыща\p{L}*)$/u.test(token)) return 1e3;
  if (/^(миллион\p{L}*|млн|лям\p{L}*)$/u.test(token)) return 1e6;
  if (/^(миллиард\p{L}*|млрд)$/u.test(token)) return 1e9;
  return 0;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/(\d)[  ](?=\d{3}(?!\d))/g, '$1') // «50 000» -> «50000»
    .replace(/(\d)(?=\p{L})/gu, '$1 '); // «50к», «1.5млн» -> «50 к», «1.5 млн»
}

function tokenize(text: string): string[] {
  return text
    .split(/[^\p{L}\p{N}.,']+/u)
    .map((t) => t.replace(/^[.,]+|[.,]+$/g, ''))
    .filter(Boolean);
}

interface Run {
  value: number;
  hasMultiplier: boolean;
  nextToken: string;
}

export function extractAmount(text: string): number {
  const tokens = tokenize(normalize(text));
  const runs: Run[] = [];

  let active = false;
  let total = 0;
  let current = 0;
  let hasMult = false;
  let lastWasNumber = false;

  const close = (next: string) => {
    if (active && total + current > 0) {
      runs.push({ value: total + current, hasMultiplier: hasMult, nextToken: next });
    }
    active = false;
    total = 0;
    current = 0;
    hasMult = false;
    lastWasNumber = false;
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const mult = multiplierOf(t) || ((t === 'к' || t === 'k') && lastWasNumber ? 1e3 : 0);

    if (/^\d+(?:[.,]\d+)?$/.test(t) || t in NUMBER_WORDS) {
      const value = t in NUMBER_WORDS ? NUMBER_WORDS[t] : parseFloat(t.replace(',', '.'));
      active = true;
      current += value;
      lastWasNumber = true;
    } else if (mult) {
      active = true;
      total += (current || 1) * mult;
      current = 0;
      hasMult = true;
      lastWasNumber = false;
    } else {
      close(t);
    }
  }
  close('');

  if (runs.length === 0) return 0;
  const pick =
    runs.find((r) => CURRENCY.test(r.nextToken)) ??
    runs.filter((r) => r.hasMultiplier).sort((a, b) => b.value - a.value)[0] ??
    [...runs].sort((a, b) => b.value - a.value)[0];
  return Math.round(pick.value);
}

function matches(token: string, stem: string): boolean {
  return stem.startsWith('=') ? token === stem.slice(1) : token.startsWith(stem);
}

function detectType(tokens: string[]): { type: TxType; guessed: boolean } {
  for (const t of tokens) {
    if (INCOME_STEMS.some((s) => t.startsWith(s))) return { type: 'income', guessed: false };
    if (EXPENSE_STEMS.some((s) => t.startsWith(s))) return { type: 'expense', guessed: false };
  }
  return { type: 'expense', guessed: true };
}

function detectCategory(tokens: string[], type: TxType): string {
  const rules = type === 'expense' ? EXPENSE_RULES : INCOME_RULES;
  for (const [name, stems] of rules) {
    if (tokens.some((t) => stems.some((s) => matches(t, s)))) return name;
  }
  return type === 'expense' ? DEFAULT_EXPENSE : DEFAULT_INCOME;
}

function cleanNote(text: string): string {
  const note = text
    .trim()
    .replace(/^(?:(?:мани|мэни|мони|money)[\s,:!]+)?(?:(?:добавь|добавить|запиши|записать|внеси)\s+)?/i, '')
    .trim();
  return note ? note[0].toUpperCase() + note.slice(1) : '';
}

export function parsePhrase(text: string): ParsedEntry {
  const tokens = tokenize(normalize(text));
  const { type, guessed } = detectType(tokens);
  return {
    type,
    amount: extractAmount(text),
    category: detectCategory(tokens, type),
    note: cleanNote(text),
    typeGuessed: guessed,
  };
}
