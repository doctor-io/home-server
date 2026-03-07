import type { StoreOperationAction, StoreOperationStatus } from "@/lib/shared/contracts/apps";

export function isStoreOperationActiveStatus(status: StoreOperationStatus) {
  return status === "queued" || status === "running";
}

export function getStoreOperationActionLabel(action: StoreOperationAction) {
  if (action === "install") return "Installing";
  if (action === "update") return "Updating";
  if (action === "redeploy") return "Redeploying";
  if (action === "uninstall") return "Uninstalling";
  if (action === "start") return "Starting";
  if (action === "stop") return "Stopping";
  if (action === "restart") return "Restarting";
  return "Checking updates";
}

export function getStoreOperationLabel(input: {
  action: StoreOperationAction;
  status: StoreOperationStatus;
}) {
  if (input.status === "queued") return "Queued";
  if (input.status === "running") return getStoreOperationActionLabel(input.action);
  if (input.status === "success") return "Completed";
  return "Failed";
}
