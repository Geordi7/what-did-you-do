import { createSignal, createMemo, Show } from 'solid-js';
import { store } from '../store';

const MS_24H = 24 * 60 * 60 * 1000;

/**
 * Banner reminding user to export full backup if 24+ hours since last export.
 * Appears once per session — dismissed until reload.
 */
export default function BackupBanner(props: { onExport: () => void }) {
  const [dismissed, setDismissed] = createSignal(false);

  const show = createMemo(() => {
    if (dismissed()) return false;
    const last = store.getLastExport();
    if (last === null) {
      // never exported — show after first calendar exists
      return store.activeCalendars.length > 0;
    }
    return Date.now() - last > MS_24H;
  });

  return (
    <Show when={show()}>
      <div class="backup-banner" role="alert">
        <span class="backup-banner-text">
          ⚠ It's been over 24 hours since your last backup. Export your calendars to stay safe.
        </span>
        <div class="backup-banner-actions">
          <button class="backup-banner-btn" onClick={props.onExport}>
            Export now
          </button>
          <button class="backup-banner-dismiss" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </div>
      </div>
    </Show>
  );
}