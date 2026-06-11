CREATE TABLE profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  first_name  text not null,
  last_name   text not null,
  age         int,
  archetype   text,
  onboarded   boolean default false,
  created_at  timestamptz default now()
);

CREATE TABLE user_memory (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz default now(),
  unique(user_id, key)
);

CREATE TABLE goals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references profiles(id) on delete cascade,
  title               text not null,
  area                text not null,
  duration            text,
  motivation          text,
  status              text default 'active',
  needs_recalibration boolean default false,
  completion_pct      int default 0,
  plan_json           jsonb,
  created_at          timestamptz default now()
);

CREATE TABLE tasks (
  id                 uuid primary key default gen_random_uuid(),
  goal_id            uuid references goals(id) on delete cascade,
  user_id            uuid references profiles(id) on delete cascade,
  name               text not null,
  frequency          text,
  duration           text,
  consecutive_misses int default 0,
  last_completed_at  timestamptz
);

CREATE TABLE daily_check_ins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  task_id     uuid references tasks(id) on delete cascade,
  date        date not null,
  completed   boolean default false,
  skip_reason text,
  unique(user_id, task_id, date)
);

CREATE TABLE day_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles(id) on delete cascade,
  date            date not null,
  energy          text,
  hours_available int,
  mood_context    text,
  blocks          jsonb,
  deferred        jsonb,
  advice          text,
  unique(user_id, date)
);

CREATE TABLE priorities (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  date       date not null,
  text       text not null,
  done       boolean default false
);

CREATE TABLE recalibrations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  task_id     uuid,
  reason      text,
  ai_proposal text,
  accepted    boolean default false,
  created_at  timestamptz default now()
);

CREATE TABLE chat_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id) on delete cascade,
  session_id    text not null,
  session_title text default 'New conversation',
  role          text,
  content       text,
  intent        text,
  created_at    timestamptz default now()
);

CREATE TABLE goal_snapshots (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references profiles(id) on delete cascade,
  goal_id        uuid references goals(id) on delete cascade,
  week_start     date not null,
  completion_pct int default 0,
  tasks_done     int default 0,
  tasks_total    int default 0,
  unique(goal_id, week_start)
);

CREATE TABLE push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null
);

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory        ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_check_ins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE priorities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE recalibrations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own" ON profiles           FOR ALL USING (auth.uid() = id);
CREATE POLICY "own" ON user_memory        FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON goals              FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON tasks              FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON daily_check_ins    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON day_plans          FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON priorities         FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON recalibrations     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON chat_logs          FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON goal_snapshots     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

CREATE INDEX ON goals           (user_id, status);
CREATE INDEX ON tasks           (goal_id);
CREATE INDEX ON daily_check_ins (user_id, date);
CREATE INDEX ON chat_logs       (user_id, session_id);
CREATE INDEX ON day_plans       (user_id, date);
CREATE INDEX ON priorities      (user_id, date);
