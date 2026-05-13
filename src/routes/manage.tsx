import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { fetchAppLogs, loginApp, updateAppVars } from "@/lib/heroku.functions";
import { Nav, Footer } from "./index";
import { ConnectingOverlay } from "@/components/connecting-overlay";

export const Route = createFileRoute("/manage")({
  validateSearch: z.object({ id: z.string().optional() }),
  component: ManagePage,
  head: () => ({ meta: [{ title: "Manage — AS CLOUD SYSTEM" }] }),
});

function ManagePage() {
  const { id: prefillId } = Route.useSearch();
  const login = useServerFn(loginApp);
  const update = useServerFn(updateAppVars);
  const fetchLogs = useServerFn(fetchAppLogs);

  const [id, setId] = useState(prefillId || "");
  const [password, setPassword] = useState("");
  const [app, setApp] = useState<any>(null);
  const [vars, setVars] = useState<{ key: string; value: string }[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState("");
  const [savedAt, setSavedAt] = useState<string>("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await login({ data: { id: id.toLowerCase(), password } });
      setApp(r);
      setVars(Object.entries(r.configVars).map(([k, v]) => ({ key: k, value: String(v) })));
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    setErr("");
    try {
      const cv: Record<string, string> = {};
      for (const v of vars) if (v.key) cv[v.key] = v.value;
      await update({ data: { id: app.id, password, configVars: cv } });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setErr(e.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogs() {
    setBusy(true);
    try {
      const r = await fetchLogs({ data: { id: app.id, password } });
      setLogs(r.text);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!app) {
    return (
      <div className="min-h-screen">
        <ConnectingOverlay show={busy} label="Connecting" sublabel="signing you in" />
        <Nav />
        <main className="mx-auto max-w-md px-6 py-20">
          <h1 className="text-3xl font-semibold tracking-tight">Manage your app</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Sign in with the ID and password you got after deployment.
          </p>
          <form
            onSubmit={handleLogin}
            className="mt-8 rounded-2xl border border-border bg-card p-5 space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground">App ID</label>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="app name"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 mono text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 mono text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {err && <div className="text-destructive text-sm">{err}</div>}
            <button
              disabled={busy}
              className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ConnectingOverlay show={busy} label="Working" sublabel="syncing with Heroku" />
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">App</div>
            <h1 className="text-2xl font-semibold tracking-tight mono">{app.appName}</h1>
            {app.appUrl && (
              <a
                href={app.appUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline-offset-4 hover:underline text-muted-foreground"
              >
                {app.appUrl}
              </a>
            )}
          </div>
          <button
            onClick={() => {
              setApp(null);
              setPassword("");
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Configuration variables</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {savedAt && <span>Saved · {savedAt}</span>}
              <button
                onClick={handleSave}
                disabled={busy}
                className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save & restart"}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {vars.map((v, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={v.key}
                  onChange={(e) => {
                    const n = [...vars];
                    n[idx] = { ...v, key: e.target.value };
                    setVars(n);
                  }}
                  className="w-1/3 rounded-lg border border-border bg-background px-3 py-2 text-sm mono outline-none"
                />
                <input
                  value={v.value}
                  onChange={(e) => {
                    const n = [...vars];
                    n[idx] = { ...v, value: e.target.value };
                    setVars(n);
                  }}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm mono outline-none"
                />
                <button
                  onClick={() => setVars(vars.filter((_, i) => i !== idx))}
                  className="px-3 rounded-lg border border-border text-sm hover:bg-muted"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-2 border-t border-border">
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="NEW_KEY"
                className="w-1/3 rounded-lg border border-border bg-background px-3 py-2 text-sm mono outline-none"
              />
              <input
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                placeholder="value"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm mono outline-none"
              />
              <button
                onClick={() => {
                  if (!newKey) return;
                  setVars([...vars, { key: newKey, value: newVal }]);
                  setNewKey("");
                  setNewVal("");
                }}
                className="px-4 rounded-lg bg-foreground text-background text-sm"
              >
                Add
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Runtime logs</h2>
            <button
              onClick={handleLogs}
              disabled={busy}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              {busy ? "Loading…" : "Fetch logs"}
            </button>
          </div>
          <pre className="mt-4 mono text-xs bg-foreground text-background rounded-xl p-4 max-h-[50vh] overflow-auto whitespace-pre-wrap">
{logs || "Click 'Fetch logs' to view recent output."}
          </pre>
        </section>

        {err && <div className="mt-4 text-destructive text-sm">{err}</div>}
      </main>
      <Footer />
    </div>
  );
}
