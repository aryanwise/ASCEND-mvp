export type AreaId = 'fitness'|'study'|'career'|'diet'|'mind'|'money'|'health'|'habits'|'custom';
export type GoalStatus = 'active'|'paused'|'completed';
export type Archetype = 'rigid_9to5'|'nocturnal_dev'|'deep_worker'|'student';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  age?: number;
  archetype?: Archetype;
  onboarded: boolean;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  area: AreaId;
  duration: string;
  motivation?: string;
  status: GoalStatus;
  needs_recalibration: boolean;
  completion_pct: number;
  plan_json?: { summary: string; tips: string[] };
  created_at: string;
  tasks?: Task[];
}

export interface Task {
  id: string;
  goal_id: string;
  user_id: string;
  name: string;
  frequency: string;
  duration?: string;
  consecutive_misses: number;
  last_completed_at?: string;
}

export interface DayBlock {
  time: string;
  task: string;
  duration: string;
  area: string;
  color: string;
  soft: string;
  done: boolean;
}

export interface DayPlan {
  advice: string;
  blocks: DayBlock[];
  deferred: { task: string; reason: string }[];
}

export interface Priority {
  id: string;
  user_id: string;
  date: string;
  text: string;
  done: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  created_at?: string;
}
