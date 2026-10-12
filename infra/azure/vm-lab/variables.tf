variable "subscription_id" { type = string }
variable "location" {
  type    = string
  default = "germanywestcentral"
}
variable "resource_group_name" {
  type    = string
  default = "credit-intelligence-lab-vm"
}
variable "vm_size" {
  type    = string
  default = "Standard_D2as_v4"
  validation {
    condition     = contains(["Standard_D2as_v4", "Standard_D2as_v5", "Standard_D4as_v5", "Standard_D2s_v5"], var.vm_size)
    error_message = "Use an explicitly reviewed, bounded-cost lab VM size."
  }
}
variable "ssh_public_key" {
  type = string
  validation {
    condition     = startswith(var.ssh_public_key, "ssh-ed25519 ")
    error_message = "Use a dedicated Ed25519 public key; never supply its private key."
  }
}
variable "ssh_source_cidr" {
  type = string
  validation {
    condition     = can(cidrhost(var.ssh_source_cidr, 0)) && endswith(var.ssh_source_cidr, "/32")
    error_message = "Restrict SSH to one operator IPv4 address (/32)."
  }
}
variable "shutdown_time_utc" {
  type        = string
  description = "Daily deallocation time in UTC (HHMM). Set approximately 8 hours after first apply."
  validation {
    condition     = can(regex("^([01][0-9]|2[0-3])[0-5][0-9]$", var.shutdown_time_utc))
    error_message = "Use a valid UTC time such as 0300."
  }
}
variable "shared_ai_resource_group" {
  type    = string
  default = "ai-shared"
}
variable "openai_resource_name" {
  type    = string
  default = "vietphung-ai-shared"
}
variable "document_resource_name" {
  type    = string
  default = "vietphung-documents-shared"
}
