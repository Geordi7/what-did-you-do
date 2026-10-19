import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import { store } from '../store';
import { guardModalFocus } from '../modal-focus';
import type { ImportRow, MergeAction, RowDisposition } from '../types';

/**
 * The import review modal of `specs/04-03-dialogs.md`.
 *
 * Every import opens it, collision or not, because rejecting a calendar must be
 * possible in both cases. Nothing is written until Apply: the rows come from
 * `store.previewImport` (which writes nothing) and the single write happens in
 * `store.applyImport`.
 *
 * Each row carries exactly **one** control, so a row's disposition is never
 * split across two widgets that have to agree with each other: a skip checkbox
 * on a calendar with no live counterpart, the merge dropdown — whose first
 * option *is* skip — on one that already exists. No control is ever disabled.
 */

/** The merge dropdown's options, in the order `06-accessibility.md` fixes. */
const MERGE_OPTIONS: Array<{ action: MergeAction; label: string; describes: string }> = [
  {
    action: 'replace',
    label: 'Replace',
    describes: 'Replace — the imported calendar supersedes this one entirely, days included',
  },
  {
    action: 'merge-by-sum',
    label: 'Add together',
    describes:
      'Add together — keep every date from both; a date in both adds its two counts. Name, color and activity value stay as they are',
  },
  {
    action: 'merge-prefer-import',
    label: 'Prefer imported',
    describes:
      'Prefer imported — keep every date from both; a date in both takes the imported count. Name, color and activity value come from the import',
  },
  {
    action: 'merge-prefer-live',
    label: 'Prefer existing',
    describes:
      'Prefer existing — keep every date from both; a date in both keeps the count already here. Name, color and activity value stay as they are',
  },
];

const SKIP_OPTION_LABEL = 'Skip — keep the existing calendar';
const SKIP_OPTION_DESCRIBES =
  'Skip — keep the existing calendar; nothing is imported for it and it is left as it is';

/** The select's value space: `'skip'` plus the four merge actions. */
type MergeChoice = 'skip' | MergeAction;

/**
 * The merge actions a colliding row offers. Todo trees do not merge, so with a GSD
 * calendar on either side only `replace` is offered — `specs/03-02-import-export.md`.
 */
function mergeOptionsFor(row: ImportRow): typeof MERGE_OPTIONS {
  const live = store.calendars.find(cal => cal.id === row.collidesWithId);
  if (row.calendar.kind === 'gsd' || live?.kind === 'gsd') return MERGE_OPTIONS.filter(option => option.action === 'replace');
  return MERGE_OPTIONS;
}

function isMergeAction(value: string): value is MergeAction {
  return MERGE_OPTIONS.some(option => option.action === value);
}

/**
 * `updatedAt` shown plainly. `04-02-copy.md` forbids relative wording and a time
 * of day, and fixes no format beyond that, so the stored instant's date part is
 * what the row shows.
 */
function plainDate(updatedAt: string): string {
  return updatedAt.slice(0, 10);
}

/** The focusable stops inside the dialog, in tab order. */
function focusableWithin(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  return Array.from(nodes).filter(el => !el.hasAttribute('disabled'));
}

