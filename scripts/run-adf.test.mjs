import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adfRequest,runAdf} from './run-adf.mjs';
const input={schemaVersion:'adf-intake-request-v1',requestId:'00000000-0000-0000-0000-000000000001',caseId:'CR-fictional',sourcePrefix:'a'.repeat(64)+'/'};
const env={AZURE_ADF_RESOURCE_ID:'/subscriptions/00000000-0000-0000-0000-000000000002/resourceGroups/lab/providers/Microsoft.DataFactory/factories/research-lab',AZURE_ADF_PIPELINE:'intake'};
test('default validation never calls Azure',()=>{assert.equal(runAdf(input,env,false,()=>{throw Error('unexpected cloud call');}).cloudCalled,false);});
test('only allowlisted ARM resource and scoped metadata are submitted',()=>{const request=adfRequest(input,env);assert.match(request.url,/^https:\/\/management.azure.com\//);assert.deepEqual(Object.keys(request.body),['labRequestId','labCaseId','labSourcePrefix']);assert.throws(()=>adfRequest(input,{...env,AZURE_ADF_RESOURCE_ID:'https://evil.invalid'}));assert.throws(()=>adfRequest({...input,sourcePrefix:'../other-case'},env));});
test('explicit run checks response without leaking provider body',()=>{const result=runAdf(input,env,true,()=>JSON.stringify({runId:'00000000-0000-0000-0000-000000000003'}));assert.equal(result.cloudCalled,true);assert.equal(result.requestId,input.requestId);});
