import { Show, For, createSignal } from 'solid-js';
import { store } from './store';
import CalendarGrid from './components/CalendarGrid';
import { totalActivities, hexToRgb } from './utils';
import './App.css';

function App() {
  const [newName, setNewName] = createSignal('');
  const [showRecover, setShowRecover] = createSignal(false);

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
        <h1>🏆 Achievement Calendars</h1>
        <p class="subtitle">Track daily wins</p>
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
                  <button
                    class="move-btn"
                    onClick={() => store.moveCalendar(cal.id, -1)}
                    disabled={idx() === 0}
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    class="move-btn"
                    onClick={() => store.moveCalendar(cal.id, 1)}
                    disabled={idx() === store.activeCalendars.length - 1}
                    title="Move down"
                  >
                    ▼
                  </button>
                  <button
                    class="delete-btn"
                    onClick={() => store.deleteCalendar(cal.id)}
                    title="Delete calendar"
                  >
                    ×
                  </button>
                </div>
              </div>
              <CalendarGrid calendar={cal} />
            </div>
          )}
        </For>
      </Show>

      <div class="hint">
        <strong>Click</strong> a day to add +1 · <strong>Long-press</strong> / <strong>Long-tap</strong> to reset to 0
      </div>

      <div class="recover-section">
        <Show when={store.deletedCalendars.length > 0}>
          <button
            class="recover-toggle"
            onClick={() => setShowRecover(!showRecover())}
          >
            🗑 {store.deletedCalendars.length} deleted calendar{store.deletedCalendars.length !== 1 ? 's' : ''} — click to {showRecover() ? 'hide' : 'recover'}
          </button>
          <Show when={showRecover()}>
            <div class="recover-list">
              <For each={store.deletedCalendars}>
                {(cal) => (
                  <div class="recover-item">
                    <span class="recover-name">{cal.name}</span>
                    <span class="recover-stat">{totalActivities(cal.days)} activities</span>
                    <button
                      class="recover-btn"
                      onClick={() => store.recoverCalendar(cal.id)}
                    >
                      Recover
                    </button>
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