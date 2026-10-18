---
id: 0006
affects:
  specs: [04-design.md, 06-accessibility.md, 02-architecture.md, 04-02-copy.md]
  paths: [src/App.tsx, src/components/CalendarMenu.tsx, src/App.css]
tags: [ui, menu, header, accessibility]
links: {}
---
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
