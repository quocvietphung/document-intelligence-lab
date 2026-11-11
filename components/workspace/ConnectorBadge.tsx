import {integrationsText,labelText,modeText,type Provider} from '@/lib/integrations';

/** Honest capability label of an adapter (verified locally, simulated, implemented, live or planned). */
export function ConnectorBadge({provider,locale}:{provider:Pick<Provider,'label'|'live'|'requiresConnection'>;locale:string}){
  const t=integrationsText(locale);
  return <span className="integration-badges"><span className={`integration-label integration-label-${provider.label}`}>{labelText(t,provider.label)}</span><small>{modeText(t,provider)}</small></span>;
}
