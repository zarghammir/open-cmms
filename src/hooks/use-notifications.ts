"use client";

import { useMemo } from "react";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import type { Role } from "@/domain/constants/roles";
import type {
  Id,
  NotifiableKind,
  NotificationPreference,
} from "@/domain/types";
import { fullName } from "@/domain/types";
import { useActor, useDemoData, useRepositories } from "./use-demo-data";
import { useSaving } from "./use-saving";

/**
 * The two notification screens in Settings, and the one awkward thing they do.
 *
 * A subject line in the email log is written in the **recipient's** language,
 * not the reader's. `useTranslations` is bound to the locale the page is being
 * read in, by design, so it cannot answer that question — and it should not:
 * everywhere else in the application, text in the reader's language is exactly
 * right.
 *
 * So this reaches into the other catalogue directly and fills in the arguments
 * itself. **It handles simple `{name}` arguments and nothing else**, which is
 * all a subject line uses; `subjectsAreSimple` in the unit tests holds that
 * true, so a subject that one day needed a plural would fail a test rather than
 * render a brace. The alternative was a runtime ICU formatter, which is a
 * dependency added for six strings.
 */
const CATALOGUES = { en, fr } as const;

/** Fills `{name}` from the arguments. Anything else is left alone, visibly. */
function fill(template: string, params: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export interface EmailLogRow {
  id: Id;
  toUserId: Id;
  toEmail: string;
  language: "en" | "fr";
  queuedAt: string;
  /** Already in the recipient's language, with its arguments filled in. */
  subject: string;
}

export function useEmailLog(): {
  ready: boolean;
  entries: EmailLogRow[];
  nameFor: (userId: Id) => string;
} {
  const { status, data } = useDemoData();
  const { repositories } = useRepositories();
  const ready = status === "ready" && repositories !== null && data !== null;

  const entries = useMemo<EmailLogRow[]>(() => {
    if (!repositories) return [];
    return repositories.notifications.emailLog().map((entry) => {
      const catalogue = CATALOGUES[entry.language];
      const bare = entry.subjectKey.replace("notifications.", "");
      const template =
        (catalogue.notifications as Record<string, unknown>)[bare] ??
        entry.subjectKey;
      return {
        id: entry.id,
        toUserId: entry.toUserId,
        toEmail: entry.toEmail,
        language: entry.language,
        queuedAt: entry.queuedAt,
        subject:
          typeof template === "string"
            ? fill(template, entry.params)
            : entry.subjectKey,
      };
    });
  }, [repositories]);

  const nameFor = useMemo(() => {
    const people = new Map(
      (data?.users ?? []).map((user) => [user.id, fullName(user)]),
    );
    // The identifier rather than a blank, when a person is not found: a row
    // that names nobody is a row that says the mail went nowhere, which is a
    // different claim from the one the record makes.
    return (userId: Id) => people.get(userId) ?? userId;
  }, [data]);

  return { ready, entries, nameFor };
}

export interface PreferencesView {
  ready: boolean;
  preference: NotificationPreference | null;
  /** False for a role that reads and does not change things. */
  editable: boolean;
  setChannel: (
    kind: NotifiableKind,
    channel: "inApp" | "email",
    on: boolean,
  ) => void;
}

export function useNotificationPreferences(role: Role): PreferencesView {
  const { status } = useDemoData();
  const { repositories } = useRepositories();
  const actor = useActor(role);
  const { save } = useSaving();
  const ready = status === "ready" && repositories !== null;

  const preference = ready
    ? repositories.notifications.preferencesFor(actor.userId)
    : null;

  return {
    ready,
    preference,
    /*
     * An auditor reads. The control stays visible and disabled with the reason
     * beside it rather than disappearing: a screen that is simply shorter for
     * one role demonstrates nothing, and an evaluator watching somebody switch
     * roles has to be able to *see* that the product is role-based.
     */
    editable: role !== "auditor",
    setChannel(kind, channel, on) {
      if (!repositories || role === "auditor") return;
      void save(() => {
        repositories.notifications.setChannel(
          actor.userId,
          kind,
          channel,
          on,
          actor,
        );
      });
    },
  };
}
