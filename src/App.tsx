import { Show, For, createSignal } from 'solid-js';
import { store } from './store';
import CalendarGrid from './components/CalendarGrid';
import './App.css';

function App() {
  const [newName, setNewName] = createSignal('');

  function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    const name = newName().trim();
    if (!name) return;
    store.addCalendar(name);
    setNewName('');
  }

  const totalActivities = () => {
    const cal = store.selected;
    if (!cal) return 0;
    return Object.values(cal.days).reduce((a, b) => a + b, 0);
  };

  return (
    <div class="app">
      <header class="header">
        <h1>🏆 Achievement Calendars</h1>
        <p class="subtitle">Track your daily wins</p>
      </header>

      <div class="main">
        <aside class="sidebar">
          <form class="new-cal-form" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="New calendar name…"
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
            />
            <button type="submit">+</button>
          </form>

          <div class="cal-list">
            <Show when={store.calendars.length === 0} fallback={
              <For each={store.calendars}>
                {(cal) => (
                  <div
                    class="cal-item"
                    classList={{ active: cal.id === store.selectedId }}
                    onClick={() => store.select(cal.id)}
                  >
                    <span class="cal-name">{cal.name}</span>
                    <button
                      class="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        store.deleteCalendar(cal.id);
                      }}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                )}
              </For>
            }>
              <div class="empty-msg">No calendars yet.<br/>Create one above!</div>
            </Show>
          </div>
        </aside>

        <section class="content">
          <Show when={store.selected} fallback={
            <div class="placeholder">
              <p>Select or create a calendar to get started 🎯</p>
            </div>
          }>
            <div class="cal-header">
              <h2>{store.selected!.name}</h2>
              <span class="stat">{totalActivities()} total activities</span>
            </div>
            <CalendarGrid />
            <div class="hint">
              <strong>Click</strong> a day to add +1 · <strong>Long-press</strong> to reset to 0
            </div>
          </Show>
        </section>
      </div>
    </div>
  );
}

export default App;
