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
