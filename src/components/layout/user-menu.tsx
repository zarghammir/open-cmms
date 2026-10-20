"use client";

import { BellRing, ChevronsUpDown, CircleUser } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLES, type Role } from "@/domain/constants/roles";
import {
  homeHrefForRole,
  canOpenModule,
  moduleForPathname,
} from "@/domain/constants/navigation";
import { roleCookieAssignment } from "@/lib/demo-session";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { locales, type AppLocale } from "@/i18n/routing";

/**
 * The demo session menu: who the application thinks you are, and the two
 * preferences that change what you see. There is no sign-in in Phase 1, so the
 * menu says so rather than pretending to have an account.
 */
export function UserMenu({
  role,
  className,
}: {
  role: Role;
  className?: string;
}) {
  const t = useTranslations("shell.user");
  const tNotifications = useTranslations("shell.notifications");
  const tRoles = useTranslations("roles");
  const tLanguage = useTranslations("shell.language");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const [, startTransition] = useTransition();

  function selectRole(next: string) {
    const nextRole = next as Role;
    if (nextRole === role) return;

    document.cookie = roleCookieAssignment(nextRole);

    // Stay where you are if the new role may open this module; otherwise land
    // on that role's home rather than on a permission-denied screen.
    const current = moduleForPathname(pathname);
    const target =
      current && canOpenModule(nextRole, current.key)
        ? pathname
        : homeHrefForRole(nextRole);

    startTransition(() => {
      router.replace(target);
      router.refresh();
      toast.success(t("roleChanged", { role: tRoles(`${nextRole}.name`) }));
    });
  }

  function selectLocale(next: string) {
    if (next === locale) return;
    const query = searchParams.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        locale: next as AppLocale,
      });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-2", className)}
          aria-label={t("menuLabel")}
        >
          <CircleUser data-icon="inline-start" />
          <span className="hidden max-w-36 truncate sm:inline">
            {tRoles(`${role}.name`)}
          </span>
          <ChevronsUpDown data-icon="inline-end" className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span>{t("demoSession")}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {t("demoSessionHint")}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-2xs tracking-[0.1em] text-muted-foreground uppercase">
            {t("switchRole")}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={role} onValueChange={selectRole}>
            {ROLES.map((candidate) => (
              <DropdownMenuRadioItem key={candidate} value={candidate}>
                <span className="flex flex-col gap-0.5">
                  <span>{tRoles(`${candidate}.name`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {tRoles(`${candidate}.summary`)}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-2xs tracking-[0.1em] text-muted-foreground uppercase">
            {t("language")}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={locale} onValueChange={selectLocale}>
            {locales.map((candidate) => (
              <DropdownMenuRadioItem key={candidate} value={candidate}>
                {tLanguage(`options.${candidate}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/*
         * The one personal screen this menu can reach.
         *
         * It is here as well as under the bell because the two are different
         * moments: the bell is where somebody notices they are hearing too
         * much, and this menu is where they look for their own settings when
         * nothing has just happened. Every role may open it, which is the
         * point — it used to live on Settings, and four of the six roles
         * could not get to their own preferences.
         */}
        <DropdownMenuItem asChild>
          <Link href="/my-notifications">
            <BellRing data-icon="inline-start" />
            {tNotifications("settingsLink")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
