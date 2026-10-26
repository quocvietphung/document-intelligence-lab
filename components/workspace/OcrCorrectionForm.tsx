"use client";
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {toWorkspaceCase,type WorkspaceCase} from '@/lib/credit-api';
import type {CreditDocument} from '@/lib/credit-data';
import {inspectionText,type EvidenceSelection} from '@/lib/evidence-inspection';

export function OcrCorrectionForm({doc,selection,caseId,caseVersion,locale,onSaved}:{doc:CreditDocument;selection:EvidenceSelection;caseId:string;caseVersion:number;locale:string;onSaved:(item:WorkspaceCase)=>void}){
  const auth=useAuth(),t=inspectionText(locale),[corrected,setCorrected]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[state,setState]=useState('');
  const inFlight=useRef(false),controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const storedText=selection.region?.text||(selection.fieldIndex!=null?doc.fields?.[selection.fieldIndex]?.originalValue??doc.fields?.[selection.fieldIndex]?.value:doc.pages?.find(p=>p.number===selection.page)?.text);
  const allowed=storedText===selection.ocrText&&selection.ocrText.length<=1000;
  async function save(){
    if(inFlight.current||!auth.token||!allowed)return;inFlight.current=true;setBusy(true);setState('');
    const abort=new AbortController();controller.current=abort;
    try{
      const response=await fetch(`/api/cases/${caseId}/documents/${doc.id}/ocr-corrections`,{method:'POST',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify({version:caseVersion,page:selection.page,sourceId:selection.sourceId,originalText:selection.ocrText,correctedText:corrected,reason}),cache:'no-store',signal:abort.signal});
      if(!response.ok)throw new Error();const updated=toWorkspaceCase(await response.json());if(abort.signal.aborted)return;
      setState(t.saved);setCorrected('');setReason('');onSaved(updated);
    }catch{if(!abort.signal.aborted)setState(t.failed);}finally{if(!abort.signal.aborted){inFlight.current=false;setBusy(false);}}
  }
  if(!allowed)return null;
  return <details className="document-text-evidence"><summary>{t.correction}</summary><p>{t.pending}</p><form className="trust-form" onSubmit={e=>{e.preventDefault();void save();}}><label>{t.corrected}<textarea value={corrected} disabled={busy} maxLength={1000} required onChange={e=>setCorrected(e.target.value)}/></label><label>{t.reason}<input value={reason} disabled={busy} maxLength={500} required onChange={e=>setReason(e.target.value)}/></label><button type="submit" className="button-secondary" disabled={busy||!corrected.trim()||corrected.trim()===storedText||!reason.trim()}>{busy?t.saving:t.save}</button>{state?<p role="status">{state}</p>:null}</form></details>;
}
