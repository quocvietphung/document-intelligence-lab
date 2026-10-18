"use client";
import {useId,type ReactNode} from 'react';
import {Search,X} from 'lucide-react';
import {workspacePresentation} from '@/lib/workspace-presentation';

type Choice={value:string;label:string};
export function CollectionToolbar({locale,label,query,searchLabel,onQuery,filter,filters,onFilter,sort,sorts,onSort,shown,total,active,reset,children}:{
  locale:string;label:string;query:string;searchLabel:string;onQuery:(value:string)=>void;
  filter?:string;filters?:readonly Choice[];onFilter?:(value:string)=>void;
  sort?:string;sorts?:readonly Choice[];onSort?:(value:string)=>void;
  shown:number;total:number;active:boolean;reset:()=>void;children?:ReactNode;
}){
  const id=useId(),t=workspacePresentation(locale);
  return <div className={`collection-toolbar${sorts?' collection-has-sort':''}${!filters?' collection-no-filter':''}`} role="search" aria-label={label}>
    <div className="collection-controls">
      <label className="collection-search" htmlFor={`${id}-query`}><span>{t.search}</span><div><Search size={16} aria-hidden="true"/><input id={`${id}-query`} type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={event=>onQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Escape'&&query){event.preventDefault();event.stopPropagation();onQuery('');}}}/></div></label>
      {filters&&onFilter?<label htmlFor={`${id}-filter`}><span>{t.status}</span><select id={`${id}-filter`} value={filter} onChange={event=>onFilter(event.target.value)}>{filters.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>:null}
      {sorts&&onSort?<label htmlFor={`${id}-sort`}><span>{t.sort}</span><select id={`${id}-sort`} value={sort} onChange={event=>onSort(event.target.value)}>{sorts.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>:null}
    </div>
    <div className="collection-toolbar-footer"><div>{children}<span role="status" aria-live="polite">{shown} / {total} {t.shown}</span></div>{active?<button type="button" className="button-link collection-reset" onClick={reset}><X size={13}/>{t.clear}</button>:null}</div>
  </div>;
}
