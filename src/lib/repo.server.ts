// Server-only helpers for parsing GitHub repos and fetching app.json
export type RepoInfo = { owner: string; repo: string; ref: string };

export function parseRepoUrl(url: string): RepoInfo {
  const cleaned = url.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const m = cleaned.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\/tree\/([^/]+))?$/i);
  if (!m) throw new Error("Invalid GitHub repo URL");
  return { owner: m[1], repo: m[2], ref: m[3] || "main" };
}

export async function fetchAppJson(info: RepoInfo): Promise<any> {
  const branches = [info.ref, "main", "master"];
  for (const b of branches) {
    const url = `https://raw.githubusercontent.com/${info.owner}/${info.repo}/${b}/app.json`;
    const res = await fetch(url);
    if (res.ok) {
      try {
        return await res.json();
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function tarballUrl(info: RepoInfo) {
  return `https://github.com/${info.owner}/${info.repo}/tarball/${info.ref}`;
}

export function randomAppName() {
  const len = 5 + Math.floor(Math.random() * 4); // 5-8
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
