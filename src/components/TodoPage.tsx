import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { store } from '../store';
import { canMarkDone, canNudge, canRestore, isCancelled } from '../gsd';
import { dateKey, formatDate, parseKey } from '../utils';
import CalendarGrid from './CalendarGrid';
import type { GsdCalendar, Todo } from '../types';

/**
 * A GSD calendar's full-page todo tool, per `specs/04-06-todo-page.md`. Every change
 * goes through the store's todo rules (`specs/03-04-gsd-points.md`), so a control here
 * never decides on its own whether a change is allowed.
 */

interface Props {
  calendarId: string;
  isLight: boolean;
  now: () => Date;
}

/** One week after `today`, the add row's prefilled due date. */
function weekAfter(today: Date): string {
  return dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7));
}

/** Open, then done, then cancelled; within each, by due date (undated last), then creation. */
function ordered(todos: readonly Todo[]): Todo[] {
  const bucket = (todo: Todo) => (todo.cancelled !== undefined ? 2 : todo.done !== undefined ? 1 : 0);
  return [...todos].sort((a, b) => {
    if (bucket(a) !== bucket(b)) return bucket(a) - bucket(b);
    if (a.due !== b.due) {
      if (a.due === undefined) return 1;
      if (b.due === undefined) return -1;
      return a.due < b.due ? -1 : 1;
    }
    return a.created < b.created ? -1 : a.created > b.created ? 1 : 0;
  });
}

/** Focus a todo's title once the tree has re-rendered around it. */
function focusTitle(id: string) {
  requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`.todo-tree li[data-id="${CSS.escape(id)}"] .todo-title`)?.focus());
}

export default function TodoPage(props: Props) {
  const calendar = createMemo<GsdCalendar | null>(() => {
    const cal = store.activeCalendars.find(candidate => candidate.id === props.calendarId);
    return cal !== undefined && cal.kind === 'gsd' ? cal : null;
  });

  return (
    <div class="todo-page">
      <a class="back-link" href="#">← Calendars</a>
      <Show when={calendar()} fallback={<p class="todo-missing">That calendar could not be found.</p>}>
        {cal => <TodoTool calendar={cal()} isLight={props.isLight} now={props.now} />}
      </Show>
    </div>
  );
}

function TodoTool(props: { calendar: GsdCalendar; isLight: boolean; now: () => Date }) {
  const today = () => dateKey(props.now());
  const [filterKey, setFilterKey] = createSignal<string | null>(null);
  let titleInput: HTMLInputElement | undefined;

  /* ── day filter ─────────────────────────────────────────────────────────── */

  const matches = (todo: Todo, key: string) => todo.created === key || todo.done === key || todo.due === key;
  /** A todo shows when it matches the filter or has a descendant that does, for context. */
  const shows = (todo: Todo): boolean => {
    const key = filterKey();
    return key === null || matches(todo, key) || todo.children.some(shows);
  };

  // Any click outside the tree, the grid and the filter line clears the filter.
  createEffect(() => {
    if (filterKey() === null) return;
    const clear = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest('.todo-tree, .todo-page .calendar-grid, .todo-filter')) return;
      setFilterKey(null);
    };
    document.addEventListener('pointerdown', clear);
    onCleanup(() => document.removeEventListener('pointerdown', clear));
  });

  /* ── add row ────────────────────────────────────────────────────────────── */

  const [newTitle, setNewTitle] = createSignal('');
  const [newBounty, setNewBounty] = createSignal(String(props.calendar.defaultBounty));
  const [newDue, setNewDue] = createSignal(weekAfter(props.now()));

  function add(e: SubmitEvent) {
    e.preventDefault();
    const title = newTitle().trim();
    if (!title) return;
    const parsed = Number.parseFloat(newBounty());
    const bounty = Number.isFinite(parsed) && parsed >= 0 ? parsed : props.calendar.defaultBounty;
    store.addTodo(props.calendar.id, { title, bounty, ...(newDue() ? { due: newDue() } : {}) });
    setNewTitle('');
    setNewBounty(String(props.calendar.defaultBounty));
    setNewDue(weekAfter(props.now()));
  }

  const actions: TodoActions = {
    calendarId: () => props.calendar.id,
    today,
    todos: () => props.calendar.todos,
    shows,
    afterDelete: () => titleInput?.focus(),
  };

  return (
    <>
      <h2 class="todo-heading">{props.calendar.name}</h2>
      <div class="todo-grid" style={{ '--cal-color': props.calendar.color }}>
        <CalendarGrid
          calendar={props.calendar}
          isLight={props.isLight}
          now={props.now}
          onOpenDay={key => setFilterKey(current => (current === key ? null : key))}
        />
      </div>

      <form class="todo-add" onSubmit={add}>
        <input
          ref={el => { titleInput = el; }}
          type="text"
          class="todo-add-title"
          placeholder="What needs doing?"
          aria-label="New todo title"
          value={newTitle()}
          onInput={e => setNewTitle(e.currentTarget.value)}
        />
        <input
          type="text"
          inputmode="decimal"
          class="todo-add-bounty"
          aria-label="New todo bounty"
          value={newBounty()}
          onInput={e => setNewBounty(e.currentTarget.value)}
        />
        <input
          type="date"
          class="todo-add-due"
          aria-label="New todo due date"
          value={newDue()}
          onInput={e => setNewDue(e.currentTarget.value)}
        />
        <button type="button" class="todo-icon-btn" aria-label="Clear new todo due date" onClick={() => setNewDue('')}>×</button>
        <button type="submit" class="create-btn">Add</button>
      </form>

      <Show when={filterKey()}>
        {key => (
          <div class="todo-filter">
            <span>Showing {formatDate(parseKey(key()))}</span>
            <button type="button" class="todo-text-btn" onClick={() => setFilterKey(null)}>Clear</button>
          </div>
        )}
      </Show>

      <TodoList todos={props.calendar.todos} parent={null} actions={actions} />
    </>
  );
}

