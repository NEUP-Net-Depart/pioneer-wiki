import "server-only";

export interface GithubRepo {
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  updatedAt: string;
}

/**
 * A member's public GitHub repositories, most recently pushed first (forks
 * left out). Fetched from the public REST API and cached for an hour; any
 * failure (offline, rate limit, unknown login) yields an empty list, so the
 * page never breaks on GitHub's account.
 */
export async function publicRepos(login: string, limit = 6): Promise<GithubRepo[]> {
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/repos?sort=pushed&per_page=30`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "pioneer-wiki" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const list = (await res.json()) as Array<{
      name: string;
      html_url: string;
      description: string | null;
      language: string | null;
      stargazers_count: number;
      pushed_at: string;
      fork: boolean;
      archived: boolean;
    }>;
    return list
      .filter((r) => !r.fork)
      .slice(0, limit)
      .map((r) => ({
        name: r.name,
        url: r.html_url,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        updatedAt: r.pushed_at,
      }));
  } catch {
    return [];
  }
}
