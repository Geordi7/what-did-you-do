export interface Calendar {
  id: string;
  name: string;
  color: string;
  days: Record<string, number>;
}

export interface AppState {
  calendars: Calendar[];
}