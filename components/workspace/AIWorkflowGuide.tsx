"use client";
import {useState,type ReactNode} from 'react';
import {ArrowRight,Ban,CheckCircle2,Circle,CircleDashed,UserRound,Workflow as WorkflowIcon} from 'lucide-react';
import {AIPdfExample} from './AIPdfExample';
import {dashboardText} from '@/lib/ai-dashboard-language';
import {workflowPdfExample} from '@/lib/ai-pdf-examples';
import {stepAction,workflowAction,workflowGroups,workflowList,workflowSummary,type StepState,type UseFeature,type Workflow,type WorkflowAction,type WorkflowFacts,type WorkflowFeature,type WorkflowStatus,type WorkflowStep} from '@/lib/ai-workflows';
import {stepDetail,workflowText} from '@/lib/ai-workflows-language';
import {researchText} from '@/lib/document-research';
import {trustText} from '@/lib/nova-trust-language';
import {workspacePageName,workspacePresentation} from '@/lib/workspace-presentation';
import {fill,usabilityText} from '@/lib/workspace-usability';

const tones:Record<WorkflowStatus,string>={done:'success',ready:'info',todo:'warning',blocked:'danger',demo:'neutral'};
const markers:Record<StepState,typeof Circle>={done:CheckCircle2,todo:Circle,blocked:Ban,unknown:CircleDashed,user:UserRound};
type Run=(action:WorkflowAction)=>void;

/** Words for steps, buttons and destinations in one language; page and section names come from their own tables. */
function workflowCopy(locale:string){
  const t=workflowText(locale),catalog=dashboardText(locale),presentation=workspacePresentation(locale),usability=usabilityText(locale),trust=trustText(locale),research=researchText(locale);
  const pageName=(action:Extract<WorkflowAction,{kind:'page'}>)=>action.panel?`${workspacePageName(locale,action.page)} → ${action.panel==='batches'?presentation.batch:research(action.panel)}`:workspacePageName(locale,action.page);
  const label=(action:WorkflowAction)=>action.kind==='intake'?presentation.upload:action.kind==='review'?usability.reviewNow:action.kind==='nova'?catalog.labels.nova
    :fill(usability.openPage,{page:action.kind==='trust'?trust[action.section]:pageName(action)});
  const library=(id:WorkflowFeature)=>{const action=workflowAction(id,'use');return action.kind==='trust'&&action.section==='library';};
  const title=(id:WorkflowFeature,step:WorkflowStep)=>{
    if(step!=='use')return t.steps[step][0];
    const action=workflowAction(id,'use');
    if(action.kind==='trust')return library(id)?fill(t.use.library,{section:trust.library,title:catalog.features[id][0]}):fill(t.use.trust,{page:workspacePageName(locale,'trust'),section:trust[action.section]});
    return action.kind==='page'?fill(t.use.page,{page:pageName(action)}):t.use.nova;
  };
  const hint=(id:WorkflowFeature,step:WorkflowStep)=>{
    if(step!=='use')return t.steps[step][1];
    const how=t.how[id as UseFeature];
    return library(id)?`${t.use.templateIntro} ${how}`:how;
  };
  return {t,catalog,presentation,label,title,hint};
}
function Go({action,primary,label,run}:{action:WorkflowAction;primary:boolean;label:string;run:Run}){
  return <button type="button" className={primary?'button-primary':'button-secondary'} onClick={()=>run(action)}>{label}<ArrowRight size={14} aria-hidden="true"/></button>;
}
/** A disclosure whose content is built only while it is open, so the task page stays light with 33 workflows. */
function Disclosure({className,summary,initiallyOpen=false,attributes,children}:{className:string;summary:ReactNode;initiallyOpen?:boolean;attributes?:Record<string,string>;children:()=>ReactNode}){
  const [open,setOpen]=useState(initiallyOpen);
  return <details className={className} open={initiallyOpen||undefined} onToggle={event=>setOpen(event.currentTarget.open)} {...attributes}>
    <summary>{summary}</summary>{open?children():null}
  </details>;
}

