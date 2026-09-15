import { createSignal, createMemo } from 'solid-js';
import { store } from '../store';
import type { Calendar } from '../types';

interface Props {
  cal: Calendar;
}

export default function ActivityValueInput(props: Props) {
  const [val, setVal] = createSignal(props.cal.activityValue);
  const [focused, setFocused] = createSignal(false);

  createMemo(() => {
    if (!focused()) {
      setVal(props.cal.activityValue);
    }
  });

  function commit() {
    const v = parseFloat(val() as any) || 0;
    store.setActivityValue(props.cal.id, v);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setVal(props.cal.activityValue);
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div class="cal-menu-item cal-menu-value">
      <span>Activity Value</span>
      <input
        type="number"
        class="value-input"
        value={val()}
        onInput={(e) => setVal(parseFloat(e.currentTarget.value) || 0)}
        onFocus={() => setFocused(true)}
        onBlur={() => { commit(); setFocused(false); }}
        onKeyDown={handleKeyDown}
        step="0.1"
        min="0"
      />
    </div>
  );
}