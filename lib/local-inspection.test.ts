import {describe,it,expect} from 'vitest';
import {localInspectionSchema,localInspectionText} from './local-inspection';
import {novaRunSchema,novaRunText} from './nova-runs';

describe('local evidence and cancellation contracts',()=>{
  it('keeps the full language contract and does not call agreement verification',()=>{
    for(const locale of ['en','de','vi']){
      expect(Object.keys(localInspectionText(locale)).sort()).toEqual(Object.keys(localInspectionText('en')).sort());
      expect(novaRunText(locale).CANCEL_REQUESTED).toBeTruthy();expect(novaRunText(locale).RESPONSE_DISCARDED).toBeTruthy();
    }
    expect(localInspectionSchema.safeParse({enabled:true,workerReady:true,runs:[]}).success).toBe(true);
  });
  it('never accepts an assertion that provider cancellation is confirmed',()=>{
    const value={id:crypto.randomUUID(),status:'RESPONSE_DISCARDED',providerStopConfirmed:false};
    expect(novaRunSchema.safeParse(value).success).toBe(true);
    expect(novaRunSchema.safeParse({...value,providerStopConfirmed:true}).success).toBe(false);
  });
});
