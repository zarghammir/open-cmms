import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SkipLink } from "@/components/layout/skip-link";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Role } from "@/domain/constants/roles";

/**
 * Desk view: desktop first. A module rail that collapses to icons, a sticky
 * header, and the widest possible content area for tables.
 */
export function DeskShell({
  role,
  sidebarOpen,
  children,
}: {
  role: Role;
  sidebarOpen: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("shell");

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <SkipLink />
      <AppSidebar role={role} />
      <SidebarInset className="min-w-0">
        <AppHeader role={role} />
        <main
          id="main"
          tabIndex={-1}
          aria-label={t("mainContent")}
          className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-5 md:px-6 md:py-6"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
