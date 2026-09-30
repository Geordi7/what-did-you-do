import { createSignal, createEffect } from 'solid-js';
import { store } from '../store';

interface Props {
  id: string;
  name: string;
}

export default function CalendarNameInput(props: Props) {
  const [editing, setEditing] = createSignal(props.name);
  const [focused, setFocused] = createSignal(false);

  // Follow the stored name, but leave an in-flight edit alone while the field has
  // focus — see specs/02-02-state-store.md. This is a side effect on a signal, so it
  // is a createEffect; a createMemo would only run while something read its value.
  createEffect(() => {
    const stored = props.name;
    if (!focused()) {
      setEditing(stored);
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
    const target = e.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    if (e.key === 'Enter') {
      target.blur();
    } else if (e.key === 'Escape') {
      setEditing(props.name);
      target.blur();
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
