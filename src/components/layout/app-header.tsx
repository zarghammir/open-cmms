import { useTranslations } from "next-intl";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { GlobalSearch } from "@/components/layout/global-search";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Role } from "@/domain/constants/roles";

/**
 * The desk header: where you are on the left, what you can do about the
 * session on the right. It stays put while a long table scrolls under it.
 */
export function AppHeader({ role }: { role: Role }) {
  const t = useTranslations("shell");

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:px-4">
      <SidebarTrigger aria-label={t("toggleNavigation")} className="shrink-0" />
      <Separator
        orientation="vertical"
        className="data-[orientation=vertical]:h-5"
      />
      <Breadcrumbs role={role} />
      <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
        <GlobalSearch className="hidden w-56 md:block lg:w-72" />
        <LocaleSwitcher />
        <NotificationsBell role={role} />
        <UserMenu role={role} />
      </div>
    </header>
  );
}