interface TodoActions {
  calendarId: () => string;
  today: () => string;
  todos: () => Todo[];
  shows: (todo: Todo) => boolean;
  afterDelete: () => void;
}

function TodoList(props: { todos: readonly Todo[]; parent: Todo | null; actions: TodoActions }) {
  return (
    <ul class={props.parent === null ? 'todo-tree' : 'todo-children'}>
      <For each={ordered(props.todos).filter(props.actions.shows)}>
        {todo => <TodoRow todo={todo} parent={props.parent} actions={props.actions} />}
      </For>
    </ul>
  );
}

function TodoRow(props: { todo: Todo; parent: Todo | null; actions: TodoActions }) {
  const [expanded, setExpanded] = createSignal(true);
  const [nudging, setNudging] = createSignal(false);
  const calId = () => props.actions.calendarId();
  const done = () => props.todo.done !== undefined;
  const isRoot = () => props.parent === null;
  const cancelled = () => isCancelled(props.actions.todos(), props.todo.id);

  /** Why the checkbox is disabled, or `null` when it is not. */
  const blocked = () => {
    if (cancelled()) return 'it is cancelled';
    if (!done() && !canMarkDone(props.actions.todos(), props.todo.id)) return 'finish its Nudges first';
    if (done() && props.parent?.done !== undefined) return 'its parent is done';
    return null;
  };

  function toggleDone(checked: boolean) {
    if (checked) store.markTodoDone(calId(), props.todo.id, props.actions.today());
    else store.reopenTodo(calId(), props.todo.id);
  }

  function promote() {
    const id = props.todo.id;
    if (store.promoteTodo(calId(), id)) focusTitle(id);
  }

  function cancel() {
    const id = props.todo.id;
    if (store.cancelTodo(calId(), id)) focusTitle(id);
  }

  function restore() {
    const id = props.todo.id;
    if (store.restoreTodo(calId(), id)) focusTitle(id);
  }

  /** Deleting is final, so it confirms through a native dialog — specs/04-06-todo-page.md. */
  function remove() {
    const nudges = countNudges(props.todo);
    const also = nudges === 0 ? '' : ` and its ${nudges} Nudge${nudges === 1 ? '' : 's'}`;
    if (!confirm(`Permanently delete "${props.todo.title}"${also}? This cannot be undone.`)) return;
    if (store.deleteTodo(calId(), props.todo.id)) props.actions.afterDelete();
  }

  return (
    <li class="todo" classList={{ done: done(), cancelled: cancelled() }} data-id={props.todo.id}>
      <div class="todo-row">
        <Show when={props.todo.children.length > 0} fallback={<span class="todo-toggle-space" />}>
          <button
            type="button"
            class="todo-toggle"
            aria-expanded={expanded()}
            aria-label={`Nudges of ${props.todo.title}`}
            onClick={() => setExpanded(!expanded())}
          >
            {expanded() ? '▾' : '▸'}
          </button>
        </Show>
        <input
          type="checkbox"
          class="todo-check"
          checked={done()}
          disabled={blocked() !== null}
          aria-label={`Done: ${props.todo.title}${blocked() ? ` — ${blocked()}` : ''}`}
          onChange={e => toggleDone(e.currentTarget.checked)}
        />
        <InlineText
          class="todo-title"
          name={`Title: ${props.todo.title}`}
          readOnly={cancelled()}
          value={props.todo.title}
          commit={title => title.trim() !== '' && store.editTodo(calId(), props.todo.id, { title: title.trim() })}
        />
        <Show when={isRoot()} fallback={<span class="todo-bounty">{props.todo.bounty}</span>}>
          <InlineText
            class="todo-bounty-input"
            name={`Bounty: ${props.todo.title}`}
            readOnly={cancelled()}
            value={String(props.todo.bounty)}
            inputmode="decimal"
            commit={text => {
              const value = Number.parseFloat(text);
              return Number.isFinite(value) && store.editTodo(calId(), props.todo.id, { bounty: value });
            }}
          />
        </Show>
        <Show when={props.todo.cancelled !== undefined}>
          <span class="todo-cancelled-note">Cancelled</span>
        </Show>
        <Show
          when={done() || cancelled()}
          fallback={
            <span class="todo-due" classList={{ overdue: props.todo.due !== undefined && props.todo.due < props.actions.today() }}>
              <input
                type="date"
                aria-label={`Due: ${props.todo.title}`}
                value={props.todo.due ?? ''}
                onChange={e => e.currentTarget.value && store.editTodo(calId(), props.todo.id, { due: e.currentTarget.value })}
              />
              <Show when={props.todo.due !== undefined}>
                <button
                  type="button"
                  class="todo-icon-btn"
                  aria-label={`Clear due date: ${props.todo.title}`}
                  onClick={() => store.editTodo(calId(), props.todo.id, { due: null })}
                >
                  ×
                </button>
              </Show>
            </span>
          }
        >
          <span class="todo-done-on">
            <Show when={done()}>
            <input
              type="date"
              readOnly={cancelled()}
              aria-label={`Done on: ${props.todo.title}`}
              value={props.todo.done}
              min={props.todo.created}
              max={props.actions.today()}
              onChange={e => {
                const input = e.currentTarget;
                if (!store.editTodo(calId(), props.todo.id, { done: input.value })) input.value = props.todo.done ?? '';
              }}
            />
            </Show>
          </span>
        </Show>
        <span class="todo-actions">
          <Show when={canRestore(props.actions.todos(), props.todo.id)}>
            <button type="button" class="todo-text-btn" aria-label={`Restore ${props.todo.title}`} onClick={restore}>
              Restore
            </button>
            <button type="button" class="todo-text-btn todo-delete" aria-label={`Delete ${props.todo.title}`} onClick={remove}>
              Delete
            </button>
          </Show>
          <Show when={canNudge(props.actions.todos(), props.todo.id)}>
            <button type="button" class="todo-text-btn" aria-label={`Nudge ${props.todo.title}`} onClick={() => setNudging(true)}>
              Nudge
            </button>
          </Show>
          <Show when={!isRoot() && !cancelled()}>
            <button type="button" class="todo-text-btn" aria-label={`Promote ${props.todo.title}`} onClick={promote}>
              Promote
            </button>
          </Show>
          <Show when={!cancelled()}>
            <button type="button" class="todo-text-btn" aria-label={`Cancel ${props.todo.title}`} onClick={cancel}>
              Cancel
            </button>
          </Show>
        </span>
      </div>
      <Show when={nudging()}>
        <NudgeInput
          parentTitle={props.todo.title}
          add={title => store.addNudge(calId(), props.todo.id, title)}
          close={() => setNudging(false)}
        />
      </Show>
      <Show when={expanded() && props.todo.children.length > 0}>
        <TodoList todos={props.todo.children} parent={props.todo} actions={props.actions} />
      </Show>
    </li>
  );
}

