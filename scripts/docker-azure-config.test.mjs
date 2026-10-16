import test from 'node:test';
import assert from 'node:assert/strict';
import {azureDockerEnvironment} from './docker-azure-config.mjs';

const valid={AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT:'https://example-docs.cognitiveservices.azure.com/',AZURE_OPENAI_ENDPOINT:'https://example-chat.openai.azure.com/',AZURE_OPENAI_DEPLOYMENT:'chat-deployment'};
const user={root:'/tmp/document-lab',uid:501,gid:20};
test('requires all Azure configuration instead of using owner resources',()=>{
  for(const key of Object.keys(valid)) assert.throws(()=>azureDockerEnvironment({...valid,[key]:''},user),new RegExp(key));
});
test('rejects unchanged template placeholders',()=>assert.throws(()=>azureDockerEnvironment({...valid,AZURE_OPENAI_DEPLOYMENT:'YOUR-CHAT-DEPLOYMENT'},user),/Configure/));
test('rejects insecure or credential-bearing endpoints without leaking values',()=>{
  for(const value of ['http://example.openai.azure.com','https://user:secret@example.openai.azure.com','https://example.openai.azure.com/?token=secret','https://untrusted.example/','not-a-url']) {
    assert.throws(()=>azureDockerEnvironment({...valid,AZURE_OPENAI_ENDPOINT:value},user),e=>e.message.includes('HTTPS')&&!e.message.includes('secret'));
  }
});
test('preserves caller environment and sets only task-specific mount/user settings',()=>{
  const result=azureDockerEnvironment({...valid,HOME:'/example-home',CREDIT_LOCAL_UID:'999'},user);
  assert.equal(result.HOME,'/example-home');assert.equal(result.CREDIT_LOCAL_UID,'501');assert.equal(result.CREDIT_LOCAL_GID,'20');assert.equal(result.CREDIT_AZURE_TOKEN_DIR,'/tmp/document-lab/.local/azure-auth');
});
test('rejects invalid deployment names',()=>assert.throws(()=>azureDockerEnvironment({...valid,AZURE_OPENAI_DEPLOYMENT:'name with spaces'},user),/deployed model name/));
