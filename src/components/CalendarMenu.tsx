import { createSignal, Show, onCleanup } from 'solid-js';
import { store } from '../store';
import type { Calendar } from '../types';

interface Props {
  cal: Calendar;
  idx: number;
  total: number;
}

export default function CalendarMenu(props: Props) {
  const [open, setOpen] = createSignal(false);

  function close() {
    setOpen(false);
  }

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    setOpen((v) => !v);
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.cal-menu')) {
      close();
    }
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  // Use document listeners so clicks outside close menu
  if (typeof document !== 'undefined') {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    });
  }

  return (
    <div class="cal-menu">
      <button
        class="cal-menu-trigger"
        onClick={toggle}
        title="Calendar actions"
        aria-label="Calendar actions"
        aria-expanded={open()}
      >
        …
      </button>
      <Show when={open()}>
        <div class="cal-menu-dropdown" onClick={(e) => e.stopPropagation()}>
          <label class="cal-menu-item cal-menu-color">
            <span>Color</span>
            <input
              type="color"
              class="color-picker"
              value={props.cal.color}
              onChange={(e) => store.setColor(props.cal.id, e.currentTarget.value)}
            />
          </label>
          <button
            class="cal-menu-item"
            onClick={() => { store.moveCalendar(props.cal.id, -1); close(); }}
            disabled={props.idx === 0}
          >
            Move up
          </button>
          <button
            class="cal-menu-item"
            onClick={() => { store.moveCalendar(props.cal.id, 1); close(); }}
            disabled={props.idx === props.total - 1}
          >
            Move down
          </button>
          <button
            class="cal-menu-item cal-menu-delete"
            onClick={() => { store.deleteCalendar(props.cal.id); close(); }}
          >
            Delete
          </button>
        </div>
      </Show>
    </div>
  );
}