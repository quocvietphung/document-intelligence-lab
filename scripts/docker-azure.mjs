import { execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { userInfo } from "node:os";
import {loadEnvFile} from 'node:process';
import {azureDockerEnvironment} from './docker-azure-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(root, ".local/azure-auth");
const resource = "https://cognitiveservices.azure.com/";
const user = userInfo();
const mode = process.argv[2] || "up";
if(!['up','start','prepare','watch'].includes(mode)) {
  console.error('Usage: node scripts/docker-azure.mjs [up|start|prepare|watch]');process.exit(1);
}
const configuration=resolve(root,'.env.azure.local');
if(existsSync(configuration))loadEnvFile(configuration);
let env;
try {env=azureDockerEnvironment(process.env,{root,uid:user.uid,gid:user.gid});}
catch(error) {console.error(error.message);process.exit(1);}
const args = ["compose", "-f", "docker-compose.yml", "-f", "docker-compose.azure.yml", "-f", "docker-compose.platform.yml"];

function refresh() {
  // Capture CLI output in memory. Never print tokens, CLI caches or provider payloads.
  const result = JSON.parse(execFileSync("az", ["account", "get-access-token", "--resource", resource, "--output", "json"],
    { encoding: "utf8", timeout: 30_000, maxBuffer: 100_000, stdio: ["ignore", "pipe", "pipe"] }));
  const expiry = Number(result.expires_on);
  if (typeof result.accessToken !== "string" || !Number.isFinite(expiry) || expiry * 1000 < Date.now() + 60_000)
    throw new Error("Invalid short-lived token");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const temporary = resolve(directory, "token.next.json");
  writeFileSync(temporary, JSON.stringify({ accessToken: result.accessToken, expiresOn: new Date(expiry * 1000).toISOString(), resource }), { mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, resolve(directory, "token.json"));
  console.log(`Azure token refreshed; expires ${new Date(expiry * 1000).toISOString()}. No API key used.`);
}

try { refresh(); }
catch { console.error("Azure login unavailable. Run az login on your computer, then retry this command."); process.exit(1); }

if (mode === "prepare") {
  console.log("Token file prepared. Use the same start command to keep automatic refresh active.");
} else if (mode === "up" || mode === "start" || mode === "watch") {
  const timer = setInterval(() => {
    try { refresh(); }
    catch { console.error("Azure token refresh failed; run az login and restart this helper. Expired tokens fail closed."); }
  }, 5 * 60_000);
  let child;
  const stop = () => {
    clearInterval(timer);
    child?.kill("SIGTERM");
    console.log("Token refresh stopped. Docker containers remain running; Azure calls stop when the token expires.");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  if (mode === "up" || mode === "start") {
    child = spawn("docker", [...args, "up", "-d", mode === "start" ? "--no-build" : "--build", "--wait", "--wait-timeout", "600"], { cwd: root, env, stdio: "inherit" });
    child.on("error", () => { clearInterval(timer); console.error("Docker unavailable. Start Docker Desktop and retry."); process.exit(1); });
    child.on("exit", code => {
      child = undefined;
      if (code !== 0) { clearInterval(timer); process.exit(code || 1); }
      console.log("Docker stack ready: http://localhost:3000/en. Keep this helper running for Azure token refresh.");
    });
  } else console.log("Token refresh active. All application services run in Docker.");
} else {
  console.error("Usage: node scripts/docker-azure.mjs [up|start|prepare|watch]");
  process.exit(1);
}
