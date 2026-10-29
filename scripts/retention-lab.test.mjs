import test from 'node:test';
import assert from 'node:assert/strict';
import {retentionPlan} from './retention-lab.mjs';
const time=new Date('2026-10-29T00:00:00Z');
const input=['--tenant','credit-lab','--case','CR-synthetic','--before','2026-10-01T00:00:00Z'];
test('history cleanup defaults to one scoped dry run',()=>{assert.equal(retentionPlan(input,time).apply,false);});
test('deletion requires the exact case confirmation and an old cutoff',()=>{assert.throws(()=>retentionPlan([...input,'--apply'],time));assert.throws(()=>retentionPlan([...input,'--apply','--confirm-case','other'],time));assert.equal(retentionPlan([...input,'--apply','--confirm-case','CR-synthetic'],time).apply,true);assert.throws(()=>retentionPlan([...input.slice(0,5),'2026-10-30'],time));});
test('wildcards, SQL syntax and duplicate arguments are refused',()=>{for(const value of ['*',"tenant' OR 1=1",'../x'])assert.throws(()=>retentionPlan(['--tenant',value,...input.slice(2)],time));assert.throws(()=>retentionPlan([...input,'--case','other'],time));});
test('invalid calendar dates cannot silently change the purge cutoff',()=>{assert.throws(()=>retentionPlan([...input.slice(0,5),'2026-02-31T00:00:00Z'],time));assert.equal(retentionPlan([...input.slice(0,5),'2026-02-28T00:00:00.123Z'],time).before,'2026-02-28T00:00:00.123Z');});
