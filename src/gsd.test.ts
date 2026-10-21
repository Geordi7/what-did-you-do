import { describe, expect, it } from 'vitest';
import {
  NUDGE_BOUNTY,
  addNudge,
  addRootTodo,
  canMarkDone,
  canNudge,
  canReopen,
  canRestore,
  cancelTodo,
  deleteTodo,
  isCancelled,
  restoreTodo,
  editTodo,
  gsdDays,
  markDone,
  promoteTodo,
  reopenTodo,
} from './gsd';
import type { Todo } from './types';

/** Fixture todos, per `specs/03-04-gsd-points.md`. */
const todo = (id: string, extra: Partial<Todo> = {}): Todo => ({
  id, title: id, bounty: 1, created: '2026-10-01', children: [], ...extra,
});

const ids = (todos: Todo[]): unknown => todos.map(t => (t.children.length ? [t.id, ids(t.children)] : t.id));

describe('gsdDays', () => {
  it('earns 1 for creating a root todo and 0.5 for a Nudge, on the creation day', () => {
    const days = gsdDays([todo('a', { children: [todo('b', { bounty: NUDGE_BOUNTY, created: '2026-10-02', children: [todo('c', { bounty: NUDGE_BOUNTY, created: '2026-10-02' })] })] })]);
    expect(days['2026-10-01']).toEqual({ points: 1, created: 1, finished: 0, due: 0 });
    expect(days['2026-10-02']).toEqual({ points: 1, created: 2, finished: 0, due: 0 });
  });

  it('earns the full bounty when done on or before the due date, or with no due date', () => {
    const days = gsdDays([
      todo('onDay', { bounty: 3, due: '2026-10-05', done: '2026-10-05' }),
      todo('early', { bounty: 2, due: '2026-10-09', done: '2026-10-05' }),
      todo('noDue', { bounty: 4, done: '2026-10-06' }),
    ]);
    expect(days['2026-10-05']).toEqual({ points: 5, created: 0, finished: 2, due: 0 });
    expect(days['2026-10-06']).toEqual({ points: 4, created: 0, finished: 1, due: 0 });
  });

  it('earns half the bounty when done after the due date', () => {
    const days = gsdDays([todo('late', { bounty: 3, due: '2026-10-04', done: '2026-10-05' })]);
    expect(days['2026-10-05'].points).toBe(1.5);
  });

  it('counts todos done at every depth as finished', () => {
    const days = gsdDays([todo('a', { done: '2026-10-03', children: [todo('b', { bounty: NUDGE_BOUNTY, done: '2026-10-03' })] })]);
    expect(days['2026-10-03']).toEqual({ points: 1.5, created: 0, finished: 2, due: 0 });
  });

  it('counts open todos due on a day, at any depth, and not done ones', () => {
    const days = gsdDays([
      todo('a', { due: '2026-10-08', children: [todo('b', { bounty: NUDGE_BOUNTY, due: '2026-10-08' })] }),
      todo('c', { due: '2026-10-08', done: '2026-10-02' }),
    ]);
    expect(days['2026-10-08']).toEqual({ points: 0, created: 0, finished: 0, due: 2 });
  });

  it('reports nothing for a calendar with no todos', () => {
    expect(gsdDays([])).toEqual({});
  });
});

