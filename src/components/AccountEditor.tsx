import { useState } from 'react';
import {
  addAccount, reconcile, removeAccount, restoreAccount, setDefaultAccount, updateAccount,
  KIND_ICONS, KIND_LABELS, type Account, type AccountKind,
} from '../db';
import { formatMoney } from '../lib/format';
import { AmountInput, errorText, Sheet, useToast } from './ui';

const KINDS: AccountKind[] = ['card', 'cash', 'wallet', 'deposit', 'other'];

/** Создание и настройка счёта: карта, наличные, кошелёк, вклад или свой вариант */
export function AccountEditor({
  account, balance, onClose,
}: {
  account?: Account;
  balance?: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'card');
  const [initial, setInitial] = useState<number | null>(account ? account.initialBalance : null);
  const [error, setError] = useState<string | null>(null);
  const [actual, setActual] = useState<number | null>(null);
  const [mode, setMode] = useState<'edit' | 'reconcile' | 'remove'>('edit');

  const save = async () => {
    try {
      if (account) {
        await updateAccount(account.id!, { name, kind, initialBalance: initial ?? 0 });
        toast('Счёт сохранён');
      } else {
        await addAccount({ name, kind, initialBalance: initial ?? 0 });
        toast(`Счёт «${name.trim()}» добавлен`);
      }
      onClose();
    } catch (e) {
      setError(errorText(e));
    }
  };

  if (account && mode === 'reconcile') {
    const diff = actual === null ? null : actual - (balance ?? 0);
    return (
      <Sheet title={`Сверка: ${account.name}`} onClose={onClose}>
        <div className="card">
          <div className="muted small">В приложении сейчас</div>
          <div className="mid num">{formatMoney(balance ?? 0)}</div>
        </div>
        <div className="field">
          <div className="label">Сколько на самом деле (из банка или кошелька)</div>
          <AmountInput value={actual} onChange={setActual} allowNegative autoFocus />
        </div>
        {diff !== null && (
          <p className="hint" style={{ marginBottom: 14 }}>
            {diff === 0
              ? 'Остатки совпадают, корректировка не нужна.'
              : `Будет создана корректировка ${diff > 0 ? '+' : '−'}${formatMoney(Math.abs(diff))}. Она меняет остаток, но не попадает в расходы и доходы.`}
          </p>
        )}
        <div className="btns">
          <button className="btn secondary" onClick={() => setMode('edit')}>Назад</button>
          <button className="btn" disabled={actual === null || diff === 0} onClick={async () => {
            const d = await reconcile(account.id!, actual!);
            toast(`Остаток исправлен: ${d > 0 ? '+' : '−'}${formatMoney(Math.abs(d))}`);
            onClose();
          }}>Подтвердить</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={account ? account.name : 'Новый счёт'} onClose={onClose}>
      {account && (
        <div className="card row">
          <div>
            <div className="muted small">Остаток</div>
            <div className="mid num">{formatMoney(balance ?? 0)}</div>
          </div>
          {account.archivedAt === null && (
            <button className="btn secondary" style={{ width: 'auto' }} onClick={() => setMode('reconcile')}>Сверить</button>
          )}
        </div>
      )}

      <div className="field">
        <div className="label">Название</div>
        <input className="input" value={name} placeholder="Uzcard, Humo, Payme, Наличные…" autoFocus={!account}
          onChange={(e) => { setError(null); setName(e.target.value); }} />
      </div>

      <div className="field">
        <div className="label">Тип</div>
        <div className="chips">
          {KINDS.map((k) => (
            <button key={k} className={`chip ${k === kind ? 'on' : ''}`} onClick={() => setKind(k)}>
              {KIND_ICONS[k]} {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="label">{account ? 'Начальный остаток (на момент создания)' : 'Сколько сейчас на счёте'}</div>
        <AmountInput value={initial} onChange={setInitial} allowNegative />
        <p className="hint">Для кредитной карты с долгом нажмите «+», чтобы сделать остаток отрицательным.</p>
      </div>

      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={save}>{account ? 'Сохранить' : 'Добавить счёт'}</button>

      {account && account.archivedAt === null && !account.isDefault && (
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={async () => {
          await setDefaultAccount(account.id!);
          toast(`«${account.name}» — основной счёт`);
          onClose();
        }}>Сделать основным</button>
      )}

      {account && account.archivedAt !== null && (
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={async () => {
          await restoreAccount(account.id!);
          toast('Счёт возвращён из архива');
          onClose();
        }}>Вернуть из архива</button>
      )}

      {account && account.archivedAt === null && mode !== 'remove' && (
        <button className="btn danger" style={{ marginTop: 8 }} onClick={() => setMode('remove')}>Убрать счёт</button>
      )}
      {account && mode === 'remove' && (
        <>
          <p className="hint">Если по счёту есть операции, он уйдёт в архив: история и статистика сохранятся.</p>
          <div className="btns" style={{ marginTop: 8 }}>
            <button className="btn secondary" onClick={() => setMode('edit')}>Отмена</button>
            <button className="btn" style={{ background: 'var(--danger)' }} onClick={async () => {
              try {
                const r = await removeAccount(account.id!);
                toast(r === 'archived' ? 'Счёт перенесён в архив' : 'Счёт удалён');
                onClose();
              } catch (e) {
                setError(errorText(e));
                setMode('edit');
              }
            }}>Убрать</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
