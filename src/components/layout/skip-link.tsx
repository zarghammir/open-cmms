import { useTranslations } from "next-intl";

/** First thing in the tab order on every page. */
export function SkipLink() {
  const t = useTranslations("shell");

  return (
    <a
      href="#main"
      className="sr-only rounded-sm bg-primary px-3 py-2 font-medium text-primary-foreground focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:ring-ring"
    >
      {t("skipToContent")}
    </a>
  );
}
