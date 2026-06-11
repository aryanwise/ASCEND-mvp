export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  age: number | null;
  archetype: string | null;
  onboarded: boolean;
}

export interface Task {
  id: string;
  goal_id: string;
  user_id: string;
  name: string;
  frequency: string | null;
  duration: string | null;
  consecutive_misses: number;
  last_completed_at: string | null;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  area: string;
  duration: string | null;
  motivation: string | null;
  status: string;
  needs_recalibration: boolean;
  completion_pct: number;
  plan_json: unknown;
  created_at: string;
  tasks?: Task[];
}

export interface Priority {
  id: string;
  user_id: string;
  date: string;
  text: string;
  done: boolean;
}

export interface DayBlock {
  time: string;
  task: string;
  area: string;
  duration?: string;
  done?: boolean;
}

export interface DeferredItem { task: string; reason: string; }

export interface DayPlan {
  id?: string;
  user_id: string;
  date: string;
  energy: string | null;
  hours_available: number | null;
  mood_context: string | null;
  blocks: DayBlock[];
  deferred: DeferredItem[];
  advice: string | null;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  session_id?: string;
}

export interface QA { q: string; a: string; }
