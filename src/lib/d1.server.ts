export type AppRow = {
  id: string;
  password: string;
  repo_url: string;
  heroku_app_name: string;
  heroku_app_url: string | null;
  config_vars: string;
  created_at: string;
};

export function getDB(): D1Database {
  // @ts-ignore
  const db = globalThis.__D1_DB__;
  if (!db) throw new Error("D1 database not initialized");
  return db;
}

export function setDB(db: D1Database) {
  // @ts-ignore
  globalThis.__D1_DB__ = db;
}
