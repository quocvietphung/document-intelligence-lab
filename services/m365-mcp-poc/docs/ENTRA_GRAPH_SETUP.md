# Entra ID and Microsoft Graph setup (documented, not configured)

Status: **future**. Nothing in this document has been executed. Use only a dedicated test tenant containing fictional documents.

## Local delegated test (explicitly enabled)

Permission: **`Files.Read`** (delegated) only.

1. In the test tenant, register a public-client application for the local device-code test.
2. Enable public client flows and the device-code flow.
3. Add the delegated permission `Files.Read`. Admin consent may be required by the tenant policy; obtain it only with approval.
4. Set `M365_POC_PROVIDER=graph`, `M365_POC_ENABLE_LIVE_GRAPH=1`, `M365_POC_TENANT_ID`, `M365_POC_CLIENT_ID`.
5. Keep the test documents in one dedicated test folder.

## Deployed service: option 1 (preferred)

Managed Identity service principal with the **application** permission `Sites.Selected`, granted to **one** dedicated test SharePoint site.

- `Sites.Selected` grants nothing by itself; a site-level grant is required for the exact site.
- Requires explicit approval for: the grant on that single site, and the service principal's identity.
- The service must also enforce its own document allowlist (fail closed). Graph site scope is not a document-level ACL.

## Deployed service: option 2

Dedicated Entra confidential application using **certificate** authentication (not a client secret). The certificate is stored in Key Vault and retrieved by Managed Identity. Same `Sites.Selected` scope and site-level grant as option 1.

Long-lived client secrets are not recommended. Use them only if neither option is possible, and then with rotation and expiry recorded.

## Not permitted by this PoC

`Files.Read.All`, `Sites.Read.All`, every write scope (`Files.ReadWrite*`, `Sites.ReadWrite*`, `Sites.Manage.All`, `Sites.FullControl.All`) and organisation-wide access. The code rejects these scope names (see `config.FORBIDDEN_GRAPH_SCOPES`).

## API boundary (Entra access tokens for this API)

- App registration for the API with an exposed scope `Documents.Read` and an app role `DocumentEvidence.Read`.
- Set `M365_POC_ENTRA_TENANT_ID` and `M365_POC_ENTRA_AUDIENCE` (the API's application ID URI).
- Clients obtain tokens for that audience. The API validates signature (RS256 via tenant JWKS), issuer, audience, tenant, expiry and the required scope or role.
