import type {
  Id,
  Inspection,
  InspectionFinding,
  InspectionTemplate,
} from "@/domain/types";
import type { RepositoryContext } from "./types";

/**
 * Inspections, read-only.
 *
 * Thin on purpose: the asset page shows what has been inspected and what was
 * found. WA-20 owns inspections — running a checklist, raising corrective work
 * from a failed item — and extends this rather than replacing it.
 */
export interface InspectionRepository {
  /** Every inspection of one asset, most recent first. */
  forAsset: (assetId: Id) => Inspection[];
  templateById: (id: Id) => InspectionTemplate | undefined;
  findingsFor: (inspectionId: Id) => InspectionFinding[];
}

export function createInspectionRepository(
  context: RepositoryContext,
): InspectionRepository {
  return {
    forAsset: (assetId) =>
      context.data.inspections
        .filter((inspection) => inspection.assetId === assetId)
        // `performedAt` is null for one that has not happened yet, so the
        // scheduled date is what every inspection can be ordered by. Sorting on
        // `performedAt` alone would drop the scheduled ones to one end
        // regardless of when they are due.
        .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)),

    templateById: (id) =>
      context.data.inspectionTemplates.find((template) => template.id === id),

    findingsFor: (inspectionId) =>
      context.data.inspectionFindings.filter(
        (finding) => finding.inspectionId === inspectionId,
      ),
  };
}
