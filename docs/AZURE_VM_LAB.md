# Optional Azure VM infrastructure

**Status: available on demand.** `credit-lab-vm` was recreated on 2026-11-08 for the interview showcase. It normally stays **deallocated** and is started only when needed. Docker local is still the primary runtime and does not depend on the VM.

The Azure OpenAI and Document Intelligence resources used by local Docker are separate and were kept.

## Current showcase state (checked on 2026-11-09)

| Part | State |
| --- | --- |
| Frontend | Vercel project `document-intelligence-lab` at https://document-intelligence-lab.vercel.app. The project was renamed from `credit-intelligence-lab` on 2026-11-09, and the old `credit-intelligence-lab.vercel.app` address no longer resolves. Git-triggered deployments remain disabled in `vercel.json`. |
| Backend | `credit-lab-vm` sits behind the Caddy HTTPS gateway. `/auth/*` serves Keycloak, and its admin paths return 404. `/api/*` and `/health` serve the Java API. Keycloak, two PostgreSQL databases, Qdrant, Redis and ClamAV run in Docker Compose. |
| Sign-in | The Keycloak client `credit-intelligence-web` accepts the new Vercel origin as a redirect URI and rejects the old one. The cloud account `advisor.demo` has a generated password. The password is kept in the operator's private files and never in Git. Local example passwords do not work in the cloud. |
| M365 PoC | Runs in mock mode and is private: it listens only on the VM loopback `127.0.0.1:8765` and the internal Docker network, with no gateway route. See the [PoC deployment plan](../services/m365-mcp-poc/docs/DEPLOYMENT_PLAN.md). |
| Power | The DevTestLab daily auto-shutdown schedule exists but is **disabled**, so deallocate the VM yourself after use. The Automation account `credit-lab-scheduler` holds only two one-time interview schedules (start and stop). Both have already run, and no future run is scheduled. |
| Terraform | A private state file outside Git tracks the current VM. `infra/azure/vm-lab/terraform.tfstate` is the empty post-teardown state of the removed VM. Never plan or apply changes to the current VM against it. Terraform does not manage the Automation account. |

The VM is billed while it runs. Its disk and static IP are billed even while it is deallocated. To start and stop it:

```bash
az vm start -g credit-intelligence-lab-vm -n credit-lab-vm
az vm deallocate -g credit-intelligence-lab-vm -n credit-lab-vm
```

After a start, the Compose services, including the private M365 PoC, come back by themselves within about two minutes.

## Known drift before the next deployment

- The VM's private `runtime.env` still contains the old frontend origin. While it differs from the origin passed by `scripts/azure-vm-lab.mjs`, `bootstrap.sh` stops with "Origin changed". Update that private value explicitly before the next `deploy`. The realm already allows the new origin.
- `scripts/azure-vm-lab.mjs` and `scripts/test-azure-vm.mjs` read Terraform outputs from `infra/azure/vm-lab/` and private files from `.local/azure-vm/`. Both locations still describe the removed VM; for example, its `advisor.json` is there. Point the scripts at the current VM's private state and files before using them.

## Source

`infra/azure/vm-lab/` contains the single-VM Compose deployment: a Caddy HTTPS gateway, Java, Keycloak, two PostgreSQL databases, Qdrant, Redis, ClamAV and optional local telemetry.

It is not a highly available managed platform. Running Terraform creates paid infrastructure, and no local startup command invokes it.

## Before recreating or changing the cloud environment

1. Review resource ownership, subscription, region, current pricing and VM quota.
2. Review a new Terraform plan against the correct state. Do not replay old saved plans, and do not restore a historical state file over a newer one.
3. Remove or update expired one-time schedules. Review SSH access and shutdown settings.
4. Use a scoped Managed Identity for the workload's Azure AI access. Do not copy the developer token-file bridge into cloud production.
5. Restore data only after testing private backups, compatible software versions and document-volume ownership.
6. Set up private database access, TLS, secret management, backups, monitoring and a rollback plan.
7. Reconfigure and test the frontend OAuth origins, issuer and backend URL before exposing the application.

The removed VM's private backup and recovery notes are stored locally under `.local/azure-vm/backups/` and are excluded from Git. They contain credentials and documents and must not be published.

For daily use, follow [Docker local setup](DOCKER_LOCAL.md) and [local Azure AI configuration](AZURE_AI.md) instead.
