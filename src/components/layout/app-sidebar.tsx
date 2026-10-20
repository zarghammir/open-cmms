"use client";

import { useTranslations } from "next-intl";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { WorkAxisMark } from "@/components/layout/wordmark";
import { homeHrefForRole, modulesForRole } from "@/domain/constants/navigation";
import type { Role } from "@/domain/constants/roles";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * The module rail. It lists only the modules the current role may open, in the
 * order set by the specification, and collapses to icons so a table can use
 * the full width.
 */
export function AppSidebar({ role }: { role: Role }) {
  const t = useTranslations("shell");
  const tApp = useTranslations("app");
  const tModules = useTranslations("modules");
  const pathname = usePathname();
  const modules = modulesForRole(role);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center">
        <Link
          href={homeHrefForRole(role)}
          className="flex items-center gap-2.5 rounded-sm px-1 py-1"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground">
            <WorkAxisMark className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold tracking-tight">
              {tApp("name")}
            </span>
            <span className="truncate text-xs text-sidebar-muted">
              {tApp("tagline")}
            </span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {/* shadcn's sidebar has no landmark of its own, so the navigation
            landmark is declared here. */}
        <nav aria-label={t("primaryNavigation")}>
          <SidebarGroup>
            <SidebarGroupLabel className="text-2xs tracking-[0.12em] text-sidebar-muted uppercase">
              {t("primaryNavigation")}
            </SidebarGroupLabel>
            <SidebarMenu>
              {modules.map((module) => {
                const active =
                  pathname === module.href ||
                  pathname.startsWith(`${module.href}/`);
                const label = tModules(`${module.key}.title`);

                return (
                  <SidebarMenuItem key={module.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={label}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
                    >
                      <Link
                        href={module.href}
                        aria-current={active ? "page" : undefined}
                      >
                        <module.icon aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}
