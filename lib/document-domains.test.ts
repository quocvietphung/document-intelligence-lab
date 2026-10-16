import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {documentDomains,domainLanguageTables,domainOf,domainText,filterDomain} from './document-domains';
import {workspaceText} from './workspace-language';
import {toWorkspaceCase} from './credit-api';
import {DocumentDomains,DomainResearch} from '@/components/workspace/DocumentDomains';
const source={id:'CR-test',tenantId:'t',applicant:'Research',coApplicant:'',purpose:'Inspect policy',amountEuro:0,completeness:0,status:'DRAFT',submittedAt:'2026-10-15',missingDocuments:[],validationIssues:[],documents:[],audit:[],version:0};
describe('multi-domain document research',()=>{
  it('preserves old dossiers as banking and validates new domains',()=>{
    expect(toWorkspaceCase(source).domain).toBe('banking');
    expect(toWorkspaceCase({...source,domain:'insurance'}).domain).toBe('insurance');
    expect(()=>toWorkspaceCase({...source,domain:'invalid'})).toThrow();
    expect(domainOf()).toBe('banking');
  });
  it('filters actual dossiers without creating synthetic records',()=>{
    const records=[{id:'old'},{id:'policy',domain:'insurance'},{id:'report',domain:'general'}];
    expect(filterDomain(records,'insurance').map(i=>i.id)).toEqual(['policy']);
    expect(filterDomain(records,'banking').map(i=>i.id)).toEqual(['old']);
    expect(filterDomain(records,'all')).toHaveLength(3);
  });
  it('has complete EN DE VI domain labels and no credit-only field names',()=>{
    for(const locale of ['en','de','vi']) {
      expect(Object.keys(domainText(locale))).toEqual(Object.keys(domainLanguageTables.en));
      expect(Object.values(domainText(locale)).every(v=>v.trim())).toBe(true);
      for(const key of ['policyNumber','deductible','insurance-policy','invoiceTotal','coverageStart'])expect(workspaceText(locale)(key)).not.toBe(key);
      expect(workspaceText(locale)('applicant')).not.toMatch(/^Applicant$|^Kreditnehmer$/);
    }
  });
  it('renders counts, selected domain and honest empty insurance research',()=>{
    const item=toWorkspaceCase({...source,domain:'insurance'});
    const html=renderToStaticMarkup(createElement(DocumentDomains,{locale:'en',cases:[item],value:'insurance',onChange:()=>{}}));
    for(const domain of documentDomains)expect(html).toContain(domainText('en')[domain].replaceAll('&','&amp;'));
    expect(html).toContain('aria-pressed="true"');expect(html).toContain('1 dossiers');
    const research=renderToStaticMarkup(createElement(DomainResearch,{locale:'en',item,inspect:()=>{},ask:()=>{}}));
    expect(research).toContain('No dossiers');expect(research).not.toContain('97%');expect(research).toContain('No coverage or settlement decisions');
  });
});
