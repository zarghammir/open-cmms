import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ModulePanel } from "@/components/shared/module-panel";
import { PermissionDeniedState } from "@/components/shared/state-panels";
import { canOpenModule, type ModuleKey } from "@/domain/constants/navigation";
import { getDemoRole } from "@/lib/server-session";

/**
 * The standard module screen: page header, then either what the module will
 * hold or a permission-denied panel. Every module route uses this, which is
 * why a new module cannot accidentally skip the role check.
 */
export async function ModuleScreen({
  moduleKey,
  actions,
  children,
  showToday = false,
  title,
  description,
}: {
  moduleKey: ModuleKey;
  actions?: ReactNode;
  /** Replaces the default "what this will hold" panel. */
  children?: ReactNode;
  /** Shows today's date above the title, for the home screens. */
  showToday?: boolean;
  /**
   * Titles a screen that lives *inside* a module — a label, a scan, a
   * verification. The module's own name moves up into the eyebrow, so the
   * reader still knows where they are, and the role check stays here rather
   * than being copied into every sub-page.
   */
  title?: string;
  description?: string;
}) {
  const role = await getDemoRole();
  const t = await getTranslations("modules");
  const tRoles = await getTranslations("roles");
  const format = await getFormatter();

  if (!canOpenModule(role, moduleKey)) {
    return (
      <>
        <PageHeader title={t(`${moduleKey}.title`)} />
        <PermissionDeniedState roleName={tRoles(`${role}.name`)} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          title
            ? t(`${moduleKey}.title`)
            : showToday
              ? format.dateTime(new Date(), "dayFull")
              : undefined
        }
        title={title ?? t(`${moduleKey}.title`)}
        description={description ?? t(`${moduleKey}.description`)}
        actions={actions}
      />
      {children ?? <ModulePanel moduleKey={moduleKey} />}
    </>
  );
}
