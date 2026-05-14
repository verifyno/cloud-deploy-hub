import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { herokuHeaders } from "./heroku-config.server";
import {
  fetchAppJson,
  parseRepoUrl,
  randomAppName,
  randomPassword,
  tarballUrl,
} from "./repo.server";

const HEROKU_API = "https://api.heroku.com";

// 1. Inspect repo: parse app.json env section
export const inspectRepo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ repoUrl: z.string().min(5).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const info = parseRepoUrl(data.repoUrl);
    const appJson = await fetchAppJson(info);
    const env = appJson?.env || {};
    const vars = Object.entries(env).map(([key, v]: [string, any]) => ({
      key,
      description: v?.description || "",
      value: v?.value ?? "",
      required: v?.required !== false,
      generator: v?.generator || null,
    }));
    const formation = appJson?.formation || {};
    const dynos = Object.entries(formation).map(([type, v]: [string, any]) => ({
      type,
      quantity: v?.quantity ?? 1,
      size: v?.size || "eco",
    }));
    if (dynos.length === 0) dynos.push({ type: "web", quantity: 1, size: "eco" });
    const addonsRaw = Array.isArray(appJson?.addons) ? appJson.addons : [];
    const addons = addonsRaw
      .map((a: any) => {
        if (!a) return null;
        if (typeof a === "string") {
          const [service, plan] = a.split(":");
          return { service, plan: a, as: null, required: true };
        }
        const planStr: string = typeof a.plan === "string" ? a.plan : "";
        const service = planStr.split(":")[0] || planStr;
        return {
          service,
          plan: planStr || service,
          as: a.as || null,
          required: true,
          options: a.options || null,
        };
      })
      .filter(Boolean);
    return {
      repo: info,
      appName: appJson?.name || `${info.owner}/${info.repo}`,
      description: appJson?.description || "",
      vars,
      dynos,
      addons,
    };
  });

// Get live dyno formation + addons for an app (auth via id+password)
export const getAppDetails = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string(), password: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("deployed_apps")
      .select("*")
      .eq("id", data.id.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.password !== data.password) throw new Error("Invalid credentials");

    const [fRes, aRes] = await Promise.all([
      fetch(`${HEROKU_API}/apps/${row.heroku_app_name}/formation`, { headers: herokuHeaders() }),
      fetch(`${HEROKU_API}/apps/${row.heroku_app_name}/addons`, { headers: herokuHeaders() }),
    ]);
    const formation = fRes.ok ? await fRes.json() : [];
    const addons = aRes.ok ? await aRes.json() : [];
    return {
      dynos: (formation as any[]).map((f) => ({
        type: f.type,
        quantity: f.quantity,
        size: f.size,
      })),
      addons: (addons as any[]).map((a) => ({
        name: a.name,
        plan: a?.plan?.name || a?.addon_service?.name,
        state: a.state,
      })),
    };
  });

// Scale dyno: change size and/or quantity
export const scaleDyno = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string(),
        password: z.string(),
        type: z.string().min(1).max(40),
        size: z.enum(["eco", "basic", "standard-1X", "standard-2X"]),
        quantity: z.number().int().min(0).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("deployed_apps")
      .select("*")
      .eq("id", data.id.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.password !== data.password) throw new Error("Invalid credentials");

    const res = await fetch(
      `${HEROKU_API}/apps/${row.heroku_app_name}/formation/${data.type}`,
      {
        method: "PATCH",
        headers: herokuHeaders(),
        body: JSON.stringify({ size: data.size, quantity: data.quantity }),
      },
    );
    if (!res.ok) throw new Error(`Scale failed: ${await res.text()}`);
    const f = await res.json();
    return { type: f.type, size: f.size, quantity: f.quantity };
  });

