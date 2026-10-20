import { useTranslations } from "next-intl";
import { InlineNotice } from "@/components/shared/state-panels";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("states.notFound");

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <InlineNotice
        title={t("title")}
        body={t("body")}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/">{t("action")}</Link>
          </Button>
        }
      />
    </div>
  );
}
