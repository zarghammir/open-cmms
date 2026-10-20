import type { Role } from "@/domain/constants/roles";
import type { EntityRef, Id, IsoDateTime, TenantOwned } from "./common";

export const NOTIFICATION_KINDS = [
  "workOrderDueSoon",
  "workOrderOverdue",
  "workOrderAssigned",
  "partBelowMinimum",
  "inspectionDue",
  "inspectionFailed",
  "maintenanceDue",
  "syncConflict",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * The kinds a person can turn off, in the order the preferences screen lists
 * them.
 *
 * Not every kind: `inspectionFailed` and `maintenanceDue` are seeded by the
 * demonstration and have no rule behind them yet, so offering a switch that
 * governs nothing would be a control that lies. They are shown in the bell and
 * left out of the screen until WA-20 gives them a rule.
 */
export const NOTIFIABLE_KINDS = [
  "workOrderDueSoon",
  "workOrderOverdue",
  "workOrderAssigned",
  "partBelowMinimum",
  "inspectionDue",
  "syncConflict",
] as const satisfies readonly NotificationKind[];
export type NotifiableKind = (typeof NOTIFIABLE_KINDS)[number];

/**
 * Something that wants a person's attention.
 *
 * The text is a catalogue key plus its arguments, never a built sentence: the
 * same notification has to read correctly in French, and a sentence frozen at
 * the moment it was created could not.
 */
export interface Notification extends TenantOwned {
  id: Id;
  kind: NotificationKind;
  /** A key under `notifications.<kind>` in both catalogues. */
  messageKey: string;
  params: Record<string, string | number>;
  subject: EntityRef;
  createdAt: IsoDateTime;
  readAt: IsoDateTime | null;
  /** Addressed to one person, or to everyone holding a role. Never neither. */
  forUserId: Id | null;
  forRole: Role | null;
  /**
   * What happened, named so the same happening cannot be reported twice.
   *
   * The rules run again on every write and again on every boot, so without
   * this a work order that is overdue on Monday would be announced on Monday,
   * and again when somebody edits its description, and again on Tuesday.
   * The key names the **event**, not the evaluation: `overdue:wo-14` is the
   * same event however many times it is noticed, while `dueSoon:wo-14:2026-09-19`
   * carries the due date, because moving the date is a different event and
   * moving it back is not a third one.
   *
   * Null on the records the seed writes directly, which is why it is nullable
   * rather than required: those exist before any rule has run and are matched
   * on their own identifiers.
   */
  eventKey: string | null;
}

/**
 * A line in the log of mail this demonstration would have sent.
 *
 * There is no mail server and Phase 1 will not have one. Rather than pretend,
 * the application writes down what it would have sent and to whom, and shows
 * that list in Settings. Phase 2 sends the same lines for real and the screens
 * do not change.
 *
 * The subject is a catalogue key and its arguments, like the notification it
 * comes from, plus the **language it would have been sent in** — which is the
 * recipient's, not the reader's. An administrator reading this log in English
 * sees a French subject line against a colleague who works in French, and that
 * is the point of showing it at all.
 */
export interface EmailLogEntry extends TenantOwned {
  id: Id;
  notificationId: Id;
  toUserId: Id;
  toEmail: string;
  /** The recipient's language, in which the subject below is written. */
  language: "en" | "fr";
  subjectKey: string;
  params: Record<string, string | number>;
  /** When it would have been sent. There is no delivery to record. */
  queuedAt: IsoDateTime;
}

/** One person's answer to "what do you want to hear about, and how". */
export interface NotificationChannelChoice {
  inApp: boolean;
  email: boolean;
}

export interface NotificationPreference extends TenantOwned {
  /** The record's id is the user's: one row per person, and never two. */
  id: Id;
  userId: Id;
  /** The language this person's mail would be written in. */
  language: "en" | "fr";
  kinds: Record<NotifiableKind, NotificationChannelChoice>;
}
