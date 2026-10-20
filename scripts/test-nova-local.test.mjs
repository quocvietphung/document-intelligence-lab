import test from 'node:test';
import assert from 'node:assert/strict';
import {exactCitations,missingClauses,identifierCategories,finalAnswerOnly} from './test-nova-local.mjs';
test('analysis narration is not a final fixture answer even when it contains a date and source',()=>{
 assert.equal(finalAnswerOnly('We are given a document. The issue date is 03/07/2023 [doc-1:p1].'),false);
 assert.equal(finalAnswerOnly('<think>Inspect the invoice</think>'),false);
 assert.equal(finalAnswerOnly('- Invoice issued: 03/07/2023 [doc-1:p1].'),true);
});
test('citation check rejects nested, invented and absent source IDs',()=>{
 assert.equal(exactCitations('A fact [doc-1:p1]',['doc-1:p1']),true);
 for(const answer of ['A fact [[doc-1:p1]]','A fact [unknown]','A fact'])assert.equal(exactCitations(answer,['doc-1:p1']),false);
});
test('an unspecified deadline is not evidence that invented invoice obligations are absent',()=>{
 assert.equal(missingClauses('No explicit contractual obligations are stated in these excerpts [doc-1:p1].'),true);
 assert.equal(missingClauses('Obligation 1: Payment of invoice. Verbatim deadline: Not specified.'),false);
 assert.equal(missingClauses('Date of issue: 03/07/2023. No due date is available.'),false);
 assert.equal(missingClauses('No exclusions are stated. The buyer must pay the invoice within 30 days [doc-review:p1].'),false);
 assert.equal(missingClauses('No contractual obligations are stated. The buyer must pay within 30 days [doc-review:p1].'),false);
});
test('privacy review must identify categories instead of confusing products with identifiers',()=>{
 assert.equal(identifierCategories('Names, addresses and tax identifiers require manual inspection [doc-1:p1].'),true);
 assert.equal(identifierCategories('CATEGORY: Garmin Fenix GPS; CATEGORY: Apple Watch'),false);
 assert.equal(identifierCategories('Names and tax identifier 27AABCT1234F1Z5'),false);
 assert.equal(identifierCategories('Names and addresses require manual inspection. Invoice identifier: 51109301 [doc-review:p1].'),false);
 assert.equal(identifierCategories('No names or addresses are present [doc-review:p1].'),false);
});
