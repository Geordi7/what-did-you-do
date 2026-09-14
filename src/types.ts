export interface Calendar {
  id: string;
  name: string;
  color: string;
  days: Record<string, number>;
  deleted?: boolean;
}

export interface AppState {
  version?: number;
  calendars: Calendar[];
}