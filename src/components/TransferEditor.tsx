import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { addTransfer, balances, deleteTx, listAccounts, updateTransfer } from '../db';
import { fromDateInput, timeForDay, toDateInput } from '../lib/dates';
import { formatMoney } from '../lib/format';
import { AmountInput, errorText, Sheet, useToast } from './ui';

export interface TransferValue {
  id?: number;
  from: number | null;
  to: number | null;
  amount: number | null;
  occurredAt: number;
  note: string;
}

/** Перевод между своими счетами: не расход и не доход */
export function TransferEditor({ initial, onClose }: { initial: TransferValue; onClose: () => void }) {
  const toast = useToast();
  const data = useLiveQuery(async () => ({ accounts: await listAccounts(true), bal: await balances() }), []);
  const [v, setV] = useState<TransferValue>(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<TransferValue>) => { setError(null); setV({ ...v, ...patch }); };

  const visible = (data?.accounts ?? []).filter((a) => a.archivedAt === null || a.id === v.from || a.id === v.to);
  const name = (id: number | null) => data?.accounts.find((a) => a.id === id)?.name;

  const save = async () => {
    if (!v.from) return setError('Выберите, откуда перевести');
    if (!v.to) return setError('Выберите, куда перевести');
    if (v.from === v.to) return setError('Выберите два разных счёта');
    if (!v.amount || v.amount <= 0) return setError('Введите сумму');
    const t = { from: v.from, to: v.to, amount: v.amount, occurredAt: v.occurredAt, note: v.note.trim() };
    try {
      if (v.id) await updateTransfer(v.id, t);
      else await addTransfer(t);
      toast(`${name(v.from)} → ${name(v.to)}: ${formatMoney(v.amount)}`);
      onClose();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const chips = (selected: number | null, onPick: (id: number) => void, disabled?: number | null) => (
    <div className="chips">
      {visible.map((a) => (
        <button
          key={a.id}
          className={`chip ${a.id === selected ? 'on' : ''}`}
          disabled={a.id === disabled}
          onClick={() => onPick(a.id!)}
        >
          {a.name} <span className="chip-sub">{formatMoney(data?.bal.get(a.id!) ?? 0)}</span>
        </button>
      ))}
    </div>
  );

  return (
    <Sheet title={v.id ? 'Изменить перевод' : 'Перевод'} onClose={onClose}>
      <div className="field">
        <div className="label">Откуда</div>
        {chips(v.from, (id) => set({ from: id, to: v.to === id ? null : v.to }))}
      </div>
      <div className="field">
        <div className="label">Куда</div>
        {chips(v.to, (id) => set({ to: id }), v.from)}
      </div>
      <div className="field">
        <AmountInput value={v.amount} onChange={(amount) => set({ amount })} autoFocus={!v.amount} />
      </div>
      <div className="field">
        <div className="label">Дата</div>
        <input
          className="input"
          type="date"
          value={toDateInput(v.occurredAt)}
          max={toDateInput(Date.now())}
          onChange={(e) => {
            if (e.target.value && e.target.value !== toDateInput(v.occurredAt)) {
              set({ occurredAt: timeForDay(fromDateInput(e.target.value)) });
            }
          }}
        />
      </div>

      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={save}>{v.id ? 'Сохранить' : 'Перевести'}</button>

      {v.id && !confirmDelete && (
        <button className="btn danger" style={{ marginTop: 8 }} onClick={() => setConfirmDelete(true)}>Удалить перевод</button>
      )}
      {v.id && confirmDelete && (
        <div className="btns" style={{ marginTop: 8 }}>
          <button className="btn secondary" onClick={() => setConfirmDelete(false)}>Отмена</button>
          <button className="btn" style={{ background: 'var(--danger)' }} onClick={async () => {
            await deleteTx(v.id!);
            toast('Перевод удалён');
            onClose();
          }}>Да, удалить</button>
        </div>
      )}
    </Sheet>
  );
}
