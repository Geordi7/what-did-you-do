import { createEffect, createSignal } from 'solid-js';

interface Props {
  /** Visible label inside the menu row. */
  label: string;
  /** Accessible name; identifies the calendar. */
  name: string;
  value: number;
  /** Whether a parsed number may be stored; anything else restores the stored value. */
  accept: (value: number) => boolean;
  commit: (value: number) => void;
}

/**
 * A number field inside a calendar menu: activity value, or a GSD calendar's
 * default bounty. It holds raw text while typing, so intermediate states such as
 * "-" or "0." survive, and commits on blur or Enter.
 */
export default function NumberMenuInput(props: Props) {
  const [text, setText] = createSignal(String(props.value));
  const [focused, setFocused] = createSignal(false);

  // While the field has focus its in-flight edit stands, per specs/02-02-state-store.md.
  createEffect(() => {
    const stored = props.value;
    if (!focused()) setText(String(stored));
  });

  function commit() {
    const parsed = Number.parseFloat(text());
    if (Number.isFinite(parsed) && props.accept(parsed)) props.commit(parsed);
    else setText(String(props.value));
  }

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    if (e.key === 'Enter') {
      target.blur();
    } else if (e.key === 'Escape') {
      setText(String(props.value));
      target.blur();
    }
  }

  return (
    <div class="cal-menu-item cal-menu-value">
      <span>{props.label}</span>
      <input
        type="text"
        role="menuitem"
        aria-label={props.name}
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
