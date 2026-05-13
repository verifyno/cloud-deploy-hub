import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "AS CLOUD SYSTEM — Deploy any GitHub repo to Heroku" },
      {
        name: "description",
        content:
          "Paste a GitHub repo, set variables, deploy. Get an ID and password to manage your app — Heroku-style, iOS-clean.",
      },
    ],
  }),
});

function Home() {
  const [repo, setRepo] = useState("");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-3xl px-6 pt-24 pb-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
            Powered by Heroku · Managed by AS Cloud
          </div>
          <h1 className="mt-6 text-5xl md:text-6xl font-semibold tracking-tight">
            Deploy anything.
            <br />
            <span className="text-muted-foreground">In one click.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
            Paste a GitHub repository link. We'll read its <span className="mono">app.json</span>,
            collect variables, and ship it. You get an ID and password to manage everything.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!repo.trim()) return;
            navigate({
              to: "/deploy",
              search: { repo: repo.trim() } as any,
            });
          }}
          className="mt-10 mx-auto max-w-2xl"
        >
          <div className="rounded-2xl border border-border bg-card shadow-sm p-2 flex flex-col sm:flex-row gap-2">
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="flex-1 px-4 py-3 bg-transparent outline-none text-base mono"
            />
            <button
              type="submit"
              className="rounded-xl bg-primary text-primary-foreground px-5 py-3 font-medium hover:opacity-90 active:scale-[0.98] transition"
            >
              Deploy →
            </button>
          </div>
        </form>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { t: "Read app.json", d: "Auto-detect required env variables." },
            { t: "Live build logs", d: "Watch deployment stream in real time." },
            { t: "Manage later", d: "Login with your ID + password to update vars." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card p-5">
              <div className="text-sm text-muted-foreground">{f.d}</div>
              <div className="mt-2 font-medium">{f.t}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/manage"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Already deployed? Manage your app →
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function Nav() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="h-6 w-6 rounded-md bg-foreground" />
          AS CLOUD SYSTEM
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            className="px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            Deploy
          </Link>
          <Link
            to="/manage"
            className="px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            Manage
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground flex justify-between">
        <span>© AS Cloud System</span>
        <span className="mono">v1.0</span>
      </div>
    </footer>
  );
}
