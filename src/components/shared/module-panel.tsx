import { useTranslations } from "next-intl";
import { moduleByKey, type ModuleKey } from "@/domain/constants/navigation";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * What a module will hold, on a module that has no records yet. It is not a
 * "coming soon" notice: it names the specific things the screen will show, so
 * a reader can tell whether the design covers what they need.
 */
export function ModulePanel({ moduleKey }: { moduleKey: ModuleKey }) {
  const t = useTranslations("modules");
  const Icon = moduleByKey(moduleKey).icon;

  const points = [
    t(`${moduleKey}.point1`),
    t(`${moduleKey}.point2`),
    t(`${moduleKey}.point3`),
  ];

  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle className="text-base">
          {t(`${moduleKey}.emptyTitle`)}
        </EmptyTitle>
        <EmptyDescription>{t(`${moduleKey}.emptyBody`)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-md">
        <ul className="w-full divide-y divide-border border-t border-border text-left">
          {points.map((point) => (
            <li
              key={point}
              className="flex gap-2 py-2 text-sm text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60"
              />
              {point}
            </li>
          ))}
        </ul>
      </EmptyContent>
    </Empty>
  );
}
