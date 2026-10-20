import type { Actor } from "@/stores/mutations";
import type { ReportKey } from "@/data/selectors/reports";
import type { RepositoryContext } from "./types";

/**
 * What was taken out of the system, and by whom.
 *
 * An export changes no record, so this writes an audit entry and nothing else —
 * `commitMany` with no record changes, which is the one shape that produces a
 * trail line on its own. That is the point rather than a technicality: a
 * demonstration that lets somebody walk away with a file and leaves no mark is
 * telling an evaluator something untrue about what the system remembers.
 */
export interface ReportRepository {
  recordExport: (report: ReportKey, rows: number, actor: Actor) => void;
}

export function createReportRepository(
  context: RepositoryContext,
): ReportRepository {
  return {
    recordExport(report, rows, actor) {
      const at = context.now().toISOString();

      context.commitMany(
        [],
        {
          entity: "demo",
          action: "exported",
          summaryKey: "audit.reportExported",
          summaryParams: { report, rows },
        },
        actor,
        context.data.organization.id,
        at,
      );
    },
  };
}
