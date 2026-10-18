import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';

describe('document workspace component identity',()=>{
  it('shows existing results before the sample library in every document domain',()=>{
    const source=readFileSync(new URL('../components/workspace/DocumentAnalysisWorkspace.tsx',import.meta.url),'utf8');
    expect(source.indexOf('<DocumentResults ')).toBeLessThan(source.indexOf('<ResearchSamples '));
  });
  it('shares one case-keyed job tracker across every sample library',()=>{
    const source=readFileSync(new URL('../components/workspace/CreditWorkspace.tsx',import.meta.url),'utf8');
    const key=(component:string)=>source.match(new RegExp('<'+component+' key=\\{([^}]+)\\}'))?.[1];
    expect(key('ResearchSamples')).toBeUndefined();
    expect(key('DocumentAnalysisWorkspace')).toBeTruthy();
    const workspace=readFileSync(new URL('../components/workspace/DocumentAnalysisWorkspace.tsx',import.meta.url),'utf8');
    expect(workspace).toContain('analyze={analyze} jobs={jobs}');
  });
});
