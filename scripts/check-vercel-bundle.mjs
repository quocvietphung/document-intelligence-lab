// Checks the files a Vercel CLI deployment uploads: tracked files minus .vercelignore.
// Fails if private or backend-only files would be uploaded, or if a file the frontend imports is missing.
// With --build it builds the Next.js app from that filtered tree only.
import {execFileSync} from "node:child_process";
import {copyFileSync, mkdirSync, mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";

const list = (args) => execFileSync("git", ["ls-files", "-z", "-c", ...args], {encoding: "utf8"}).split("\0").filter(Boolean);
const tracked = list([]);
const ignored = new Set(list(["-i", "--exclude-from=.vercelignore"]));
const uploaded = tracked.filter((file) => !ignored.has(file));

// Backend files the frontend imports at build time; everything else under services/ stays out.
const frontendBackendFiles = [
  "services/credit-api/src/main/resources/contractor-dossier/manifest.json",
  "services/credit-api/src/main/resources/datev-reference-hashes.json",
  "services/credit-api/src/main/resources/nova-features.json",
];
const allowedServices = /^services\/credit-api\/src\/main\/resources\/(contractor-dossier\/manifest\.json|datev-reference-hashes\.json|kaggle-reference-hashes\.json|nova-features\.json|real-estate\/)/;
const forbidden = [
  [/^\.local\//, "private local files"],
  [/(^|\/)\.env(?!\.example$)[^/]*$/, "environment files"],
  [/\.(dump|sql|sqlite|db|tfstate|tfvars|pem|key)$/i, "database dumps, state or keys"],
  [/^(infra|docs)\//, "infrastructure and docs"],
  [/^docker-compose[^/]*\.yml$/, "compose files"],
  [/\.test\.(ts|tsx|mjs|js)$/, "test files"],
  [/^services\//, "backend files the frontend does not import", (file) => !allowedServices.test(file)],
];

const leaks = uploaded.flatMap((file) => forbidden.filter(([pattern, , extra]) => pattern.test(file) && (!extra || extra(file))).map(([, reason]) => `${file} (${reason})`));
const missing = frontendBackendFiles.filter((file) => !uploaded.includes(file));
if (leaks.length) console.error(`Would upload ${leaks.length} files that must stay out:\n  ${leaks.slice(0, 20).join("\n  ")}`);
if (missing.length) console.error(`Files the frontend imports are excluded by .vercelignore:\n  ${missing.join("\n  ")}`);
if (leaks.length || missing.length) process.exit(1);
console.log(`Vercel upload: ${uploaded.length} of ${tracked.length} tracked files; no private or backend-only files; frontend imports present.`);

if (process.argv.includes("--build")) {
  const dir = mkdtempSync(join(tmpdir(), "vercel-bundle-"));
  try {
    for (const file of uploaded) {
      mkdirSync(dirname(join(dir, file)), {recursive: true});
      copyFileSync(file, join(dir, file));
    }
    execFileSync("npm", ["ci", "--no-audit", "--no-fund"], {cwd: dir, stdio: "inherit"});
    execFileSync("npm", ["run", "build"], {cwd: dir, stdio: "inherit"});
    console.log("Next.js production build passed on the filtered upload tree.");
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}
