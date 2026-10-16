import {resolve} from 'node:path';

export function azureDockerEnvironment(source, {root, uid, gid}) {
  const required=['AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT','AZURE_OPENAI_ENDPOINT','AZURE_OPENAI_DEPLOYMENT'];
  for(const key of required) {
    if(!source[key]?.trim() || /YOUR-|REPLACE-|<|>/i.test(source[key]))
      throw new Error(`Configure ${key} in .env.azure.local or your environment before starting Azure mode.`);
  }
  for(const key of required.slice(0,2)) {
    let endpoint;
    try {endpoint=new URL(source[key]);} catch {throw new Error(`${key} must be a valid HTTPS resource endpoint.`);}
    if(endpoint.protocol!=='https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !endpoint.hostname.endsWith('.azure.com'))
      throw new Error(`${key} must be an HTTPS Azure resource endpoint without credentials or query parameters.`);
  }
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(source.AZURE_OPENAI_DEPLOYMENT))
    throw new Error('AZURE_OPENAI_DEPLOYMENT must be your deployed model name.');
  // Never alter HOME or mount the Azure CLI credential cache into a container.
  return {...source,CREDIT_LOCAL_UID:String(uid),CREDIT_LOCAL_GID:String(gid),CREDIT_AZURE_TOKEN_DIR:resolve(root,'.local/azure-auth')};
}
