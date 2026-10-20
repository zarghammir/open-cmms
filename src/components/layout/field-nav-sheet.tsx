"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { modulesForRole } from "@/domain/constants/navigation";
import type { Role } from "@/domain/constants/roles";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Navigation for the field view. A phone in one hand does not get a rail, it
 * gets a full-height list with targets big enough for a gloved thumb.
 */
export function FieldNavSheet({ role }: { role: Role }) {
  const t = useTranslations("shell");
  const tModules = useTranslations("modules");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const modules = modulesForRole(role);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("toggleNavigation")}
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[17rem] p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t("primaryNavigation")}</SheetTitle>
          <SheetDescription>{t("views.fieldHint")}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t("primaryNavigation")} className="p-2">
          <ul className="flex flex-col gap-1">
            {modules.map((module) => {
              const active =
                pathname === module.href ||
                pathname.startsWith(`${module.href}/`);

              return (
                <li key={module.key}>
                  <Link
                    href={module.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className="flex min-h-11 items-center gap-3 rounded-sm px-3 hover:bg-muted aria-[current=page]:bg-secondary aria-[current=page]:font-medium aria-[current=page]:text-secondary-foreground"
                  >
                    <module.icon
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                    {tModules(`${module.key}.title`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
