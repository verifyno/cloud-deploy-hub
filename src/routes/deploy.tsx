import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  inspectRepo,
  deployRepo,
  fetchBuildLog,
  getBuildStatus,
} from "@/lib/heroku.functions";
import { Nav, Footer } from "./index";

export const Route = createFileRoute("/deploy")({
  validateSearch: z.object({ repo: z.string().optional() }),
  component: DeployPage,
  head: () => ({ meta: [{ title: "Deploy — AS CLOUD SYSTEM" }] }),
});

type Var = {
  key: string;
  value: string;
  description: string;
  required: boolean;
};

function DeployPage() {
  const { repo } = Route.useSearch();
  const navigate = useNavigate();
  const inspect = useServerFn(inspectRepo);
  const deploy = useServerFn(deployRepo);
  const fetchLog = useServerFn(fetchBuildLog);
  const fetchStatus = useServerFn(getBuildStatus);

  const [repoUrl, setRepoUrl] = useState(repo || "");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<any>(null);
  const [vars, setVars] = useState<Var[]>([]);
  const [err, setErr] = useState("");

  // Deployment phase
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState("");
  const [status, setStatus] = useState<string>("pending");

  useEffect(() => {
    if (repo && !meta) handleInspect(repo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInspect(url: string) {
    setErr("");
    setLoading(true);
    setMeta(null);
    setVars([]);
    try {
      const r = await inspect({ data: { repoUrl: url } });
      setMeta(r);
      setVars(
        r.vars.map((v: any) => ({
          key: v.key,
          value: v.value || "",
          description: v.description,
          required: v.required,
        })),
      );
    } catch (e: any) {
      setErr(e.message || "Failed to inspect repo");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeploy() {
    setErr("");
    setDeploying(true);
    setLogs("");
    setStatus("pending");
    try {
      const cv: Record<string, string> = {};
      for (const v of vars) if (v.value) cv[v.key] = v.value;
      const r = await deploy({ data: { repoUrl, configVars: cv } });
      setResult(r);
      pollLogs(r.appName, r.buildId, r.outputStreamUrl);
    } catch (e: any) {
      setErr(e.message || "Deploy failed");
      setDeploying(false);
    }
  }

  const stopRef = useRef(false);
  async function pollLogs(appName: string, buildId: string, streamUrl: string) {
    stopRef.current = false;
    for (let i = 0; i < 240; i++) {
      if (stopRef.current) break;
      try {
        const l = await fetchLog({ data: { url: streamUrl } });
        if (l.text) setLogs(l.text);
        const s = await fetchStatus({ data: { appName, buildId } });
        setStatus(s.status);
        if (s.status === "succeeded" || s.status === "failed") break;
      } catch {
        // ignore transient
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (deploying && result) {
    return (
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-4xl px-6 py-12">
          <h1 className="text-2xl font-semibold tracking-tight">Deploying {result.appName}</h1>
          <div className="mt-2 text-sm text-muted-foreground">
            Status:{" "}
            <span
              className={
                "mono px-2 py-0.5 rounded-md " +
                (status === "succeeded"
                  ? "bg-foreground text-background"
                  : status === "failed"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted")
              }
            >
              {status}
            </span>
          </div>

          {(status === "succeeded" || status === "failed") && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6">
              {status === "succeeded" ? (
                <>
                  <div className="text-lg font-medium">Deployment complete 🎉</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Save these credentials — you'll need them to manage your app.
                  </p>
                  <div className="mt-4 grid sm:grid-cols-2 gap-3">
                    <CredBox label="App URL" value={result.appUrl || "—"} />
                    <CredBox label="App Name" value={result.appName} />
                    <CredBox label="Login ID" value={result.loginId} />
                    <CredBox label="Password" value={result.password} />
                  </div>
                  <button
                    onClick={() =>
                      navigate({
                        to: "/manage",
                        search: { id: result.loginId } as any,
                      })
                    }
                    className="mt-5 rounded-xl bg-primary text-primary-foreground px-4 py-2 font-medium"
                  >
                    Go to manage →
                  </button>
                </>
              ) : (
                <div className="text-destructive font-medium">
                  Build failed. Check logs below.
                </div>
              )}
            </div>
          )}

          <div className="mt-6">
            <div className="text-sm text-muted-foreground mb-2">Build logs</div>
            <pre className="mono text-xs bg-foreground text-background rounded-2xl p-4 max-h-[60vh] overflow-auto whitespace-pre-wrap">
{logs || "Waiting for output…"}
            </pre>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Deploy a repository</h1>
        <p className="mt-2 text-muted-foreground">
          Paste a GitHub repo, fill in variables, and deploy.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-2 flex gap-2">
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 px-3 py-2 bg-transparent outline-none mono text-sm"
          />
          <button
            onClick={() => handleInspect(repoUrl)}
            disabled={loading || !repoUrl}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load"}
          </button>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm">
            {err}
          </div>
        )}

        {meta && (
          <div className="mt-8">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-xs text-muted-foreground">App</div>
              <div className="font-medium">{meta.appName}</div>
              {meta.description && (
                <div className="mt-1 text-sm text-muted-foreground">{meta.description}</div>
              )}
            </div>

            <h2 className="mt-8 text-lg font-semibold">Configuration variables</h2>
            {vars.length === 0 ? (
              <div className="mt-3 text-sm text-muted-foreground">
                No variables required by this repo.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {vars.map((v, idx) => (
                  <div
                    key={v.key}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between">
                      <label className="mono text-sm font-medium">
                        {v.key}
                        {v.required && <span className="text-destructive ml-1">*</span>}
                      </label>
                    </div>
                    {v.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {v.description}
                      </div>
                    )}
                    <input
                      value={v.value}
                      onChange={(e) => {
                        const next = [...vars];
                        next[idx] = { ...v, value: e.target.value };
                        setVars(next);
                      }}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mono outline-none focus:ring-2 focus:ring-ring"
                      placeholder={v.required ? "Required" : "Optional"}
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleDeploy}
              className="mt-8 w-full rounded-2xl bg-primary text-primary-foreground py-3 font-medium hover:opacity-90 active:scale-[0.99] transition"
            >
              Deploy app
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function CredBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mono text-sm mt-1 break-all select-all">{value}</div>
    </div>
  );
}

