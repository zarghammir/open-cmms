"use client";

import { useTranslations } from "next-intl";
import { RecordBarcode, RecordQr } from "@/components/shared/record-code";
import type { LabelContent } from "@/lib/label";

/**
 * One printed label.
 *
 * Sized in millimetres rather than pixels, because this ends up on a label
 * printer or a sheet of stock and a label that is "about right" on screen is
 * the wrong size on paper. Everything on it is black on white for the same
 * reason the codes are: it has to survive a photocopier and a corridor.
 *
 * The identifier is set large and in mono. When the codes will not read — a
 * cracked phone camera, a scuffed label — a person reads the tag out and types
 * it, and that path has to work too.
 */
export function RecordLabel({ content }: { content: LabelContent }) {
  const t = useTranslations("label");

  return (
    <div
      data-label
      className="flex w-[86mm] flex-col gap-[3mm] border border-black bg-white p-[4mm] text-black"
    >
      <div className="flex items-start gap-[4mm]">
        <RecordQr
          value={content.url}
          identifier={content.identifier}
          size={148}
        />
        <div className="flex min-w-0 flex-col gap-[1mm]">
          <span className="font-mono text-[13pt] leading-none font-semibold">
            {content.identifier}
          </span>
          <span className="line-clamp-2 text-[9pt] leading-snug">
            {content.name}
          </span>
          <span className="text-[8pt] leading-snug">
            {t(content.kind === "asset" ? "roomLine" : "binLine", {
              code: content.placeCode,
            })}
          </span>
          <span className="text-[8pt] leading-snug">{content.placeName}</span>
        </div>
      </div>

      <RecordBarcode value={content.identifier} />

      <span className="text-center text-[7pt] leading-none">
        {t("scanHint")}
      </span>
    </div>
  );
}
