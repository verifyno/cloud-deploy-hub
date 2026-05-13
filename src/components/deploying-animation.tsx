import { useEffect, useState } from "react";

const PHASES = [
  "Provisioning dyno",
  "Resolving buildpack",
  "Installing dependencies",
  "Compiling slug",
  "Releasing app",
];

export function DeployingAnimation({
  status,
  appName,
}: {
  status: string;
  appName: string;
}) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const isDone = status === "succeeded" || status === "failed";

  useEffect(() => {
    if (isDone) return;
    const i = setInterval(() => {
      setPhaseIdx((p) => (p + 1) % PHASES.length);
      setElapsed((e) => e + 1);
    }, 2200);
    return () => clearInterval(i);
  }, [isDone]);

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      {/* Warning bar */}
      <div className="bg-foreground text-background px-5 py-3 text-xs sm:text-sm font-medium flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-2 w-2 rounded-full bg-background animate-pulse shrink-0" />
        <span>
          Don't close this page while deploying — otherwise you won't get the password
          required to manage your app's variables later.
        </span>
      </div>

      <div className="p-6 sm:p-10 flex flex-col items-center text-center">
        {/* The unique deploying loader */}
        <div className="relative h-32 w-32">
          {/* outer rotating ring */}
          <div className="absolute inset-0 rounded-full border border-border" />
          <div
            className="absolute inset-0 rounded-full border-2 border-foreground border-t-transparent border-r-transparent animate-spin"
            style={{ animationDuration: "1.6s" }}
          />
          {/* inner counter-rotating ring */}
          <div
            className="absolute inset-3 rounded-full border border-foreground/30 border-b-transparent animate-spin"
            style={{ animationDuration: "2.4s", animationDirection: "reverse" }}
          />
          {/* pulsing core */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-12 w-12 rounded-2xl bg-foreground flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-foreground animate-ping opacity-20" />
              <span className="text-background font-bold text-lg tracking-tighter">AS</span>
            </div>
          </div>
          {/* orbit dots */}
          <div
            className="absolute inset-0 animate-spin"
            style={{ animationDuration: "3s" }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-foreground" />
          </div>
        </div>

        <div className="mt-6 text-xs text-muted-foreground uppercase tracking-widest">
          {isDone ? "Build complete" : "Deploying"}
        </div>
        <div className="mt-1 text-2xl font-semibold tracking-tight mono">{appName}</div>

        {!isDone && (
          <div className="mt-4 text-sm text-foreground/80 animate-fade-in" key={phaseIdx}>
            {PHASES[phaseIdx]}
            <span className="inline-block ml-1">…</span>
          </div>
        )}

        {/* phase tracker */}
        <div className="mt-6 w-full max-w-md grid grid-cols-5 gap-1.5">
          {PHASES.map((_, i) => (
            <div
              key={i}
              className={
                "h-1 rounded-full transition-all duration-500 " +
                (isDone
                  ? status === "succeeded"
                    ? "bg-foreground"
                    : "bg-destructive"
                  : i <= phaseIdx
                    ? "bg-foreground"
                    : "bg-border")
              }
            />
          ))}
        </div>

        <div className="mt-4 text-[11px] text-muted-foreground mono">
          status: {status} · elapsed ~{elapsed * 2}s
        </div>
      </div>
    </div>
  );
}
