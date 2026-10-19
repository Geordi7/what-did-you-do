import { createSignal, createEffect } from 'solid-js';
import { store } from '../store';
import type { ScoringCalendar } from '../types';

interface Props {
  cal: ScoringCalendar;
}

export default function ActivityValueInput(props: Props) {
  // The raw text the user is typing, not a number. Parsing on every keystroke would
  // collapse the intermediate states of a negative or fractional value ("-", "0.")
  // to 0, and a negative activity value is intended — see specs/03-data-model.md.
  const [text, setText] = createSignal(String(props.cal.activityValue));
  const [focused, setFocused] = createSignal(false);

  // While the field has focus its in-flight edit stands, per specs/02-02-state-store.md.
  createEffect(() => {
    const stored = props.cal.activityValue;
    if (!focused()) {
      setText(String(stored));
    }
  });

  function commit() {
    const parsed = Number.parseFloat(text());
    if (Number.isFinite(parsed)) {
      store.setActivityValue(props.cal.id, parsed);
    } else {
      // Not a number at all: abandon the edit and show the stored value again.
      setText(String(props.cal.activityValue));
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    if (e.key === 'Enter') {
      target.blur();
    } else if (e.key === 'Escape') {
      setText(String(props.cal.activityValue));
      target.blur();
    }
  }

  return (
    <div class="cal-menu-item cal-menu-value">
      <span>Activity Value</span>
      <input
        type="text"
        role="menuitem"
        aria-label={`Activity value: ${props.cal.name}`}
        inputmode="decimal"
        class="value-input"
        value={text()}
        onInput={(e) => setText(e.currentTarget.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { commit(); setFocused(false); }}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
