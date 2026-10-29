import catalogue from '@/lib/rag-pdf-sources.json';

const copy={
  en:{title:'PDF benchmark sources',hint:'Reviewed source registry. Private PDFs are prepared separately; no automatic download, upload or cloud call. Publisher terms still apply. Original page numbers below differ from excerpt pages.',pages:'Publisher pages',open:'Open imported PDF',publisher:'Publisher source'},
  de:{title:'PDF-Quellen für Benchmarks',hint:'Geprüftes Quellenverzeichnis. Private PDFs separat vorbereiten; kein automatischer Download, Upload oder Cloud-Aufruf. Herausgeberbedingungen gelten. Original- und Auszugsseiten unterscheiden sich.',pages:'Originalseiten',open:'Importierte PDF öffnen',publisher:'Herausgeberquelle'},
  vi:{title:'Nguồn PDF cho bộ đánh giá',hint:'Danh mục nguồn đã rà soát. PDF riêng tư được chuẩn bị riêng; không tự tải, upload hay gọi cloud. Điều khoản nhà phát hành vẫn áp dụng. Số trang nguồn có thể khác trang bản trích.',pages:'Trang nguồn',open:'Mở PDF đã nhập',publisher:'Nguồn nhà phát hành'},
};
export function RagPdfSources({locale,documents,inspect}:{locale:string;documents:{id:string;name:string}[];inspect:(id:string,page?:number)=>void}){
  const t=copy[locale==='vi'?'vi':locale==='de'?'de':'en'];
  return <details className="surface lab-section research-reference-details"><summary>{t.title} · {catalogue.sources.length}</summary><p className="lab-caption">{t.hint}</p><div className="research-asset-list">{catalogue.sources.map(source=>{const imported=documents.find(d=>d.name===source.file);return <article key={source.id}><div><strong>{source.title}</strong><small>{source.publisher} · {t.pages}: {source.sourcePages.join(', ')}</small><a className="button-link" href={source.sourceUrl||('url' in source?source.url:undefined)} target="_blank" rel="noreferrer">{t.publisher}</a></div>{imported?<button className="button-secondary" onClick={()=>inspect(imported.id,1)}>{t.open}</button>:null}</article>;})}</div></details>;
}
