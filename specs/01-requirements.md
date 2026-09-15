# Requirements

Project: achievement calendar app.

## Core intent
- Track daily activity counts in one or more calendars.
- Persist calendar state locally.
- Support create, edit, reorder, delete, recover, and purge flows.

## User interactions
- Click/tap day to increment activity count.
- Long-press day to reset count.
- Rename calendar inline.
- Change calendar color.
- Add new calendar by name.
- Reorder active calendars.
- Recover deleted calendars from trash.
- Empty trash with explicit confirmation.

## UI expectations
- Heatmap-style calendar grid.
- Per-calendar activity totals.
- Detail view for selected/hovered day.
- Responsive layout on small screens.
- Clear visual states for today, focus, hover, and selection.

## Data expectations
- Counts persist across reloads.
- Deleted calendars remain recoverable until purged.
- State migration may be needed when schema changes.
- Each calendar has an Activity Value (float) for scoring.
- Daily score = sum across calendars of (activityValue * count).
- Score chart at top shows last 26 weeks of daily scores.
