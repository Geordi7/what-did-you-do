import { Show, For, createSignal, createMemo, createEffect, onMount } from 'solid-js';
import { store } from './store';
import CalendarGrid from './components/CalendarGrid';
import CalendarMenu from './components/CalendarMenu';
import ScoreChart from './components/ScoreChart';
import CalendarNameInput from './components/CalendarNameInput';
import BackupBanner from './components/BackupBanner';
import { totalActivities, hexToRgb } from './utils';
import type { ThemeMode } from './types';
import './App.css';

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = mode;
  root.dataset.themeResolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
}

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

function downloadFile(base64: string, filename: string) {
  const blob = new Blob([atob(base64)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [newName, setNewName] = createSignal('');
  const [showNewCal, setShowNewCal] = createSignal(false);
  const [showRecover, setShowRecover] = createSignal(false);
  const [themeOpen, setThemeOpen] = createSignal(false);
  const theme = createMemo(() => store.theme);
  const [systemDark, setSystemDark] = createSignal(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const isLight = createMemo(() => {
    const mode = theme();
    if (mode !== 'system') return mode === 'light';
    return !systemDark();
  });

  let fileInput: HTMLInputElement | undefined;

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
    if (!name) {
      setShowNewCal(false);
      return;
    }
    store.addCalendar(name);
    setNewName('');
    setShowNewCal(false);
  }

  function handleNewCalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setShowNewCal(false);
      setNewName('');
    }
  }

  function purgeDeleted() {
    if (confirm('Permanently delete all trashed calendars? This cannot be undone.')) {
      store.purgeDeleted();
      setShowRecover(false);
    }
  }

  function permanentlyDelete(id: string, name: string) {
    if (confirm(`Permanently delete "${name}"? This cannot be undone.`)) {
      store.permanentlyDeleteCalendar(id);
    }
  }

  function handleExportAll() {
    const b64 = store.exportAllCalendars();
    if (b64) {
      store.setLastExport();
      const ts = new Date().toISOString().slice(0, 10);
      downloadFile(b64, `calendars_${ts}.json`);
    }
  }

  function handleImportClick() {
    fileInput?.click();
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const idx = text.indexOf(',');
      const b64 = idx >= 0 ? text.slice(idx + 1) : btoa(text);
      const result = store.importCalendars(b64);
      if (result === -1) {
        alert('Failed to parse file.');
      } else if (result === 0) {
        alert('No valid calendars found in file.');
      } else {
        alert(`Imported ${result} calendar${result !== 1 ? 's' : ''}.`);
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  function toggleThemeDropdown() {
    setThemeOpen(v => !v);
  }

  function selectTheme(mode: ThemeMode) {
    store.setTheme(mode);
    setThemeOpen(false);
  }

  // Close theme dropdown on outside click
  function handleThemeOutsideClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.theme-dropdown')) {
      setThemeOpen(false);
    }
  }

  onMount(() => {
    document.addEventListener('click', handleThemeOutsideClick);
  });

  return (
    <div class="app">
      <header class="header">
        <div class="title-row">
          <div>
            <h1>😱 What did you do!?</h1>
            <p class="subtitle">Track daily wins</p>
          </div>
          <div class="header-actions">
            <div class="theme-dropdown" role="group" aria-label="Theme">
              <button class="theme-btn" onClick={toggleThemeDropdown} aria-expanded={themeOpen()}>
                Theme: {THEME_LABELS[theme()]}
              </button>
              <Show when={themeOpen()}>
                <div class="theme-dropdown-menu">
                  {(['light', 'dark', 'system'] as ThemeMode[]).map(mode => (
                    <button
                      class="theme-option"
                      classList={{ active: theme() === mode }}
                      onClick={() => selectTheme(mode)}
                    >
                      {THEME_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </Show>
            </div>
            <div class="new-cal-section">
              <button
                class="add-cal-btn"
                classList={{ active: showNewCal() }}
                onClick={() => setShowNewCal(v => !v)}
                title="Create new calendar"
                aria-label="Create new calendar"
              >
                + New calendar
              </button>
            </div>
            <button class="header-icon-btn" onClick={handleImportClick} title="Import calendars" aria-label="Import calendars">
              📥
            </button>
            <input
              ref={(el) => { fileInput = el; }}
              type="file"
              accept=".json"
              class="hidden-input"
              onChange={handleFileChange}
            />
            <button class="header-icon-btn" onClick={handleExportAll} title="Export all calendars" aria-label="Export all calendars">
              📤
            </button>
          </div>
        </div>
      </header>

      <BackupBanner onExport={handleExportAll} />

      <ScoreChart isLight={isLight()} />

      <Show when={showNewCal()}>
        <form class="new-cal-bar" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Calendar name…"
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={handleNewCalKeydown}
            autofocus
          />
          <button type="submit" class="create-btn">Create</button>
          <button type="button" class="cancel-btn" onClick={() => { setShowNewCal(false); setNewName(''); }}>Cancel</button>
        </form>
      </Show>

      <Show when={store.activeCalendars.length > 0}>
        <For each={store.activeCalendars} fallback={<div class="empty-state">No calendars yet. Create one above!</div>}>
          {(cal, idx) => (
            <div class="cal-card" style={{ '--cal-color': cal.color, '--cal-color-rgb': hexToRgb(cal.color) }}>
              <div class="cal-card-header">
                <div class="cal-info">
                  <CalendarNameInput id={cal.id} name={cal.name} />
                  <span class="cal-stat">
                    {totalActivities(cal.days)} activities
                  </span>
                </div>
                <CalendarMenu cal={cal} idx={idx()} total={store.activeCalendars.length} />
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
                    <div class="recover-actions">
                      <button class="recover-btn" onClick={() => store.recoverCalendar(cal.id)}>Recover</button>
                      <button class="recover-delete-btn" onClick={() => permanentlyDelete(cal.id, cal.name)}>Delete forever</button>
                    </div>
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