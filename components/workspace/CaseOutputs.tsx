"use client";
import {useEffect,useState} from 'react';
import {Download} from 'lucide-react';
import {downloadJson} from '@/lib/browser-download';
import type {CreditDocument} from '@/lib/credit-data';
import {draftPreviewSchema,draftResultSchema,integrationsText,overviewSchema,type DraftPreview} from '@/lib/integrations';
import type {WorkspaceTab} from '@/lib/nova-guide';
import {workspaceText} from '@/lib/workspace-language';
import {workspacePageName} from '@/lib/workspace-presentation';
import {fill,usabilityText} from '@/lib/workspace-usability';
import {ModalSurface} from './ModalSurface';
import {useConnectorApi} from './connector-api';

/** Documents a person has confirmed and that have fields. Only these can feed a report or a draft. */
export function reviewedDocuments(documents:readonly CreditDocument[]){return documents.filter(d=>d.status==='verified'&&(d.fields?.length??0)>0);}

/** Report download next to the reviewed results. The server exports confirmed documents only. */
export function CaseReportButton({caseId,locale,documents}:{caseId:string;locale:string;documents:readonly CreditDocument[]}){
  const {request,run,busy,error}=useConnectorApi(locale),t=integrationsText(locale),u=usabilityText(locale);
  const ready=reviewedDocuments(documents).length>0;
  return <div className="case-report" data-page-tour="documents-report">
    <button type="button" className="button-secondary" disabled={!!busy||!ready} aria-describedby="case-report-hint"
      onClick={()=>void run('report',async()=>downloadJson(await request(`/api/cases/${encodeURIComponent(caseId)}/platform/destinations/report`,{}),`document-report-${caseId}.json`))}><Download size={15}/>{t.report}</button>
    <small id="case-report-hint">{ready?u.reportScope:t.reportNeedsReview}</small>
    {error?<p className="notice-error" role="alert">{error}</p>:null}
  </div>;
}

/** Gmail draft for one reviewed document. A draft is created only after approval of its exact text; nothing is sent. */
export function GmailDraftDialog({caseId,locale,document,close,navigate}:{caseId:string;locale:string;document:CreditDocument;close:()=>void;navigate:(tab:WorkspaceTab)=>void}){
  const {auth,request,run,busy,error}=useConnectorApi(locale),t=integrationsText(locale),u=usabilityText(locale);
  const casePath=`/api/cases/${encodeURIComponent(caseId)}/platform`;
  const [enabled,setEnabled]=useState<boolean>(),[fields,setFields]=useState<string[]>([]),[recipients,setRecipients]=useState(''),[subject,setSubject]=useState(''),[note,setNote]=useState('');
  const [excerpts,setExcerpts]=useState(false),[draft,setDraft]=useState<DraftPreview>(),[approved,setApproved]=useState(false),[done,setDone]=useState(false);
  useEffect(()=>{
    if(!auth.token)return;
    const timer=window.setTimeout(()=>void run('load',async()=>setEnabled(overviewSchema.parse(await request('/api/connectors')).destinations.some(d=>d.id==='gmail-draft'&&d.enabled))),0);
    return()=>window.clearTimeout(timer);
  },[auth.token,request,run]);
  const sources=workspacePageName(locale,'integrations');
  return <ModalSurface title={`${t.draft} · ${document.name}`} label={workspaceText(locale)('close')} close={()=>{if(!busy)close();}}>
    <div className="integrations-workbench gmail-draft-dialog">
      <p className="notice-lab">{t.draftWarning}</p>
      {error?<p className="notice-error" role="alert">{error}</p>:null}
      {enabled===undefined&&!error?<p className="lab-loading" role="status">{t.loading}</p>:null}
      {enabled===false?<div className="integration-draft"><p>{fill(u.draftNotConnected,{page:sources})}</p><button type="button" className="button-secondary" onClick={()=>{close();navigate('integrations');}}>{fill(u.openPage,{page:sources})}</button></div>:null}
      {enabled?<div className="integration-draft">
        <fieldset><legend>{t.fields}</legend>{document.fields?.map(f=><label key={f.label}><input type="checkbox" checked={fields.includes(f.label)}
          onChange={()=>{setDraft(undefined);setFields(current=>current.includes(f.label)?current.filter(v=>v!==f.label):[...current,f.label]);}}/>{f.label}: {f.value}</label>)}</fieldset>
        <label>{t.recipients}<input value={recipients} onChange={e=>{setRecipients(e.target.value);setDraft(undefined);}}/></label>
        <label>{t.subject}<input value={subject} maxLength={150} onChange={e=>{setSubject(e.target.value);setDraft(undefined);}}/></label>
        <label>{t.note}<textarea rows={2} value={note} maxLength={1000} onChange={e=>{setNote(e.target.value);setDraft(undefined);}}/></label>
        <label className="integration-consent"><input type="checkbox" checked={excerpts} onChange={e=>{setExcerpts(e.target.checked);setDraft(undefined);}}/>{t.excerpts}</label>
        <button type="button" className="button-secondary" disabled={!!busy||!fields.length||!subject.trim()} onClick={()=>void run('draft',async()=>{setDone(false);setApproved(false);
          setDraft(draftPreviewSchema.parse(await request(`${casePath}/destinations/gmail-draft/preview`,{documentId:document.id,fieldLabels:fields,recipients:recipients.split(',').map(r=>r.trim()).filter(Boolean),subject,note,includeEvidenceExcerpts:excerpts})));})}>{t.previewDraft}</button>
        {draft?<div className="integration-result"><pre className="integration-draft-preview">{`To: ${draft.recipients.join(', ')||'—'}\nSubject: ${draft.subject}\n\n${draft.body}`}</pre>
          <label className="integration-consent"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>{t.approve}</label>
          <button type="button" className="button-primary" disabled={!!busy||!approved} onClick={()=>void run('approve',async()=>{draftResultSchema.parse(await request(`${casePath}/destinations/gmail-draft/approve`,{previewId:draft.previewId,contentHash:draft.contentHash,confirmed:true}));setDone(true);setDraft(undefined);})}>{t.createDraft}</button></div>:null}
        {done?<p className="notice-lab" role="status">{t.draftCreated}</p>:null}
      </div>:null}
    </div>
  </ModalSurface>;
}
