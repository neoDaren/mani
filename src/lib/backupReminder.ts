const KEY = 'mani.lastBackupAt';
const DAY = 24 * 60 * 60 * 1000;

export function lastBackupAt(): number | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function markBackupDone() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* хранилище недоступно — напоминание просто покажется снова */
  }
}

/** Напоминать, если операции есть, а копии не было 30 дней (или не было вовсе при 20+ операциях) */
export function backupDue(txCount: number, now = Date.now()): boolean {
  const last = lastBackupAt();
  if (last === null) return txCount >= 20;
  return txCount > 0 && now - last > 30 * DAY;
}
