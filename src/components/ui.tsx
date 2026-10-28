import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { UserError } from '../db';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="row">
          <h2 className="sheet-title">{title}</h2>
          <button className="btn link" onClick={onClose}>Закрыть</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function groupDigits(n: number): string {
  return Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Поле суммы: цифры с пробелами между тысячами, цифровая клавиатура. allowNegative — для остатков. */
export function AmountInput({
  value, onChange, allowNegative = false, autoFocus = false, placeholder = '0',
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  allowNegative?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [neg, setNeg] = useState(value !== null && value < 0);
  const text = value === null ? '' : groupDigits(value);
  return (
    <div className="row" style={{ gap: 8 }}>
      {allowNegative && (
        <button
          type="button"
          className="chip"
          aria-label="Знак"
          onClick={() => {
            setNeg(!neg);
            if (value !== null) onChange(-value);
          }}
        >
          {neg ? '−' : '+'}
        </button>
      )}
      <input
        className="input amount-input"
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={(neg && text ? '−' : '') + text}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 13);
          if (!digits) return onChange(null);
          const n = Number(digits);
          onChange(neg ? -n : n);
        }}
      />
      <span className="muted">сум</span>
    </div>
  );
}

// ---------- Уведомления ----------

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>();
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function errorText(e: unknown): string {
  if (e instanceof UserError) return e.message;
  console.error(e);
  return 'Не удалось сохранить. Попробуйте ещё раз.';
}
