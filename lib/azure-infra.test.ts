import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=(file:string)=>readFileSync(resolve('infra/azure/vm-lab',file),'utf8');
describe('Azure VM lab deployment safety',()=>{
  it('uses dedicated resources, a bounded VM and existing AI IDs without reading keys',()=>{
    expect(read('variables.tf')).toContain('default = "Standard_D2as_v4"');
    const main=read('main.tf');
    expect(main).toContain('data "azurerm_resources" "openai"');
    expect(main).not.toContain('data "azurerm_cognitive_account"');
    expect(main).toContain('type = "SystemAssigned"');
    expect(main).toContain('Cognitive Services OpenAI User');
    expect(main).toContain('azurerm_dev_test_global_vm_shutdown_schedule');
  });
  it('requires operator-only SSH and persistent disk with no public DB ports',()=>{
    expect(read('variables.tf')).toContain('endswith(var.ssh_source_cidr, "/32")');
    expect(read('main.tf')).toContain('StandardSSD_LRS');
    const compose=read('compose.yml');
    expect(compose).not.toMatch(/\d+:5432|\d+:6379|\d+:6333|\d+:3310|\d+:4318/);
    expect(compose).toContain('127.0.0.1:8081:8080');
    expect(compose).toContain('CASE_PERSISTENCE_ENABLED: "true"');
    expect(compose).toContain('CLAMAV_HOST: clamav');
  });
  it('does not use local demo passwords or long-lived Azure keys in cloud compose',()=>{
    const compose=read('compose.yml');
    expect(compose).not.toContain('demo-password');
    expect(compose).not.toContain('AZURE_OPENAI_API_KEY');
    expect(compose).toContain('AZURE_OPENAI_CREDENTIAL: default');
    expect(compose).toContain('SECURITY_ENABLED: "true"');
    expect(read('bootstrap.sh')).toContain('secrets.token_hex(32)');
    expect(read('bootstrap.sh')).toContain('env.chmod(0o600)');
  });
  it('blocks public admin paths and does not log OAuth query strings',()=>{
    expect(read('Caddyfile')).toContain('/auth/realms/master/*');
    expect(read('Caddyfile')).not.toMatch(/^\s*log\b/m);
    expect(read('.gitignore')).toContain('*.tfstate');
    expect(read('.gitignore')).toContain('*.auto.tfvars.json');
  });
  it('builds the same Keycloak relative path used at runtime and waits for real readiness',()=>{
    expect(read('Dockerfile.keycloak').match(/KC_HTTP_RELATIVE_PATH=\/auth/g)).toHaveLength(2);
    expect(read('compose.yml')).toContain('keycloak: {condition: service_healthy}');
    expect(read('compose.yml')).toContain('KC_CACHE_EMBEDDED_CLUSTER_NAME: credit-azure-vm');
    expect(read('compose.yml')).toContain('KC_HOSTNAME: https://${BACKEND_HOST:?backend DNS required}/auth');
  });
  it('ships the shared Nova catalog without shipping Java outputs or deployment secrets to Vercel',()=>{
    const rules=readFileSync(resolve('.vercelignore'),'utf8');
    expect(rules).toContain('!services/credit-api/src/main/resources/nova-features.json');
    expect(rules).toContain('services/credit-api/*');
    expect(rules).toContain('.local');
    expect(rules).toContain('infra');
    expect(JSON.parse(readFileSync(resolve('services/credit-api/src/main/resources/nova-features.json'),'utf8'))).toBeTruthy();
  });
});
