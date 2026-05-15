-- Apply with: wrangler d1 execute cloud-deploy-hub --file=migrations/d1/0001_init.sql --remote
CREATE TABLE IF NOT EXISTS deployed_apps (
  id TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  heroku_app_name TEXT NOT NULL,
  heroku_app_url TEXT,
  config_vars TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
