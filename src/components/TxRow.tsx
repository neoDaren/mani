import type { Account, Tx } from '../db';
import { formatMoney } from '../lib/format';

const CAT_ICONS: Record<string, string> = {
  'Транспорт': '🚕', 'Продукты': '🛒', 'Кафе и еда': '🍽️', 'Связь': '📶', 'Жильё': '🏠',
  'Здоровье': '💊', 'Одежда': '👕', 'Развлечения': '🎬', 'Образование': '📚', 'Подарки': '🎁',
  'Другое': '📦', 'Зарплата': '💼', 'Бизнес': '📈', 'Подарок': '🎁', 'Возврат': '↩️',
  'Прочее': '💰', 'Корректировка': '⚖️', 'Перевод': '⇄',
};

export function txTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function TxRow({ t, account, onClick, nameOf, perspective }: {
  t: Tx;
  account?: Account;
  onClick?: () => void;
  /** Название счёта по id — для подписи перевода «Uzcard → Humo» */
  nameOf?: (id: number) => string | undefined;
  /** Счёт, с точки зрения которого показывать знак перевода */
  perspective?: number;
}) {
  if (t.type === 'transfer') {
    const sign = perspective === undefined ? '' : perspective === t.accountId ? '−' : '+';
    return (
      <button className="item" onClick={onClick} disabled={!onClick}>
        <span className="ico transfer-ico">⇄</span>
        <span className="main">
          <div className="name">Перевод</div>
          <div className="sub">{nameOf?.(t.accountId) ?? '?'} → {nameOf?.(t.toAccountId!) ?? '?'}</div>
        </span>
        <span className="num">{sign}{formatMoney(t.amount)}</span>
      </button>
    );
  }
  const sign = t.type === 'expense' ? '−' : t.amount >= 0 ? '+' : '−';
  const cls = t.type === 'expense' ? 'expense' : t.type === 'income' ? 'income' : 'muted';
  const sub = [t.note && t.note.toLowerCase() !== t.category.toLowerCase() ? t.note : null, account?.name]
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
