# Import and Export

Refines `03-data-model.md`.

## Envelope

```ts
interface ExportEnvelope {
  version: number;      // STORAGE_VERSION at export time
  exportedAt: string;   // ISO timestamp
  calendars: Calendar[];
}
```

- The payload is plain JSON. It is never base64-encoded.
- Export-all covers every calendar, trashed ones included — a backup is complete.
- A full export records its timestamp under `achievement-calendars-last-export`.

## Accepted input

An import accepts any of:

- an envelope — migrations run from the envelope's own `version`;
- a bare array of calendars — treated as version 3;
- a single calendar object — treated as version 3.

## Rules

- Imported data is untrusted: it is migrated and then parsed with the current-version schema before anything is stored, the same path a load takes.
- Imported calendars are added to the existing set; an `id` that collides with an existing calendar is replaced with a new UUID.
- Imported calendars always land undeleted, whatever the source said.
