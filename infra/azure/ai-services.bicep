targetScope = 'resourceGroup'

@description('Short lowercase prefix used for globally unique Cognitive Services names.')
param prefix string
param location string = resourceGroup().location
param deployOpenAi bool = false
param openAiDeploymentName string = 'gpt-4-1-mini'
param openAiModelName string = 'gpt-4.1-mini'
param openAiModelVersion string = '2025-04-14'

@description('Built-in Cognitive Services User role. Override only if Microsoft changes the role ID.')
param cognitiveServicesUserRoleId string = 'a97b65f3-24c7-4388-baec-2e87135dc908'
@description('Built-in Cognitive Services OpenAI User role.')
param openAiUserRoleId string = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

resource workloadIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-credit-ai'
  location: location
}

resource documentIntelligence 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${prefix}-docintel'
  location: location
  kind: 'FormRecognizer'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: '${prefix}-docintel'
    publicNetworkAccess: 'Enabled'
  }
}

resource documentRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(documentIntelligence.id, workloadIdentity.id, cognitiveServicesUserRoleId)
  scope: documentIntelligence
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
    principalId: workloadIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = if (deployOpenAi) {
  name: '${prefix}-openai'
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: '${prefix}-openai'
    publicNetworkAccess: 'Enabled'
  }
}

resource chatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = if (deployOpenAi) {
  parent: openAi
  name: openAiDeploymentName
  sku: { name: 'GlobalStandard', capacity: 10 }
  properties: {
    model: {
      format: 'OpenAI'
      name: openAiModelName
      version: openAiModelVersion
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

resource openAiRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployOpenAi) {
  name: guid(openAi.id, workloadIdentity.id, openAiUserRoleId)
  scope: openAi
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', openAiUserRoleId)
    principalId: workloadIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output managedIdentityResourceId string = workloadIdentity.id
output managedIdentityClientId string = workloadIdentity.properties.clientId
output documentIntelligenceEndpoint string = documentIntelligence.properties.endpoint
output openAiEndpoint string = deployOpenAi ? openAi!.properties.endpoint : ''
output openAiDeployment string = deployOpenAi ? chatDeployment.name : ''
