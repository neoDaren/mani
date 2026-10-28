// Распознавание даты операции во фразе: «вчера», «позавчера», «в пятницу», «3 октября», «3 числа».

const MONTH_STEMS = ['янв', 'фев', 'мар', 'апр', 'ма', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS: [RegExp, number][] = [
  [/^понедельник\p{L}*$/u, 1],
  [/^вторник\p{L}*$/u, 2],
  [/^сред[ау]$/u, 3],
  [/^четверг\p{L}*$/u, 4],
  [/^пятниц[ау]$/u, 5],
  [/^суббот[ау]$/u, 6],
  [/^воскресень[ея]$/u, 0],
];

export interface DateMatch {
  /** Полночь найденного дня по локальному времени */
  day: Date;
  /** Фраза без слов даты — чтобы число дня не приняли за сумму */
  rest: string;
}

function monthIndex(token: string): number {
  if (/^ма[йя]$/.test(token)) return 4;
  if (token.startsWith('мар')) return 2;
  for (let i = 0; i < MONTH_STEMS.length; i++) {
    if (i === 4) continue;
    if (token.startsWith(MONTH_STEMS[i]) && token.length >= 3) return i;
  }
  return -1;
}

export function extractDate(text: string, now: Date = new Date()): DateMatch | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (days: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  const lower = text.toLowerCase().replace(/ё/g, 'е');
  const strip = (re: RegExp) => text.replace(re, ' ').replace(/\s{2,}/g, ' ').trim();

  if (/(^|[^\p{L}])позавчера([^\p{L}]|$)/u.test(lower)) {
    return { day: shift(-2), rest: strip(/позавчера/iu) };
  }
  if (/(^|[^\p{L}])вчера([^\p{L}]|$)/u.test(lower)) {
    return { day: shift(-1), rest: strip(/вчера(шн\p{L}*)?/iu) };
  }
  if (/(^|[^\p{L}])сегодня([^\p{L}]|$)/u.test(lower)) {
    return { day: today, rest: strip(/сегодня/iu) };
  }

  // «3 октября», «3-го октября»
  const dm = lower.match(/(^|[^\d])(\d{1,2})(?:-?го)?\s+(\p{L}+)/u);
  if (dm) {
    const day = Number(dm[2]);
    const month = monthIndex(dm[3]);
    if (month >= 0 && day >= 1 && day <= 31) {
      let date = new Date(today.getFullYear(), month, day);
      if (date > today) date = new Date(today.getFullYear() - 1, month, day);
      const re = new RegExp(`${dm[2]}(?:-?го)?\\s+${dm[3]}`, 'iu');
      return { day: date, rest: strip(re) };
    }
  }

  // «3 числа», «3-го числа» — текущий месяц, если день ещё не наступил — прошлый
  const dn = lower.match(/(^|[^\d])(\d{1,2})(?:-?го)?\s+числа/u);
  if (dn) {
    const day = Number(dn[2]);
    let date = new Date(today.getFullYear(), today.getMonth(), day);
    if (date > today) date = new Date(today.getFullYear(), today.getMonth() - 1, day);
    return { day: date, rest: strip(new RegExp(`${dn[2]}(?:-?го)?\\s+числа`, 'iu')) };
  }

  // «в пятницу» — последний такой день, не позже сегодняшнего
  const words = lower.split(/[^\p{L}]+/u);
  for (const w of words) {
    for (const [re, wd] of WEEKDAYS) {
      if (re.test(w)) {
        const back = (today.getDay() - wd + 7) % 7;
        return { day: shift(-back), rest: strip(new RegExp(`(во?\\s+)?${w}`, 'iu')) };
      }
    }
  }
  return null;
}

/** Время операции для выбранного дня: сегодня — текущее время, другой день — 12:00. */
export function timeForDay(day: Date, now: Date = new Date()): number {
  const sameDay =
    day.getFullYear() === now.getFullYear() &&
    day.getMonth() === now.getMonth() &&
    day.getDate() === now.getDate();
  if (sameDay) return now.getTime();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTime();
}

/** yyyy-mm-dd по локальному времени — для <input type="date"> */
export function toDateInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}
