// Разбор фразы в черновик операции: тип, сумма, категория, счёт, дата, заметка.
// В v0.4 этот модуль заменит встроенная модель; интерфейс Draft останется прежним.
import { DEFAULT_EXPENSE, DEFAULT_INCOME } from './categories';
import { extractDate, timeForDay } from './dates';
import { parsePhrase } from './parser';

export type EntryType = 'expense' | 'income';

export interface AccountRef {
  id: number;
  name: string;
  kind: string;
  isDefault: 0 | 1;
}

export interface Draft {
  type: EntryType;
  amount: number;
  category: string;
  note: string;
  accountId: number | null;
  occurredAt: number;
  typeGuessed: boolean;
  /** Названный в запросе счёт не найден среди счетов */
  unknownAccount?: string;
}

const CASH_WORDS = /(^|[^\p{L}])(налич\p{L}*|нал|кэш\p{L}*|кеш\p{L}*|cash)([^\p{L}]|$)/u;

function norm(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').trim();
}

// Диктовка пишет латинские названия кириллицей: «хумо», «узкард», «пейми»
const LAT2CYR: [RegExp, string][] = [
  [/sh/g, 'ш'], [/ch/g, 'ч'], [/ya/g, 'я'], [/yu/g, 'ю'], [/ay/g, 'ай'], [/ey/g, 'ей'],
  [/a/g, 'а'], [/b/g, 'б'], [/c/g, 'к'], [/d/g, 'д'], [/e/g, 'е'], [/f/g, 'ф'], [/g/g, 'г'],
  [/h/g, 'х'], [/i/g, 'и'], [/j/g, 'дж'], [/k/g, 'к'], [/l/g, 'л'], [/m/g, 'м'], [/n/g, 'н'],
  [/o/g, 'о'], [/p/g, 'п'], [/q/g, 'к'], [/r/g, 'р'], [/s/g, 'с'], [/t/g, 'т'], [/u/g, 'у'],
  [/v/g, 'в'], [/w/g, 'в'], [/x/g, 'кс'], [/y/g, 'й'], [/z/g, 'з'],
];
const KNOWN_ALIASES: Record<string, string[]> = {
  payme: ['пейми', 'пэйми', 'пайми', 'пеймик'],
  click: ['клик'],
  uzcard: ['узкарт', 'узкарта'],
  visa: ['виза', 'визе', 'визой'],
  mastercard: ['мастеркард', 'мастер'],
};

function variants(name: string): string[] {
  const n = norm(name);
  let cyr = n;
  for (const [re, to] of LAT2CYR) cyr = cyr.replace(re, to);
  return [...new Set([n, cyr, ...(KNOWN_ALIASES[n] ?? [])])];
}

export function findAccount(text: string, accounts: AccountRef[]): AccountRef | null {
  const t = norm(text);
  const words = t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  // Точное вхождение названия («с Uzcard», «на Humo»), длинные названия первыми
  const byLength = [...accounts].sort((a, b) => b.name.length - a.name.length);
  for (const a of byLength) {
    if (variants(a.name).some((v) => v.length >= 2 && t.includes(v))) return a;
  }
  // Падежи и опечатки: слово начинается с первых 4 букв названия («хумо» / «хумой»)
  for (const a of byLength) {
    for (const v of variants(a.name)) {
      const stem = v.slice(0, 4);
      if (stem.length >= 4 && words.some((w) => w.startsWith(stem))) return a;
    }
  }
  if (CASH_WORDS.test(t)) return accounts.find((a) => a.kind === 'cash') ?? null;
  return null;
}

/** Слово после «с»/«на»/«картой», похожее на название счёта, которого нет в списке */
function guessUnknownAccount(text: string): string | undefined {
  const m = text.match(/(?:с|со|на)\s+(?:карты|карту|кошелька)\s+([\p{L}\d-]{3,})/iu)
    ?? text.match(/(?:картой|карты|карту)\s+([A-Za-z][\w-]{2,})/u);
  return m?.[1];
}

const NOISE = new RegExp(
  '^(мани|мэни|мони|money|добавь|добавить|запиши|записать|внеси|забыл|забыла|' +
  'расход\\p{L}*|доход\\p{L}*|потратил\\p{L}*|купил\\p{L}*|заплатил\\p{L}*|оплатил\\p{L}*|' +
  'получил\\p{L}*|пришл\\p{L}*|поступил\\p{L}*|начисл\\p{L}*|заработал\\p{L}*|' +
  'на|в|во|с|со|за|из|от|по|и|а|через|картой|карты|карту|' +
  'сум|сума|сумов|сумы|тысяч\\p{L}*|тыс|тыщ\\p{L}*|к|k|млн|миллион\\p{L}*|лям\\p{L}*|' +
  'налич\\p{L}*|нал|кэш\\p{L}*|кеш\\p{L}*|' +
  'ноль|один|одна|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|' +
  'одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|' +
  'восемнадцать|девятнадцать|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|' +
  'восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|' +
  'восемьсот|девятьсот|полтора|полторы)$',
  'u',
);

/** Заметка — смысловые слова фразы без команды, суммы, даты и счёта: «такси», «обед с друзьями» */
function buildNote(text: string, account: AccountRef | null): string {
  const accWords = account ? variants(account.name).map((v) => v.slice(0, 4)) : [];
  const words = text.split(/[\s,.:;!?]+/).filter((w) => {
    const n = norm(w);
    if (!n || /\d/.test(n)) return false;
    if (NOISE.test(n)) return false;
    if (accWords.some((a) => a.length >= 4 && n.startsWith(a))) return false;
    return true;
  });
  const note = words.join(' ').trim();
  return note ? note[0].toUpperCase() + note.slice(1) : '';
}

export function parseRequest(
  text: string,
  ctx: { accounts: AccountRef[]; categories: { expense: string[]; income: string[] }; now?: Date },
): Draft {
  const now = ctx.now ?? new Date();
  const date = extractDate(text, now);
  const parsed = parsePhrase(date ? date.rest : text);

  const list = parsed.type === 'expense' ? ctx.categories.expense : ctx.categories.income;
  const fallback = parsed.type === 'expense' ? DEFAULT_EXPENSE : DEFAULT_INCOME;
  const category = list.includes(parsed.category)
    ? parsed.category
    : list.includes(fallback)
      ? fallback
      : (list[0] ?? fallback);

  const named = findAccount(text, ctx.accounts);
  const def = ctx.accounts.find((a) => a.isDefault) ?? ctx.accounts[0] ?? null;

  return {
    type: parsed.type,
    amount: parsed.amount,
    category,
    note: buildNote(date ? date.rest : text, named),
    accountId: (named ?? def)?.id ?? null,
    occurredAt: date ? timeForDay(date.day, now) : now.getTime(),
    typeGuessed: parsed.typeGuessed,
    unknownAccount: named ? undefined : guessUnknownAccount(text),
  };
}
