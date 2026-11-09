# Deployment plan: PoC on the existing VM

Status: **private mock deployment applied on 2026-11-09** (see section 0). The public gateway route (section 5), Entra authentication and live Microsoft Graph are **not** applied.
Every further step needs its own explicit approval (see the approval gate in the README).

## 0. Applied on 2026-11-09 (private, mock mode)

- The PoC was built on the VM from a release directory (`/opt/m365-poc/releases/<commit>`) with [`deploy/compose.vm.yml`](../deploy/compose.vm.yml). It is attached to the existing lab Docker network.
- The port is bound only to the VM loopback (`127.0.0.1:8765`). There is no gateway route, so the service is not reachable from the internet. Reach it through an SSH tunnel or a command on the VM.
- It uses the mock document provider, local extraction and deterministic answers. `M365_POC_ALLOW_UNAUTHENTICATED_LOCAL_DOCKER=1` is set only because the service stays private.
- Hardening: the container runs as a non-root user with a read-only root file system, all capabilities dropped and a 512 MB memory limit. With `restart: unless-stopped`, it comes back when the VM starts.
- The smoke test on the VM passed. It covered health, a grounded answer with its source and page, abstention when evidence is missing, prompt-injection isolation, hiding of the restricted document, and clean logs.
- The gateway `Caddyfile` was backed up on the VM and left unchanged. No Azure resource was created.

From the release root on the VM:

```bash
LAB_NETWORK=<existing lab network> docker compose -f services/m365-mcp-poc/deploy/compose.vm.yml up -d --build   # deploy
LAB_NETWORK=<existing lab network> docker compose -f services/m365-mcp-poc/deploy/compose.vm.yml down             # rollback
```

## 1. Existing resources reused (no new resource is created)

Source: `infra/azure/vm-lab/` (Terraform, state kept outside Git).

| Existing resource | Used for | Change required |
| --- | --- | --- |
| Resource group, VNet, subnet, NSG, static public IP | Network path to the HTTPS gateway | None |
| Linux VM with system-assigned Managed Identity | Runs Docker Compose | None |
| Role assignment on existing Azure OpenAI resource | Future Azure OpenAI answer provider | None until live test is approved |
| Role assignment on existing Document Intelligence resource | Future `prebuilt-layout` extraction | None until live test is approved |
| Caddy gateway in `infra/azure/vm-lab/compose.yml` | HTTPS entry point | A new route is needed (section 5) |
| Daily VM auto-shutdown schedule (currently disabled) | Cost control | None; deallocate the VM manually after use |

Names containing `credit-lab` are preserved; renaming them would force Terraform replacement.

## 2. Proposed files deployed to the VM

The private variant applied in section 0 uses the release root with `deploy/compose.vm.yml`. The gateway snippet listed below has not been added.

- `services/m365-mcp-poc/` (application source, fixtures, evaluation dataset)
- `services/m365-mcp-poc/Dockerfile` and `docker-compose.yml` (standalone profile)
- A gateway route snippet (section 5) added to the VM's Caddy configuration after review

Not deployed: tests, caches, `.venv*`, `.env` files, the Terraform state, or any token file.

## 3. Environment variables

| Variable | Value for mock demo | Value for live (after approval) | Secret? |
| --- | --- | --- | --- |
| `M365_POC_PROVIDER` | `mock` | `graph` | no |
| `M365_POC_ENABLE_LIVE_GRAPH` | unset | `1` | no |
| `M365_POC_TENANT_ID`, `M365_POC_CLIENT_ID` | unset | test-tenant GUIDs | no (identifiers) |
| `M365_POC_EXTRACTOR` | `local` | `azure-document-intelligence` | no |
| `M365_POC_ENABLE_LIVE_AZURE_DI` | unset | `1` | no |
| `M365_POC_ANSWER_PROVIDER` | `deterministic` | `azure-openai` | no |
| `M365_POC_ENABLE_LIVE_AZURE_OPENAI` | unset | `1` | no |
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT` | unset | existing resource endpoints | no (endpoints; never keys) |
| `M365_POC_AUTH_MODE` | `local-dev` (loopback only) | `entra` | no |
| `M365_POC_ENTRA_TENANT_ID`, `M365_POC_ENTRA_AUDIENCE` | unset | API app registration values | no |
| `M365_POC_ALLOW_UNAUTHENTICATED_LOCAL_DOCKER` | `1` (local demo only) | must be unset | no |

No variable holds a client secret, API key or token. Secrets are not used by this design.

## 4. Managed Identity and credentials

- Azure calls use `DefaultAzureCredential` (azure-identity). On the VM this resolves to the VM's system-assigned Managed Identity.
- The identity already has resource-scoped Azure AI roles (Terraform). It does **not** have any Microsoft Graph permission. Graph access needs one of the two options in `docs/ENTRA_GRAPH_SETUP.md`, and neither is configured yet.
- No API key is read from the environment or from files.

## 5. HTTPS route through the existing gateway (proposal, not applied)

Add a path-scoped route to the Caddy site in `infra/azure/vm-lab/Caddyfile`, pointing to the PoC container on the internal Docker network:

```caddy
  handle /m365poc/* {
    uri strip_prefix /m365poc
    reverse_proxy m365-poc:8765
  }
```

Consequences to review before approval: the route exposes the PoC API to the internet through the gateway. In `entra` mode every request needs a valid bearer token. Do not deploy the route in `local-dev` mode.

## 6. Health check and smoke test (after approval)

```bash
curl -fsS https://<gateway-host>/m365poc/health
curl -fsS -H "Authorization: Bearer <token-from-test-tenant>" "https://<gateway-host>/m365poc/documents/search?q=Berlin%20Living"
curl -sS -o /dev/null -w "%{http_code}\n" "https://<gateway-host>/m365poc/documents/search?q=Berlin"   # expect 401
```

## 7. Commands (to be run only after approval)

These commands are for the standalone variant behind the gateway. The private variant uses the commands in section 0.

```bash
# on the VM, after the files are copied by an approved method
cd services/m365-mcp-poc
docker compose up -d --build
docker compose ps
docker inspect --format '{{.State.Health.Status}}' m365-poc-m365-poc-1
```

## 8. Rollback

```bash
docker compose -f services/m365-mcp-poc/docker-compose.yml down
# restore the previous Caddyfile (kept as a dated copy before the change) and reload the gateway
```

Rollback removes only the PoC container. Terraform state and the existing application stack are not touched.

## 9. VM start, deallocation and cost

- Start the VM only after approval. The auto-shutdown schedule is currently disabled, so deallocate the VM after use.
- Deallocate after the demo: `az vm deallocate --resource-group <rg> --name <vm>`.
- Estimated cost: the VM and public IP are already billed by the existing lab. The PoC container adds no Azure service cost. Azure OpenAI and Document Intelligence calls are billed per use and are not part of this plan's approval.

## 10. Cleanup

- Remove the gateway route and restore the saved Caddyfile.
- `docker compose down --volumes` removes only the PoC volumes (the PoC has no database volume; the job store is a local file).
- Revoke any test-tenant consent granted for the Graph test application. Delete the test app registration if it is no longer needed.
