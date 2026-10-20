import { describe, expect, it } from "vitest";
import type { AuditEvent } from "@/domain/types";
import { auditSummaryParams } from "./audit-text";

const event = (summaryParams: AuditEvent["summaryParams"]): AuditEvent => ({
  id: "aud-1",
  organizationId: "org-dln",
  at: "2026-09-12T14:05:00.000Z",
  actorKind: "person",
  actorUserId: "usr-raman",
  actorRole: "maintenanceCoordinator",
  entity: "workOrder",
  entityId: "wko-1",
  action: "statusChanged",
  summaryKey: "audit.statusChanged",
  summaryParams,
  changes: [],
});

// Stands in for `useTranslations`, so the test can see which key was asked for.
const translate = (key: string) => `<${key}>`;

describe("audit summary arguments", () => {
  it("translates a status rather than printing the domain value", () => {
    expect(
      auditSummaryParams(
        event({ number: "WO-2026-0001", status: "waitingForParts" }),
        translate,
      ),
    ).toEqual({
      number: "WO-2026-0001",
      status: "<workOrderStatus.waitingForParts>",
    });
  });

  it("leaves everything else exactly as it was", () => {
    expect(
      auditSummaryParams(
        event({ quantity: 3, partNumber: "FLT-201" }),
        translate,
      ),
    ).toEqual({ quantity: 3, partNumber: "FLT-201" });
  });

  it("does nothing when there is nothing to say", () => {
    expect(auditSummaryParams(event({}), translate)).toEqual({});
  });
});
