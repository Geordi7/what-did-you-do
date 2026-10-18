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
  let trigger: HTMLButtonElement | undefined;
  let menu: HTMLDivElement | undefined;

  function close() {
    setOpen(false);
    trigger?.focus();
  }

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (open()) close();
    else setOpen(true);
  }

  const items = () => Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);

  function navigate(e: KeyboardEvent) {
    const stops = items();
    if (stops.length === 0) return;
    const at = stops.findIndex(el => el === document.activeElement);
    let next: number;
    if (e.key === 'ArrowDown') next = (at + 1) % stops.length;
    else if (e.key === 'ArrowUp') next = (at - 1 + stops.length) % stops.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = stops.length - 1;
    else if (e.key === 'Tab') { close(); return; }
    else return;
    e.preventDefault();
    stops[next].focus();
  }

  // Document-level listeners exist only while the menu is open, and each one is
  // disposed when it closes or the component goes away — specs/02-01-coding-standard.md.
  createEffect(() => {
    if (!open()) return;
    items()[0]?.focus();
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
        ref={trigger}
        onClick={toggle}
        title="Calendar actions"
        aria-label="Calendar actions"
        aria-expanded={open()}
        aria-haspopup="menu"
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            if (e.key === 'ArrowUp') items().at(-1)?.focus();
          }
        }}
      >
        …
      </button>
      <Show when={open()}>
        <div class="cal-menu-dropdown" role="menu" ref={menu} onKeyDown={navigate} onClick={(e) => e.stopPropagation()}>
          <label class="cal-menu-item cal-menu-color">
            <span>Color</span>
            <input
              type="color"
              role="menuitem"
              aria-label={`Color: ${props.cal.name}`}
              class="color-picker"
              value={props.cal.color}
              onChange={(e) => store.setColor(props.cal.id, e.currentTarget.value)}
            />
          </label>
          <ActivityValueInput cal={props.cal} />
          <button
            class="cal-menu-item"
            role="menuitem"
            onClick={() => { store.moveCalendar(props.cal.id, -1); close(); }}
            disabled={props.idx === 0}
          >
            Move up
          </button>
          <button
            class="cal-menu-item"
            role="menuitem"
            onClick={() => { store.moveCalendar(props.cal.id, 1); close(); }}
            disabled={props.idx === props.total - 1}
          >
            Move down
          </button>
          <button
            class="cal-menu-item"
            role="menuitem"
            onClick={handleExport}
          >
            Export
          </button>
          <button
            class="cal-menu-item cal-menu-delete"
            role="menuitem"
            onClick={() => { store.deleteCalendar(props.cal.id); close(); }}
          >
            Delete
          </button>
        </div>
      </Show>
    </div>
  );
}
