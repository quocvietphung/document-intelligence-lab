import assert from 'node:assert/strict';
import {test} from 'node:test';
import {benchmarkDossiers,benchmarkQuestions,grade} from './benchmark-nova.mjs';

const documents=[{id:'doc-r',name:'datev-lodas-2025-robert-muster.pdf'},{id:'doc-m',name:'datev-lodas-2025-melanie-muster.pdf'}];
const sources=[{id:'doc-r:p1:c1'},{id:'doc-m:p1:c1'},{id:'policy'}];
const compare=benchmarkQuestions.find(q=>q.id==='payroll-compare');

test('a correct comparison keeps both documents and never swaps net income and payout',()=>{
  const answer='- Robert Muster: net earnings 2.967,11 EUR, payout 2.882,11 EUR [doc-r:p1:c1]\n- Melanie Muster: net earnings 4.212,90 EUR, payout 3.069,93 EUR [doc-m:p1:c1]';
  const result=grade(compare,{answer,sources},documents);
  assert.equal(result.passed,true,JSON.stringify(result.checks));
  assert.deepEqual(result.citedDocuments,['datev-lodas-2025-robert-muster','datev-lodas-2025-melanie-muster']);
});

test('swapped values, a lost document or an unknown citation fail',()=>{
  const swapped=grade(compare,{answer:'Net 2.882,11 EUR and payout 2.967,11 EUR [doc-r:p1:c1]. Net 4.212,90 EUR, payout 3.069,93 EUR [doc-m:p1:c1].',sources},documents);
  assert.equal(swapped.checks.pairsKept,false);
  const sameLine=grade(compare,{answer:'Robert: net earnings 2.882,11 EUR, payout 2.967,11 EUR [doc-r:p1:c1]\nMelanie: net earnings 4.212,90 EUR, payout 3.069,93 EUR [doc-m:p1:c1]',sources},documents);
  assert.equal(sameLine.checks.pairsKept,false);
  const lost=grade(compare,{answer:'Net 2.967,11 EUR, payout 2.882,11 EUR [doc-r:p1:c1].',sources:[sources[0]]},documents);
  assert.equal(lost.checks.evidenceKept,false);assert.equal(lost.checks.sourcesCited,false);
  assert.equal(grade(compare,{answer:'Net 2.967,11 EUR [doc-x:p1]',sources},documents).checks.citationsValid,false);
});

test('labels may follow a value, and German labels are recognised',()=>{
  const german=benchmarkQuestions.find(q=>q.id==='payroll-net-payout');
  assert.equal(grade(german,{answer:'Netto-Verdienst: 2.967,11 EUR; Auszahlungsbetrag: 2.882,11 EUR [doc-r:p1:c1]',sources},documents).checks.pairsKept,true);
  assert.equal(grade(german,{answer:'2.967,11 EUR (Netto-Verdienst) [doc-r:p1:c1]\nAuszahlung 2.882,11 EUR [doc-r:p1:c1]',sources},documents).checks.pairsKept,true);
});

test('missing evidence must be acknowledged without inventing a value',()=>{
  const question=benchmarkQuestions.find(q=>q.id==='missing-paid');
  assert.equal(grade(question,{answer:'The invoice does not state a payment; payment approval is not part of the document [doc-r:p1:c1].',sources},documents).passed,true);
  assert.equal(grade(question,{answer:'The invoice has been paid [doc-r:p1:c1].',sources},documents).passed,false);
  // Naming the claim inside an open question is not the claim.
  assert.equal(grade(question,{answer:'No source confirms whether the invoice has been paid [doc-r:p1:c1]. The payment status is unknown.',sources},documents).passed,true);
});

test('every question names a dossier, locale and the evidence it needs',()=>{
  for(const question of benchmarkQuestions){
    assert.ok(benchmarkDossiers[question.dossier],question.id);assert.match(question.locale,/^(en|de|vi)$/);
    if(question.kind!=='missing')assert.ok(question.sources?.length&&question.expect?.length,question.id);
  }
  assert.ok(benchmarkQuestions.some(q=>q.kind==='multi-source'&&q.sources.length>=3));
});
