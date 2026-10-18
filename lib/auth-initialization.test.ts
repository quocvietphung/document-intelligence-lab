import {afterEach,describe,expect,it,vi} from 'vitest';
import {authDeadline,keycloakInitOptions} from './auth-initialization';
describe('bounded Keycloak initialization',()=>{
  afterEach(()=>vi.useRealTimers());
  it('keeps normal silent SSO separate from interactive sign-in',()=>{
    expect(keycloakInitOptions('http://localhost:3000/en')).toMatchObject({pkceMethod:'S256',onLoad:'check-sso',silentCheckSsoFallback:false,checkLoginIframe:false,messageReceiveTimeout:5000});
    expect(keycloakInitOptions('http://localhost:3000/en',true)).not.toHaveProperty('silentCheckSsoRedirectUri');
    expect(keycloakInitOptions('http://localhost:3000/en',true)).toMatchObject({pkceMethod:'S256',checkLoginIframe:false});
  });
  it('processes both response modes without waiting on a third-party cookie iframe',()=>{
    for(const url of ['http://localhost:3000/en?code=example&state=example','http://localhost:3000/en#code=example&state=example'])expect(keycloakInitOptions(url)).not.toHaveProperty('onLoad');
    expect(keycloakInitOptions('http://localhost:3000/en#overview')).toHaveProperty('onLoad','check-sso');
  });
  it('fails closed instead of waiting forever and clears successful timers',async()=>{
    vi.useFakeTimers();const expired=expect(authDeadline(new Promise(()=>{}),100)).rejects.toThrow('AUTH_INITIALIZATION_TIMEOUT');await vi.advanceTimersByTimeAsync(100);await expired;
    await expect(authDeadline(Promise.resolve('initialized'),100)).resolves.toBe('initialized');expect(vi.getTimerCount()).toBe(0);
    await expect(authDeadline(Promise.reject(new Error('offline')),100)).rejects.toThrow('offline');expect(vi.getTimerCount()).toBe(0);
  });
});