describe('todo rules', () => {
  it('adds a root todo with the given bounty and due date, created today, at the end', () => {
    const todos = [todo('a')];
    addRootTodo(todos, { id: 'b', title: 'Write', bounty: 2, due: '2026-10-26' }, '2026-10-19');
    expect(todos[1]).toEqual({ id: 'b', title: 'Write', bounty: 2, due: '2026-10-26', created: '2026-10-19', children: [] });
    addRootTodo(todos, { id: 'c', title: 'Someday', bounty: 1 }, '2026-10-19');
    expect(todos[2]).not.toHaveProperty('due');
  });

  it('adds a Nudge with a fixed 0.5 bounty and its parent due date, created today', () => {
    const todos = [todo('a', { bounty: 5, due: '2026-10-20' })];
    expect(addNudge(todos, 'a', { id: 'b', title: 'Open the file' }, '2026-10-19')).toBe(true);
    expect(todos[0].children).toEqual([{ id: 'b', title: 'Open the file', bounty: NUDGE_BOUNTY, due: '2026-10-20', created: '2026-10-19', children: [] }]);
    expect(NUDGE_BOUNTY).toBe(0.5);
    addNudge(todos, 'b', { id: 'c', title: 'Find it' }, '2026-10-19');
    expect(ids(todos)).toEqual([['a', [['b', ['c']]]]]);
  });

  it('gives a Nudge no due date when its parent has none', () => {
    const todos = [todo('a')];
    addNudge(todos, 'a', { id: 'b', title: 'Step' }, '2026-10-19');
    expect(todos[0].children[0]).not.toHaveProperty('due');
  });

  it('refuses a Nudge on a done todo', () => {
    const todos = [todo('a', { done: '2026-10-02' })];
    expect(canNudge(todos, 'a')).toBe(false);
    expect(addNudge(todos, 'a', { id: 'b', title: 'Step' }, '2026-10-19')).toBe(false);
    expect(todos[0].children).toEqual([]);
    expect(canNudge(todos, 'missing')).toBe(false);
  });

  it('marks a todo done on a day between its creation and today', () => {
    const todos = [todo('a', { created: '2026-10-05' })];
    expect(markDone(todos, 'a', '2026-10-04', '2026-10-19')).toBe(false);
    expect(markDone(todos, 'a', '2026-10-20', '2026-10-19')).toBe(false);
    expect(todos[0]).not.toHaveProperty('done');
    expect(markDone(todos, 'a', '2026-10-05', '2026-10-19')).toBe(true);
    expect(todos[0].done).toBe('2026-10-05');
  });

  it('refuses to mark done a todo with an open child', () => {
    const todos = [todo('a', { children: [todo('b', { bounty: NUDGE_BOUNTY })] })];
    expect(canMarkDone(todos, 'a')).toBe(false);
    expect(markDone(todos, 'a', '2026-10-19', '2026-10-19')).toBe(false);
    expect(markDone(todos, 'b', '2026-10-19', '2026-10-19')).toBe(true);
    expect(canMarkDone(todos, 'a')).toBe(true);
    expect(markDone(todos, 'a', '2026-10-19', '2026-10-19')).toBe(true);
  });

  it('reopens a done todo unless its parent is done', () => {
    const todos = [todo('a', { done: '2026-10-03', children: [todo('b', { bounty: NUDGE_BOUNTY, done: '2026-10-02' })] })];
    expect(canReopen(todos, 'b')).toBe(false);
    expect(reopenTodo(todos, 'b')).toBe(false);
    expect(todos[0].children[0].done).toBe('2026-10-02');
    expect(reopenTodo(todos, 'a')).toBe(true);
    expect(todos[0]).not.toHaveProperty('done');
    expect(reopenTodo(todos, 'b')).toBe(true);
    expect(todos[0].children[0]).not.toHaveProperty('done');
  });

  it('deletes only a todo that carries its own cancelled date, with its subtree', () => {
    const todos = [todo('a', { cancelled: '2026-10-05', children: [todo('b', { children: [todo('c')] }), todo('d')] }), todo('e')];
    expect(deleteTodo(todos, 'e')).toBe(false);
    expect(deleteTodo(todos, 'b')).toBe(false);
    expect(ids(todos)).toEqual([['a', [['b', ['c']], 'd']], 'e']);
    expect(deleteTodo(todos, 'a')).toBe(true);
    expect(ids(todos)).toEqual(['e']);
    expect(deleteTodo(todos, 'missing')).toBe(false);
  });

  it('promotes a Nudge, subtree included, to its grandparent, right after its parent', () => {
    const todos = [
      todo('a', { children: [todo('b', { bounty: NUDGE_BOUNTY, children: [todo('c', { bounty: NUDGE_BOUNTY, children: [todo('d', { bounty: NUDGE_BOUNTY })] }), todo('x', { bounty: NUDGE_BOUNTY })] }), todo('y', { bounty: NUDGE_BOUNTY })] }),
    ];
    expect(promoteTodo(todos, 'c', 3)).toBe(true);
    expect(ids(todos)).toEqual([['a', [['b', ['x']], ['c', ['d']], 'y']]]);
    // Between Nudge levels nothing stored changes.
    expect(todos[0].children[1]).toMatchObject({ id: 'c', bounty: NUDGE_BOUNTY });
  });

  it('promotes to root with the larger of 0.5 and the default bounty, keeping its creation day', () => {
    const todos = [todo('a', { children: [todo('b', { bounty: NUDGE_BOUNTY, created: '2026-10-03' })] }), todo('z')];
    expect(promoteTodo(todos, 'b', 3)).toBe(true);
    expect(ids(todos)).toEqual(['a', 'b', 'z']);
    expect(todos[1]).toMatchObject({ bounty: 3, created: '2026-10-03' });
    // As a root todo its creation now earns 1 on its original day.
    expect(gsdDays(todos)['2026-10-03'].points).toBe(1);

    const low = [todo('a', { children: [todo('b', { bounty: NUDGE_BOUNTY })] })];
    promoteTodo(low, 'b', 0.25);
    expect(low[1].bounty).toBe(0.5);
  });

  it('refuses to promote a root todo', () => {
    const todos = [todo('a')];
    expect(promoteTodo(todos, 'a', 1)).toBe(false);
    expect(promoteTodo(todos, 'missing', 1)).toBe(false);
    expect(ids(todos)).toEqual(['a']);
  });

  it('edits a title, a root bounty and a due date, and removes a due date', () => {
    const todos = [todo('a', { due: '2026-10-08', children: [todo('b', { bounty: NUDGE_BOUNTY, due: '2026-10-08' })] })];
    expect(editTodo(todos, 'a', { title: 'Renamed', bounty: 4, due: '2026-10-12' })).toBe(true);
    expect(todos[0]).toMatchObject({ title: 'Renamed', bounty: 4, due: '2026-10-12' });
    expect(editTodo(todos, 'a', { due: null })).toBe(true);
    expect(todos[0]).not.toHaveProperty('due');
    expect(todos[0].title).toBe('Renamed');
    expect(editTodo(todos, 'b', { title: 'Smaller', due: '2026-10-09' })).toBe(true);
    expect(todos[0].children[0]).toMatchObject({ title: 'Smaller', due: '2026-10-09' });
  });

  it('keeps a Nudge bounty fixed, and refuses a negative bounty or a missing todo', () => {
    const todos = [todo('a', { children: [todo('b', { bounty: NUDGE_BOUNTY })] })];
    expect(editTodo(todos, 'b', { bounty: 3 })).toBe(false);
    expect(todos[0].children[0].bounty).toBe(NUDGE_BOUNTY);
    expect(editTodo(todos, 'a', { bounty: -1 })).toBe(false);
    expect(editTodo(todos, 'a', { bounty: Number.NaN })).toBe(false);
    expect(todos[0].bounty).toBe(1);
    expect(editTodo(todos, 'missing', { title: 'x' })).toBe(false);
  });

  it('moves a done date within creation and today, and only on a done todo', () => {
    const todos = [todo('a', { created: '2026-10-05', done: '2026-10-10' }), todo('b')];
    expect(editTodo(todos, 'a', { done: '2026-10-07' }, '2026-10-19')).toBe(true);
    expect(todos[0].done).toBe('2026-10-07');
    expect(editTodo(todos, 'a', { done: '2026-10-04' }, '2026-10-19')).toBe(false);
    expect(editTodo(todos, 'a', { done: '2026-10-20' }, '2026-10-19')).toBe(false);
    expect(todos[0].done).toBe('2026-10-07');
    expect(editTodo(todos, 'b', { done: '2026-10-07' }, '2026-10-19')).toBe(false);
    expect(todos[1]).not.toHaveProperty('done');
  });
});

