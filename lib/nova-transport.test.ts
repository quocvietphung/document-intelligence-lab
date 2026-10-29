import {createServer} from 'node:http';
import {AddressInfo} from 'node:net';
import {expect,it} from 'vitest';
import {createLocalChatDispatcher,localChatTimeoutMs} from './nova-transport';

it('waits for delayed model headers with a bounded dispatcher and still honors cancellation',async()=>{
  const server=createServer((_request,response)=>{setTimeout(()=>response.end('saved answer'),1100);});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const short=createLocalChatDispatcher(20),long=createLocalChatDispatcher(4000);
  try{
    expect(localChatTimeoutMs).toBeGreaterThan(360_000);
    await expect(fetch(url,{dispatcher:short} as RequestInit)).rejects.toThrow();
    const response=await fetch(url,{dispatcher:long} as RequestInit);
    expect(await response.text()).toBe('saved answer');
    await expect(fetch(url,{dispatcher:long,signal:AbortSignal.timeout(30)} as RequestInit)).rejects.toThrow();
  }finally{await Promise.all([short.close(),long.close()]);server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
},10_000);
