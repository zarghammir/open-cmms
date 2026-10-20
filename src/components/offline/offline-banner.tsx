"use client";

import { CloudUpload, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useConnection, usePendingChanges } from "@/hooks/use-demo-data";
import { Link } from "@/i18n/navigation";

/**
 * What the connection is doing, and what is waiting because of it.
 *
 * Three states, like everything that reads the store. While the browser is
 * still reading the database the count is not zero, it is unknown, and saying
 * "nothing waiting to send" then would be a claim about a queue nobody has
 * looked at — which is the one claim a technician in a basement cannot afford
 * to be wrong about.
 *
 * Silent when there is a connection and nothing queued: a banner that is always
 * there is a banner nobody reads.
 *
 * The count is the question and the link is the answer, so the answer lives
 * beside it. A link inside the alert rather than the alert as a link: an alert
 * that is entirely a target reads as one long name to a screen reader and gives
 * a thumb no edge to aim at.
 */
export function OfflineBanner() {
  const t = useTranslations("offline");
  const online = useConnection();
  const { status, count } = usePendingChanges();
  const known = status === "ready";

  // Quiet unless there is something to say. With a connection and nothing
  // queued there is nothing; with a connection and the records not yet read
  // there is also nothing, because "checking what is waiting to send" on every
  // page load is noise that says nothing a person can act on — and it flashed
  // on every screen in the application, which is how it was found.
  //
  // Offline is different: then the count matters even before it is known, and
  // the banner says which of the two it is rather than guessing zero.
  if (online && (!known || count === 0)) return null;

  const pending = known ? t("pending", { count }) : t("pendingUnknown");

  const queueLink = (
    <Link
      data-slot="queue-link"
      href="/waiting-to-send"
      className="font-medium underline underline-offset-4"
    >
      {t("queueLink")}
    </Link>
  );

  if (!online) {
    return (
      <Alert data-slot="offline-banner" data-state="offline">
        <WifiOff aria-hidden="true" />
        <AlertTitle>{t("title")}</AlertTitle>
        <AlertDescription>
          {t("body")} <span data-slot="pending-count">{pending}</span>{" "}
          {queueLink}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert data-slot="offline-banner" data-state="sending">
      <CloudUpload aria-hidden="true" />
      <AlertTitle>{t("syncTitle")}</AlertTitle>
      <AlertDescription>
        <span data-slot="pending-count">{pending}</span> {queueLink}
      </AlertDescription>
    </Alert>
  );
}
