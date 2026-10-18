import { onCleanup, onMount } from 'solid-js';

/** Focus fallback for baseline browsers without native inert support. */
export function guardModalFocus(panel: () => HTMLElement | undefined) {
  onMount(() => {
    const guard = (event: FocusEvent) => {
      const root = panel();
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        const first = root.querySelector<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]');
        (first ?? root).focus();
      }
    };
    document.addEventListener('focusin', guard, true);
    onCleanup(() => document.removeEventListener('focusin', guard, true));
  });
}
