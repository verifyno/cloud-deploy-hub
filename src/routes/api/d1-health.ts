import { createFileRoute } from "@tanstack/react-router";
import { getDB } from "@/lib/d1.server";

export const Route = createFileRoute("/api/d1-health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const db = getDB();
          const r = await db
            .prepare("SELECT COUNT(*) as count FROM deployed_apps")
            .first<{ count: number }>();
          return Response.json({ ok: true, count: r?.count ?? 0 });
        } catch (e: any) {
          return Response.json(
            { ok: false, error: e?.message || String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
