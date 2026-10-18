import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicationRisk} from './check-public-source.mjs';

test('blocks private data, model weights and state without printing their content',()=>{
  for(const path of ['.local/reference-pdfs/customer.pdf','.env.azure.local','infra/.terraform/state','infra/terraform.tfstate.backup','infra/terraform.tfvars','key.pem','model.safetensors','models/embedding.onnx','public/customer.pdf','backup.sql'])
    assert.ok(publicationRisk(path),path);
});
test('allows code, reviewed templates, migrations and existing fictional test fixtures',()=>{
  for(const path of ['README.md','.env.example','.env.azure.example','infra/terraform.tfvars.example','services/credit-api/src/main/resources/db/migration/V1__schema.sql','services/credit-api/src/test/resources/legacy-research/invoice-fictional.pdf'])
    assert.equal(publicationRisk(path),null,path);
});
