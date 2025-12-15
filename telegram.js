export function getTg() {
  return window.Telegram?.WebApp ?? null;
}

export function getTelegramUserId() {
  const tg = getTg();
  const id = tg?.initDataUnsafe?.user?.id;
  return id ? Number(id) : null;
}
