import {describe,it,expect} from 'vitest';
import {pipelineLifecycle,lifecycleIds} from './pipeline-lifecycle';
describe('full document lifecycle guide',()=>{
  it('covers processing, human review, retrieval, evaluation and retention in all UI languages',()=>{
    expect(lifecycleIds).toHaveLength(7);
    for(const locale of ['en','de','vi']){const copy=pipelineLifecycle(locale);expect(copy.steps).toHaveLength(7);expect(copy.steps.every(([title,hint])=>title.trim().length>0&&hint.length>30)).toBe(true);}
    const copy=pipelineLifecycle('en');expect(copy.hint).toContain('not a live status');expect(copy.steps.at(-1)?.[1]).toContain('does not purge case/chat history');
  });
});
