"use client";

import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CapabilityAction } from "@/components/shared/capability-action";
import { Button } from "@/components/ui/button";
import {
  DOCUMENT_KINDS,
  isAcceptedMimeType,
  type DocumentKind,
  type Id,
} from "@/domain/types";
import { useActor } from "@/hooks/use-demo-data";
import { useSaving } from "@/hooks/use-saving";
import type { Role } from "@/domain/constants/roles";
import {
  UnsupportedFileTypeError,
  useDocumentUpload,
} from "@/hooks/use-documents";

/**
 * Recording a file somebody chose, without storing a byte of it.
 *
 * The browser reads the real name, type and size off the `File`; nothing is
 * uploaded anywhere and the panel says so. That is the honest version of this
 * feature in Phase 1, and it demonstrates the part an evaluator is actually
 * asking about — that the system records the document and attaches it to the
 * right record.
 *
 * **The refusal is named.** A type outside the accepted list is turned away
 * with a sentence saying which type it was, in the reader's language. A
 * refusal only the person at the machine can see, or one that says nothing at
 * all, is indistinguishable from the upload being broken — and the repository
 * refuses too, so a second surface cannot walk around this check.
 */
export function DocumentUpload({
  role,
  assetId = null,
  workOrderId = null,
  maintenancePlanId = null,
}: {
  role: Role;
  assetId?: Id | null;
  workOrderId?: Id | null;
  maintenancePlanId?: Id | null;
}) {
  const t = useTranslations("documentUpload");
  const tKind = useTranslations("documentKind");
  const actor = useActor(role);
  const upload = useDocumentUpload();
  const { saving, save } = useSaving();
  const tSaving = useTranslations("states.saving");
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocumentKind>("manual");

  async function chosen(file: File | undefined) {
    if (!file) return;

    // Asked before the write, so the sentence can name the type. The
    // repository asks again; this one exists to be readable, that one to be
    // unavoidable.
    if (!isAcceptedMimeType(file.type)) {
      toast.error(t("refused", { fileName: file.name }));
      return;
    }

    try {
      const result = await save(() =>
        upload(
          {
            title: { en: file.name, fr: file.name },
            kind,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            assetId,
            workOrderId,
            maintenancePlanId,
          },
          actor,
        ),
      );
      // The tenth write surface. `save` has already told the person if the
      // browser could not keep it; saying "recorded" on top of that would be
      // the screen contradicting the message beside it.
      if (!result.stored) return;
      if (result.value) toast.success(t("recorded", { fileName: file.name }));
    } catch (error) {
      // The repository's refusal, should a type ever reach it that the check
      // above let through. Same sentence: a person should not be able to tell
      // which of the two turned the file away.
      if (error instanceof UnsupportedFileTypeError) {
        toast.error(t("refused", { fileName: file.name }));
        return;
      }
      throw error;
    }
  }

  return (
    <CapabilityAction
      role={role}
      capability="document.attach"
      label={t("action")}
      icon={<Paperclip data-icon="inline-start" />}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="document-kind" className="text-xs font-medium">
            {t("kindLabel")}
          </label>
          <select
            id="document-kind"
            className="h-9 w-full max-w-48 rounded-md border border-input bg-transparent px-3 text-sm"
            value={kind}
            onChange={(event) => setKind(event.target.value as DocumentKind)}
          >
            {DOCUMENT_KINDS.map((value) => (
              <option key={value} value={value}>
                {tKind(value)}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving}
          aria-busy={saving}
          onClick={() => input.current?.click()}
        >
          <Paperclip data-icon="inline-start" />
          {saving ? tSaving("label") : t("action")}
        </Button>

        {/*
         * `hidden`, not `sr-only`, and with no label of its own.
         *
         * `sr-only` keeps an element in the tab order and in the
         * accessibility tree, so this input was a second control carrying the
         * same name as the button beside it: a keyboard user tabbed onto an
         * invisible file input, and a screen reader announced "Attach a
         * document" twice with only one of them doing anything. Found by
         * walking the keyboard path, which is the only way it shows up —
         * every mouse test passed.
         *
         * The button is the control. This is how it opens the picker, and
         * `.click()` works on a display:none input.
         */}
        <input
          ref={input}
          type="file"
          hidden
          onChange={(event) => {
            // `void`, and deliberately: `chosen` waits for the browser to store
            // the file now, so this no longer returns before the work is done.
            // Marked rather than left floating, the way the other write
            // surfaces mark theirs.
            void chosen(event.target.files?.[0]);
            // Cleared so choosing the same file twice fires again: a second
            // attempt that silently does nothing reads as a broken button.
            // Safe before the write finishes — the file is already read out of
            // the event above, and clearing only resets the picker.
            event.target.value = "";
          }}
        />
      </div>
    </CapabilityAction>
  );
}