/** One workflow: status, the next step with how and where to do it, then the full process on demand. */
export function AIWorkflowRow({locale,item,facts,run,expanded=false}:{locale:string;item:Workflow;facts:WorkflowFacts;run:Run;expanded?:boolean}){
  const {t,catalog,label,title,hint}=workflowCopy(locale),[name,purpose]=catalog.features[item.id],next=item.status==='demo'?undefined:item.next;
  return <li className="ai-workflow" data-status={item.status} data-ai-workflow={item.id}>
    <div className="ai-workflow-head">
      <strong>{name}</strong>
      <span className="status-chip" data-tone={tones[item.status]}>{t.status[item.status]}</span>
      <small>{fill(t.labels.progress,{done:item.done,total:item.total})}</small>
    </div>
    {next?<div className="ai-workflow-next">
      <p><b>{item.status==='blocked'?t.labels.operator:t.labels.next}:</b> {title(item.id,next)}</p>
      <p className="ai-workflow-hint">{hint(item.id,next)}</p>
      <Go action={workflowAction(item.id,next)} primary={item.status!=='blocked'} label={label(workflowAction(item.id,next))} run={run}/>
    </div>:null}
    <Disclosure className="ai-workflow-process" initiallyOpen={expanded} summary={item.total===1?t.labels.processOne:fill(t.labels.process,{count:item.total})}>{()=><>
      <p className="ai-workflow-purpose">{purpose}</p>
      <ol>{item.steps.map(({step,state},index)=>{const Marker=markers[state],detail=stepDetail(step,facts,t.details);
        return <li key={step} data-state={state} aria-current={step===next?'step':undefined}>
          <Marker size={16} aria-hidden="true"/>
          <div>
            <p><strong>{index+1}. {title(item.id,step)}</strong> <span className="ai-workflow-state">{t.state[state]}</span>{detail?<span className="ai-workflow-detail"> · {detail}</span>:null}</p>
            <p className="ai-workflow-hint">{hint(item.id,step)}</p>
          </div>
        </li>;})}</ol>
      <AIPdfExample example={workflowPdfExample(item.id,locale)} locale={locale} open={()=>run({kind:'page',page:item.id==='classification'?'experiments':'documents'})}/>
    </>}</Disclosure>
  </li>;
}

/**
 * Every AI feature as an end-to-end process on the task page. Unfinished workflows say which step comes next,
 * how to do it and where; the full process stays one click away. Status comes only from this dossier's records.
 */
export function AIWorkflowGuide({locale,facts,run}:{locale:string;facts:WorkflowFacts;run:Run}){
  const [filter,setFilter]=useState<'open'|'all'>('open');
  const {t,presentation,label}=workflowCopy(locale);
  const list=workflowList(facts),summary=workflowSummary(list),unfinished=list.filter(item=>item.status!=='done');
  return <section className="surface ai-workflows" aria-labelledby="ai-workflows-title">
    <header>
      <div>
        <h2 id="ai-workflows-title"><WorkflowIcon size={17} aria-hidden="true"/> {t.labels.title}</h2>
        <p>{t.labels.intro}</p>
      </div>
      <div className="ai-workflows-filter" role="group" aria-label={t.labels.filter}>
        <button type="button" aria-pressed={filter==='open'} onClick={()=>setFilter('open')}>{fill(t.labels.showOpen,{count:unfinished.length})}</button>
        <button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>{fill(t.labels.showAll,{count:list.length})}</button>
      </div>
    </header>
    {facts.demo?<p className="ai-workflows-unlock" data-tone="neutral">{t.labels.demoNote}</p>
      :<ul className="ai-workflows-counts">{(['done','ready','todo','blocked'] as const).filter(status=>summary[status]>0).map(status=>
        <li key={status}><span className="status-chip" data-tone={tones[status]}>{t.status[status]} · {summary[status]}</span></li>)}</ul>}
    {!facts.demo&&summary.unlock?<div className="ai-workflows-unlock">
      <p>{fill(summary.unlock.workflows===1?t.labels.unlockOne:t.labels.unlock,{step:t.steps[summary.unlock.step][0],count:summary.unlock.workflows})}</p>
      <Go action={stepAction(summary.unlock.step)} primary label={label(stepAction(summary.unlock.step))} run={run}/>
    </div>:null}
    {workflowGroups(list).map(group=>{
      const rows=group.workflows.filter(item=>filter==='all'||item.status!=='done');
      if(!rows.length)return null;
      const done=group.workflows.filter(item=>item.status==='done').length,open=workflowSummary(group.workflows);
      return <Disclosure key={group.id} className="ai-workflows-group" attributes={{'data-ai-workflow-group':group.id}} summary={<>
        <strong>{presentation[group.id]}</strong>
        <small>{fill(t.labels.groupProgress,{done,total:group.workflows.length})}</small>
        {(['todo','blocked','ready'] as const).filter(status=>open[status]>0).map(status=><span key={status} className="status-chip" data-tone={tones[status]}>{t.status[status]} · {open[status]}</span>)}
      </>}>{()=><ul>{rows.map(item=><AIWorkflowRow key={item.id} locale={locale} item={item} facts={facts} run={run}/>)}</ul>}</Disclosure>;
    })}
    {filter==='open'&&!unfinished.length?<p className="overview-clear">{t.labels.allDone}</p>:null}
    <p className="ai-workflows-note">{t.labels.honesty}</p>
  </section>;
}
