targetScope = 'resourceGroup'

@description('Shared resource name. Deploy into the existing ai-shared resource group.')
param documentName string = 'vietphung-documents-shared'
param location string = 'westeurope'
@allowed(['F0', 'S0'])
param sku string = 'F0'

resource documents 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: documentName
  location: location
  kind: 'FormRecognizer'
  sku: { name: sku }
  tags: { purpose: 'shared-document-ai', environment: 'lab' }
  properties: {
    customSubDomainName: documentName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: true
  }
}

output documentIntelligenceEndpoint string = documents.properties.endpoint
output documentResourceId string = documents.id
output maxPages int = sku == 'F0' ? 2 : 4
