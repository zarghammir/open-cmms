#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createConnection } from "node:net";
import { E2E_PORT } from "./e2e-port.mjs";

/**
 * Frees the browser suite's port before a run.
 *
 * Playwright reuses an existing server locally (`reuseExistingServer`), which is
 * what makes a second run fast. It is also a trap: a `next start` left over from
 * an earlier build keeps holding the port, Playwright cheerfully reuses it, and
 * the whole suite then measures code that is no longer on disk. The failure is
 * uniform and confident-looking — every assertion about the change you just made
 * is simply false — and it has cost this project two separate lanes twenty
 * minutes each.
 *
 * Continuous integration starts its own server with reuse disabled, so there is
 * nothing stale there and this does nothing.
 */

if (process.env.CI) {
  process.exit(0);
}

function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    // A non-zero exit means "nothing matched" for both lsof and netstat.
    return "";
  }
}

function pidsHoldingPort(port) {
  const found =
    process.platform === "win32"
      ? run("netstat", ["-ano"])
          .split(/\r?\n/)
          .filter(
            (line) =>
              line.includes("LISTENING") &&
              new RegExp(`[:.]${port}\\b`).test(line),
          )
          .map((line) => line.trim().split(/\s+/).at(-1))
      : run("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"]).split(/\s+/);

  return [
    ...new Set(
      found.filter(
        (pid) => /^\d+$/.test(pid ?? "") && Number(pid) !== process.pid,
      ),
    ),
  ];
}

function stillListening(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const pids = pidsHoldingPort(E2E_PORT);

if (pids.length === 0) {
  process.exit(0);
}

process.stdout.write(
  `Freeing port ${E2E_PORT}, held by ${pids.join(", ")} — a stale server here would make the suite test an old build.\n`,
);

for (const pid of pids) {
  if (process.platform === "win32") {
    run("taskkill", ["/PID", pid, "/F"]);
  } else {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      // Already gone between listing and killing, which is fine.
    }
  }
}

// Give the port a moment to come back, then insist.
const deadline = Date.now() + 5000;
while (Date.now() < deadline && (await stillListening(E2E_PORT))) {
  for (const pid of pidsHoldingPort(E2E_PORT)) {
    if (process.platform === "win32") {
      run("taskkill", ["/PID", pid, "/F"]);
    } else {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {
        // Already gone.
      }
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}

if (await stillListening(E2E_PORT)) {
  process.stderr.write(
    `Port ${E2E_PORT} is still held. Stop that process before running the browser suite, or it will test whatever build it is serving.\n`,
  );
  process.exit(1);
}
