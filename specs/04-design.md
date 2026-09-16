# Design

## Visual style
- Dark UI by default, with light/dark/system theme toggle.
- GitHub-like palette for heatmap in both themes.
- Compact card layout for each calendar.
- Heatmap grid with color intensity based on activity count.
- Clear hover, focus, today, and selected outlines.
- Heatmap zero-activity cell color adapts to the resolved theme (light or dark).

## Layout
- Header contains title, subtitle, and theme toggle (Light / Dark / System).
- Score chart at top showing combined daily score from all calendars.
- Create form, calendar cards, hint, trash section.
- Calendar card header contains name, total, and a "…" overflow menu housing color picker, activity value, reorder, and delete controls.
- Grid and detail panel sit side by side on desktop.
- Grid and detail stack on mobile.

## Controls
- Text input for new calendar name.
- Inline text input for calendar rename.
- Color picker for calendar theme color.
- Buttons for reorder, delete, recover, purge.
- Per-calendar controls (color, reorder, delete) collected in a "…" overflow menu.
- Calendar cells act as buttons.

## Copy
- Default title: "🏆 Achievement Calendars".
- Subtitle: "Track daily wins".
- Hint explains click and long-press behavior.
- Banner below header reminding to export backup if 24+ hours since last export.
- Banner has dismiss button and export-now button.
- Banner appears on page load, not live-countdown.
- Dismiss hides banner for session.