describe('cancelling', () => {
  it('drops a cancelled todo and its whole subtree from every figure', () => {
    const tree = [
      todo('a', { due: '2026-10-08', cancelled: '2026-10-06', children: [
        todo('a1', { bounty: NUDGE_BOUNTY, created: '2026-10-02', done: '2026-10-03', children: [todo('a1x', { bounty: NUDGE_BOUNTY, due: '2026-10-08', created: '2026-10-02' })] }),
      ] }),
      todo('b', { done: '2026-10-03', children: [todo('b1', { bounty: NUDGE_BOUNTY, created: '2026-10-02', due: '2026-10-08', cancelled: '2026-10-04' })] }),
    ];
    const days = gsdDays(tree);
    expect(days['2026-10-01']).toEqual({ points: 1, created: 1, finished: 0, due: 0 });
    expect(days['2026-10-02']).toBeUndefined();
    expect(days['2026-10-03']).toEqual({ points: 1, created: 0, finished: 1, due: 0 });
    expect(days['2026-10-08']).toBeUndefined();
  });

  it('tells a cancelled todo by its own date or an ancestor\'s', () => {
    const tree = [todo('a', { cancelled: '2026-10-06', children: [todo('a1')] }), todo('b', { children: [todo('b1')] })];
    expect(isCancelled(tree, 'a')).toBe(true);
    expect(isCancelled(tree, 'a1')).toBe(true);
    expect(isCancelled(tree, 'b')).toBe(false);
    expect(isCancelled(tree, 'b1')).toBe(false);
  });

  it('cancels an open or done todo today, once', () => {
    const tree = [todo('a', { done: '2026-10-03' }), todo('b', { children: [todo('b1')] })];
    expect(cancelTodo(tree, 'a', '2026-10-19')).toBe(true);
    expect(tree[0]).toMatchObject({ done: '2026-10-03', cancelled: '2026-10-19' });
    expect(cancelTodo(tree, 'a', '2026-10-20')).toBe(false);
    expect(tree[0].cancelled).toBe('2026-10-19');
    expect(cancelTodo(tree, 'b', '2026-10-19')).toBe(true);
    expect(cancelTodo(tree, 'b1', '2026-10-19')).toBe(false);
    expect(tree[1].children[0]).not.toHaveProperty('cancelled');
    expect(cancelTodo(tree, 'missing', '2026-10-19')).toBe(false);
  });

  it('lets a parent be ticked once its only open Nudge is cancelled', () => {
    const tree = [todo('a', { children: [todo('a1', { bounty: NUDGE_BOUNTY })] })];
    expect(canMarkDone(tree, 'a')).toBe(false);
    cancelTodo(tree, 'a1', '2026-10-19');
    expect(canMarkDone(tree, 'a')).toBe(true);
  });

  it('refuses every other rule on a cancelled todo', () => {
    const tree = [
      todo('a', { cancelled: '2026-10-06', children: [todo('a1', { bounty: NUDGE_BOUNTY })] }),
      todo('d', { done: '2026-10-03', cancelled: '2026-10-06' }),
    ];
    const before = JSON.stringify(tree);
    expect(canMarkDone(tree, 'a1')).toBe(false);
    expect(markDone(tree, 'a1', '2026-10-19', '2026-10-19')).toBe(false);
    expect(canReopen(tree, 'd')).toBe(false);
    expect(reopenTodo(tree, 'd')).toBe(false);
    expect(canNudge(tree, 'a')).toBe(false);
    expect(addNudge(tree, 'a1', { id: 'x', title: 'x' }, '2026-10-19')).toBe(false);
    expect(promoteTodo(tree, 'a1', 1)).toBe(false);
    expect(editTodo(tree, 'a', { title: 'Renamed' })).toBe(false);
    expect(editTodo(tree, 'a1', { due: null })).toBe(false);
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('restores a todo as it was, unless an ancestor is cancelled', () => {
    const tree = [todo('a', { cancelled: '2026-10-06', children: [todo('a1', { bounty: NUDGE_BOUNTY, cancelled: '2026-10-04' }), todo('a2', { bounty: NUDGE_BOUNTY, done: '2026-10-02' })] })];
    expect(canRestore(tree, 'a1')).toBe(false);
    expect(restoreTodo(tree, 'a1')).toBe(false);
    expect(canRestore(tree, 'a2')).toBe(false);
    expect(canRestore(tree, 'a')).toBe(true);
    expect(restoreTodo(tree, 'a')).toBe(true);
    expect(tree[0]).not.toHaveProperty('cancelled');
    expect(tree[0].children[1].done).toBe('2026-10-02');
    expect(tree[0].children[0].cancelled).toBe('2026-10-04');
    expect(canRestore(tree, 'a1')).toBe(true);
    expect(restoreTodo(tree, 'missing')).toBe(false);
  });
});
