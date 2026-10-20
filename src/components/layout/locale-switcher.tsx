"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "cn";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type AppLocale } from "@/i18n/routing";

/**
 * Language is a first-class control, not a setting buried in a menu: the
 * product is bilingual by mandate, so the switch stays visible on every screen
 * at every width. Filters held in the query string survive the switch.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("shell.language");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = useLocale();
  const [isPending, startTransition] = useTransition();

  function select(next: string) {
    if (!next || next === active) return;

    const query = searchParams.toString();
    const target = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.replace(target, { locale: next as AppLocale });
    });
  }

  return (
    <ToggleGroup
      type="single"
      value={active}
      onValueChange={select}
      // The items are radios; Radix does not put the matching container role on
      // the root, and a radio outside a radiogroup is an orphan for a screen
      // reader.
      role="radiogroup"
      aria-label={t("label")}
      disabled={isPending}
      className={cn("gap-0", className)}
    >
      {locales.map((locale) => (
        <ToggleGroupItem
          key={locale}
          value={locale}
          aria-label={t("switchTo", { language: t(`options.${locale}`) })}
          className="px-2 font-mono text-2xs tracking-[0.1em] uppercase"
        >
          {t(`short.${locale}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
