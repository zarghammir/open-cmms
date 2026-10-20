"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSaving } from "@/hooks/use-saving";
import { useManagePeople } from "@/hooks/use-manage-people";
import { ROLES, type Role } from "@/domain/constants/roles";
import { textFor } from "@/lib/localized-text";
import type { Facility, Id, User } from "@/domain/types";

/**
 * What an administrator may change about a person: their role, their site,
 * and whether they are still here.
 *
 * **Three fields and no more.** A name, an employee number and an email
 * address are a person's own details and Phase 2's sign-in owns them;
 * inventing a form for them here would be a demonstration of something the
 * product does not do. Invitations are WA-80 and stay out, which the screen
 * already says.
 *
 * **Native `<select>`**, as everywhere in this application: on a phone it
 * gives the platform picker a technician already knows, and it costs no new
 * registry component.
 */
export function EditPersonDialog({
  person,
  facilities,
  role,
}: {
  person: User;
  facilities: Facility[];
  role: Role;
}) {
  const t = useTranslations("managePeople");
  const tRoles = useTranslations("roles");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const { saving, save } = useSaving();
  const tSaving = useTranslations("states.saving");
  const { apply } = useManagePeople(role);

  const [nextRole, setNextRole] = useState<Role>(person.role);
  const [nextSite, setNextSite] = useState<Id>(person.homeFacilityId);
  const [nextActive, setNextActive] = useState(person.active);

  function onOpenChange(next: boolean) {
    // Reopening shows the person as they are now, not as the last cancelled
    // edit left the form — otherwise an abandoned change quietly becomes the
    // starting point for the next one.
    if (next) {
      setNextRole(person.role);
      setNextSite(person.homeFacilityId);
      setNextActive(person.active);
    }
    setOpen(next);
  }

  async function submit() {
    const result = await save(() =>
      apply(person.id, {
        role: nextRole,
        homeFacilityId: nextSite,
        active: nextActive,
      }),
    );
    // The dialog closing is this screen's durability signal, so it stays open
    // until the write reports stored — a dialog that shut here would be the
    // screen saying the change was kept.
    if (!result.stored) return;
    toast.success(result.value ? t("saved") : t("nothingChanged"));
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-slot="edit-person">
          <Pencil data-icon="inline-start" />
          {t("action")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", {
              name: `${person.firstName} ${person.lastName}`,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            {t("role")}
            <select
              data-slot="person-role"
              className="rounded-md border border-border px-2 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              value={nextRole}
              onChange={(event) => setNextRole(event.target.value as Role)}
            >
              {ROLES.map((one) => (
                <option key={one} value={one}>
                  {tRoles(`${one}.name`)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            {t("site")}
            <select
              data-slot="person-site"
              className="rounded-md border border-border px-2 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              value={nextSite}
              onChange={(event) => setNextSite(event.target.value)}
            >
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.code} — {textFor(facility.name, locale)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-slot="person-active"
              className="size-4 rounded-sm border-border accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              checked={nextActive}
              onChange={(event) => setNextActive(event.target.checked)}
            />
            {t("active")}
          </label>
          {/*
            Said on the screen rather than left to be discovered: this is the
            field `assignable` already reads, so turning it off stops the
            person being offered work immediately.
          */}
          <p className="text-xs text-muted-foreground">{t("activeHint")}</p>
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={submit} disabled={saving}>
            {saving ? tSaving("label") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
