"use strict";
/**
 * Lightweight assertion-based tests for orchestrator.js, using fake
 * spawn/http functions so they run under plain `node` with no Docker,
 * no Electron, and no network. Run with: node orchestrator.test.js
 */
const assert = require("assert");
const { EventEmitter } = require("events");
const {
  detectComposeCommand,
  startStack,
  stopStack,
  waitForUrl,
} = require("./orchestrator");

let passed = 0;
function test(name, fn) {
  return fn()
    .then(() => {
      passed++;
      console.log(`ok - ${name}`);
    })
    .catch((err) => {
      console.error(`FAIL - ${name}`);
      console.error(err);
      process.exitCode = 1;
    });
}

function fakeChildProcess() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

async function run() {
  await test("detectComposeCommand: finds `docker compose` when it succeeds", async () => {
    const spawnFn = (cmd, args) => {
      const child = fakeChildProcess();
      setImmediate(() => child.emit("close", 0));
      return child;
    };
    const result = await detectComposeCommand("/tmp", { spawnFn });
    assert.deepStrictEqual(result, { cmd: "docker", baseArgs: ["compose"] });
  });

  await test("detectComposeCommand: falls back to docker-compose when `docker compose` fails", async () => {
    const spawnFn = (cmd) => {
      const child = fakeChildProcess();
      if (cmd === "docker") {
        setImmediate(() => child.emit("close", 1));
      } else if (cmd === "docker-compose") {
        setImmediate(() => child.emit("close", 0));
      }
      return child;
    };
    const result = await detectComposeCommand("/tmp", { spawnFn });
    assert.deepStrictEqual(result, { cmd: "docker-compose", baseArgs: [] });
  });

  await test("detectComposeCommand: returns null when neither is available (Docker not installed)", async () => {
    // Mirrors real Node behavior: a failed spawn (ENOENT) emits both
    // 'error' and 'close' (verified against a real spawn() call).
    const spawnFn = () => {
      const child = fakeChildProcess();
      setImmediate(() => {
        child.emit("error", new Error("ENOENT"));
        child.emit("close", -2);
      });
      return child;
    };
    const result = await detectComposeCommand("/tmp", { spawnFn });
    assert.strictEqual(result, null);
  });

  await test("startStack: rejects with DOCKER_NOT_FOUND when composeCommand is null", async () => {
    await assert.rejects(
      () => startStack("/tmp", { composeCommand: null }),
      /DOCKER_NOT_FOUND/
    );
  });

  await test("startStack: streams log lines and resolves 0 on clean exit", async () => {
    const lines = [];
    const spawnFn = (cmd, args) => {
      assert.strictEqual(cmd, "docker");
      assert.deepStrictEqual(args, ["compose", "up", "--build", "-d"]);
      const child = fakeChildProcess();
      setImmediate(() => {
        child.stdout.emit("data", Buffer.from("Creating network...\n"));
        child.emit("close", 0);
      });
      return child;
    };
    const code = await startStack("/tmp", {
      composeCommand: { cmd: "docker", baseArgs: ["compose"] },
      onLog: (l) => lines.push(l),
      spawnFn,
    });
    assert.strictEqual(code, 0);
    assert.ok(lines.some((l) => l.includes("Creating network")));
  });

  await test("startStack: rejects when compose exits non-zero", async () => {
    const spawnFn = () => {
      const child = fakeChildProcess();
      setImmediate(() => child.emit("close", 1));
      return child;
    };
    await assert.rejects(
      () =>
        startStack("/tmp", {
          composeCommand: { cmd: "docker", baseArgs: ["compose"] },
          spawnFn,
        }),
      /COMPOSE_UP_FAILED/
    );
  });

  await test("stopStack: resolves cleanly even if the process errors", async () => {
    const spawnFn = () => {
      const child = fakeChildProcess();
      setImmediate(() => child.emit("error", new Error("boom")));
      return child;
    };
    await stopStack("/tmp", { composeCommand: { cmd: "docker", baseArgs: ["compose"] }, spawnFn });
  });

  await test("waitForUrl: resolves as soon as any HTTP response arrives", async () => {
    const requestFn = (url, cb) => {
      const req = new EventEmitter();
      req.setTimeout = () => {};
      req.destroy = () => {};
      setImmediate(() => cb({ resume: () => {} }));
      return req;
    };
    const ok = await waitForUrl("http://localhost:9999", { requestFn });
    assert.strictEqual(ok, true);
  });

  await test("waitForUrl: retries on connection error, then times out", async () => {
    let attempts = 0;
    const requestFn = () => {
      attempts++;
      const req = new EventEmitter();
      req.setTimeout = () => {};
      req.destroy = () => {};
      setImmediate(() => req.emit("error", new Error("ECONNREFUSED")));
      return req;
    };
    await assert.rejects(
      () => waitForUrl("http://localhost:9999", { requestFn, timeoutMs: 30, intervalMs: 5 }),
      /TIMEOUT/
    );
    assert.ok(attempts >= 2, `expected retries, got ${attempts}`);
  });

  console.log(`\n${passed} test(s) passed`);
  if (process.exitCode) {
    console.error("Some tests FAILED");
    process.exit(1);
  }
}

run();
