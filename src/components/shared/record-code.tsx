"use client";

import JsBarcode from "jsbarcode";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The two machine-readable marks on a label.
 *
 * Both are drawn in flat black on flat white rather than in theme tokens. That
 * is deliberate and is the one place in this project where a colour is not a
 * token: these are not chrome, they are images a scanner has to resolve, and
 * a tinted surface or a near-black foreground is how a label that looks fine
 * fails to read in a corridor. They stay black on white in both themes and on
 * paper.
 */

/** Error correction level Q recovers a quarter of the code — labels get scuffed. */
const ERROR_CORRECTION = "Q";

export function RecordQr({
  value,
  identifier,
  size = 132,
}: {
  /** The absolute URL the QR carries, or null while the origin is unknown. */
  value: string | null;
  identifier: string;
  size?: number;
}) {
  const t = useTranslations("label");

  if (value === null) {
    return (
      <Skeleton
        className="shrink-0 rounded-sm"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // The wrapper is what a test photographs, and what a decoder needs: the
    // quiet zone around a QR is part of the code, so the white padding here is
    // functional rather than decorative.
    <span data-qr className="shrink-0 bg-white p-[2mm]">
      <QRCodeSVG
        value={value}
        size={size}
        level={ERROR_CORRECTION}
        marginSize={0}
        bgColor="#ffffff"
        fgColor="#000000"
        title={t("qrAlt", { identifier })}
      />
    </span>
  );
}

export function RecordBarcode({
  value,
  height = 44,
}: {
  /** The identifier itself: a handheld reader types this straight into a field. */
  value: string;
  height?: number;
}) {
  const t = useTranslations("label");
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) {
      return;
    }
    JsBarcode(svg, value, {
      format: "CODE128",
      // The human-readable line is already on the label, set in the type the
      // rest of the card uses. Letting the library draw its own would put a
      // second, differently styled copy underneath it.
      displayValue: false,
      height,
      width: 1.6,
      margin: 0,
      background: "#ffffff",
      lineColor: "#000000",
    });
  }, [value, height]);

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={t("barcodeAlt", { identifier: value })}
      className="h-11 w-full"
    />
  );
}
