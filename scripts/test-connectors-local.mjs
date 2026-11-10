// Local acceptance for the provider-neutral connectors, through the real Keycloak login, the Next.js
// proxies and the Java API. Uses only bundled fictional PDFs and the simulated M365 service; it makes no
// Google, Microsoft or Azure call. It creates one dedicated fictional dossier and never approves anything.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function auditConnectors({request,check,bearer,web}){
  const json=async(url,options={})=>{const response=await request(url,{...options,headers:{...bearer,'Content-Type':'application/json',...options.headers}});return {status:response.status,body:await response.json().catch(()=>({}))};};
  const post=(url,body={})=>json(url,{method:'POST',body:JSON.stringify(body)});

  const unauthenticated=await request(`${web}/api/connectors`);check(unauthenticated.status===401,'Connector status requires a bearer token');
  const overview=await json(`${web}/api/connectors`);
  check(overview.status===200&&overview.body.tokensInBrowser===false&&overview.body.automaticSync===false,'Connector status is readable and never returns tokens');
  const providers=Object.fromEntries(overview.body.providers.map(p=>[p.id,p]));
  check(providers.local?.label==='verified-local'&&providers.local.enabled&&providers.local.connection==='NOT_REQUIRED','Local fixtures are the default verified-local source');
  check(providers.gmail?.label==='implemented-not-live-verified'&&providers.gmail.enabled===false&&providers['google-drive']?.enabled===false,'Gmail and Drive stay disabled without the Google layer');
  check(providers['microsoft-365']?.label==='simulated'&&providers['microsoft-365'].live===false,'Microsoft 365 is labelled simulated, never live');
  check(['webdav','s3'].every(id=>providers[id]?.label==='future'&&providers[id].enabled===false),'Future adapters are disabled');
  check(!JSON.stringify(overview.body).includes('refresh_token')&&!JSON.stringify(overview.body).includes('"live-verified"'),'No token field and no live-verified label');

  const catalog=await json(`${web}/api/connectors/use-cases`);check(catalog.status===200&&catalog.body.useCases.length===8,'Eight use cases are served');
  const created=await post(`${web}/api/cases`,{applicant:'Connector acceptance (fictional)',purpose:'Provider-neutral intake check with fictional PDFs only',amountEuro:0,coApplicant:'',version:0,domain:'real-estate'});
  check(created.status===201&&/^CR-/.test(created.body.id),'Dedicated fictional dossier created');
  const caseId=created.body.id,base=`${web}/api/cases/${caseId}/platform`;

  for(const useCase of catalog.body.useCases){
    const result=await post(`${base}/use-cases/${useCase.id}/check`);
    check(result.status===200&&result.body.passed===true&&result.body.networkCalls===0,`Use case passes offline: ${useCase.id}`);
  }
  const sample=catalog.body.useCases.find(u=>u.id==='project-assessment').businessDataSample;
  const assessment=await post(`${base}/project-assessment`,{csv:sample});
  check(assessment.status===200&&assessment.body.costs.forecast==='16750000.00'&&assessment.body.humanReviewRequired===true,'Project metrics are deterministic and only request review');

  const gmail=await post(`${base}/sources/gmail/preview`,{query:''});check(gmail.status===503&&gmail.body.error==='CONNECTOR_NOT_CONFIGURED','Gmail is not called without configuration');
  const webdav=await post(`${base}/sources/webdav/preview`,{});check(webdav.status===501&&webdav.body.error==='CONNECTOR_NOT_IMPLEMENTED','Future adapters have no network code');

  const caseVersion=async()=>(await json(`${web}/api/cases/${caseId}`)).body.version;
  async function importAndProcess(sourceId,query,pick){
    const preview=await post(`${base}/sources/${sourceId}/preview`,{query,limit:10});
    check(preview.status===200&&preview.body.automaticImport===false,`${sourceId} preview is explicit`);
    const item=preview.body.items.find(pick);assert.ok(item,`${sourceId} fixture missing`);check(item.alreadyImported===false,`${sourceId} item not imported yet`);
    const imported=await post(`${base}/sources/${sourceId}/import`,{requestId:randomUUID(),caseVersion:await caseVersion(),externalIds:[item.externalId],profile:'general',consent:true});
    const entry=imported.body.items?.[0];check(imported.status===200&&entry?.state==='ACCEPTED'&&entry.jobId,`${sourceId} item queued in the shared pipeline`);
    let job;
    for(let attempt=0;attempt<60;attempt++){
      await new Promise(resolve=>setTimeout(resolve,5000));
      job=(await json(base)).body.jobs?.find(j=>j.id===entry.jobId);
      if(job&&['COMPLETE','FAILED'].includes(job.status))break;
    }
    check(job?.status==='COMPLETE'&&job.scan_result==='CLAMAV_CLEAN',`${sourceId} document scanned by ClamAV and extracted`);
    const again=await post(`${base}/sources/${sourceId}/import`,{requestId:randomUUID(),caseVersion:await caseVersion(),externalIds:[item.externalId],profile:'general',consent:true});
    check(again.body.items?.[0]?.state==='DUPLICATE','Re-import of the same revision is refused');
    return job;
  }
  const local=await importAndProcess('local','bauvertrag',i=>i.externalId==='use-cases/bauvertrag-musterquartier.pdf');
  const m365=await importAndProcess('microsoft-365','',i=>i.externalId==='project-status-001');
  const dossier=(await json(`${web}/api/cases/${caseId}`)).body;
  const contract=dossier.documents.find(d=>d.id===local.document_id);
  check(contract&&contract.status!=='verified'&&contract.pages.some(p=>p.text.includes('Gewährleistungsfrist')),'Extracted text is kept for review and nothing is auto-approved');
  check(dossier.documents.some(d=>d.id===m365.document_id),'Simulated Microsoft 365 document reached the same dossier');

  const draft=await post(`${base}/destinations/gmail-draft/preview`,{documentId:contract.id,fieldLabels:['x'],recipients:[],subject:'Check',note:'',includeEvidenceExcerpts:false});
  check(draft.status===409&&draft.body.error==='HUMAN_REVIEW_REQUIRED','Drafts need a human-reviewed document first');
  const report=await post(`${base}/destinations/report`);
  check(report.status===200&&report.body.documents.length>=2&&report.body.provenance.length===2&&report.body.documents.every(d=>d.humanReviewed===false),'Report carries provenance and no implied approval');
  const trail=await json(`${base}/sources/imports`);
  const events=new Set(trail.body.audit.map(e=>e.event));
  check(['SOURCE_PREVIEWED','SOURCE_IMPORTED','USE_CASE_CHECKED','PROJECT_ASSESSED','REPORT_EXPORTED'].every(e=>events.has(e)),'Audit trail records preview, import, checks, assessment and report');
  check(trail.body.imports.some(i=>i.sourceId==='microsoft-365'&&i.label==='simulated')&&trail.body.imports.some(i=>i.sourceId==='local'),'Provenance keeps source, revision and label');
  console.log(`Connector acceptance dossier: ${caseId}`);
}
