"use client";

import { Boxes, Wrench } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { FacilitiesMapView } from "@/components/facilities/facilities-map-view";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Role } from "@/domain/constants/roles";
import { ModulePanel } from "@/components/shared/module-panel";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { FacilityNode } from "@/data/selectors/facility-tree";
import type { Asset, Id } from "@/domain/types";
import { hasRecords } from "@/hooks/use-demo-data";
import { useFacilities } from "@/hooks/use-facilities";
import { Link } from "@/i18n/navigation";
import { textFor } from "@/lib/localized-text";

/**
 * Where everything is, and what is at each place.
 *
 * **A `<details>` per node rather than a built tree widget.** It is open and
 * closed by keyboard with no code, it is announced as a disclosure by screen
 * readers, and the repository's rule is to add no registry component a native
 * element already covers. A hand-built `role="tree"` would have brought arrow
 * keys, roving focus and `aria-expanded` to maintain, for a control a person
 * uses by clicking a triangle.
 *
 * Every node carries what is at it **or below it**, which is what makes a site
 * row worth reading: equipment is filed against rooms, so a site counting only
 * itself would read zero everywhere.
 */

function Counts({ node }: { node: FacilityNode }) {
  const t = useTranslations("facilities");

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className="gap-1">
        <Boxes data-icon="inline-start" />
        {t("equipment", { count: node.equipment })}
      </Badge>
      {/* Zero open work is a fact worth showing, not a badge to hide: a site
          with nothing outstanding is the thing a manager is looking for. */}
      <Badge
        variant={node.openWork > 0 ? "default" : "outline"}
        className="gap-1"
      >
        <Wrench data-icon="inline-start" />
        {t("openWork", { count: node.openWork })}
      </Badge>
    </span>
  );
}

function Room({
  node,
  equipmentIn,
}: {
  node: FacilityNode;
  /*
   * Handed down rather than looked up here.
   *
   * Calling `useFacilities()` in this component read well and was wrong: the
   * hook builds the whole tree, its `useMemo` is per component instance, and
   * this component renders once per room. A hundred rooms meant a hundred
   * tree builds on one screen, all identical. Threading the lookup costs a
   * prop and builds the tree once.
   */
  equipmentIn: (locationId: Id) => Asset[];
}) {
  const t = useTranslations("facilities");
  const locale = useLocale();
  const assets = equipmentIn(node.id);

  return (
    <details>
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 rounded-sm py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="font-mono text-sm">{node.code}</span>
        <span className="text-sm">{textFor(node.name, locale)}</span>
        <Counts node={node} />
      </summary>

      {assets.length === 0 ? (
        <Empty className="py-4">
          <EmptyHeader>
            <EmptyTitle className="text-sm">{t("roomEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("roomEmptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col py-1">
          {assets.map((asset) => (
            <li key={asset.id}>
              <Link
                href={`/assets/${asset.assetTag}`}
                aria-label={t("openInRegister", { tag: asset.assetTag })}
                className="flex min-h-11 flex-wrap items-center gap-2 rounded-sm px-1 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="font-mono text-xs font-medium">
                  {asset.assetTag}
                </span>
                <span className="text-sm">{textFor(asset.name, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function Node({
  node,
  equipmentIn,
}: {
  node: FacilityNode;
  equipmentIn: (locationId: Id) => Asset[];
}) {
  const locale = useLocale();
  // The map's own words, from the map's own namespace, so the link and the
  // screen it opens cannot come to call the same thing two different things.
  const map = useTranslations("floorMap");

  if (node.kind === "room") {
    return <Room node={node} equipmentIn={equipmentIn} />;
  }

  return (
    <details>
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 rounded-sm py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="font-mono text-sm font-medium">{node.code}</span>
        <span className="text-sm">{textFor(node.name, locale)}</span>
        <Counts node={node} />
      </summary>
      {/*
        A floor is the only node a plan is filed against, so it is the only one
        that offers the link. It is offered whether or not a drawing exists:
        the screen answers "drawn", "surveyed with no drawing on file" or
        "nobody has looked", and those are three different things a person may
        need to know. Hiding the link where there is no drawing would collapse
        the last two into silence, which reads as the first.
      */}
      {node.kind === "floor" ? (
        <p className="ml-2 border-l border-border py-1 pl-3">
          <Link
            href={`/facilities/map/${node.code}`}
            aria-label={map("openFloorPlanFor", { code: node.code })}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {map("openFloorPlan")}
          </Link>
        </p>
      ) : null}

      {/*
        The indent lives here, on the list of children, not on each `<details>`.
        It was on the node itself with `first:border-l-0 first:pl-0` to spare the
        top level — and every node is the only child of its own `<li>`, so
        `first:` matched all of them and stripped the indent from the whole
        tree. A screenshot showed it: sites, buildings and floors all starting
        at the same x-position, a hierarchy browser reading as a flat list.
        Every test passed, because counts and clicks do not have a left edge.
      */}
      <ul className="ml-2 flex flex-col gap-0.5 border-l border-border py-1 pl-3">
        {node.children.map((child) => (
          <li key={child.id}>
            <Node node={child} equipmentIn={equipmentIn} />
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The places, as a list or as a plan.
 *
 * **Two views of one set of records, not two features.** The tree answers
 * "what have we got and where", the plan answers "what is where on this floor";
 * they are the same equipment read two ways, which is why they share a screen
 * and a place in the navigation rather than becoming a second module.
 *
 * The state is local, like the maintenance module's own switch: a reader
 * sending somebody a link is sending them the module, and `?view=` would be
 * machinery for a case the demonstration does not have. The per-floor route
 * still exists for a link to one floor, and the tree still offers it.
 */
export function FacilitiesScreen({ role }: { role: Role }) {
  const t = useTranslations("facilities");
  const [view, setView] = useState<"list" | "map">("list");

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        value={view}
        /*
         * `type="single"` hands back an empty string when the pressed item is
         * pressed again, and an empty view is not one of the two answers — so a
         * repeated press keeps the current view rather than emptying the
         * screen. Every caller of this control in the product guards it; this
         * one does it by naming its two answers.
         */
        onValueChange={(next) => {
          if (next === "list" || next === "map") setView(next);
        }}
        variant="outline"
        size="sm"
        aria-label={t("viewLabel")}
        data-slot="facilities-views"
      >
        <ToggleGroupItem value="list">{t("viewList")}</ToggleGroupItem>
        <ToggleGroupItem value="map">{t("viewMap")}</ToggleGroupItem>
      </ToggleGroup>

      {view === "list" ? (
        <FacilitiesTree />
      ) : (
        <FacilitiesMapView role={role} list={<FacilitiesTree />} />
      )}
    </div>
  );
}

function FacilitiesTree() {
  const t = useTranslations("facilities");
  const { status, sites, equipmentIn } = useFacilities();

  if (!hasRecords(status)) {
    // Never an empty tree while the store is unread: no places and no answer
    // are different claims, and only one of them is true at that moment.
    return <DataTableSkeleton columns={3} />;
  }

  if (sites.length === 0) return <ModulePanel moduleKey="facilities" />;

  return (
    <section className="flex flex-col gap-1" aria-label={t("caption")}>
      <ul className="flex flex-col gap-1">
        {sites.map((site) => (
          <li key={site.id}>
            <Node node={site} equipmentIn={equipmentIn} />
          </li>
        ))}
      </ul>
    </section>
  );
}
