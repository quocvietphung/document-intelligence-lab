import { ClientAssertionCredential, DefaultAzureCredential } from "@azure/identity";
import { createAzure } from "@ai-sdk/azure";
import { getVercelOidcToken } from "@vercel/oidc";

export type AzureConfig = {
  endpoint: string;
  deployment: string;
  tenantId?: string;
  clientId?: string;
};

export function getAzureConfig(): AzureConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!endpoint || !deployment) return null;
  return {
    endpoint,
    deployment,
    tenantId: process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID,
  };
}

export function createAzureModel(config: AzureConfig) {
  const credential =
    process.env.VERCEL && config.tenantId && config.clientId
      ? new ClientAssertionCredential(
          config.tenantId,
          config.clientId,
          getVercelOidcToken,
        )
      : new DefaultAzureCredential();
  const azure = createAzure({
    baseURL: `${config.endpoint}/openai`,
    tokenProvider: async () => {
      const accessToken = await credential.getToken(
        "https://cognitiveservices.azure.com/.default",
      );
      if (!accessToken?.token) throw new Error("Azure identity token unavailable");
      return accessToken.token;
    },
  });
  return azure.chat(config.deployment);
}
