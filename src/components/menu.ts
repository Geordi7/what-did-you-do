import { createEffect, createSignal, onCleanup } from 'solid-js';
import { onClickOutside } from '../utils';

/**
 * Open state and keyboard behaviour shared by every popup menu, per
 * `specs/06-accessibility.md` "Menus". Callers bind `root` (trigger and popup), `trigger` and
 * `menu` as refs, then wire `toggle`, `onTriggerKeyDown` and `onMenuKeyDown`.
 */
export function createMenu() {
  const [open, setOpen] = createSignal(false);
  const refs: { root?: HTMLElement; trigger?: HTMLElement; menu?: HTMLElement } = {};

  const items = () => Array.from(refs.menu?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? []);

  /** Closing returns focus to the trigger, however the menu was closed. */
  function close() {
    setOpen(false);
    refs.trigger?.focus();
  }

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (open()) close();
    else setOpen(true);
  }

  function onTriggerKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    setOpen(true);
    if (e.key === 'ArrowUp') items().at(-1)?.focus();
  }

  function onMenuKeyDown(e: KeyboardEvent) {
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
    const el = refs.root;
    if (el !== undefined) onCleanup(onClickOutside(el, close));
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEscape);
    onCleanup(() => document.removeEventListener('keydown', handleEscape));
  });

  return { open, close, toggle, onTriggerKeyDown, onMenuKeyDown, refs };
}
