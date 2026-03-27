"use client";

import { StatusScreen } from "./status-screen";

type RebootOverlayProps = {
  action: "reboot" | "shutdown" | "factory-reset" | "restore" | "update";
  phase: "starting" | "waiting" | "reconnecting";
};

const PHASE_COPY: Record<
  RebootOverlayProps["action"],
  Record<RebootOverlayProps["phase"], { title: string; description: string }>
> = {
  reboot: {
    starting: {
      title: "Starting reboot...",
      description:
        "Homeio has accepted the reboot request and is preparing to restart the server.",
    },
    waiting: {
      title: "Waiting for server to restart...",
      description:
        "The server is restarting now. This page will reconnect automatically when Homeio is available again.",
    },
    reconnecting: {
      title: "Reconnecting to Homeio...",
      description:
        "Homeio is back online. Restoring your session and refreshing live system data.",
    },
  },
  shutdown: {
    starting: {
      title: "Starting shutdown...",
      description:
        "Homeio accepted the shutdown request and is preparing to power the machine off.",
    },
    waiting: {
      title: "Waiting for server to come back...",
      description:
        "The machine is powered off or still booting. This page will reconnect automatically after the server is started again.",
    },
    reconnecting: {
      title: "Reconnecting to Homeio...",
      description:
        "The server is reachable again. Restoring your session and refreshing live system data.",
    },
  },
  "factory-reset": {
    starting: {
      title: "Starting factory reset...",
      description:
        "Homeio is stopping containers, clearing Docker state, resetting the database, and wiping /DATA before rebooting.",
    },
    waiting: {
      title: "Applying factory reset...",
      description:
        "The server is still running the reset workflow. This page will reconnect automatically when Homeio is available again.",
    },
    reconnecting: {
      title: "Reconnecting to Homeio...",
      description:
        "The reset workflow is complete. Checking whether Homeio is ready for login again.",
    },
  },
  restore: {
    starting: {
      title: "Starting restore...",
      description:
        "Homeio accepted the restore request and is preparing a full replacement of your data and database.",
    },
    waiting: {
      title: "Applying backup restore...",
      description:
        "The restore is running now. This page will reconnect automatically when Homeio becomes available again.",
    },
    reconnecting: {
      title: "Reconnecting to Homeio...",
      description:
        "The restored system is back online. Verifying your session and refreshing live state.",
    },
  },
  update: {
    starting: {
      title: "Starting Homeio update...",
      description:
        "Homeio accepted the update request and is starting the updater in the background.",
    },
    waiting: {
      title: "Applying Homeio update...",
      description:
        "The updater is rebuilding and restarting Homeio now. This page will reconnect automatically when the updated service is available again.",
    },
    reconnecting: {
      title: "Reconnecting to Homeio...",
      description:
        "The updated Homeio service is back online. Restoring your session and refreshing live system data.",
    },
  },
};

export function RebootOverlay({ action, phase }: RebootOverlayProps) {
  const copy = PHASE_COPY[action][phase];

  return <StatusScreen title={copy.title} body={copy.description} />;
}
