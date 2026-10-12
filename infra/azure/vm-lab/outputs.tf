output "backend_url" { value = "https://${azurerm_public_ip.lab.fqdn}" }
output "keycloak_url" { value = "https://${azurerm_public_ip.lab.fqdn}/auth" }
output "public_ip" { value = azurerm_public_ip.lab.ip_address }
output "vm_id" { value = azurerm_linux_virtual_machine.lab.id }
output "resource_group" { value = azurerm_resource_group.lab.name }
output "vm_name" { value = azurerm_linux_virtual_machine.lab.name }
output "managed_identity_principal_id" { value = azurerm_linux_virtual_machine.lab.identity[0].principal_id }