// Delete app from Heroku and our DB
export const deleteApp = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string(), password: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("deployed_apps")
      .select("*")
      .eq("id", data.id.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.password !== data.password) throw new Error("Invalid credentials");

    const res = await fetch(`${HEROKU_API}/apps/${row.heroku_app_name}`, {
      method: "DELETE",
      headers: herokuHeaders(),
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Delete failed: ${await res.text()}`);
    }
    await supabaseAdmin.from("deployed_apps").delete().eq("id", row.id);
    return { ok: true };
  });

// 2. Deploy: create heroku app, set vars, trigger build from tarball
export const deployRepo = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        repoUrl: z.string().min(5).max(500),
        configVars: z.record(z.string(), z.string()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const info = parseRepoUrl(data.repoUrl);
    const headers = herokuHeaders();

    // Create app with retry on name collision
    let appName = randomAppName();
    let createRes: Response | null = null;
    for (let i = 0; i < 5; i++) {
      createRes = await fetch(`${HEROKU_API}/apps`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: appName, region: "us", stack: "heroku-24" }),
      });
      if (createRes.ok) break;
      const txt = await createRes.text();
      if (createRes.status === 422 && /name is already taken|name already taken/i.test(txt)) {
        appName = randomAppName();
        continue;
      }
      throw new Error(`Heroku app create failed (${createRes.status}): ${txt}`);
    }
    if (!createRes || !createRes.ok) throw new Error("Could not allocate Heroku app name");
    const app = await createRes.json();

    // Set config vars
    if (Object.keys(data.configVars).length) {
      const cv = await fetch(`${HEROKU_API}/apps/${appName}/config-vars`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data.configVars),
      });
      if (!cv.ok) {
        const t = await cv.text();
        throw new Error(`Setting config vars failed: ${t}`);
      }
    }

    // Trigger build from GitHub tarball
    const buildRes = await fetch(`${HEROKU_API}/apps/${appName}/builds`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source_blob: {
          url: tarballUrl(info),
          version: info.ref,
        },
      }),
    });
    if (!buildRes.ok) {
      const t = await buildRes.text();
      throw new Error(`Triggering build failed: ${t}`);
    }
    const build = await buildRes.json();

    // Generate credentials and persist
    const password = randomPassword();
    const { error } = await supabaseAdmin.from("deployed_apps").insert({
      id: appName,
      password,
      repo_url: data.repoUrl,
      heroku_app_name: appName,
      heroku_app_url: app?.web_url || null,
      config_vars: data.configVars,
    });
    if (error) throw new Error(`DB insert failed: ${error.message}`);

    return {
      appName,
      appUrl: app?.web_url || null,
      buildId: build.id,
      outputStreamUrl: build.output_stream_url,
      loginId: appName,
      password,
    };
  });

// 3. Stream logs: fetch the output_stream_url text (one shot pull)
export const fetchBuildLog = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(data.url);
    const text = await res.text();
    return { text, ok: res.ok };
  });

// 4. Get latest build status
export const getBuildStatus = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ appName: z.string(), buildId: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const res = await fetch(
      `${HEROKU_API}/apps/${data.appName}/builds/${data.buildId}`,
      { headers: herokuHeaders() },
    );
    if (!res.ok) throw new Error(`Status fetch failed: ${await res.text()}`);
    const b = await res.json();
    return { status: b.status as string, outputStreamUrl: b.output_stream_url };
  });

// 5. Login (id + password) -> returns app data
export const loginApp = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().min(3).max(64), password: z.string().min(4).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("deployed_apps")
      .select("*")
      .eq("id", data.id.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.password !== data.password) throw new Error("Invalid credentials");

    // Pull live config vars
    const cv = await fetch(`${HEROKU_API}/apps/${row.heroku_app_name}/config-vars`, {
      headers: herokuHeaders(),
    });
    const liveVars = cv.ok ? await cv.json() : (row.config_vars as any) || {};

    return {
      id: row.id,
      appName: row.heroku_app_name,
      appUrl: row.heroku_app_url,
      repoUrl: row.repo_url,
      configVars: liveVars as Record<string, string>,
    };
  });

// 6. Update config vars (auth via id+password)
export const updateAppVars = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string(),
        password: z.string(),
        configVars: z.record(z.string(), z.string()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("deployed_apps")
      .select("*")
      .eq("id", data.id.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.password !== data.password) throw new Error("Invalid credentials");

    const cv = await fetch(`${HEROKU_API}/apps/${row.heroku_app_name}/config-vars`, {
      method: "PATCH",
      headers: herokuHeaders(),
      body: JSON.stringify(data.configVars),
    });
    if (!cv.ok) throw new Error(`Update failed: ${await cv.text()}`);

    await supabaseAdmin
      .from("deployed_apps")
      .update({ config_vars: data.configVars })
      .eq("id", row.id);

    // Restart dynos to pick up new vars
    await fetch(`${HEROKU_API}/apps/${row.heroku_app_name}/dynos`, {
      method: "DELETE",
      headers: herokuHeaders(),
    });

    return { ok: true };
  });

// 7. Fetch runtime logs (heroku log session)
export const fetchAppLogs = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string(), password: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("deployed_apps")
      .select("*")
      .eq("id", data.id.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.password !== data.password) throw new Error("Invalid credentials");

    const sess = await fetch(`${HEROKU_API}/apps/${row.heroku_app_name}/log-sessions`, {
      method: "POST",
      headers: herokuHeaders(),
      body: JSON.stringify({ lines: 200, tail: false }),
    });
    if (!sess.ok) throw new Error(`Log session failed: ${await sess.text()}`);
    const session = await sess.json();
    const logRes = await fetch(session.logplex_url);
    const text = await logRes.text();
    return { text };
  });
