import { For } from 'solid-js';
import { store } from '../store';
import type { CalendarSort } from '../types';

type SortBy = CalendarSort['by'];

/** Accessible-name suffixes for each direction, per specs/06-accessibility.md "Sort bar". */
const DIRECTION_NAMES: Record<Exclude<SortBy, 'custom'>, Record<CalendarSort['dir'], string>> = {
  activities: { desc: 'high to low', asc: 'low to high' },
  score: { desc: 'high to low', asc: 'low to high' },
  recent: { desc: 'most recent first', asc: 'least recent first' },
};

const BUTTONS: Array<{ by: SortBy; label: string }> = [
  { by: 'custom', label: 'Custom' },
  { by: 'activities', label: 'Activities' },
  { by: 'score', label: 'Score' },
  { by: 'recent', label: 'Recent' },
];

/** The sort bar above the calendar sections, per specs/04-04-calendar-sort.md "Controls". */
export default function SortBar() {
  function choose(by: SortBy) {
    const current = store.calendarSort;
    if (by === 'custom') store.setCalendarSort({ by, dir: 'desc' });
    else if (current.by === by) store.setCalendarSort({ by, dir: current.dir === 'desc' ? 'asc' : 'desc' });
    else store.setCalendarSort({ by, dir: 'desc' });
  }

  return (
    <div class="sort-bar" role="group" aria-label="Sort calendars">
      <For each={BUTTONS}>
        {button => {
          const selected = () => store.calendarSort.by === button.by;
          const arrow = () => (store.calendarSort.dir === 'desc' ? ' ▼' : ' ▲');
          const name = () => (selected() && button.by !== 'custom'
            ? `${button.label}, ${DIRECTION_NAMES[button.by][store.calendarSort.dir]}`
            : button.label);
          return (
            <button
              type="button"
              class="sort-btn"
              classList={{ active: selected() }}
              aria-pressed={selected()}
              aria-label={name()}
              onClick={() => choose(button.by)}
            >
              {button.label}{selected() && button.by !== 'custom' ? arrow() : ''}
            </button>
          );
        }}
      </For>
    </div>
  );
}