function countNudges(todo: Todo): number {
  return todo.children.reduce((total, child) => total + 1 + countNudges(child), 0);
}

/** The inline "smallest next step" input under a row: Enter adds, Escape or empty cancels. */
function NudgeInput(props: { parentTitle: string; add: (title: string) => void; close: () => void }) {
  const [text, setText] = createSignal('');
  let input: HTMLInputElement | undefined;
  createEffect(() => input?.focus());

  function finish(save: boolean) {
    const title = text().trim();
    if (save && title) props.add(title);
    props.close();
  }

  return (
    <input
      ref={el => { input = el; }}
      type="text"
      class="todo-nudge-input"
      placeholder="Smallest next step…"
      aria-label={`Smallest next step for ${props.parentTitle}`}
      value={text()}
      onInput={e => setText(e.currentTarget.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(false)}
    />
  );
}

/**
 * A text field that edits a stored value in place: the in-flight edit stands while it
 * has focus, Enter or blur commits, Escape restores. A refused commit restores too.
 */
function InlineText(props: {
  class: string;
  name: string;
  value: string;
  inputmode?: 'decimal';
  readOnly?: boolean;
  commit: (text: string) => boolean;
}) {
  const [text, setText] = createSignal(props.value);
  const [focused, setFocused] = createSignal(false);
  createEffect(() => {
    const stored = props.value;
    if (!focused()) setText(stored);
  });

  return (
    <input
      type="text"
      class={props.class}
      aria-label={props.name}
      inputmode={props.inputmode}
      readOnly={props.readOnly}
      value={text()}
      onInput={e => setText(e.currentTarget.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        if (text() !== props.value && !props.commit(text())) setText(props.value);
        setFocused(false);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') { setText(props.value); e.currentTarget.blur(); }
      }}
    />
  );
}
