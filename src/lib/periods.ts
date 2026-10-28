export type Period = 'day' | 'week' | 'month' | 'year';

export const PERIOD_LABELS: Record<Period, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  year: 'Год',
};

/**
 * Границы периода [from, to) в мс по локальному времени. Неделя с понедельника.
 * offset: 0 — текущий период, -1 — прошлый и т. д.
 */
export function periodRange(period: Period, now: Date = new Date(), offset = 0): [number, number] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (period) {
    case 'day':
      return [new Date(y, m, d + offset).getTime(), new Date(y, m, d + offset + 1).getTime()];
    case 'week': {
      const start = d - ((now.getDay() + 6) % 7) + offset * 7;
      return [new Date(y, m, start).getTime(), new Date(y, m, start + 7).getTime()];
    }
    case 'month':
      return [new Date(y, m + offset, 1).getTime(), new Date(y, m + offset + 1, 1).getTime()];
    case 'year':
      return [new Date(y + offset, 0, 1).getTime(), new Date(y + offset + 1, 0, 1).getTime()];
  }
}

const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** Подпись периода: «28 октября», «26 окт – 1 ноя», «Октябрь 2026», «2026». */
export function periodTitle(period: Period, range: [number, number]): string {
  const a = new Date(range[0]);
  const b = new Date(range[1] - 1);
  switch (period) {
    case 'day':
      return `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} ${a.getFullYear()}`;
    case 'week':
      return `${a.getDate()} ${MONTHS_GEN[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()].slice(0, 3)}`;
    case 'month':
      return `${MONTHS_NOM[a.getMonth()]} ${a.getFullYear()}`;
    case 'year':
      return String(a.getFullYear());
  }
}

export { MONTHS_GEN };

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** Корзины для графика: неделя и месяц — по дням, год — по месяцам, день — по 6 часов. */
export function periodBuckets(period: Period, range: [number, number]): { range: [number, number]; label: string; full: string }[] {
  const start = new Date(range[0]);
  const y = start.getFullYear();
  const m = start.getMonth();
  const d = start.getDate();
  const out: { range: [number, number]; label: string; full: string }[] = [];
  if (period === 'year') {
    for (let i = 0; i < 12; i++) {
      out.push({
        range: [new Date(y, i, 1).getTime(), new Date(y, i + 1, 1).getTime()],
        label: MONTHS_SHORT[i][0].toUpperCase(),
        full: `${MONTHS_SHORT[i]} ${y}`,
      });
    }
  } else if (period === 'day') {
    for (let h = 0; h < 24; h += 6) {
      out.push({
        range: [new Date(y, m, d, h).getTime(), new Date(y, m, d, h + 6).getTime()],
        label: `${h}–${h + 6}`,
        full: `${String(h).padStart(2, '0')}:00–${String(h + 6).padStart(2, '0')}:00`,
      });
    }
  } else {
    for (let i = 0; ; i++) {
      const a = new Date(y, m, d + i);
      if (a.getTime() >= range[1]) break;
      out.push({
        range: [a.getTime(), new Date(y, m, d + i + 1).getTime()],
        label: period === 'week' ? WEEKDAYS_SHORT[a.getDay()] : String(a.getDate()),
        full: `${a.getDate()} ${MONTHS_GEN[a.getMonth()]}, ${WEEKDAYS_SHORT[a.getDay()]}`,
      });
    }
  }
  return out;
}
