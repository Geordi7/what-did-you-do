# Calendars

Refines `03-data-model.md`. A calendar is a scoring calendar or a Getting Stuff Done (GSD)
calendar, told apart by `kind`.

## Shared fields
```ts
type Calendar = ScoringCalendar | GsdCalendar;

interface CalendarBase {
  id: string;                    // stable UUID, unique across the array
  name: string;
  color: string;                 // hex
  updatedAt: string;             // ISO 8601 instant
  deleted?: boolean;             // trash flag
}
```

- `updatedAt` is an ISO 8601 instant (`YYYY-MM-DDTHH:mm:ss.sssZ`, UTC) recording when the calendar
  was last changed, restamped by any change to it: a day count, a todo, rename, colour, activity
  value, default bounty, soft delete, recover, or a merge that alters it. It is a wall-clock time,
  unrelated to which dates the calendar holds. A change to another calendar leaves it alone.
- Day keys and todo dates are real Gregorian calendar dates in `YYYY-MM-DD` form, including valid
  leap days.

## Scoring calendar
```ts
interface ScoringCalendar extends CalendarBase {
  kind: 'scoring';
  days: Record<string, number>;  // YYYY-MM-DD -> count
  activityValue: number;
}
```

- Counts in `days` are finite integers `>= 0`; an absent key reads as zero, and resetting a day
  deletes its key rather than storing `0`. Total activities is the sum of the `days` values.
- `activityValue` is a finite float of any sign, default `1.0`. Negative weights are intended — the
  chart's positive/negative/net split depends on them.
- A day's score is its count times `activityValue`.

## GSD calendar
```ts
interface GsdCalendar extends CalendarBase {
  kind: 'gsd';
  defaultBounty: number;         // prefills a new root todo's bounty; default 1
  todos: Todo[];                 // root todos, in creation order
}

interface Todo {
  id: string;                    // UUID, unique across the calendar's whole tree
  title: string;
  bounty: number;                // points for finishing it on time
  due?: string;                  // YYYY-MM-DD; absent means no due date
  created: string;               // YYYY-MM-DD, the day it was added
  done?: string;                 // YYYY-MM-DD, the day it was finished; absent while open
  cancelled?: string;            // YYYY-MM-DD, the day it was cancelled; absent unless cancelled
  children: Todo[];              // its Nudges, in creation order
}
```

- `bounty` and `defaultBounty` are finite numbers `>= 0`.
- `done`, when present, is on or after `created`; so is `cancelled`.
- A GSD calendar stores no day counts: its activity counts and points derive from its todos, per
  `03-04-gsd-points.md`, so the two can never disagree. It has no activity value.
- A GSD calendar's total activities is its number of todos done, at any depth.

## Trash
- A trashed calendar has `deleted === true`, stays in the array, and keeps its index, so recovery
  returns it to its original position.
- Trashed calendars are excluded from the score chart and from every active total; active
  calendars are `deleted !== true`. Purge is per item and removes the entry outright.
