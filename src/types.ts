export interface Level {
  id: string;
  name: string;
  energy: number;
}

export interface Transition {
  id: string;
  fromLevelId: string;
  toLevelId: string;
  label: string;
  xOffset: number;
}

export interface AppState {
  levels: Level[];
  transitions: Transition[];
}
