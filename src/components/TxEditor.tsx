import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { addCategory, addTx, deleteTx, listAccounts, listCategories, updateTx, KIND_ICONS, type Tx } from '../db';
import { fromDateInput, timeForDay, toDateInput } from '../lib/dates';
import { formatMoney } from '../lib/format';
import { AmountInput, errorText, Sheet, useToast } from './ui';

export interface EditorValue {
  id?: number;
  type: 'expense' | 'income';
  amount: number | null;
  category: string;
  note: string;
  accountId: number | null;
  occurredAt: number;
}

/** Карточка операции: добавление, подтверждение разобранной фразы, правка и удаление */
export function TxEditor({
  initial, title, onClose, onSaved,
}: {
  initial: EditorValue;
  title: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const accounts = useLiveQuery(() => listAccounts(true), []);
  const categories = useLiveQuery(listCategories, []);
  const [v, setV] = useState<EditorValue>(initial);
  const [error, setError] = useState<string | null>(null);
  const [newCat, setNewCat] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<EditorValue>) => { setError(null); setV({ ...v, ...patch }); };
  const list = categories ? categories[v.type] : [];
  const visibleAccounts = (accounts ?? []).filter((a) => a.archivedAt === null || a.id === v.accountId);

  const switchType = (type: 'expense' | 'income') => {
    if (type === v.type) return;
    const other = categories?.[type] ?? [];
    const fallback = type === 'expense' ? 'Другое' : 'Прочее';
    set({ type, category: other.includes(fallback) ? fallback : (other[0] ?? fallback) });
  };

  const save = async () => {
    if (!v.amount || v.amount <= 0) return setError('Введите сумму больше нуля');
    if (!v.accountId) return setError('Выберите счёт');
    const tx: Omit<Tx, 'id' | 'createdAt'> = {
      type: v.type, amount: v.amount, category: v.category, note: v.note.trim(),
      accountId: v.accountId, occurredAt: v.occurredAt,
    };
    try {
      if (v.id) await updateTx(v.id, tx);
      else await addTx(tx);
      toast(`${v.id ? 'Изменено' : 'Сохранено'}: ${v.type === 'expense' ? '−' : '+'}${formatMoney(v.amount)}`);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const saveCategory = async () => {
    if (newCat === null) return;
    try {
      await addCategory(v.type, newCat);
      set({ category: newCat.trim() });
      setNewCat(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="field seg">
        <button className={v.type === 'expense' ? 'on' : ''} onClick={() => switchType('expense')}>Расход</button>
        <button className={v.type === 'income' ? 'on' : ''} onClick={() => switchType('income')}>Доход</button>
      </div>

      <div className="field">
        <AmountInput value={v.amount} onChange={(amount) => set({ amount })} autoFocus={!v.amount} />
      </div>

      <div className="field">
        <div className="label">Категория</div>
        <div className="chips">
          {list.map((c) => (
            <button key={c} className={`chip ${c === v.category ? 'on' : ''}`} onClick={() => set({ category: c })}>{c}</button>
          ))}
          {!list.includes(v.category) && v.category && <button className="chip on">{v.category}</button>}
          <button className="chip" onClick={() => setNewCat('')}>＋ Новая</button>
        </div>
        {newCat !== null && (
          <div className="row" style={{ marginTop: 10 }}>
            <input className="input" autoFocus placeholder="Название категории" value={newCat}
              onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveCategory()} />
            <button className="btn" style={{ width: 'auto' }} onClick={saveCategory}>OK</button>
          </div>
        )}
      </div>

      <div className="field">
        <div className="label">Счёт</div>
        <div className="chips">
          {visibleAccounts.map((a) => (
            <button key={a.id} className={`chip ${a.id === v.accountId ? 'on' : ''}`} onClick={() => set({ accountId: a.id! })}>
              {KIND_ICONS[a.kind]} {a.name}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="label">Дата</div>
        <input
          className="input"
          type="date"
          value={toDateInput(v.occurredAt)}
          max={toDateInput(Date.now())}
          onChange={(e) => {
            if (!e.target.value) return;
            const day = fromDateInput(e.target.value);
            const same = toDateInput(v.occurredAt) === e.target.value;
            if (!same) set({ occurredAt: timeForDay(day) });
          }}
        />
      </div>

      <div className="field">
        <div className="label">Заметка</div>
        <input className="input" value={v.note} placeholder="Необязательно" onChange={(e) => set({ note: e.target.value })} />
      </div>

      {error && <div className="error">{error}</div>}

      <button className="btn" onClick={save}>{v.id ? 'Сохранить изменения' : 'Сохранить'}</button>

      {v.id && !confirmDelete && (
        <button className="btn danger" style={{ marginTop: 8 }} onClick={() => setConfirmDelete(true)}>Удалить операцию</button>
      )}
      {v.id && confirmDelete && (
        <div className="btns" style={{ marginTop: 8 }}>
          <button className="btn secondary" onClick={() => setConfirmDelete(false)}>Отмена</button>
          <button className="btn" style={{ background: 'var(--danger)' }} onClick={async () => {
            await deleteTx(v.id!);
            toast('Операция удалена');
            onClose();
          }}>Да, удалить</button>
        </div>
      )}
    </Sheet>
  );
}
