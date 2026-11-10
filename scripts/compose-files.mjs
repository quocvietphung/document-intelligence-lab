// Single source of truth for which Compose files form the supported stack.
// Spark is a research experiment: it is never part of the production file list,
// and the production check below fails if any Spark service, image or build appears.
export const productionComposeFiles=Object.freeze([
  'docker-compose.yml',
  'docker-compose.platform.yml',
  'docker-compose.docling.yml',
  'docker-compose.nova-local.yml',
  'docker-compose.etl.yml',
  'docker-compose.local-resources.yml',
  'docker-compose.m365.yml',
]);
// Optional local analytics (DuckDB/Parquet consumers and the bounded ML worker). Still not Spark.
export const analyticsComposeFiles=Object.freeze(['docker-compose.ml.yml']);
// Explicit research experiments. Started only by scripts/run-document-spark.mjs, never by the normal stack.
export const experimentalComposeFiles=Object.freeze(['docker-compose.spark.yml']);
// Optional Google connectors (Gmail, Drive, Gmail drafts). Never part of the default production stack.
export const googleConnectorComposeFiles=Object.freeze(['docker-compose.google.yml']);
export const requiredProductionServices=Object.freeze(['case-db','identity-db','keycloak','credit-api','web','redis','qdrant','etl','m365-poc']);

export function composeFileArgs(files){return files.flatMap(file=>['-f',file]);}

// Returns human-readable findings; an empty list means no Spark component is present.
export function sparkFindings(config){
  const findings=[];
  for(const [name,service] of Object.entries(config?.services??{})){
    const image=String(service?.image??'');
    const dockerfile=String(service?.build?.dockerfile??'');
    const context=String(service?.build?.context??'');
    if(/spark/i.test(name))findings.push(`service "${name}"`);
    if(/spark/i.test(image))findings.push(`image "${image}" in service "${name}"`);
    if(/document-spark|spark/i.test(dockerfile)||/document-spark/i.test(context))findings.push(`build "${dockerfile||context}" in service "${name}"`);
  }
  return findings;
}

export function missingServices(config,required=requiredProductionServices){
  const present=new Set(Object.keys(config?.services??{}));
  return required.filter(name=>!present.has(name));
}
