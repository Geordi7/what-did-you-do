import { createSignal, createMemo, Show } from 'solid-js';
import { store } from '../store';

const MS_24H = 24 * 60 * 60 * 1000;

/**
 * Banner reminding the user to export a full backup once 24 or more hours have passed
 * since the last export. Per specs/04-02-copy.md it is evaluated on page load rather
 * than as a live countdown, so "now" is captured once at mount — but it reads the
 * store's reactive `lastExport`, so exporting hides it immediately.
 */
export default function BackupBanner(props: { onExport: () => void }) {
  const [dismissed, setDismissed] = createSignal(false);
  const loadedAt = Date.now();

  const show = createMemo(() => {
    if (dismissed()) return false;
    const last = store.lastExport;
    if (last === null) {
      // Never exported — show once at least one calendar exists.
      return store.activeCalendars.length > 0;
    }
    return loadedAt - last > MS_24H;
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
