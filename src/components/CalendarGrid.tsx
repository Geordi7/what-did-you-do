import { createMemo, For, onCleanup } from 'solid-js';
import { store } from '../store';
import { buildGrid, dateKey, cellColor } from '../utils';

const WEEKS = 26;
const CELL = 14; // px
const GAP = 2; // px
const STEP = CELL + GAP;

function CalendarGrid() {
  const weeks = createMemo(() => buildGrid(new Date(), WEEKS));
  const todayKey = dateKey(new Date());

  // Long press logic
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressedKey = '';
  let longPressFired = false;

  onCleanup(() => {
    if (pressTimer) clearTimeout(pressTimer);
  });

  function handleMouseDown(key: string) {
    longPressFired = false;
    pressedKey = key;
    pressTimer = setTimeout(() => {
      longPressFired = true;
      store.zeroDay(pressedKey);
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, 600);
  }

  function handleMouseUp() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (!longPressFired && pressedKey) {
      store.incrementDay(pressedKey);
    }
    pressedKey = '';
  }

  function handleMouseLeave() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
      pressedKey = '';
      longPressFired = false;
    }
  }

  // Compute month labels
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

  return (
    <div class="calendar-grid">
      <div class="grid-header">
        <div class="day-labels">
          <span class="dl" style={{ height: `${STEP}px`, width: `${STEP}px` }} />
          <span class="dl">Mon</span>
          <span class="dl" />
          <span class="dl">Wed</span>
          <span class="dl" />
          <span class="dl">Fri</span>
          <span class="dl" />
        </div>
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
                  return (
                    <div
                      class="cell"
                      classList={{ today: key === todayKey }}
                      style={{
                        width: `${CELL}px`,
                        height: `${CELL}px`,
                        background: store.selected
                          ? cellColor(store.selected.days[key] ?? 0)
                          : '#1d2226',
                      }}
                      title={`${key}: ${store.selected?.days[key] ?? 0} — click to +1, long-press to zero`}
                      onMouseDown={() => handleMouseDown(key)}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseLeave}
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
        <span class="legend-cell" style={{ background: 'rgb(29,34,38)' }} />
        <span class="legend-cell" style={{ background: 'rgb(14,68,41)' }} />
        <span class="legend-cell" style={{ background: 'rgb(0,109,50)' }} />
        <span class="legend-cell" style={{ background: 'rgb(38,166,65)' }} />
        <span class="legend-cell" style={{ background: 'rgb(57,211,83)' }} />
        <span>More</span>
      </div>
    </div>
  );
}

export default CalendarGrid;
