import { createSignal, createMemo } from 'solid-js';
import { store } from '../store';

interface Props {
  id: string;
  name: string;
}

export default function CalendarNameInput(props: Props) {
  const [editing, setEditing] = createSignal(props.name);
  const [focused, setFocused] = createSignal(false);

  // Sync initial value if props change while not editing
  // Only sync when not focused (avoids overwriting local edits on re-render)
  createMemo(() => {
    if (!focused()) {
      setEditing(props.name);
    }
  });

  function commit() {
    const v = editing().trim();
    if (v && v !== props.name) {
      store.setCalendarName(props.id, v);
    } else {
      setEditing(props.name);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setEditing(props.name);
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <input
      class="cal-name-input"
      value={editing()}
      onInput={(e) => setEditing(e.currentTarget.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { commit(); setFocused(false); }}
      onKeyDown={handleKeyDown}
    />
  );
}