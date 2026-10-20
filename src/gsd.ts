import type { Todo } from './types';

/**
 * Getting Stuff Done: a GSD calendar's per-day figures, derived from its todo
 * tree on every read, and the rules that change the tree.
 *
 * `specs/03-04-gsd-points.md` is authoritative. The mutators work on a plain
 * todo array in place, so the store can run them inside `produce` and the tests
 * can run them on fixtures; each returns whether it changed anything.
 */

/** A Nudge's fixed bounty, and its creation points. */
export const NUDGE_BOUNTY = 0.5;

const ROOT_CREATION_POINTS = 1;
const NUDGE_CREATION_POINTS = 0.5;

export interface GsdDay {
  /** Root todos done that day. */
  activities: number;
  points: number;
  /** Todos of any depth created that day. */
  created: number;
  /** Todos of any depth done that day. */
  finished: number;
  /** Open todos due that day. */
  due: number;
}

const emptyDay = (): GsdDay => ({ activities: 0, points: 0, created: 0, finished: 0, due: 0 });

/** On time: no due date, or done on or before it. Only meaningful for a done todo. */
function onTime(todo: Todo): boolean {
  return todo.due === undefined || (todo.done !== undefined && todo.done <= todo.due);
}

/** Every date the tree touches, with its figures; dates it never touches are absent. */
export function gsdDays(todos: readonly Todo[]): Record<string, GsdDay> {
  const days: Record<string, GsdDay> = {};
  const day = (key: string) => (days[key] ??= emptyDay());

  const walk = (list: readonly Todo[], root: boolean) => {
    for (const todo of list) {
      const created = day(todo.created);
      created.created += 1;
      created.points += root ? ROOT_CREATION_POINTS : NUDGE_CREATION_POINTS;
      if (todo.done !== undefined) {
        const done = day(todo.done);
        done.finished += 1;
        if (root) done.activities += 1;
        done.points += onTime(todo) ? todo.bounty : todo.bounty / 2;
      } else if (todo.due !== undefined) {
        day(todo.due).due += 1;
      }
      walk(todo.children, false);
    }
  };
  walk(todos, true);
  return days;
}

/* ── locating todos ──────────────────────────────────────────────────────── */

interface Found {
  todo: Todo;
  /** The array holding it: the calendar's roots, or its parent's children. */
  siblings: Todo[];
  parent: Todo | null;
  grandparentSiblings: Todo[] | null;
}

function find(todos: Todo[], id: string, parent: Todo | null = null, parentSiblings: Todo[] | null = null): Found | null {
  for (const todo of todos) {
    if (todo.id === id) return { todo, siblings: todos, parent, grandparentSiblings: parentSiblings };
    const inner = find(todo.children, id, todo, todos);
    if (inner) return inner;
  }
  return null;
}

/** `find` over a read-only tree; the rule checks never write. */
const lookup = (todos: readonly Todo[], id: string) => find(todos as Todo[], id);

/* ── rules ───────────────────────────────────────────────────────────────── */

export function addRootTodo(
  todos: Todo[],
  fields: { id: string; title: string; bounty: number; due?: string },
  today: string,
): void {
  const todo: Todo = { id: fields.id, title: fields.title, bounty: fields.bounty, created: today, children: [] };
  if (fields.due !== undefined) todo.due = fields.due;
  todos.push(todo);
}

/** A done todo takes no new Nudge. */
export function canNudge(todos: readonly Todo[], id: string): boolean {
  const found = lookup(todos, id);
  return found !== null && found.todo.done === undefined;
}

/** A Nudge has a fixed bounty and starts with its parent's due date. */
export function addNudge(todos: Todo[], parentId: string, fields: { id: string; title: string }, today: string): boolean {
  if (!canNudge(todos, parentId)) return false;
  const parent = find(todos, parentId)!.todo;
  const nudge: Todo = { id: fields.id, title: fields.title, bounty: NUDGE_BOUNTY, created: today, children: [] };
  if (parent.due !== undefined) nudge.due = parent.due;
  parent.children.push(nudge);
  return true;
}

/** Open, with no open child. */
export function canMarkDone(todos: readonly Todo[], id: string): boolean {
  const found = lookup(todos, id);
  return found !== null && found.todo.done === undefined && found.todo.children.every(child => child.done !== undefined);
}

/** `date` must lie between the todo's creation and `today`, inclusive. */
export function markDone(todos: Todo[], id: string, date: string, today: string): boolean {
  if (!canMarkDone(todos, id)) return false;
  const todo = find(todos, id)!.todo;
  if (date < todo.created || date > today) return false;
  todo.done = date;
  return true;
}

/** Done, under a parent that is not. */
export function canReopen(todos: readonly Todo[], id: string): boolean {
  const found = lookup(todos, id);
  return found !== null && found.todo.done !== undefined && found.parent?.done === undefined;
}

export function reopenTodo(todos: Todo[], id: string): boolean {
  if (!canReopen(todos, id)) return false;
  delete find(todos, id)!.todo.done;
  return true;
}

/** Removes the todo and its whole subtree. */
export function deleteTodo(todos: Todo[], id: string): boolean {
  const found = find(todos, id);
  if (!found) return false;
  found.siblings.splice(found.siblings.indexOf(found.todo), 1);
  return true;
}

/**
 * Moves a Nudge, subtree included, to its grandparent's children right after
 * its parent. Landing among the roots makes it a root todo, whose bounty becomes
 * the larger of a Nudge's and the calendar default.
 */
export function promoteTodo(todos: Todo[], id: string, defaultBounty: number): boolean {
  const found = find(todos, id);
  if (!found || found.parent === null || found.grandparentSiblings === null) return false;
  const { todo, siblings, parent, grandparentSiblings } = found;
  siblings.splice(siblings.indexOf(todo), 1);
  grandparentSiblings.splice(grandparentSiblings.indexOf(parent) + 1, 0, todo);
  if (grandparentSiblings === todos) todo.bounty = Math.max(NUDGE_BOUNTY, defaultBounty);
  return true;
}

/**
 * Changes a todo's title, bounty, due date or done date; `due: null` removes the
 * due date. A Nudge's bounty is fixed, a bounty is never negative, and a done date
 * moves only on a done todo, between its creation and `today`: any of these refuses
 * the whole edit.
 */
export function editTodo(
  todos: Todo[],
  id: string,
  fields: { title?: string; bounty?: number; due?: string | null; done?: string },
  today = '',
): boolean {
  const found = find(todos, id);
  if (!found) return false;
  if (fields.done !== undefined) {
    const { todo } = found;
    if (todo.done === undefined || fields.done < todo.created || fields.done > today) return false;
  }
  if (fields.bounty !== undefined) {
    if (found.parent !== null || !Number.isFinite(fields.bounty) || fields.bounty < 0) return false;
  }
  const { todo } = found;
  if (fields.title !== undefined) todo.title = fields.title;
  if (fields.bounty !== undefined) todo.bounty = fields.bounty;
  if (fields.due === null) delete todo.due;
  else if (fields.due !== undefined) todo.due = fields.due;
  if (fields.done !== undefined) todo.done = fields.done;
  return true;
}
