import { useTranslations } from "next-intl";
import { InlineNotice } from "@/components/shared/state-panels";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function AppNotFound() {
  const t = useTranslations("states.notFound");

  return (
    <InlineNotice
      title={t("title")}
      body={t("body")}
      action={
        <Button asChild size="sm" variant="outline">
          <Link href="/">{t("action")}</Link>
        </Button>
      }
    />
  );
}
