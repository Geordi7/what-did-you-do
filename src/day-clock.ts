import { createSignal, onCleanup } from 'solid-js';

export function createDayClock() {
  const [now, setNow] = createSignal(new Date());
  let timer: ReturnType<typeof setTimeout>;
  function refresh() {
    clearTimeout(timer);
    const current = new Date();
    setNow(current);
    const midnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
    timer = setTimeout(refresh, midnight.getTime() - current.getTime() + 1000);
  }
  const visible = () => { if (document.visibilityState === 'visible') refresh(); };
  refresh();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visible);
  onCleanup(() => {
    clearTimeout(timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visible);
  });
  return now;
}
