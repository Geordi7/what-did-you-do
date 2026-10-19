import { Show } from 'solid-js';
import { store } from '../store';
import { downloadFile } from '../utils';
import ActivityValueInput from './ActivityValueInput';
import { createMenu } from './menu';
import type { Calendar } from '../types';

interface Props {
  cal: Calendar;
  idx: number;
  total: number;
}

export default function CalendarMenu(props: Props) {
  const { open, close, toggle, onTriggerKeyDown, onMenuKeyDown, refs } = createMenu();

  function handleExport() {
    // A plain-JSON envelope, not base64 — see specs/03-02-import-export.md.
    const contents = store.exportCalendar(props.cal.id);
    if (contents) {
      downloadFile(`${props.cal.name.replace(/[^a-z0-9]/gi, '_')}.json`, contents);
    }
    close();
  }

  return (
    <div class="cal-menu" ref={el => { refs.root = el; }}>
      <button
        class="cal-menu-trigger"
        ref={el => { refs.trigger = el; }}
        onClick={toggle}
        title="Calendar actions"
        aria-label="Calendar actions"
        aria-expanded={open()}
        aria-haspopup="menu"
        onKeyDown={onTriggerKeyDown}
      >
        ⋮
      </button>
      <Show when={open()}>
        <div class="cal-menu-dropdown" role="menu" ref={el => { refs.menu = el; }} onKeyDown={onMenuKeyDown} onClick={(e) => e.stopPropagation()}>
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
