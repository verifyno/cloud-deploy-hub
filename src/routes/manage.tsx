import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import {
  fetchAppLogs,
  loginApp,
  updateAppVars,
  getAppDetails,
  scaleDyno,
  deleteApp,
} from "@/lib/heroku.functions";
import { Nav, Footer } from "./index";
import { ConnectingOverlay } from "@/components/connecting-overlay";

const DYNO_SIZES = ["eco", "basic", "standard-1X", "standard-2X"] as const;
type DynoSize = (typeof DYNO_SIZES)[number];

export const Route = createFileRoute("/manage")({
  validateSearch: z.object({ id: z.string().optional() }),
  component: ManagePage,
  head: () => ({ meta: [{ title: "Manage — AS CLOUD SYSTEM" }] }),
});

function ManagePage() {
  const { id: prefillId } = Route.useSearch();
  const navigate = useNavigate();
  const login = useServerFn(loginApp);
  const update = useServerFn(updateAppVars);
  const fetchLogs = useServerFn(fetchAppLogs);
  const getDetails = useServerFn(getAppDetails);
  const scale = useServerFn(scaleDyno);
  const remove = useServerFn(deleteApp);

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
  const [dynos, setDynos] = useState<{ type: string; size: DynoSize; quantity: number }[]>([]);
  const [addons, setAddons] = useState<{ name: string; plan: string; state: string }[]>([]);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [scaleBusy, setScaleBusy] = useState<string>("");

  async function loadDetails(appId: string, pw: string) {
    try {
      const d = await getDetails({ data: { id: appId, password: pw } });
      setDynos(
        (d.dynos || []).map((x: any) => ({
          type: x.type,
          size: (DYNO_SIZES.includes(x.size) ? x.size : "eco") as DynoSize,
          quantity: x.quantity ?? 1,
        })),
      );
      setAddons(d.addons || []);
    } catch {
      // ignore — details are optional
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await login({ data: { id: id.toLowerCase(), password } });
      setApp(r);
      setVars(Object.entries(r.configVars).map(([k, v]) => ({ key: k, value: String(v) })));
      await loadDetails(r.id, password);
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleScale(idx: number) {
    const d = dynos[idx];
    setScaleBusy(d.type);
    setErr("");
    try {
      const r = await scale({
        data: { id: app.id, password, type: d.type, size: d.size, quantity: d.quantity },
      });
      const next = [...dynos];
      next[idx] = { type: r.type, size: r.size as DynoSize, quantity: r.quantity };
      setDynos(next);
    } catch (e: any) {
      setErr(e.message || "Scale failed");
    } finally {
      setScaleBusy("");
    }
  }

  async function handleDelete() {
    if (confirmDelete !== app.id) return;
    setBusy(true);
    setErr("");
    try {
      await remove({ data: { id: app.id, password } });
      navigate({ to: "/" });
    } catch (e: any) {
      setErr(e.message || "Delete failed");
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

        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Dyno scaling</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose a tier and quantity per process type. Heroku will restart that process.
          </p>
          {dynos.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">
              No dyno formation found yet. Try refreshing after the first deploy completes.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {dynos.map((d, idx) => (
                <div
                  key={d.type}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-border p-3"
                >
                  <div className="mono text-sm w-20">{d.type}</div>
                  <select
                    value={d.size}
                    onChange={(e) => {
                      const n = [...dynos];
                      n[idx] = { ...d, size: e.target.value as DynoSize };
                      setDynos(n);
                    }}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    {DYNO_SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={d.quantity}
                    onChange={(e) => {
                      const n = [...dynos];
                      n[idx] = { ...d, quantity: Math.max(0, Math.min(10, Number(e.target.value) || 0)) };
                      setDynos(n);
                    }}
                    className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm mono"
                  />
                  <button
                    onClick={() => handleScale(idx)}
                    disabled={scaleBusy === d.type}
                    className="sm:ml-auto rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  >
                    {scaleBusy === d.type ? "Scaling…" : "Apply"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Add-ons</h2>
          {addons.length === 0 ? (
            <div className="mt-3 text-sm text-muted-foreground">No add-ons attached.</div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm mono">
              {addons.map((a) => (
                <li key={a.name} className="flex justify-between border-b border-border pb-2 last:border-0">
                  <span>{a.plan}</span>
                  <span className="text-muted-foreground">{a.state}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <h2 className="text-lg font-semibold text-destructive">Danger zone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently delete <span className="mono">{app.appName}</span> from Heroku. This cannot be undone.
            Type the app name to confirm.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={app.id}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm mono outline-none"
            />
            <button
              onClick={handleDelete}
              disabled={busy || confirmDelete !== app.id}
              className="rounded-lg bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete app"}
            </button>
          </div>
        </section>

        {err && <div className="mt-4 text-destructive text-sm">{err}</div>}
      </main>
      <Footer />
    </div>
  );
}
