import type { Account, Tx } from '../db';
import { formatMoney } from '../lib/format';

const CAT_ICONS: Record<string, string> = {
  'Транспорт': '🚕', 'Продукты': '🛒', 'Кафе и еда': '🍽️', 'Связь': '📶', 'Жильё': '🏠',
  'Здоровье': '💊', 'Одежда': '👕', 'Развлечения': '🎬', 'Образование': '📚', 'Подарки': '🎁',
  'Другое': '📦', 'Зарплата': '💼', 'Бизнес': '📈', 'Подарок': '🎁', 'Возврат': '↩️',
  'Прочее': '💰', 'Корректировка': '⚖️',
};

export function txTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function TxRow({ t, account, onClick, showTime = true }: {
  t: Tx; account?: Account; onClick?: () => void; showTime?: boolean;
}) {
  const sign = t.type === 'expense' ? '−' : t.amount >= 0 ? '+' : '−';
  const cls = t.type === 'expense' ? 'expense' : t.type === 'income' ? 'income' : 'muted';
  const sub = [t.note && t.note !== t.category ? t.note : null, account?.name, showTime ? txTime(t.occurredAt) : null]
    .filter(Boolean).join(' · ');
  return (
    <button className="item" onClick={onClick} disabled={!onClick}>
      <span className="ico">{CAT_ICONS[t.category] ?? (t.type === 'income' ? '💰' : '🏷️')}</span>
      <span className="main">
        <div className="name">{t.category}</div>
        {sub && <div className="sub">{sub}</div>}
      </span>
      <span className={`num ${cls}`}>{sign}{formatMoney(Math.abs(t.amount))}</span>
    </button>
  );
}
