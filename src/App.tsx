import { Show, For, createSignal, createMemo, createEffect, onCleanup, onMount } from 'solid-js';
import { store } from './store';
import CalendarGrid from './components/CalendarGrid';
import CalendarMenu from './components/CalendarMenu';
import ScoreChart from './components/ScoreChart';
import CalendarNameInput from './components/CalendarNameInput';
import BackupBanner from './components/BackupBanner';
import ImportReviewModal from './components/ImportReviewModal';
import BlockingMessage from './components/BlockingMessage';
import { totalActivities, hexToRgb, downloadFile, onClickOutside } from './utils';
import type { ImportRow, ThemeMode } from './types';
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

/** How long a success status stays on the inline line — `specs/04-02-copy.md`. */
const STATUS_CLEAR_MS = 5000;

/** The inline import status line: a success clears itself, a failure persists. */
type ImportStatus = { kind: 'success' | 'failure'; text: string };

function App() {
  const [newName, setNewName] = createSignal('');
  const [showNewCal, setShowNewCal] = createSignal(false);
  const [showRecover, setShowRecover] = createSignal(false);
  const [themeOpen, setThemeOpen] = createSignal(false);
  const [importRows, setImportRows] = createSignal<ImportRow[] | null>(null);
  const [importStatus, setImportStatus] = createSignal<ImportStatus | null>(null);
  const [systemDark, setSystemDark] = createSignal(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const isLight = createMemo(() => {
    const mode = store.theme;
    if (mode !== 'system') return mode === 'light';
    return !systemDark();
  });

  let fileInput: HTMLInputElement | undefined;
  let importBtn: HTMLButtonElement | undefined;
  let newNameInput: HTMLInputElement | undefined;
  let themeRoot: HTMLDivElement | undefined;

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(media.matches);
    const handler = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
      if (store.theme === 'system') applyTheme('system');
    };
    media.addEventListener('change', handler);
    onCleanup(() => media.removeEventListener('change', handler));
  });

  createEffect(() => {
    applyTheme(store.theme);
  });

  // The theme dropdown's document listener exists only while it is open, and is
  // disposed when it closes — specs/02-01-coding-standard.md.
  createEffect(() => {
    if (!themeOpen()) return;
    const el = themeRoot;
    if (el !== undefined) onCleanup(onClickOutside(el, () => setThemeOpen(false)));
  });

  // A success status clears itself after about 5s; a failure persists until it is
  // dismissed or superseded, so it gets no timer.
  createEffect(() => {
    const status = importStatus();
    if (status === null || status.kind !== 'success') return;
    const timer = setTimeout(() => setImportStatus(null), STATUS_CLEAR_MS);
    onCleanup(() => clearTimeout(timer));
  });

  // The create bar's input takes focus when the bar appears. `autofocus` only
  // acts on the document's first load, so it never fires on a toggle.
  createEffect(() => {
    if (showNewCal()) newNameInput?.focus();
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

  // The app's only native dialog — specs/04-design.md "Controls". There is no
  // bulk empty: clearing the trash is deliberately one item at a time.
  function permanentlyDelete(id: string, name: string) {
    if (confirm(`Permanently delete "${name}"? This cannot be undone.`)) {
      store.permanentlyDeleteCalendar(id);
    }
  }

  function handleExportAll() {
    const contents = store.exportAll();
    if (contents) {
      store.setLastExport();
      const ts = new Date().toISOString().slice(0, 10);
      downloadFile(`calendars_${ts}.json`, contents);
    }
  }

  function handleImportClick() {
    fileInput?.click();
  }

  function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const preview = store.previewImport(text);
      if (!preview.ok) {
        setImportStatus({ kind: 'failure', text: preview.reason });
        return;
      }
      // Every import opens the review modal, collision or not: rejecting a
      // calendar must be possible in both cases — specs/04-03-dialogs.md.
      setImportStatus(null);
      setImportRows(preview.rows);
    };
    reader.onerror = () => {
      setImportStatus({ kind: 'failure', text: 'That file could not be read.' });
    };
    reader.readAsText(file);
  }

  /** `null` is a Cancel — nothing was written, appends included. */
  function handleImportClose(imported: number | null) {
    setImportRows(null);
    if (imported === null) {
      // Cancel reports nothing: no write happened, so there is no outcome to announce, and a
      // persisting message would be the treatment reserved for a real failure.
      setImportStatus(null);
    } else if (imported === 0) {
      setImportStatus({ kind: 'success', text: 'Nothing was imported.' });
    } else {
      setImportStatus({
        kind: 'success',
        text: `Imported ${imported} calendar${imported !== 1 ? 's' : ''}.`,
      });
    }
    // Focus returns to the control that opened the dialog — specs/06-accessibility.md.
    importBtn?.focus();
  }

  function toggleThemeDropdown() {
    setThemeOpen(v => !v);
  }

  function selectTheme(mode: ThemeMode) {
    store.setTheme(mode);
    setThemeOpen(false);
  }

  return (
    <>
      <div class="app" aria-hidden={store.blocked || importRows() !== null}>
        <header class="header">
          <div class="title-row">
            <div>
              <h1>😱 What did you do!?</h1>
              <p class="subtitle">Track daily wins</p>
            </div>
            <div class="header-actions">
              <div class="theme-dropdown" role="group" aria-label="Theme" ref={el => { themeRoot = el; }}>
                <button class="theme-btn" onClick={toggleThemeDropdown} aria-expanded={themeOpen()}>
                  Theme: {THEME_LABELS[store.theme]}
                </button>
                <Show when={themeOpen()}>
                  <div class="theme-dropdown-menu">
                    <For each={['light', 'dark', 'system'] as ThemeMode[]}>
                      {mode => (
                        <button
                          class="theme-option"
                          classList={{ active: store.theme === mode }}
                          onClick={() => selectTheme(mode)}
                        >
                          {THEME_LABELS[mode]}
                        </button>
                      )}
                    </For>
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
              <button
                class="header-icon-btn"
                ref={el => { importBtn = el; }}
                onClick={handleImportClick}
                title="Import calendars"
                aria-label="Import calendars"
              >
                📥
              </button>
              <input
                ref={el => { fileInput = el; }}
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

        {/* The one banner region: backup reminder, import status, storage error. */}
        <div class="banner-region">
          <BackupBanner onExport={handleExportAll} />

          {/* The region is always mounted; only its contents come and go. A live region
              inserted in the same mutation as its text is routinely not announced. */}
          <div
            class="import-status"
            classList={{
              'import-status-empty': !importStatus(),
              'import-status-failure': importStatus()?.kind === 'failure',
              'import-status-success': importStatus()?.kind === 'success',
            }}
            role="status"
            aria-live="polite"
          >
            <Show when={importStatus()}>
              {status => (
                <>
                  <span class="import-status-text">{status().text}</span>
                  <button
                    class="import-status-dismiss"
                    onClick={() => setImportStatus(null)}
                    aria-label="Dismiss import status"
                  >
                    Dismiss
                  </button>
                </>
              )}
            </Show>
          </div>

          {/* The app keeps running in memory when storage is unavailable. */}
          <Show when={store.storageError}>
            {message => (
              <div class="storage-error" role="alert">
                {message()}
              </div>
            )}
          </Show>
        </div>

        <ScoreChart isLight={isLight()} />

        <Show when={showNewCal()}>
          <form class="new-cal-bar" onSubmit={handleCreate}>
            <input
              ref={el => { newNameInput = el; }}
              type="text"
              placeholder="Calendar name…"
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              onKeyDown={handleNewCalKeydown}
            />
            <button type="submit" class="create-btn">Create</button>
            <button type="button" class="cancel-btn" onClick={() => { setShowNewCal(false); setNewName(''); }}>Cancel</button>
          </form>
        </Show>

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

        <div class="hint">
          <strong>Click</strong> a day to add +1 · <strong>Long-press</strong> / <strong>Long-tap</strong> to reset to 0
        </div>

        {/* No empty-trash control: trash is a safety net — specs/01-requirements.md. */}
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
        </div>
      </div>

      <Show when={importRows()}>
        {rows => <ImportReviewModal rows={rows()} onClose={handleImportClose} />}
      </Show>

      {/* Both blocked cases show it: a migrate/validate defect carries a
          diagnostic, the newer-version guard of specs/03-01-migrations.md
          carries none but must still block. */}
      <Show when={store.blocked}>
        <BlockingMessage diagnostic={store.diagnostic} />
      </Show>
    </>
  );
}

export default App;