export default function ImportReviewModal(props: {
  rows: ImportRow[];
  /** `null` is a Cancel; a number is how many calendars Apply imported. */
  onClose: (imported: number | null) => void;
}) {
  // One disposition per row, parallel to `props.rows`. A row with no live
  // counterpart starts imported (its skip checkbox starts unchecked); a
  // colliding row starts on its dropdown's skip option.
  const [choices, setChoices] = createSignal<RowDisposition[]>(
    props.rows.map(row => (row.collidesWithId === null ? { kind: 'append' } : { kind: 'skip' })),
  );

  const allSkipped = createMemo(
    () => props.rows.length > 0 && choices().every(choice => choice.kind === 'skip'),
  );

  function dispositionAt(index: number): RowDisposition {
    return choices()[index] ?? { kind: 'skip' };
  }

  function setDisposition(index: number, disposition: RowDisposition) {
    setChoices(current => current.map((choice, i) => (i === index ? disposition : choice)));
  }

  function mergeChoiceAt(index: number): MergeChoice {
    const disposition = dispositionAt(index);
    return disposition.kind === 'merge' ? disposition.action : 'skip';
  }

  function chooseMerge(index: number, value: string) {
    setDisposition(index, isMergeAction(value) ? { kind: 'merge', action: value } : { kind: 'skip' });
  }

  function apply() {
    const decided = props.rows.map((row, index) => ({ row, disposition: dispositionAt(index) }));
    props.onClose(store.applyImport(decided));
  }

  function cancel() {
    props.onClose(null);
  }

  let dialogEl: HTMLDivElement | undefined;
  guardModalFocus(() => dialogEl);

  // Escape is a Cancel, and Tab is trapped. An open native select swallows both
  // itself, so dismissing the dropdown never cancels the import.
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key !== 'Tab' || dialogEl === undefined) return;
    const stops = focusableWithin(dialogEl);
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
    // Opening moves focus to the first row's own control, so the first thing
    // read is a row and not the surrounding chrome. With no rows there is no
    // row control and Cancel is the only action.
    const stops = dialogEl === undefined ? [] : focusableWithin(dialogEl);
    stops[0]?.focus();
  });

  return (
    <div
      class="import-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      aria-describedby="import-modal-intro"
      onKeyDown={onKeyDown}
    >
      <div class="import-modal" ref={el => { dialogEl = el; }}>
        <h2 id="import-modal-title">Review import</h2>
        <p id="import-modal-intro" class="import-modal-intro">
          This is everything in the file, and each calendar is imported only if you keep it here.
          Calendars already present here start out skipped. Cancel imports nothing at all.
        </p>

        <Show
          when={props.rows.length > 0}
          fallback={<p class="import-modal-empty">This file holds no calendars.</p>}
        >
          <div class="import-modal-list-scroll">
            <div class="import-modal-headers" aria-hidden="true">
              <span>Calendar</span>
              <span>Events</span>
              <span>Last updated</span>
              <span />
            </div>
            <div
              role="list"
              class="import-modal-list"
              aria-label={`${props.rows.length} calendar${props.rows.length === 1 ? '' : 's'} in this file`}
            >
              <For each={props.rows}>
                {(row, index) => {
                  const nameId = `import-row-name-${index()}`;
                  const labelId = `import-row-label-${index()}`;
                  const skipped = () => dispositionAt(index()).kind === 'skip';
                  return (
                    <div
                      role="listitem"
                      class="import-modal-row"
                      classList={{ 'import-modal-row-skipped': skipped() }}
                      aria-label={[
                        row.calendar.name,
                        `${row.events} event${row.events === 1 ? '' : 's'}`,
                        `last updated ${plainDate(row.calendar.updatedAt)}`,
                        row.collidesWithId === null
                          ? 'not already present here'
                          : 'already present here',
                      ].join(', ')}
                    >
                      <span id={nameId} class="import-modal-name">
                        {row.calendar.name}
                      </span>
                      <span class="import-modal-events">{row.events}</span>
                      <span class="import-modal-updated">{plainDate(row.calendar.updatedAt)}</span>
                      <Show
                        when={row.collidesWithId === null}
                        fallback={
                          <span class="import-modal-merge">
                            <span id={labelId} class="import-modal-merge-label">
                              When it already exists
                            </span>
                            <select
                              aria-labelledby={`${nameId} ${labelId}`}
                              value={mergeChoiceAt(index())}
                              onChange={e => chooseMerge(index(), e.currentTarget.value)}
                            >
                              <option value="skip" aria-label={SKIP_OPTION_DESCRIBES}>
                                {SKIP_OPTION_LABEL}
                              </option>
                              <For each={mergeOptionsFor(row)}>
                                {option => (
                                  <option value={option.action} aria-label={option.describes}>
                                    {option.label}
                                  </option>
                                )}
                              </For>
                            </select>
                          </span>
                        }
                      >
                        <label class="import-modal-skip">
                          <input
                            type="checkbox"
                            checked={skipped()}
                            aria-labelledby={`${labelId} ${nameId}`}
                            onChange={e =>
                              setDisposition(
                                index(),
                                e.currentTarget.checked ? { kind: 'skip' } : { kind: 'append' },
                              )
                            }
                          />
                          <span id={labelId}>Skip</span>
                        </label>
                      </Show>
                      <Show when={skipped()}>
                        <span class="import-modal-skipped-tag">Skipped</span>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        <Show when={allSkipped()}>
          <p class="import-modal-none">Nothing will be imported.</p>
        </Show>

        <div class="import-modal-actions">
          <Show when={props.rows.length > 0}>
            <button type="button" class="import-modal-apply" onClick={apply}>
              Apply
            </button>
          </Show>
          <button type="button" class="import-modal-cancel" onClick={cancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
