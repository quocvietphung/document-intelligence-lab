locals {
  dns_label = "credit-lab-${substr(sha256("${var.subscription_id}/${var.resource_group_name}"), 0, 10)}"
  tags      = { project = "credit-intelligence-lab", purpose = "synthetic-demo", managed_by = "terraform" }
}

# Read existing shared AI resources. This stack never creates/deletes ai-shared.
data "azurerm_resources" "openai" {
  name                = var.openai_resource_name
  resource_group_name = var.shared_ai_resource_group
  type                = "Microsoft.CognitiveServices/accounts"
}
data "azurerm_resources" "documents" {
  name                = var.document_resource_name
  resource_group_name = var.shared_ai_resource_group
  type                = "Microsoft.CognitiveServices/accounts"
}

resource "azurerm_resource_group" "lab" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.tags
}
resource "azurerm_virtual_network" "lab" {
  name                = "credit-lab-vnet"
  address_space       = ["10.83.0.0/16"]
  location            = azurerm_resource_group.lab.location
  resource_group_name = azurerm_resource_group.lab.name
  tags                = local.tags
}
resource "azurerm_subnet" "lab" {
  name                 = "containers"
  resource_group_name  = azurerm_resource_group.lab.name
  virtual_network_name = azurerm_virtual_network.lab.name
  address_prefixes     = ["10.83.1.0/24"]
}
resource "azurerm_public_ip" "lab" {
  name                = "credit-lab-ip"
  resource_group_name = azurerm_resource_group.lab.name
  location            = azurerm_resource_group.lab.location
  allocation_method   = "Static"
  sku                 = "Standard"
  domain_name_label   = local.dns_label
  tags                = local.tags
}
resource "azurerm_network_security_group" "lab" {
  name                = "credit-lab-nsg"
  location            = azurerm_resource_group.lab.location
  resource_group_name = azurerm_resource_group.lab.name
  tags                = local.tags
  security_rule {
    name                       = "operator-ssh"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = var.ssh_source_cidr
    destination_address_prefix = "*"
  }
  security_rule {
    name                       = "public-https-acme"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_ranges    = ["80", "443"]
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }
}
resource "azurerm_network_interface" "lab" {
  name                = "credit-lab-nic"
  location            = azurerm_resource_group.lab.location
  resource_group_name = azurerm_resource_group.lab.name
  tags                = local.tags
  ip_configuration {
    name                          = "primary"
    subnet_id                     = azurerm_subnet.lab.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.lab.id
  }
}
resource "azurerm_network_interface_security_group_association" "lab" {
  network_interface_id      = azurerm_network_interface.lab.id
  network_security_group_id = azurerm_network_security_group.lab.id
}
resource "azurerm_linux_virtual_machine" "lab" {
  name                            = "credit-lab-vm"
  location                        = azurerm_resource_group.lab.location
  resource_group_name             = azurerm_resource_group.lab.name
  size                            = var.vm_size
  admin_username                  = "labadmin"
  disable_password_authentication = true
  network_interface_ids           = [azurerm_network_interface.lab.id]
  tags                            = local.tags
  custom_data                     = filebase64("${path.module}/cloud-init.yml")
  admin_ssh_key {
    username   = "labadmin"
    public_key = var.ssh_public_key
  }
  identity { type = "SystemAssigned" }
  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
    disk_size_gb         = 128
  }
  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }
  depends_on = [azurerm_network_interface_security_group_association.lab]
}
resource "azurerm_role_assignment" "openai" {
  scope                = one(data.azurerm_resources.openai.resources).id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_linux_virtual_machine.lab.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}
resource "azurerm_role_assignment" "documents" {
  scope                = one(data.azurerm_resources.documents.resources).id
  role_definition_name = "Cognitive Services User"
  principal_id         = azurerm_linux_virtual_machine.lab.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}
resource "azurerm_dev_test_global_vm_shutdown_schedule" "lab" {
  virtual_machine_id    = azurerm_linux_virtual_machine.lab.id
  location              = azurerm_resource_group.lab.location
  enabled               = true
  daily_recurrence_time = var.shutdown_time_utc
  timezone              = "UTC"
  notification_settings { enabled = false }
  tags = local.tags
}
