"use client";

import { useTranslations } from "next-intl";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  homeHrefForRole,
  moduleForPathname,
} from "@/domain/constants/navigation";
import type { Role } from "@/domain/constants/roles";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Where you are. The home crumb is dropped when the current module already is
 * the role's home, so the trail never repeats itself.
 */
export function Breadcrumbs({ role }: { role: Role }) {
  const t = useTranslations("shell.breadcrumb");
  const tModules = useTranslations("modules");
  const pathname = usePathname();
  const current = moduleForPathname(pathname);
  const home = homeHrefForRole(role);
  const showHome = current?.href !== home;

  return (
    <Breadcrumb aria-label={t("label")} className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {showHome ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={home}>{t("home")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">
            {current ? tModules(`${current.key}.title`) : t("home")}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
