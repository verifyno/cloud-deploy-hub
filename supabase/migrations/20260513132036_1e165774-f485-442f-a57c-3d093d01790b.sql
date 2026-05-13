
CREATE TABLE public.deployed_apps (
  id TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  heroku_app_name TEXT NOT NULL,
  heroku_app_url TEXT,
  config_vars JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deployed_apps ENABLE ROW LEVEL SECURITY;

-- No public policies; all access via server functions using service role.
