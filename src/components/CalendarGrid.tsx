import { createMemo, createSignal, createEffect, For, onCleanup, Show } from 'solid-js';
import type { Calendar } from '../types';
import { store } from '../store';
import { buildGrid, dateKey, cellColor } from '../utils';

const WEEKS = 26;
const CELL_PX = 12;
const GAP_PX = 2;
const STEP = CELL_PX + GAP_PX;

function formatDate(date: Date): string {
  return date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function useNow(): () => Date {
  const [now, setNow] = createSignal(new Date());
  const tick = () => {
    const next = new Date();
    setNow(next);
    const msToMidnight =
      new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1, 0, 0, 0, 0).getTime() - next.getTime() + 1000;
    return setTimeout(tick, msToMidnight);
  };
  const id = tick();
  onCleanup(() => clearTimeout(id));
  return now;
}

interface Props {
  calendar: Calendar;
  isLight: boolean;
}

function CalendarGrid(props: Props) {
  const now = useNow();
  const weeks = createMemo(() => buildGrid(now(), WEEKS));
  const todayKey = createMemo(() => dateKey(now()));

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressedKey = '';
  let longPressFired = false;
  let pressStarted = false;

  onCleanup(() => {
    if (pressTimer) clearTimeout(pressTimer);
  });

  function startPress(key: string) {
    if (pressStarted) return;
    pressStarted = true;
    longPressFired = false;
    pressedKey = key;
    pressTimer = setTimeout(() => {
      longPressFired = true;
      store.zeroDay(props.calendar.id, pressedKey);
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, 600);
  }

  function endPress() {
    if (!pressStarted) return;
    pressStarted = false;
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (!longPressFired && pressedKey) {
      store.incrementDay(props.calendar.id, pressedKey);
    }
    pressedKey = '';
  }

  function cancelPress() {
    if (pressStarted) {
      pressStarted = false;
    }
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    pressedKey = '';
    longPressFired = false;
  }

  const maxVal = createMemo(() => {
    const vals = Object.values(props.calendar.days);
    if (vals.length === 0) return 1;
    return Math.max(...vals, 1);
  });

  const [highlighted, setHighlighted] = createSignal<{ key: string; date: Date } | null>({ key: dateKey(now()), date: now() });

  createEffect(() => {
    const h = highlighted();
    const tk = todayKey();
    if (h && h.key !== tk) {
    }
  });

  const months = createMemo(() => {
    const labels: { text: string; col: number }[] = [];
    let lastMonth = -1;
    for (let i = 0; i < weeks().length; i++) {
      const date = weeks()[i][0];
      const m = date.getMonth();
      if (m !== lastMonth) {
        labels.push({ text: date.toLocaleDateString('en', { month: 'short' }), col: i });
        lastMonth = m;
      }
    }
    return labels;
  });

  const highlightedVal = () => {
    const h = highlighted();
    if (!h) return null;
    return props.calendar.days[h.key] ?? 0;
  };

  const highlightedDate = () => {
    const h = highlighted();
    if (!h) return null;
    return formatDate(h.date);
  };

  const highlightedIsToday = () => {
    const h = highlighted();
    if (!h) return false;
    return h.key === todayKey();
  };

  function handleKeyDown(e: KeyboardEvent, key: string, date: Date) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      store.incrementDay(props.calendar.id, key);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      store.zeroDay(props.calendar.id, key);
    }
  }

  return (
    <div class="grid-with-detail">
      <div class="calendar-grid">
        <div class="grid-header">
          <div class="month-labels">
            <For each={months()}>
              {(m) => <span style={{ left: `${m.col * STEP}px` }}>{m.text}</span>}
            </For>
          </div>
        </div>

        <div class="grid">
          <For each={weeks()}>
            {(week) => (
              <div class="week-col">
                <For each={week}>
                  {(date) => {
                    const key = dateKey(date);
                    const val = props.calendar.days[key] ?? 0;
                    const intensity = val / maxVal();
                    const isToday = key === todayKey();
                    const isHighlighted = highlighted()?.key === key;
                    return (
                      <button
                        class="cell"
                        classList={{
                          today: isToday,
                          highlighted: isHighlighted,
                        }}
                        style={{
                          width: `${CELL_PX}px`,
                          height: `${CELL_PX}px`,
                          background: cellColor(props.calendar.color, intensity, props.isLight),
                        }}
                        aria-label={`${formatDate(date)}: ${val} ${val === 1 ? 'activity' : 'activities'}. Click to add, long press to reset.`}
                        onPointerDown={() => startPress(key)}
                        onPointerUp={endPress}
                        onPointerLeave={cancelPress}
                        onPointerCancel={cancelPress}
                        onMouseEnter={() => setHighlighted({ key, date })}
                        onFocus={() => setHighlighted({ key, date })}
                        onKeyDown={(e) => handleKeyDown(e, key, date)}
                        tabindex="0"
                      />
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>

        <div class="legend">
          <span>Less</span>
          <span class="legend-cell" style={{ background: cellColor(props.calendar.color, 0, props.isLight) }} />
          <span class="legend-cell" style={{ background: cellColor(props.calendar.color, 0.25, props.isLight) }} />
          <span class="legend-cell" style={{ background: cellColor(props.calendar.color, 0.5, props.isLight) }} />
          <span class="legend-cell" style={{ background: cellColor(props.calendar.color, 0.75, props.isLight) }} />
          <span class="legend-cell" style={{ background: cellColor(props.calendar.color, 1, props.isLight) }} />
          <span>More</span>
        </div>
      </div>

      <div class="day-detail">
        <Show when={highlighted()} fallback={<p class="detail-placeholder">Select a day to see details</p>}>
          <div class="detail-date">{highlightedDate()}</div>
          <span class="detail-badge" classList={{ invisible: !highlightedIsToday() }}>Today</span>
          <div class="detail-count">
            <span class="detail-number">{highlightedVal()}</span>
            <span class="detail-label">{highlightedVal() === 1 ? 'activity' : 'activities'}</span>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default CalendarGrid;