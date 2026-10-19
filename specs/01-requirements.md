# Requirements

Project: achievement calendar app.

## Core intent
- Track daily activity counts in one or more calendars.
- Get stuff done: a todo list built to help a mind that struggles to start, where breaking a task
  into its smallest next step is itself rewarded.
- Persist calendar state locally.
- Support create, edit, reorder, soft-delete, recover, and per-item permanent delete flows.

## Features
- Calendars of two kinds, any number of each:
  - scoring calendars — a name, a color, an activity value, and counted days;
  - Getting Stuff Done (GSD) calendars — a hierarchical todo list whose points derive from its
    todos, shown in the list like any calendar and opened as a full-page todo tool.
- Heatmap grid per calendar over 26 weeks: 22 ending with the current week, then 4 ahead, so every
  grid lines up; with a per-calendar activity total.
- Detail view for the hovered day.
- Score chart above the calendars, with a range toggle:
  - Last 28 days — one bar per day, 28 bars.
  - Last 22 weeks — one bar per Monday-start week, 22 bars, each the sum of its days.
  - Both ranges split each bar into positive, negative, and net score.
  - Last 28 days is the range on first run; the choice persists.
- Trash — soft-deleted calendars stay recoverable, and each can be permanently deleted on its
  own, behind a confirmation. There is no bulk empty and no multi-select: trash is a safety net,
  so clearing it is deliberately tedious and must stay that way.
- Sort bar over the calendars: custom order, or by visible activities, visible score, or recency,
  each either way; and a filter for all, scoring or GSD calendars. Both choices persist.
- Export and import of the full data set as a file.
- Banner prompting a full export backup when 24 or more hours have passed since the last export.

## User interactions
- Click/tap day to increment activity count.
- Long-press day to reset count.
- Keyboard on a focused day cell: Enter/Space increments, Backspace/Delete clears.
- Rename calendar inline.
- Change calendar color.
- Set a calendar's activity value.
- Add new calendar by name, choosing its kind.
- Reorder active calendars.
- Sort the calendar view without changing the custom order.
- Recover a deleted calendar from trash.
- Permanently delete a single trashed calendar.
- Switch the score chart range.
- Switch theme between light, dark, and system.
- Export all calendars to a file; import calendars from a file.
- Clear visual states for today, keyboard focus, and hover highlight.

## Data
- Counts persist across reloads.
- History is kept forever — nothing is pruned. The grid and chart show trailing windows over
  unbounded stored data.
- Deleted calendars remain recoverable until permanently deleted, one at a time.
- Stored state carries a schema version; older stored state migrates on load.
- Each scoring calendar has an activity value (float) used for scoring.
- Daily score = sum across scoring calendars of (activityValue * count), plus GSD points.
- Dates use the `en` locale, and weeks start on Monday.

## Quality attributes
- Local-first — all data lives in the browser; the running app makes no network calls.
- Immediate persistence — every mutation writes to local storage at once.
- Responsive — usable on small screens; the layout stacks rather than scrolls sideways.
- Keyboard accessible — every control is reachable and operable from the keyboard.

## Non-goals
- No accounts, no server, no multi-user.
- No cross-device sync. Tabs on the same device converge; devices do not.
- No telemetry.
- No PWA — no manifest, no service worker, no offline install.
