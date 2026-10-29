import {describe,it,expect} from 'vitest';
import {dashboardFeatures} from './ai-dashboard';
import {novaTaskIds} from './nova-trust';
import {workflowPdfExample,servicePdfExample,aiServicePdfSamples,pdfExampleCopy} from './ai-pdf-examples';
describe('PDF exercises',()=>{
  it('covers all sixteen AI workflows and all controlled tasks in three languages',()=>{
    for(const locale of ['en','de','vi'])for(const id of [...dashboardFeatures.filter(f=>f.category==='ai').map(f=>f.id),...novaTaskIds]){
      const example=workflowPdfExample(id,locale);expect(example?.file).toMatch(/\.pdf$/);expect(example?.question.length).toBeGreaterThan(30);
      expect(['general','insurance','banking']).toContain(example?.domain);
    }
    expect(dashboardFeatures.filter(f=>f.category==='ai')).toHaveLength(17);
  });
  it('covers both active and opt-in AI engines without pretending an example is a live result',()=>{
    for(const id of Object.keys(aiServicePdfSamples))expect(servicePdfExample(id,'en')?.file).toMatch(/\.pdf$/);
    expect(Object.keys(aiServicePdfSamples)).toEqual(expect.arrayContaining(['azure-document-intelligence','docling','paddle','azure-openai','nova-local','minilm','bge','reranker','vision','foundry']));
    expect(pdfExampleCopy('en').hint).toContain('not a passing result');
    expect(workflowPdfExample('payment','en')).toBeUndefined();
  });
  it('anchors the new chunking, prompting, ETL and cross-document exercises to concrete PDFs',()=>{
    for(const locale of ['en','de','vi'])for(const id of ['experiments','lineage','reconcile']){
      const example=workflowPdfExample(id,locale);expect(example?.file).toBe('kaggle-invoice-51109301.pdf');expect(example?.question).toContain('51109301');
    }
    expect(workflowPdfExample('reconcile','en')?.question).toContain('51109302');
    expect(workflowPdfExample('experiments','en')?.question).toContain('schema');
    expect(workflowPdfExample('lineage','en')?.question).toContain('Gold');
  });
});
