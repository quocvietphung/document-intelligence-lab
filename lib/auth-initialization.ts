import type {KeycloakInitOptions} from 'keycloak-js';

export function keycloakInitOptions(href:string,interactive=false):KeycloakInitOptions{
  const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1));
  const callback=[url.searchParams,fragment].some(params=>params.has('state')&&(params.has('code')||params.has('error')));
  return {pkceMethod:'S256',checkLoginIframe:false,messageReceiveTimeout:2000,
    ...(!interactive&&!callback?{onLoad:'check-sso' as const,silentCheckSsoRedirectUri:`${url.origin}/silent-check-sso.html`,silentCheckSsoFallback:false}:{})};
}
export function authCallback(href:string){
  const url=new URL(href);return [url.searchParams,new URLSearchParams(url.hash.slice(1))].some(p=>p.has('state')&&(p.has('code')||p.has('error')));
}
/** Store navigation only, never tokens or an arbitrary redirect destination. */
export function workspaceReturnPath(href:string){
  const url=new URL(href),path=/^\/(en|de|vi)\/?$/.test(url.pathname)?url.pathname:'/en';
  const result=new URL(path,url.origin),id=url.searchParams.get('case'),pipeline=url.searchParams.get('pipeline');
  if(id&&/^CR-[a-zA-Z0-9-]{1,76}$/.test(id))result.searchParams.set('case',id);
  if(pipeline&&/^[a-z-]{1,30}$/.test(pipeline))result.searchParams.set('pipeline',pipeline);
  if(/^#[a-z-]{1,40}$/.test(url.hash))result.hash=url.hash;
  return result.pathname+result.search+result.hash;
}
export function restoredWorkspacePath(raw:string|null,href:string,now=Date.now()){
  try{const saved=JSON.parse(raw||'null');if(!saved||typeof saved.path!=='string'||!Number.isFinite(saved.time)||now-saved.time<0||now-saved.time>600_000)return;
    const current=new URL(href),target=new URL(saved.path,current.origin);
    if(target.origin!==current.origin||target.pathname!==current.pathname||workspaceReturnPath(target.href)!==saved.path)return;
    return saved.path;
  }catch{return;}
}
/** Bound startup only; a timeout never grants a session or an access token. */
export function authDeadline<T>(pending:Promise<T>,milliseconds=15000):Promise<T>{
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('AUTH_INITIALIZATION_TIMEOUT')),milliseconds);pending.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
}
