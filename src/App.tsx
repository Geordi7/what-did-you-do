import { Show, For, createSignal, createMemo, createEffect, onMount } from 'solid-js';
import { store } from './store';
import CalendarGrid from './components/CalendarGrid';
import { totalActivities, hexToRgb } from './utils';
import type { ThemeMode } from './types';
import './App.css';

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = mode;
  root.dataset.themeResolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
}

function App() {
  const [newName, setNewName] = createSignal('');
  const [showRecover, setShowRecover] = createSignal(false);
  const theme = createMemo(() => store.theme);
  const [systemDark, setSystemDark] = createSignal(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const isLight = createMemo(() => {
    const mode = theme();
    if (mode !== 'system') return mode === 'light';
    return !systemDark();
  });

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(media.matches);
    const handler = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
      if (store.theme === 'system') applyTheme('system');
    };
    media.addEventListener('change', handler);
  });

  createEffect(() => {
    applyTheme(theme());
  });

  function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    const name = newName().trim();
    if (!name) return;
    store.addCalendar(name);
    setNewName('');
  }

  function purgeDeleted() {
    if (confirm('Permanently delete all trashed calendars? This cannot be undone.')) {
      store.purgeDeleted();
      setShowRecover(false);
    }
  }

  return (
    <div class="app">
      <header class="header">
        <div class="title-row">
          <div>
            <h1>🏆 Achievement Calendars</h1>
            <p class="subtitle">Track daily wins</p>
          </div>
          <div class="theme-toggle" role="group" aria-label="Theme">
            <button classList={{ active: theme() === 'light' }} onClick={() => store.setTheme('light')}>Light</button>
            <button classList={{ active: theme() === 'dark' }} onClick={() => store.setTheme('dark')}>Dark</button>
            <button classList={{ active: theme() === 'system' }} onClick={() => store.setTheme('system')}>System</button>
          </div>
        </div>
      </header>

      <form class="new-cal-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="New calendar name…"
          value={newName()}
          onInput={(e) => setNewName(e.currentTarget.value)}
        />
        <button type="submit">+</button>
      </form>

      <Show when={store.activeCalendars.length > 0}>
        <For each={store.activeCalendars} fallback={<div class="empty-state">No calendars yet. Create one above!</div>}>
          {(cal, idx) => (
            <div class="cal-card" style={{ '--cal-color': cal.color, '--cal-color-rgb': hexToRgb(cal.color) }}>
              <div class="cal-card-header">
                <div class="cal-info">
                  <input
                    class="cal-name-input"
                    value={cal.name}
                    onInput={(e) => store.setCalendarName(cal.id, e.currentTarget.value)}
                  />
                  <span class="cal-stat">
                    {totalActivities(cal.days)} activities
                  </span>
                </div>
                <div class="cal-actions">
                  <input
                    type="color"
                    class="color-picker"
                    value={cal.color}
                    onChange={(e) => store.setColor(cal.id, e.currentTarget.value)}
                    title="Calendar color"
                  />
                  <button class="move-btn" onClick={() => store.moveCalendar(cal.id, -1)} disabled={idx() === 0} title="Move up">▲</button>
                  <button class="move-btn" onClick={() => store.moveCalendar(cal.id, 1)} disabled={idx() === store.activeCalendars.length - 1} title="Move down">▼</button>
                  <button class="delete-btn" onClick={() => store.deleteCalendar(cal.id)} title="Delete calendar">×</button>
                </div>
              </div>
              <CalendarGrid calendar={cal} isLight={isLight()} />
            </div>
          )}
        </For>
      </Show>

      <div class="hint">
        <strong>Click</strong> a day to add +1 · <strong>Long-press</strong> / <strong>Long-tap</strong> to reset to 0
      </div>

      <div class="recover-section">
        <Show when={store.deletedCalendars.length > 0}>
          <button class="recover-toggle" onClick={() => setShowRecover(!showRecover())}>
            🗑 {store.deletedCalendars.length} deleted calendar{store.deletedCalendars.length !== 1 ? 's' : ''} — click to {showRecover() ? 'hide' : 'recover'}
          </button>
          <Show when={showRecover()}>
            <div class="recover-list">
              <For each={store.deletedCalendars}>
                {(cal) => (
                  <div class="recover-item">
                    <span class="recover-name">{cal.name}</span>
                    <span class="recover-stat">{totalActivities(cal.days)} activities</span>
                    <button class="recover-btn" onClick={() => store.recoverCalendar(cal.id)}>Recover</button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
        <Show when={store.deletedCalendars.length > 1}>
          <button class="purge-btn" onClick={purgeDeleted}>Empty trash</button>
        </Show>
      </div>
    </div>
  );
}

export default App;