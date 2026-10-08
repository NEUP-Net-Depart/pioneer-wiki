import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

function findBash(): string | null {
  if (process.platform !== "win32") return "bash";
  try {
    const gitExecPath = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim();
    const candidate = path.resolve(gitExecPath, "../../../bin/bash.exe");
    return existsSync(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

const bash = findBash();
const asShellPath = (file: string) =>
  file.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);

function deployFixture(variant: "default" | "legacy", existingEnv?: string) {
  const root = mkdtempSync(path.join(tmpdir(), "pioneer-deploy-"));
  const bin = path.join(root, "bin");
  const install = path.join(root, "install");
  mkdirSync(bin);
  mkdirSync(install);
  const command = (name: string, body: string) => {
    const file = path.join(bin, name);
    writeFileSync(file, `#!/bin/bash\nset -eu\n${body}\n`);
    chmodSync(file, 0o755);
  };
  command("uname", 'printf "x86_64\\n"');
  command(
    "docker",
    `printf '%s\\n' "$*" >> "$DOCKER_LOG"
case "$1" in
  info) exit 0 ;;
  load) cat >/dev/null; printf 'Loaded image: pioneer-wiki:v0.1.2\\n' ;;
  *) exit 91 ;;
esac`,
  );
  command("gzip", 'for last; do :; done; cat "$last"');
  command(
    "curl",
    `output=""; url=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    https://*) url="$1"; shift ;;
    *) shift ;;
  esac
done
printf '%s\\n' "$url" >> "$FETCH_LOG"
case "$url" in
  */default.env.example) [ "$TEMPLATE_VARIANT" = default ] || exit 22 ;;
  */.env.example) [ "$TEMPLATE_VARIANT" = legacy ] || exit 22 ;;
  *) printf 'fixture asset\\n' > "$output"; exit 0 ;;
esac
printf 'NEXT_PUBLIC_SUPABASE_URL=\\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\\nTEMPLATE_MARKER=%s\\n' "$TEMPLATE_VARIANT" > "$output"`,
  );
  const script = path.join(root, "deploy.sh");
  writeFileSync(
    script,
    'export PATH="$MOCK_BIN:$PATH"\n' + readFileSync("deploy/deploy.sh", "utf8").replaceAll("\r\n", "\n"),
  );
  if (existingEnv) writeFileSync(path.join(install, ".env"), existingEnv);
  try {
    const result = spawnSync(bash!, [asShellPath(script), "v0.1.2", "--dir", asShellPath(install), "--no-start"], {
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        MOCK_BIN: asShellPath(bin),
        PIONEER_REPO: "fixture/wiki",
        FETCH_LOG: asShellPath(path.join(root, "fetch.log")),
        DOCKER_LOG: asShellPath(path.join(root, "docker.log")),
        TEMPLATE_VARIANT: variant,
      },
    });
    if (result.error) throw result.error;
    if (!existsSync(path.join(install, ".env.example"))) {
      throw new Error(`Template not downloaded: ${result.stderr}\n${result.stdout}`);
    }
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      env: readFileSync(path.join(install, ".env"), "utf8"),
      template: readFileSync(path.join(install, ".env.example"), "utf8"),
      fetches: readFileSync(path.join(root, "fetch.log"), "utf8"),
      docker: readFileSync(path.join(root, "docker.log"), "utf8"),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe.skipIf(bash === null)("release deployment assets", () => {
  it("copies GitHub's published template and stops before downloading the image on first install", () => {
    const result = deployFixture("default");
    expect(result.status, result.stderr).toBe(1);
    expect(result.template).toContain("TEMPLATE_MARKER=default");
    expect(result.env).toBe(result.template);
    expect(result.fetches).toContain("/default.env.example");
    expect(result.fetches).not.toContain("/.env.example");
    expect(result.fetches).not.toContain("pioneer-wiki-linux-amd64.tar.gz");
    expect(result.docker).toBe("info\n");
  });

  it("accepts the legacy leading-dot template filename", () => {
    const result = deployFixture("legacy");
    expect(result.status, result.stderr).toBe(1);
    expect(result.template).toContain("TEMPLATE_MARKER=legacy");
    expect(result.fetches).toContain("/default.env.example");
    expect(result.fetches).toContain("/.env.example");
  });

  it("preserves configured environment values and loads an update without starting it", () => {
    const existing =
      "NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-public\n";
    const result = deployFixture("default", existing);
    expect(result.status, result.stderr).toBe(0);
    expect(result.env).toBe(existing);
    expect(result.fetches).toContain("pioneer-wiki-linux-amd64.tar.gz");
    expect(result.docker).toBe("info\nload\n");
    expect(result.stdout).toContain("wiki.example.com");
  });
});
