import {kaggleReference,researchSampleLabels,researchSampleScope} from '@/lib/research-samples';
export function InsuranceReferenceNotice({name,locale}:{name:string;locale:string}){
  const sample=kaggleReference(name);if(!sample)return null;
  const t=researchSampleLabels(locale);
  const check=locale==='de'?'Bibliothekszuordnung nach Dateiname; Original prüfen.':locale==='vi'?'Đối chiếu theo tên trong thư viện; cần kiểm tra bản gốc.':'Library mapping by filename; verify against the original.';
  return <aside className="payroll-reference-notice"><div><strong>{t.kaggle}</strong><p>{researchSampleScope(sample,locale)}</p><p>{t.mapped}: {sample.sourcePages.map((page,index)=>`${index+1} → ${page}`).join(' · ')}. {check}</p><a href={sample.sourceUrl} target="_blank" rel="noopener noreferrer">{t.source}</a></div></aside>;
}
