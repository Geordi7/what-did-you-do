# Agents

@specs/00-meta.md

This project uses the specsify convention: read `specs/00-meta.md` in full at the start of every session and follow it. It is imported above for agents that resolve `@` includes.

## Must read
- `specs/01-requirements.md`
- Any domain specs for change scope, and the threads that affect them

## Project rules
- Run the thread sweep from `00-meta.md` at session start.
- Check for drift as its own activity every few commits, not as part of every activity: compare specs against implementation, and update specs first where code has diverged.
