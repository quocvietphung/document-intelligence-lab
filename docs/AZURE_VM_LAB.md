# Optional Azure VM infrastructure

**Current status: decommissioned.** The previous `credit-lab-vm`, its disk, public IP, dedicated network and interview power scheduler were removed to avoid ongoing VM infrastructure costs. Docker local is the primary runtime.

The Azure OpenAI and Document Intelligence resources used by local Docker are separate and were retained. The old Vercel frontend no longer has its former cloud API/Keycloak backend.

## Source kept for future use

`infra/azure/vm-lab/` contains an optional single-VM Compose deployment: Caddy HTTPS gateway, Java, Keycloak, two PostgreSQL databases, Qdrant, Redis, ClamAV and optional local telemetry.

It is not a highly available managed platform, and running Terraform would create paid infrastructure. No local startup command invokes it.

## Before recreating a cloud environment

1. Review resource ownership, subscription, region, current pricing and VM quota.
2. Review a new Terraform plan. Do not replay old saved plans or restore a historical state file over the current post-teardown state.
3. Remove/update expired one-time interview schedules and review SSH access and shutdown settings.
4. Use a scoped Managed Identity for the workload's Azure AI access; do not copy the developer token-file bridge into cloud production.
5. Restore data only after testing private backups, compatible software versions and document-volume ownership.
6. Establish private database access, TLS, secret management, backups, monitoring and a rollback plan.
7. Reconfigure/test frontend OAuth origins, issuer and backend URL before exposing the application.

The dedicated former VM's private backup and recovery notes are held locally under `.local/azure-vm/backups/`, excluded from Git. They contain credentials and documents and must not be published.

For daily use, follow [Docker local setup](DOCKER_LOCAL.md) and [local Azure AI configuration](AZURE_AI.md) instead.
