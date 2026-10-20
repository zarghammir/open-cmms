"use client";

import { Camera, CameraOff, ScanLine, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import QrScanner from "qr-scanner";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RecordMissing } from "@/components/shared/record-missing";
import { LoadingState } from "@/components/shared/state-panels";
import { hasRecords, useRepositories } from "@/hooks/use-demo-data";
import { Link } from "@/i18n/navigation";
import { labelPath, resolveScan, type ScanResult } from "@/lib/scan";

/**
 * Scanning, in the field view.
 *
 * Two paths, and the second is not hidden behind the first. The camera is the
 * fast one; uploading a photo is the one that works when the camera is
 * blocked, when the device has none, when the technician is on a desktop, and
 * when a reviewer is following a demonstration script. Offering it only after
 * a failure would mean the person who most needs it has to fail first to find
 * it, so it sits on the screen from the start.
 *
 * The camera is started by a button rather than on arrival. A page that asks
 * for the camera the moment it opens gets refused by people who would have
 * said yes if asked at the moment they wanted to scan.
 */

type CameraState =
  "idle" | "starting" | "running" | "denied" | "unavailable" | "failed";

/**
 * Why the camera did not start.
 *
 * qr-scanner catches the browser's own failure and rethrows its own string,
 * `"Camera not found."`, for every acquisition failure alike — a refused
 * permission and a laptop with no camera arrive here identically. Telling a
 * technician who blocked the camera that their device has none is wrong and
 * gives them nothing to act on, so when the library's answer is that vague we
 * ask the browser ourselves and read the real DOMException.
 *
 * The probe only runs on the failure path, so nothing extra happens when the
 * camera works. It is not a second permission prompt in the ordinary case:
 * reaching here means the browser has already decided — refused, or no device
 * — and a decision the browser has recorded is what the second request
 * resolves against rather than asking again. The exception is a prompt the
 * person dismissed without answering, which Chrome treats as a block for this
 * attempt rather than a recorded choice; they may be asked once more. That is
 * the right trade: the alternative is telling someone who blocked the camera
 * that their device does not have one.
 */
async function diagnoseCameraFailure(error: unknown): Promise<CameraState> {
  const reported = cameraStateForError(error);
  if (reported === "denied") {
    return reported;
  }
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return reported;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    // The camera itself is fine, so whatever went wrong was not permission.
    return "failed";
  } catch (probe) {
    return cameraStateForError(probe);
  }
}

/** qr-scanner rejects with a DOMException, or with a bare string. Both mean something. */
function cameraStateForError(error: unknown): CameraState {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "denied";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "unavailable";
  }
  const text = typeof error === "string" ? error : (error as Error)?.message;
  if (typeof text === "string" && /permission|denied|allow/i.test(text)) {
    return "denied";
  }
  if (typeof text === "string" && /not found|no camera/i.test(text)) {
    return "unavailable";
  }
  return "failed";
}

