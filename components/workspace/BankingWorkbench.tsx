"use client";
import {DocumentCorpus} from "./DocumentCorpus";
export function BankingWorkbench({caseId,locale,ask,inspect}:{caseId:string;locale:string;ask:(question:string)=>void;inspect:(id:string)=>void}){
 return <DocumentCorpus banking caseId={caseId} locale={locale} ask={ask} inspect={inspect}/>;
}
