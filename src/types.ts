export interface Calendar {
  id: string;
  name: string;
  color: string;
  days: Record<string, number>;
  activityValue: number;
  deleted?: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppState {
  version?: number;
  theme?: ThemeMode;
  calendars: Calendar[];
}