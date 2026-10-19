# Requirements

Project: achievement calendar app.

## Core intent
- Track daily activity counts in one or more calendars.
- Persist calendar state locally.
- Support create, edit, reorder, soft-delete, recover, and per-item permanent delete flows.

## Features
- Calendars — any number, each with a name, a color, and an activity value.
- Heatmap grid per calendar over the trailing 26 weeks, with a per-calendar activity total.
- Detail view for the hovered day.
- Score chart above the calendars, with a range toggle:
  - Last 28 days — one bar per day, 28 bars.
  - Last 26 weeks — one bar per Monday-start week, 26 bars, each the sum of its days.
  - Both ranges split each bar into positive, negative, and net score.
  - Last 28 days is the range on first run; the choice persists.
- Trash — soft-deleted calendars stay recoverable, and each can be permanently deleted on its
  own, behind a confirmation. There is no bulk empty and no multi-select: trash is a safety net,
  so clearing it is deliberately tedious and must stay that way.
- Sort bar over the calendars: custom order, or by visible activities, visible score, or recency,
  each either way; the choice persists.
- Export and import of the full data set as a file.
- Banner prompting a full export backup when 24 or more hours have passed since the last export.

## User interactions
- Click/tap day to increment activity count.
- Long-press day to reset count.
- Keyboard on a focused day cell: Enter/Space increments, Backspace/Delete clears.
- Rename calendar inline.
- Change calendar color.
- Set a calendar's activity value.
- Add new calendar by name.
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
- Each calendar has an activity value (float) used for scoring.
- Daily score = sum across calendars of (activityValue * count).
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
