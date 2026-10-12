#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
action="${1:?Use status, start or stop}"
subscription="$(terraform output -raw vm_id | cut -d/ -f3)"
group="$(terraform output -raw resource_group)"
name="$(terraform output -raw vm_name)"
case "$action" in
  status) az vm get-instance-view --subscription "$subscription" -g "$group" -n "$name" --query 'instanceView.statuses[].displayStatus' -o tsv ;;
  start) az vm start --subscription "$subscription" -g "$group" -n "$name" ;;
  stop) az vm deallocate --subscription "$subscription" -g "$group" -n "$name" ;;
  *) echo "Use status, start or stop. This helper never deletes disks." >&2; exit 1 ;;
esac
