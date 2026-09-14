# Testing

## Goals
- Verify calendar CRUD flows.
- Verify day increment, reset, and keyboard interaction.
- Verify persistence across reloads.
- Verify migration from old stored state.
- Verify responsive layout behavior.

## Manual checks
- Add new calendar.
- Rename calendar.
- Change calendar color.
- Move calendar up and down.
- Click day to increment count.
- Long-press day to clear count.
- Use keyboard Enter, Space, Backspace, Delete on focused cell.
- Delete calendar, then recover it.
- Empty trash after confirmation.
- Reload page and confirm state persists.

## Build verification
- TypeScript build must pass.
- Vite production build must succeed.
