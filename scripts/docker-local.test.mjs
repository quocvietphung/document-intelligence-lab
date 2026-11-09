import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localCompose,localModel,validateModel,freeDiskKb,warmupRequest} from './docker-local.mjs';
import {sparkBatchArgs} from './run-document-spark.mjs';
import {experimentalComposeFiles,missingServices,productionComposeFiles,sparkFindings} from './compose-files.mjs';
test('analytics is explicit and Spark remains a separate bounded one-shot batch',()=>{
  assert.ok(!localCompose().args.includes('docker-compose.ml.yml'));
  assert.ok(localCompose(localModel,{analytics:true}).args.includes('docker-compose.ml.yml'));
  const snapshot='a'.repeat(64)+'/etl-12345678-1234-1234-1234-123456789abc';
  const args=sparkBatchArgs(snapshot,10);assert.ok(args.run.includes('--no-deps'));assert.ok(args.run.includes('/etl/assets/'+snapshot));assert.ok(args.run.includes('10'));
  for(const bad of ['../secret',snapshot+'/../../secret','http://example.com/data'])assert.throws(()=>sparkBatchArgs(bad));
  for(const repeat of [0,10001,1.5,NaN])assert.throws(()=>sparkBatchArgs(snapshot,repeat));
});
test('warmup loads one explicit model without document content or generation',()=>{assert.deepEqual(JSON.parse(warmupRequest()),{model:localModel,prompt:'',stream:false,keep_alive:'5m',options:{num_ctx:4096}});});
test('local profile keeps Docling, uses one explicit local model and no cloud startup',()=>{
  const configuration=localCompose();assert.equal(configuration.env.OLLAMA_CHAT_MODEL,localModel);
  assert.ok(configuration.args.includes('docker-compose.docling.yml'));assert.ok(configuration.args.includes('docker-compose.nova-local.yml'));
  assert.ok(!configuration.args.includes('docker-compose.azure.yml'));
});
test('CPU runtime is separate from model weights and retains a pinned official engine',()=>{
  const dockerfile=readFileSync(new URL('../services/ollama-cpu/Dockerfile',import.meta.url),'utf8');
  assert.match(dockerfile,/ollama\/ollama:0\.40\.6@sha256:[a-f0-9]{64}/);
  assert.match(dockerfile,/-name 'cpu\*'/);assert.match(dockerfile,/OLLAMA_NO_CLOUD=1/);
  assert.doesNotMatch(dockerfile,/ollama pull|COPY.*(?:gguf|safetensors)/);
  const profile=readFileSync(new URL('../docker-compose.nova-local.yml',import.meta.url),'utf8');
  assert.match(profile,/external: true\s+name: credit-intelligence-lab_lab_ollama/);
  assert.match(profile,/LLAMA_ARG_CACHE_RAM: "0"/);
  assert.match(profile,/LLAMA_ARG_THREADS: "3"/);
});
test('rejects cloud model IDs and URLs',()=>{for(const value of ['', 'https://example.com/model','model:cloud','model-cloud','../model'])assert.throws(()=>validateModel(value));assert.equal(validateModel('qwen3:1.7b'),'qwen3:1.7b');});
test('Docker disk guard checks Docker filesystem capacity, not host free space',()=>{
  assert.ok(freeDiskKb('Filesystem 1024-blocks Used Available Capacity Mounted\noverlay 60000000 40000000 20000000 66% /')>8*1024*1024);
  assert.throws(()=>freeDiskKb('overlay 60000000 59000000 1000000 98% /'));assert.throws(()=>freeDiskKb('unavailable'));
  assert.ok(freeDiskKb('overlay 60000000 57000000 3000000 95% /',1)>1024*1024);
});

test('the normal stack uses only production Compose files and never Spark',()=>{
  for(const analytics of [false,true]){
    const {args}=localCompose(undefined,{analytics});
    const files=args.filter((_,index)=>args[index-1]==='-f');
    for(const file of experimentalComposeFiles)assert.ok(!files.includes(file),`${file} must not be in the normal stack`);
    assert.ok(!files.some(file=>/spark/i.test(file)));
    assert.ok(files.includes('docker-compose.m365.yml'));
    assert.ok(!args.includes('spark'));
  }
  assert.ok(!productionComposeFiles.some(file=>/spark/i.test(file)));
});
test('the production check detects Spark services, images and builds',()=>{
  assert.deepEqual(sparkFindings({services:{web:{image:'credit-intelligence-lab-web'}}}),[]);
  assert.equal(sparkFindings({services:{spark:{image:'x'}}}).length,1);
  assert.equal(sparkFindings({services:{batch:{image:'document-lab-spark:1'}}}).length,1);
  assert.equal(sparkFindings({services:{batch:{build:{context:'.',dockerfile:'services/document-spark/Dockerfile'}}}}).length,1);
  assert.deepEqual(missingServices({services:{web:{}}},['web','etl']),['etl']);
});
