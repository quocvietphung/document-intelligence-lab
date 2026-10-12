export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") || 0) > limit) throw new Error("BODY_LIMIT");
  const reader=request.body?.getReader();
  if(!reader) return new Uint8Array();
  const chunks: Uint8Array[]=[]; let size=0;
  try {
    while(true) {
      const {value,done}=await reader.read(); if(done) break;
      size+=value.byteLength;
      if(size>limit) { await reader.cancel(); throw new Error("BODY_LIMIT"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const output=new Uint8Array(size); let offset=0;
  for(const chunk of chunks) { output.set(chunk,offset); offset+=chunk.length; }
  return output;
}
