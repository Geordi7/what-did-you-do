import { For, Show } from 'solid-js';
import { store } from '../store';
import { createMenu } from './menu';
import type { ThemeMode } from '../types';

const THEMES: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'system', label: 'System' },
];

interface Props {
  onNewCalendar: () => void;
  onImport: () => void;
  onExportAll: () => void;
  /** The ☰ button, where focus returns after an import closes — specs/06-accessibility.md. */
  triggerRef: (el: HTMLButtonElement) => void;
}

/** The header's ☰ menu: every header action, per specs/04-design.md "Layout". */
export default function HeaderMenu(props: Props) {
  const { open, close, toggle, onTriggerKeyDown, onMenuKeyDown, refs } = createMenu();

  /** Each item closes the menu before acting, so its own focus move (the create bar's input) wins. */
  function choose(action: () => void) {
    close();
    action();
  }

  return (
    <div class="header-menu" ref={el => { refs.root = el; }}>
      <button
        class="header-menu-trigger"
        ref={el => { refs.trigger = el; props.triggerRef(el); }}
        onClick={toggle}
        title="Menu"
        aria-label="Menu"
        aria-expanded={open()}
        aria-haspopup="menu"
        onKeyDown={onTriggerKeyDown}
      >
        ☰
      </button>
      <Show when={open()}>
        <div class="header-menu-dropdown" role="menu" aria-label="Menu" ref={el => { refs.menu = el; }} onKeyDown={onMenuKeyDown}>
          <button class="header-menu-item" role="menuitem" onClick={() => choose(props.onNewCalendar)}>
            New calendar
          </button>
          <button class="header-menu-item" role="menuitem" onClick={() => choose(props.onImport)}>
            Import calendars
          </button>
          <button class="header-menu-item" role="menuitem" onClick={() => choose(props.onExportAll)}>
            Export all calendars
          </button>
          <div class="header-menu-group" role="group" aria-label="Theme">
            <For each={THEMES}>
              {theme => (
                <button
                  class="header-menu-item"
                  role="menuitemradio"
                  aria-checked={store.theme === theme.mode ? 'true' : 'false'}
                  onClick={() => choose(() => store.setTheme(theme.mode))}
                >
                  <span class="header-menu-check" aria-hidden="true">{store.theme === theme.mode ? '✓' : ''}</span>
                  {theme.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
