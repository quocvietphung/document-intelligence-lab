"use client";
import {useCallback,useState} from 'react';
import {useOptionalAuth} from '@/components/auth/KeycloakProvider';
import {connectorError} from '@/lib/integrations';

/** Thrown for a non-2xx connector response; `code` is the stable server error code, never a raw message. */
export class ConnectorRequestError extends Error{constructor(readonly code:string|undefined){super(code||'REQUEST_FAILED');}}

/**
 * Shared Bearer-token client for connector, use-case and destination endpoints.
 * The browser only ever holds the Keycloak access token; connector tokens stay on the server.
 */
export function useConnectorApi(locale:string){
  const session=useOptionalAuth();
  const auth={token:session?.token,authenticated:!!session?.authenticated,mode:session?.mode??'keycloak',roles:session?.roles??[]};
  const [busy,setBusy]=useState(''),[error,setError]=useState('');
  const request=useCallback(async(path:string,body?:unknown)=>{
    if(!auth.token)throw new ConnectorRequestError('SESSION_EXPIRED');
    const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${auth.token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},
      body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(60_000)});
    const value:unknown=await response.json().catch(()=>({}));
    if(!response.ok)throw new ConnectorRequestError(typeof value==='object'&&value&&'error' in value&&typeof value.error==='string'?value.error:undefined);
    return value;
  },[auth.token]);
  const run=useCallback(async(key:string,action:()=>Promise<void>)=>{
    setBusy(key);setError('');
    try{await action();}catch(failure){setError(connectorError(locale,failure instanceof ConnectorRequestError?failure.code:undefined));}finally{setBusy('');}
  },[locale]);
  const canWrite=auth.authenticated&&auth.mode!=='demo'&&auth.roles.some(r=>r==='ADVISOR'||r==='ADMIN');
  return {auth,request,run,busy,error,setError,canWrite};
}
