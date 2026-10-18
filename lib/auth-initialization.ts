import type {KeycloakInitOptions} from 'keycloak-js';

export function keycloakInitOptions(href:string,interactive=false):KeycloakInitOptions{
  const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1));
  const callback=[url.searchParams,fragment].some(params=>params.has('state')&&(params.has('code')||params.has('error')));
  return {pkceMethod:'S256',checkLoginIframe:false,messageReceiveTimeout:5000,
    ...(!interactive&&!callback?{onLoad:'check-sso' as const,silentCheckSsoRedirectUri:`${url.origin}/silent-check-sso.html`,silentCheckSsoFallback:false}:{})};
}
/** Bound startup only; a timeout never grants a session or an access token. */
export function authDeadline<T>(pending:Promise<T>,milliseconds=15000):Promise<T>{
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('AUTH_INITIALIZATION_TIMEOUT')),milliseconds);pending.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
}
