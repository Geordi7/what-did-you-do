import { createMemo, For, onCleanup, Show } from 'solid-js';
import type { Calendar } from '../types';
import { store } from '../store';
import { calendarGrid, dateKey, cellColor, parseKey, formatDate } from '../utils';
import { visibleMaximum } from '../scores';
import { dayCounts } from '../calendar-figures';
import { gsdDays, type GsdDay } from '../gsd';

const CELL_PX = 12;
const GAP_PX = 2;
const STEP = CELL_PX + GAP_PX;

interface Props {
  calendar: Calendar;
  isLight: boolean;
  now: () => Date;
  /** A GSD calendar's day was clicked or activated; its cells change nothing themselves. */
  onOpenDay?: (key: string) => void;
}

const NO_GSD_DAY: GsdDay = { points: 0, created: 0, finished: 0, due: 0 };

/** A GSD day's figures in words, per specs/04-05-calendar-grid.md "Detail panel". */
function gsdSummary(day: GsdDay): string {
  return `Created ${day.created} · Finished ${day.finished} · Due ${day.due} · +${day.points.toFixed(1)} points`;
}

const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

function CalendarGrid(props: Props) {
  const weeks = createMemo(() => calendarGrid(props.now()));
  const todayKey = createMemo(() => dateKey(props.now()));

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressedKey = '';
  let longPressFired = false;
  let pressStarted = false;

  onCleanup(() => {
    if (pressTimer) clearTimeout(pressTimer);
  });

  /** Days after today never change, per specs/04-05-calendar-grid.md "Window". */
  const isFuture = (key: string) => key > todayKey();

  const isGsd = () => props.calendar.kind === 'gsd';
  const gsdFigures = createMemo(() => (props.calendar.kind === 'gsd' ? gsdDays(props.calendar.todos) : {}));
  const gsdDay = (key: string) => gsdFigures()[key] ?? NO_GSD_DAY;
  const counts = createMemo(() => dayCounts(props.calendar));
  const activityValue = () => (props.calendar.kind === 'scoring' ? props.calendar.activityValue : 1);

  function startPress(key: string) {
    if (isGsd()) return;
    if (pressStarted || isFuture(key)) return;
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

  const visibleKeys = createMemo(() => weeks().flat().map(dateKey));
  const maxVal = createMemo(() => visibleMaximum(counts(), visibleKeys()));

  const highlighted = createMemo(() => {
    const hk = store.highlightedKey;
    if (!hk) return null;
    const d = parseKey(hk);
    return { key: hk, date: d };
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
    // A leading partial month too narrow for its label gives way to the next month's.
    if (labels.length > 1 && labels[1].col - labels[0].col < 3) labels.shift();
    return labels;
  });

  const highlightedVal = () => {
    const h = highlighted();
    if (!h) return null;
    return counts()[h.key] ?? 0;
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

  function handleKeyDown(e: KeyboardEvent, key: string) {
    if (isGsd()) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        props.onOpenDay?.(key);
      }
      return;
    }
    if (isFuture(key)) return;
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
                    const val = () => counts()[key] ?? 0;
                    const intensity = () => val() / maxVal();
                    const isToday = () => key === todayKey();
                    const future = () => isFuture(key);
                    const score = () => `${val()} × ${activityValue()} = ${(val() * activityValue()).toFixed(1)}`;
                    const label = () => {
                      if (isGsd()) {
                        const day = gsdDay(key);
                        return `${formatDate(date)}: created ${day.created}, finished ${day.finished}, due ${day.due}, +${day.points.toFixed(1)} points. Open todos`;
                      }
                      return future() ? `${formatDate(date)}: upcoming, ${score()}.` : `${formatDate(date)}: ${score()}. Click to add, long press to reset.`;
                    };
                    return (
                      <div
                        class="cell-slot"
                        classList={{
                          // The first seven days of a month border last month's days to their left,
                          // and the 1st, unless a Monday, borders them above. Mirrored, the last seven
                          // border next month's on their right, and the last day, unless a Sunday, below.
                          'month-edge-left': date.getDate() <= 7,
                          'month-edge-top': date.getDate() === 1 && date.getDay() !== 1,
                          'month-edge-right': date.getDate() > daysInMonth(date) - 7,
                          'month-edge-bottom': date.getDate() === daysInMonth(date) && date.getDay() !== 0,
                        }}
                      >
                      <button
                        class="cell"
                        classList={{
                          today: isToday(),
                          future: future(),
                          highlighted: store.highlightedKey === key,
                        }}
                        data-key={key}
                        style={{
                          width: `${CELL_PX}px`,
                          height: `${CELL_PX}px`,
                          'background-color': cellColor(props.calendar.color, intensity(), props.isLight),
                        }}
                        aria-disabled={future() && !isGsd() ? 'true' : undefined}
                        aria-label={label()}
                        onClick={() => { if (isGsd()) props.onOpenDay?.(key); }}
                        onPointerDown={() => startPress(key)}
                        onPointerUp={endPress}
                        onPointerLeave={cancelPress}
                        onPointerCancel={cancelPress}
                        onContextMenu={(e) => e.preventDefault()}
                        onMouseEnter={() => store.setHighlightedKey(key)}
                        onFocus={() => store.setHighlightedKey(key)}
                        onKeyDown={(e) => handleKeyDown(e, key)}
                        tabindex="0"
                      >
                        <Show when={isGsd() && gsdDay(key).due > 0}>
                          <span class="due-dot" classList={{ overdue: key < todayKey() }} aria-hidden="true" />
                        </Show>
                      </button>
                      </div>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="day-detail">
        <Show when={highlighted()} fallback={<p class="detail-placeholder">Select a day to see details</p>}>
          <div class="detail-date">{highlightedDate()}</div>
          <span class="detail-badge" classList={{ invisible: !highlightedIsToday() }}>Today</span>
          <div class="detail-count">
            <span class="detail-number" classList={{ 'detail-summary': isGsd() }}>
              {isGsd()
                ? gsdSummary(gsdDay(highlighted()!.key))
                : `${highlightedVal()} × ${activityValue()} = ${(highlightedVal()! * activityValue()).toFixed(1)}`}
            </span>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default CalendarGrid;
