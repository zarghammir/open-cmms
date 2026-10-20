"use client";

import { useCallback, useMemo } from "react";
import {
  CREW_CODE_ASSIGNMENTS,
  assignmentForCrewCode,
} from "@/data/seed/people";
import { SITE_CODES, type ImportBatch } from "@/domain/types";
import type { BuildContext } from "@/lib/import/build";
import type { ColumnMapping, SheetKind } from "@/lib/import/mapping";
import { runImport, type ImportRun } from "@/lib/import/run";
import type { SheetData, ValidationContext } from "@/lib/import/validate";
import { toIsoDate } from "@/data/seed/dates";
import type { Actor } from "@/stores/mutations";
import { useRepositories } from "./use-demo-data";

/**
 * What the import wizard is allowed to do.
 *
 * The screen never reaches the store: it hands rows to `run`, shows what comes
 * back, and hands the same object to `commit`. There is deliberately no second
 * way to build records — the report and the commit read one run, so the number
 * on the screen is the number that gets written.
 */

export interface ImportTools {
  ready: boolean;
  run: (
    sheets: readonly SheetData[],
    mappings: Record<SheetKind, ColumnMapping>,
  ) => ImportRun | null;
  commit: (run: ImportRun, fileName: string) => ImportBatch;
  rollback: (batchId: string) => void;
  latestUndoable: () => ImportBatch | undefined;
}

export function useImport(actor: Actor): ImportTools {
  const { status, repositories } = useRepositories();

  const contexts = useMemo(() => {
    if (!repositories) return null;
    const facilities = repositories.facilities;
    const assets = repositories.assets;

    const validation: ValidationContext = {
      today: toIsoDate(new Date()),
      knownSiteCodes: [...SITE_CODES],
      knownLocationCodes: facilities
        .list()
        .flatMap((facility) => facilities.locationsIn(facility.id))
        .map((location) => location.code),
      knownBinCodes: facilities.bins().map((bin) => bin.code),
      knownCrewCodes: Object.keys(CREW_CODE_ASSIGNMENTS),
      existingAssetTags: assets.list().map((asset) => asset.assetTag),
      existingPartNumbers: repositories.parts
        .list()
        .map((part) => part.partNumber),
      existingWorkOrderNumbers: repositories.workOrders
        .list()
        .map((order) => order.number),
    };

    const build: BuildContext = {
      organizationId: facilities.organization().id,
      facilityIdForSite: (site) => facilities.byCode(site)?.id,
      locationIdForCode: (code) => facilities.locationByCode(code)?.id,
      binIdForCode: (code) => facilities.binByCode(code)?.id,
      assetTypeIdForPrefix: (prefix) =>
        assets.types().find((type) => type.tagPrefix === prefix)?.id,
      userIdForCrewCode: (code) => {
        const found = assignmentForCrewCode(code);
        return found && "userId" in found ? found.userId : undefined;
      },
      actorUserId: actor.userId,
      assetIdForTag: (tag) => assets.byTag(tag)?.id,
      now: new Date().toISOString(),
    };

    return { validation, build };
  }, [repositories, actor.userId]);

  const run = useCallback(
    (
      sheets: readonly SheetData[],
      mappings: Record<SheetKind, ColumnMapping>,
    ) => {
      if (!contexts) return null;
      return runImport(sheets, mappings, contexts.validation, contexts.build);
    },
    [contexts],
  );

  const commit = useCallback(
    (result: ImportRun, fileName: string) => {
      if (!repositories) {
        throw new Error("Cannot import before the records are loaded");
      }
      return repositories.imports.commitImport(result.records, fileName, actor);
    },
    [repositories, actor],
  );

  const rollback = useCallback(
    (batchId: string) => {
      if (!repositories) {
        throw new Error("Cannot undo before the records are loaded");
      }
      repositories.imports.rollback(batchId, actor);
    },
    [repositories, actor],
  );

  const latestUndoable = useCallback(
    () => repositories?.imports.latestUndoable(),
    [repositories],
  );

  return {
    ready: status === "ready" && repositories !== null,
    run,
    commit,
    rollback,
    latestUndoable,
  };
}
