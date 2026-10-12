import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../infra/keycloak/", import.meta.url);
const local = JSON.parse(
  readFileSync(new URL("credit-intelligence-realm.json", root), "utf8"),
);
const production = JSON.parse(
  readFileSync(
    new URL("credit-intelligence-production-realm.json.template", root),
    "utf8",
  ).replaceAll(
    "__FRONTEND_URL__",
    "https://credit-intelligence-lab.vercel.app",
  ),
);
const startup = readFileSync(new URL("start-vercel.sh", root), "utf8");
const dockerfile = readFileSync(new URL("Dockerfile.vercel", root), "utf8");
assert.ok(
  dockerfile.includes("ENV KC_FEATURES=stateless"),
  "Ephemeral Vercel instances need database-backed authentication state",
);
assert.ok(
  startup.includes("KC_CACHE_EMBEDDED_CLUSTER_NAME="),
  "Each independent cache cluster needs a unique name",
);
assert.ok(
  startup.includes(
    `> /opt/keycloak/data/import/${production.realm}-realm.json`,
  ),
  "Keycloak import filename must match the realm name",
);
for (const realm of [local, production]) {
  assert.equal(realm.registrationAllowed, false);
  const client = realm.clients.find(
    (item) => item.clientId === "credit-intelligence-web",
  );
  assert.equal(client.publicClient, true);
  assert.equal(client.directAccessGrantsEnabled, false);
  assert.equal(client.attributes["pkce.code.challenge.method"], "S256");
  assert.ok(
    client.protocolMappers.some(
      (mapper) => mapper.config["included.custom.audience"] === "credit-api",
    ),
  );
  assert.ok(
    client.protocolMappers.some(
      (mapper) => mapper.config["claim.name"] === "tenant_id",
    ),
  );
  assert.ok(
    !client.redirectUris.some((uri) => uri === "*"),
    "Redirects must be restricted to the application origin",
  );
}
console.log(
  "PASS local and production Keycloak realm configuration, PKCE, tenant, audience and import filename",
);
