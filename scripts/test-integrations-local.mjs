import assert from 'node:assert/strict';

/** Read-only authenticated checks. Never imports a Blob, runs ADF or invokes a model. */
export async function auditIntegrations({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const response=await request(`${web}/api/cases`,{headers:bearer});check(response.ok,'Dossiers available through authenticated web proxy');
  const cases=await response.json();assert.ok(cases.length,'Use an existing local research dossier for read-only verification');
  const suffix=`/api/cases/${encodeURIComponent(cases[0].id)}/platform/integrations`;
  for(const origin of [api,web]){
    check((await request(origin+suffix)).status===401,'Integration metadata requires Bearer authentication');
    const result=await request(origin+suffix,{headers:bearer});check(result.ok,'Integration metadata passes Java and web boundaries');
    const data=await result.json();
    check(data.caseId===cases[0].id&&data.automaticCalls===false&&data.integrations.length===9&&data.integrations.every(i=>i.verification==='NOT_LIVE_TESTED'),'Nine adapter states are configuration only, never fake live health');
    check(!data.integrations.some(i=>i.configured),'Baseline Docling stack leaves all new model/cloud integrations disabled');
    const serialized=JSON.stringify(data);check(!/accessToken|connection_string|openai\.azure\.com|blob\.core\.windows\.net/.test(serialized),'Public integration metadata does not expose provider credentials or resource endpoints');
  }
}
