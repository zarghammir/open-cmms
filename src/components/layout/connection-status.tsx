"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { StatusChip } from "@/components/shared/status-chip";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether the device has a connection. Offline mode itself is WA-15; this is
 * the indicator it will drive, and it already reports the real browser state.
 * The server render assumes a connection, which is also the first client
 * snapshot, so the markup matches.
 */
export function ConnectionStatus({ className }: { className?: string }) {
  const t = useTranslations("shell.connection");
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  return (
    <StatusChip
      tone={online ? "quiet" : "critical"}
      icon={online ? Wifi : WifiOff}
      label={online ? t("online") : t("offline")}
      className={className}
    />
  );
}
