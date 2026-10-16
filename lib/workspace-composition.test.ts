import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';

describe('document workspace component identity',()=>{
  it('shows existing results before the sample library in every document domain',()=>{
    const source=readFileSync(new URL('../components/workspace/CreditWorkspace.tsx',import.meta.url),'utf8');
    expect(source.indexOf('<DocumentAnalysisWorkspace key=')).toBeLessThan(source.indexOf('<ResearchSamples key='));
  });
  it('uses distinct sibling keys for the sample library and analysis workspace',()=>{
    const source=readFileSync(new URL('../components/workspace/CreditWorkspace.tsx',import.meta.url),'utf8');
    const key=(component:string)=>source.match(new RegExp('<'+component+' key=\\{([^}]+)\\}'))?.[1];
    expect(key('ResearchSamples')).toBeTruthy();
    expect(key('DocumentAnalysisWorkspace')).toBeTruthy();
    expect(key('ResearchSamples')).not.toBe(key('DocumentAnalysisWorkspace'));
  });
});
