---
id: 0006
affects:
  specs: [04-design.md, 06-accessibility.md, 02-architecture.md, 04-02-copy.md]
  paths: [src/App.tsx, src/components/CalendarMenu.tsx, src/App.css]
tags: [ui, menu, header, accessibility]
links: {}
---
## Outcome
Decision: the header keeps only title and subtitle plus one ☰ hamburger button at its right. The
hamburger menu holds New calendar (opens the create bar and closes the menu), Import, Export all,
and the theme as three radio items (Light / Dark / System). Each calendar's overflow menu trigger
becomes a ⋮ vertical-dots (kebab) button; its contents are unchanged. The hamburger follows the
same keyboard and ARIA rules as the calendar menu (role="menu", arrows, Home/End, Escape and
click-outside close, focus returns to the trigger).
Rejected:
1. Keeping theme, create, import and export as separate header buttons: the operator wants them
   collected into one menu.
2. A ⋯ horizontal-dots trigger (today's "…"), restyled or not: the operator chose kebab.
Reopen if: the header gains a control that must stay one tap away.

## Thread
> Operator asked in chat: collect the top menu items into a hamburger menu, and change the
> per-calendar menus into "sushi" menus. How exactly should both menus look and behave?
>
> Today the header row holds the theme dropdown, the create toggle (+), Import, and Export all.
> Each calendar has a "…" (horizontal dots) overflow menu with colour, activity value, move up,
> move down, Export, and Delete.
>
> Q1. Hamburger contents: move all four header controls (theme, create, import, export all) into
> one ☰ button at the header's right, leaving only title and subtitle beside it? Theme becomes
> three radio items (Light / Dark / System) inside the menu. Proposed: yes.
> Q2. "Sushi menu" is not a standard name I can pin down. Which do you mean?
>   (a) ⋮ vertical dots (often called "kebab")
>   (b) ⋯ horizontal dots in a pill/rounded button (what "…" is today, restyled)
>   (c) something else — describe or sketch it
> Q3. The hamburger follows the same keyboard rules as the calendar menu in
> `06-accessibility.md` (role="menu", arrow keys, Home/End, Escape and click-outside close,
> focus returns to the button). Proposed: yes.
> Q4. Choosing "New calendar" in the hamburger opens the existing create bar below the header,
> and closes the menu. Proposed: yes.

Q1: fine
Q2: let's go with kebab
Q3: no opinion
Q4: fine

decided!

> Q1, Q4: adopted as proposed. Q2: kebab (⋮). Q3: with no preference stated, I apply the
> proposal — the hamburger uses the calendar menu's keyboard rules, so the app has one menu
> behaviour. Decided in thread; renamed A → R. Applying now.

> Applied: header ☰ menu and ⋮ calendar trigger, sharing one menu helper; specs 04-design,
> 06-accessibility, 02-architecture and the browser and manual test lists updated;
> `e2e/menus.e2e.ts` added. Renamed R → T.
