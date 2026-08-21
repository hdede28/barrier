"use strict";
/**
 * Pure-Node orchestration logic (no Electron dependency) for starting and
 * monitoring the docker-compose stack. Kept dependency-free so it can be
 * unit-tested with plain `node`, independent of the Electron runtime.
 */

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

/** Try `docker compose` (v2 plugin) first, fall back to standalone `docker-compose`. */
function detectComposeCommand(cwd, { spawnFn = spawn } = {}) {
  return new Promise((resolve) => {
    const probe = spawnFn("docker", ["compose", "version"], { cwd, shell: false });
    let failed = false;
    probe.on("error", () => {
      failed = true;
    });
    probe.on("close", (code) => {
      if (!failed && code === 0) {
        resolve({ cmd: "docker", baseArgs: ["compose"] });
        return;
      }
      const legacyProbe = spawnFn("docker-compose", ["version"], { cwd, shell: false });
      let legacyFailed = false;
      legacyProbe.on("error", () => {
        legacyFailed = true;
      });
      legacyProbe.on("close", (legacyCode) => {
        if (!legacyFailed && legacyCode === 0) {
          resolve({ cmd: "docker-compose", baseArgs: [] });
        } else {
          resolve(null); // neither found -- Docker is not installed/available
        }
      });
    });
  });
}

/** Ensure a .env file exists in cwd, seeded from .env.example if missing. */
function ensureEnvFile(cwd) {
  const envPath = path.join(cwd, ".env");
  const examplePath = path.join(cwd, ".env.example");
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    return true; // created
  }
  return false;
}

/**
 * Starts the stack with `docker compose up --build -d` and streams log lines
 * via onLog(line). Resolves with the exit code once the up command itself
 * finishes launching containers (detached, so this returns quickly once
 * containers are created -- readiness is checked separately via waitForHealth).
 */
function startStack(cwd, { onLog = () => {}, composeCommand, spawnFn = spawn } = {}) {
  return new Promise((resolve, reject) => {
    if (!composeCommand) {
      reject(new Error("DOCKER_NOT_FOUND"));
      return;
    }
    const args = [...composeCommand.baseArgs, "up", "--build", "-d"];
    const child = spawnFn(composeCommand.cmd, args, { cwd, shell: false });

    child.stdout && child.stdout.on("data", (chunk) => onLog(chunk.toString()));
    child.stderr && child.stderr.on("data", (chunk) => onLog(chunk.toString()));

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve(code);
      else reject(new Error(`COMPOSE_UP_FAILED (exit code ${code})`));
    });
  });
}

function stopStack(cwd, { composeCommand, spawnFn = spawn } = {}) {
  return new Promise((resolve) => {
    if (!composeCommand) {
      resolve();
      return;
    }
    const args = [...composeCommand.baseArgs, "stop"];
    const child = spawnFn(composeCommand.cmd, args, { cwd, shell: false });
    child.on("error", () => resolve());
    child.on("close", () => resolve());
  });
}

/** Polls a URL until it responds with any HTTP status (meaning the service is up). */
function waitForUrl(url, { timeoutMs = 240000, intervalMs = 1500, requestFn = http.get } = {}) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      const req = requestFn(url, (res) => {
        res.resume(); // drain
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`TIMEOUT waiting for ${url}`));
        } else {
          setTimeout(attempt, intervalMs);
        }
      });
      req.setTimeout(3000, () => req.destroy());
    }
    attempt();
  });
}

async function waitForStackHealthy(urls, options = {}) {
  for (const url of urls) {
    await waitForUrl(url, options);
  }
  return true;
}

module.exports = {
  detectComposeCommand,
  ensureEnvFile,
  startStack,
  stopStack,
  waitForUrl,
  waitForStackHealthy,
};
