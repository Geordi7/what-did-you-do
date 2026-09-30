import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { store } from '../store';
import { downloadFile, onClickOutside } from '../utils';
import ActivityValueInput from './ActivityValueInput';
import type { Calendar } from '../types';

interface Props {
  cal: Calendar;
  idx: number;
  total: number;
}

export default function CalendarMenu(props: Props) {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;

  function close() {
    setOpen(false);
  }

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    setOpen((v) => !v);
  }

  // Document-level listeners exist only while the menu is open, and each one is
  // disposed when it closes or the component goes away — specs/02-01-coding-standard.md.
  createEffect(() => {
    if (!open()) return;
    const el = root;
    if (el !== undefined) {
      onCleanup(onClickOutside(el, close));
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEscape);
    onCleanup(() => document.removeEventListener('keydown', handleEscape));
  });

  function handleExport() {
    // A plain-JSON envelope, not base64 — see specs/03-02-import-export.md.
    const contents = store.exportCalendar(props.cal.id);
    if (contents) {
      downloadFile(`${props.cal.name.replace(/[^a-z0-9]/gi, '_')}.json`, contents);
    }
    close();
  }

  return (
    <div class="cal-menu" ref={root}>
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
          <ActivityValueInput cal={props.cal} />
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
            class="cal-menu-item"
            onClick={handleExport}
          >
            Export
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
