import {createHash} from 'node:crypto';
export function validInsuranceReference(bytes:Uint8Array,sha256:string){
  return bytes.length>0&&bytes.length<=3_000_000&&Buffer.from(bytes.subarray(0,5)).toString()==='%PDF-'&&/^[a-f0-9]{64}$/.test(sha256)&&createHash('sha256').update(bytes).digest('hex')===sha256;
}