export function ScanPanel({
  onResult,
}: {
  /**
   * Given by a screen that does something with the scan itself — the
   * verification sheet adds the part to its count. Without it the panel shows
   * the record it found and a way into it.
   */
  onResult?: (result: ScanResult) => void;
}) {
  const t = useTranslations("scan");
  const { status, repositories } = useRepositories();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);

  const resolve = useCallback(
    (text: string) => {
      if (!repositories) {
        return;
      }
      const scanResult = resolveScan(text, {
        assetByTag: (tag) => repositories.assets.byTag(tag),
        partByNumber: (number) => repositories.parts.byNumber(number),
      });
      setResult(scanResult);
      onResult?.(scanResult);
    },
    [repositories, onResult],
  );

  const stopCamera = useCallback(() => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setCameraState("idle");
  }, []);

  // One scanner at most, and never one left running behind a closed screen.
  useEffect(
    () => () => {
      scannerRef.current?.destroy();
      scannerRef.current = null;
    },
    [],
  );

  const startCamera = useCallback(async () => {
    const video = videoRef.current;
    if (!video || scannerRef.current) {
      return;
    }
    setCameraState("starting");
    try {
      // Deliberately no `QrScanner.hasCamera()` gate in front of this.
      // `hasCamera` probes by asking for the camera, so a browser that has been
      // told "no" makes it answer false — and the screen then told a technician
      // "no camera on this device", which is both wrong and unactionable. The
      // failure from `start()` is the honest one: it distinguishes a refusal
      // from an absent device, and it asks for the camera once rather than
      // twice.
      const scanner = new QrScanner(
        video,
        (scanned) => {
          resolve(scanned.data);
          scanner.stop();
          scanner.destroy();
          scannerRef.current = null;
          setCameraState("idle");
        },
        {
          // Without this the callback is handed a bare string and the library
          // logs a deprecation warning — which the browser tests treat as a
          // failure, correctly.
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
        },
      );
      scannerRef.current = scanner;
      await scanner.start();
      setCameraState("running");
    } catch (error) {
      scannerRef.current?.destroy();
      scannerRef.current = null;
      setCameraState(await diagnoseCameraFailure(error));
    }
  }, [resolve]);

  const scanFile = useCallback(
    async (file: File) => {
      try {
        const scanned = await QrScanner.scanImage(file, {
          returnDetailedScanResult: true,
        });
        resolve(scanned.data);
      } catch {
        // No code in the picture is an answer, not a crash: it is "we did not
        // recognise this", the same answer a code we do not hold produces.
        setResult({ outcome: "unknown", scanned: file.name });
      }
    },
    [resolve],
  );

  if (!hasRecords(status)) {
    return <LoadingState rows={3} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
        <h2 className="text-base font-semibold">{t("cameraTitle")}</h2>

        <div className="relative overflow-hidden rounded-sm bg-muted">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full max-w-md object-cover"
            hidden={cameraState !== "running"}
            muted
            playsInline
          />
          {cameraState !== "running" ? (
            <div className="flex aspect-[4/3] w-full max-w-md items-center justify-center text-muted-foreground">
              <ScanLine className="size-10" aria-hidden="true" />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cameraState === "running" ? (
            <Button size="sm" variant="outline" onClick={stopCamera}>
              <CameraOff data-icon="inline-start" />
              {t("stopCamera")}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={startCamera}
              disabled={cameraState === "starting"}
            >
              <Camera data-icon="inline-start" />
              {t("startCamera")}
            </Button>
          )}
          {cameraState === "starting" ? (
            <span className="text-sm text-muted-foreground">
              {t("starting")}
            </span>
          ) : null}
        </div>

        {cameraState === "denied" ? (
          <Alert variant="destructive">
            <AlertTitle>{t("deniedTitle")}</AlertTitle>
            <AlertDescription>{t("deniedBody")}</AlertDescription>
          </Alert>
        ) : null}
        {cameraState === "unavailable" ? (
          <Alert>
            <AlertTitle>{t("noCameraTitle")}</AlertTitle>
            <AlertDescription>{t("noCameraBody")}</AlertDescription>
          </Alert>
        ) : null}
        {cameraState === "failed" ? (
          <Alert variant="destructive">
            <AlertTitle>{t("cameraFailedTitle")}</AlertTitle>
            <AlertDescription>{t("cameraFailedBody")}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
        <h2 className="text-base font-semibold">{t("uploadTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("uploadBody")}</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          // The button below is the control. Left exposed, the input appears in
          // the accessibility tree as a second control with the same name, and
          // a person tabbing through hears "Choose a photo" twice with only one
          // of them doing anything. `tabIndex={-1}` alongside `aria-hidden`
          // keeps it out of the tab order, which is what makes hiding it legal.
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void scanFile(file);
            }
            // Clearing lets the same file be chosen twice in a row, which is
            // exactly what happens when someone re-runs a demonstration step.
            event.target.value = "";
          }}
        />
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
          >
            <Upload data-icon="inline-start" />
            {t("uploadAction")}
          </Button>
        </div>
      </section>

      <div aria-live="polite">
        {result === null || onResult ? null : <ScanOutcome result={result} />}
      </div>
    </div>
  );
}

function ScanOutcome({ result }: { result: ScanResult }) {
  const t = useTranslations("scan");

  if (result.outcome === "unknown") {
    return <RecordMissing identifier={result.scanned} />;
  }

  const identifier =
    result.outcome === "asset" ? result.asset.assetTag : result.part.partNumber;
  const kind = result.outcome;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <span className="text-sm text-muted-foreground">
        {t(kind === "asset" ? "foundAsset" : "foundPart")}
      </span>
      <span className="font-mono text-lg font-semibold">{identifier}</span>
      <div>
        <Button asChild size="sm">
          <Link href={labelPath(kind, identifier)}>{t("open")}</Link>
        </Button>
      </div>
    </div>
  );
}
