import { z } from "zod";
import { ASSET_CRITICALITIES, ASSET_STATUSES } from "@/domain/types/asset";

/**
 * Asset forms. As in the work-order schemas the messages are catalogue keys.
 *
 * `assetTag` is checked for shape here and for uniqueness in the repository:
 * a pattern cannot know what else exists.
 */
export const ASSET_TAG_PATTERN = /^[A-Z]{2,4}-(KGN|SUD|MCT|KAM|REG)-\d{2}$/;

export const assetCreateSchema = z.object({
  assetTag: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .regex(ASSET_TAG_PATTERN, { error: "validation.assetTagShape" }),
  name: z.object({
    en: z.string().trim().min(1, { error: "validation.required" }).max(120, {
      error: "validation.tooLong",
    }),
    fr: z.string().trim().min(1, { error: "validation.required" }).max(120, {
      error: "validation.tooLong",
    }),
  }),
  assetTypeId: z.string().min(1, { error: "validation.required" }),
  locationId: z.string().min(1, { error: "validation.locationRequired" }),
  manufacturer: z.string().trim().max(120, { error: "validation.tooLong" }),
  model: z.string().trim().max(120, { error: "validation.tooLong" }),
  serialNumber: z.string().trim().max(120, { error: "validation.tooLong" }),
  installedOn: z.iso.date({ error: "validation.date" }),
  status: z.enum(ASSET_STATUSES, { error: "validation.required" }),
  criticality: z.enum(ASSET_CRITICALITIES, { error: "validation.required" }),
});

export type AssetCreateInput = z.infer<typeof assetCreateSchema>;

export const assetUpdateSchema = assetCreateSchema.partial();
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;
