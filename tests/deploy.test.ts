import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts/deploy-vercel.sh");
const projectId = "prj_iCIuRd8iUPHYmu2bePAcTj6fRNUD";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "orbs-deploy-"));
  const bin = join(directory, "bin");
  const log = join(directory, "commands.jsonl");
  mkdirSync(bin);
  const stub = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const command = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DEPLOY_TEST_LOG, JSON.stringify({command, args, cwd:process.cwd(), token:process.env.VERCEL_TOKEN, authToken:process.env.VERCEL_AUTH_TOKEN})+'\\n');
if (command === 'pnpm' && args.includes(process.env.DEPLOY_TEST_FAIL)) process.exit(9);
if (command === 'npx' && args.includes('logout')) { console.log('Logged out!'); process.exit(Number(process.env.DEPLOY_TEST_LOGOUT_EXIT || 0)); }
if (command === 'npx' && args.includes('deploy')) { if (process.env.DEPLOY_TEST_SIGNAL) process.kill(process.ppid, process.env.DEPLOY_TEST_SIGNAL); console.log('https://example.vercel.app'); process.exit(Number(process.env.DEPLOY_TEST_CLI_EXIT || 0)); }
`;
  for (const command of ["pnpm", "npx"])
    writeFileSync(join(bin, command), stub, { mode: 0o755 });
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    DEPLOY_TEST_LOG: log,
    VERCEL_TOKEN: "test-token-never-print",
    VERCEL_AUTH_TOKEN: "test-auth-token-never-print",
    VERCEL_PROJECT_ID: "prj_wrong_from_environment",
    VERCEL_SCOPE: "team-with-spaces",
    OPS_VERCEL_PROJECT_ID: "prj_OpsTest456",
  };
  return {
    run: (args: string[] = [], extra: Record<string, string> = {}) =>
      spawnSync("bash", [script, ...args], {
        cwd: directory,
        env: { ...env, ...extra },
        encoding: "utf8",
      }),
    commands: () => {
      try {
        return readFileSync(log, "utf8")
          .trim()
          .split("\n")
          .map(
            (line) =>
              JSON.parse(line) as {
                command: string;
                args: string[];
                cwd: string;
                token?: string;
                authToken?: string;
              },
          );
      } catch {
        return [];
      }
    },
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("deployment runs checks first and explicitly selects the requested project from any directory", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const commands = f.commands();
  assert.deepEqual(
    commands.slice(0, 3).map((c) => c.args),
    [["run", "lint"], ["run", "typecheck"], ["test"]],
  );
  const deployment = commands[4];
  assert.equal(deployment.command, "npx");
  assert.deepEqual(deployment.args, [
    "--yes",
    "vercel@58.9.0",
    "deploy",
    "--cwd",
    root,
    "--project",
    projectId,
    "--target",
    "preview",
    "--yes",
    "--non-interactive",
    "--scope",
    "team-with-spaces",
  ]);
  assert.equal(deployment.cwd, root);
  assert.equal(deployment.token, "test-token-never-print");
  assert.ok(!deployment.args.some((a) => a.includes("test-token")));
  assert.ok(!`${result.stdout}${result.stderr}`.includes("test-token"));
  assert.equal(commands.length, 6);
  const logout = commands[5];
  assert.deepEqual(logout.args, [
    "--yes",
    "vercel@58.9.0",
    "logout",
    "--non-interactive",
  ]);
  assert.equal(logout.token, undefined);
  assert.equal(logout.authToken, undefined);
  assert.ok(!result.stdout.includes("Logged out!"));
  assert.match(result.stderr, /Logged out!/);
});

test("production must be requested explicitly and does not require a scope flag", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const result = f.run(["--prod"], { VERCEL_SCOPE: "" });
  assert.equal(result.status, 0, result.stderr);
  const args = f.commands()[4].args;
  assert.equal(args[args.indexOf("--target") + 1], "production");
  assert.ok(!args.includes("--scope"));
});

test("help, dry runs, and invalid arguments never execute checks or deployment", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  assert.equal(f.run(["--help"]).status, 0);
  const dry = f.run(["--prod", "--dry-run"]);
  assert.equal(dry.status, 0);
  assert.match(dry.stdout, /Target: production/);
  assert.ok(dry.stdout.includes(projectId));
  assert.match(dry.stdout, /logout --non-interactive/);
  assert.ok(!dry.stdout.includes("test-token"));
  const invalid = f.run(["--token=not-for-logs"]);
  assert.equal(invalid.status, 2);
  assert.ok(!invalid.stderr.includes("not-for-logs"));
  assert.deepEqual(f.commands(), []);
});

test("failed checks and deployments still log out and preserve their exit status", (t) => {
  const failure = fixture();
  t.after(failure.cleanup);
  const result = failure.run([], { DEPLOY_TEST_FAIL: "typecheck" });
  assert.equal(result.status, 9);
  assert.deepEqual(
    failure.commands().map((c) => c.command),
    ["pnpm", "pnpm", "npx"],
  );
  assert.ok(failure.commands()[2].args.includes("logout"));
  const cli = fixture();
  t.after(cli.cleanup);
  assert.equal(cli.run([], { DEPLOY_TEST_CLI_EXIT: "7" }).status, 7);
  assert.ok(cli.commands()[5].args.includes("logout"));
});

test("logout failure is reported without hiding an earlier deployment failure", (t) => {
  const success = fixture();
  t.after(success.cleanup);
  const result = success.run([], { DEPLOY_TEST_LOGOUT_EXIT: "4" });
  assert.equal(result.status, 4);
  assert.match(result.stderr, /Vercel logout failed/);
  const failure = fixture();
  t.after(failure.cleanup);
  const failed = failure.run([], {
    DEPLOY_TEST_CLI_EXIT: "7",
    DEPLOY_TEST_LOGOUT_EXIT: "4",
  });
  assert.equal(failed.status, 7);
  assert.match(failed.stderr, /Vercel logout failed/);
});

test("interrupted deployments log out once and return the interruption status", (t) => {
  for (const [signal, status] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const) {
    const f = fixture();
    t.after(f.cleanup);
    const result = f.run([], { DEPLOY_TEST_SIGNAL: signal });
    assert.equal(result.status, status, result.stderr);
    assert.equal(
      f.commands().filter((c) => c.args.includes("logout")).length,
      1,
    );
  }
});

test("ops deployment configures its own project root and cannot target the explorer project", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  assert.equal(f.run(["--app", "ops"]).status, 0);
  const commands = f.commands();
  assert.ok(commands[3].args.includes("/v9/projects/prj_OpsTest456"));
  assert.ok(
    commands[3].args.includes(join(root, "apps/ops/vercel-project.json")),
  );
  const deploy = commands[4].args;
  assert.equal(deploy[deploy.indexOf("--project") + 1], "prj_OpsTest456");
  assert.equal(
    f.run(["--app", "ops"], { OPS_VERCEL_PROJECT_ID: "invalid" }).status,
    2,
  );
  assert.equal(
    f.run(["--app", "ops"], { OPS_VERCEL_PROJECT_ID: projectId }).status,
    2,
  );
  assert.equal(f.run(["--app", "unknown"]).status, 2);
});

test("ops defaults to its configured project without an environment override", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const opsProjectId = "prj_WsmkqUUi6kJu5MdRPN69ALiofXpM";
  const result = f.run(["--app", "ops"], { OPS_VERCEL_PROJECT_ID: "" });
  assert.equal(result.status, 0, result.stderr);
  const commands = f.commands();
  assert.ok(commands[3].args.includes(`/v9/projects/${opsProjectId}`));
  const deploy = commands[4].args;
  assert.equal(deploy[deploy.indexOf("--project") + 1], opsProjectId);
});
