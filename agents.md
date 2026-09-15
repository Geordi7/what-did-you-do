# Agents

Project follows spec-driven workflow.

## Must read
- `specs/00-meta.md`
- `specs/01-requirements.md`
- Any domain specs for change scope

## Workflow
1. Review specs first.
2. Split work into separable activities.
3. Update specs before code — always when intent changes, and also when drift is found.
4. Keep spec files under 150 lines.
5. Keep refined root specs under 50 lines.
6. Add observations in specs as HTML comments when QA finds issues.
7. Remove observations after fix.
8. Commit specs and code together.
9. Check for drift regularly: compare specs against implementation; update specs first if code has diverged.

## Notes
- Use `ls specs` to map spec tree.
- Search observations with:
  `grep -RIn --include='*.md' -E '^<!-- OBS' specs/`
- Do not edit `specs/00-meta.md`.
