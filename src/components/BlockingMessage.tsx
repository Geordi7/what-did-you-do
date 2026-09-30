import { Show, createSignal, onMount } from 'solid-js';
import { formatDiagnostic } from '../diagnostic';
import { downloadFile } from '../utils';
import type { Diagnostic } from '../types';

/**
 * The unrecoverable-data message of `specs/04-03-dialogs.md`.
 *
 * Shown on load when stored data fails to migrate or fails validation. It
 * blocks: there is no dismiss, because the state behind it is a defect rather
 * than something the user can act on, and `Escape` does nothing for the same
 * reason. The app runs in memory from empty state behind it; the stored string
 * and the pre-migration backup are left byte-intact.
 *
 * The diagnostic is offered both ways — clipboard and file — from the one
 * `formatDiagnostic` payload, which carries no calendar names and no day counts.
 */
export default function BlockingMessage(props: { diagnostic: Diagnostic | null }) {
  const [copied, setCopied] = createSignal<string | null>(null);

  // `null` is the newer-version guard of `specs/03-01-migrations.md`: the stored
  // data is not a defect, it is simply from a build ahead of this one, so there
  // is no failure to diagnose. The message still blocks, because loading and
  // saving are both off and the save path must not clobber newer data.
  const diagnostic = () => props.diagnostic;
  const text = () => {
    const d = diagnostic();
    return d === null ? '' : formatDiagnostic(d);
  };

  async function copyDiagnostic() {
    try {
      await navigator.clipboard.writeText(text());
      setCopied('Diagnostic copied to the clipboard.');
    } catch {
      // Clipboard access can be refused outright; the download is the fallback
      // and the text is on screen either way.
      setCopied('Could not copy. Use Download diagnostic, or copy the text below.');
    }
  }

  function download() {
    downloadFile('calendar-diagnostic.txt', text(), 'text/plain');
  }

  let copyBtn: HTMLButtonElement | undefined;
  let dialogEl: HTMLDivElement | undefined;

  // The trap holds for the life of the page: there is no safe state to dismiss
  // to, so Tab cycles between the two diagnostic controls and nothing else.
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Tab' || dialogEl === undefined) return;
    const stops = Array.from(dialogEl.querySelectorAll<HTMLElement>('button'));
    if (stops.length === 0) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialogEl.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialogEl.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    // Copy diagnostic is the surface's first interactive stop. The
    // newer-version variant offers no controls at all, so focus lands on the
    // panel itself and the alertdialog is still announced.
    if (copyBtn !== undefined) copyBtn.focus();
    else dialogEl?.focus();
  });

  return (
    <div
      class="blocking"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="blocking-title"
      aria-describedby="blocking-body"
      onKeyDown={onKeyDown}
    >
      <div class="blocking-panel" tabindex="-1" ref={el => { dialogEl = el; }}>
        <h2 id="blocking-title" class="blocking-title">
          {diagnostic() === null
            ? 'Your saved data is from a newer version'
            : 'Your saved data could not be read'}
        </h2>
        <p id="blocking-body" class="blocking-body">
          Nothing has been changed or overwritten. The app is running empty for this session.
        </p>
        <Show
          when={diagnostic() !== null}
          fallback={
            <p class="blocking-body">
              This data was saved by a newer version of this app, so this version will neither load
              nor save it. Open it in the newer version instead.
            </p>
          }
        >
          <p class="blocking-body">
            Please send the diagnostic to a developer. It describes only where the data failed — no
            calendar names, no day counts.
          </p>
          <div class="blocking-actions">
            <button
              type="button"
              class="blocking-btn blocking-copy"
              ref={el => { copyBtn = el; }}
              onClick={copyDiagnostic}
            >
              Copy diagnostic
            </button>
            <button type="button" class="blocking-btn blocking-download" onClick={download}>
              Download diagnostic
            </button>
          </div>
          <Show when={copied()}>
            <p class="blocking-copy-status" role="status">
              {copied()}
            </p>
          </Show>
          <pre class="blocking-diagnostic">{text()}</pre>
        </Show>
      </div>
    </div>
  );
}
