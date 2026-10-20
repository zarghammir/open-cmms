"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  assignablePeople,
  rolesNotAssignable,
} from "@/data/selectors/assignable";
import { can, type Role } from "@/domain/constants/roles";
import {
  workOrderCreateSchema,
  type WorkOrderCreateInput,
} from "@/domain/schemas/work-order";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_TYPES,
} from "@/domain/types/work-order";
import { useActor, useRepositories } from "@/hooks/use-demo-data";
import { useSaving } from "@/hooks/use-saving";
import { contentLanguageFor, textFor } from "@/lib/localized-text";
import { PermissionDeniedState } from "@/components/shared/state-panels";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { Field, Select, Textarea } from "./field";

function emptyForm(contentLanguage: "en" | "fr"): WorkOrderCreateInput {
  return {
    title: "",
    description: "",
    contentLanguage,
    assetId: "",
    type: "corrective",
    priority: "medium",
    dueOn: null,
    estimatedMinutes: null,
    assignedUserId: null,
  };
}

/**
 * Raising a work order.
 *
 * Zod decides whether the form is filled in; the repository decides whether the
 * order may exist and writes the audit entry. Keeping those apart is what stops
 * the rules living in a screen, where the next screen would have to repeat
 * them.
 *
 * The title and the description are typed once, in whichever language the
 * person raising the order works in. Interface text is translated; a person's
 * own words are not, and asking a technician in a mechanical room to write
 * their request twice would be friction rather than bilingualism.
 *
 * The record still carries a slot per language, so the same words go in both
 * and `contentLanguage` records which language they are. A reader of the other
 * language is told what they are looking at rather than shown it as though it
 * were theirs.
 */
export function CreateWorkOrderForm({
  role,
  /** Asset tag to start with, from a row action on the assets table. */
  presetAssetTag,
  onRaised,
}: {
  role: Role;
  presetAssetTag?: string;
  /**
   * Called once the order is **stored**, never when it is merely submitted.
   *
   * WA-90 raises work from the floor map, in a dialog over the plan, and the
   * dialog closes on this. That is the same rule the other write dialogs
   * follow: the screen updating is not the write landing, so a dialog that
   * closed on submit would tell somebody their order was raised while the
   * device was still refusing to store it. Below, this fires after `stored`
   * and after the form has been reset, on the same branch as the toast.
   */
  onRaised?: (number: string) => void;
}) {
  const t = useTranslations("workOrderForm");
  const tValidation = useTranslations("validation");
  const tType = useTranslations("workOrderType");
  const tPriority = useTranslations("priority");
  const tRoles = useTranslations("roles");
  const locale = useLocale();
  const language = contentLanguageFor(locale);
  const { status, repositories } = useRepositories();
  const actor = useActor(role);
  const { saving, save } = useSaving();
  /*
   * Where focus goes when the fields come back.
   *
   * A `disabled` fieldset blurs whatever is inside it, so pressing Enter in the
   * Title field sent focus to `document.body` and nothing put it back: a
   * keyboard user raising orders one after another started each one by tabbing
   * from the top of the document. Measured by the review against the head
   * before the fieldset, where focus stayed on the field throughout.
   *
   * The id is taken before the write, and restored after the fields are live
   * again — from an effect rather than inline, because `.focus()` on a control
   * that is still disabled does nothing at all, and the re-enabling render has
   * not happened yet when `onSubmit` resumes.
   *
   * Succeeded: focus goes to the Title field, which is where a person starts
   * the next order on an empty form. Failed: focus goes back where they were,
   * because the form still holds what they typed.
   *
   * A fresh object per request, not a bare string, and not cleared in the
   * effect. Clearing it there cascades a render; and a plain string would not
   * change identity when two orders in a row both ask for `wo-title`, so the
   * effect's dependencies would be unchanged and the second one would never
   * get its focus back — which is the very case this exists for.
   */
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (saving || !focusRequest) return;
    document.getElementById(focusRequest.id)?.focus();
  }, [saving, focusRequest]);

  const tSaving = useTranslations("states.saving");

  const form = useForm<WorkOrderCreateInput>({
    resolver: zodResolver(workOrderCreateSchema),
    defaultValues: emptyForm(language),
    mode: "onSubmit",
  });

  const assets = repositories?.assets.list({ status: ["active"] }) ?? [];
  /*
   * Who may be given this work, from the rule both assignee lists share.
   *
   * This select offered everybody, including the auditor — the one role that
   * may not change anything — so the form invited a coordinator to hand work
   * to a person who could never finish it. `assignablePeople` answers with
   * `workOrder.complete`, and `rolesNotAssignable` is what the hint says, so
   * the people left out are named rather than quietly missing.
   */
  const everyone = repositories?.users.list() ?? [];
  const people = assignablePeople(everyone);
  const omitted = rolesNotAssignable(everyone);

  // A row action on the assets table arrives here with a tag in the address.
  useEffect(() => {
    if (!presetAssetTag || !repositories) return;
    const asset = repositories.assets.byTag(presetAssetTag);
    if (asset) form.setValue("assetId", asset.id);
  }, [presetAssetTag, repositories, form]);

  /**
   * Three answers, not two.
   *
   * No tag in the address is nothing to say. A tag that resolves preselects the
   * equipment. A tag that does not resolve is neither of those, and leaving the
   * field blank for it would make a broken link look exactly like an ordinary
   * visit — the reader would fill the form in by hand and never learn that the
   * address named equipment this organisation does not have.
   *
   * It stops being worth saying the moment they choose something themselves.
   */
  // `useWatch` rather than `form.watch`: the latter cannot be memoized safely
  // and the React lint rules say so.
  const chosenAssetId = useWatch({ control: form.control, name: "assetId" });
  const presetTagIsUnknown =
    Boolean(presetAssetTag) &&
    status === "ready" &&
    repositories !== null &&
    !repositories.assets.byTag(presetAssetTag as string) &&
    !chosenAssetId;

  if (!can(role, "workOrder.create")) {
    return <PermissionDeniedState roleName={tRoles(`${role}.name`)} />;
  }

  if (status !== "ready" || !repositories) {
    // A skeleton rather than a form with a dead submit button. The disabled
    // button was also an accessibility failure — white on a washed-out primary
    // is 2.86:1 — and it only existed during loading, so it was the kind of
    // violation that appears in one continuous integration run and not the
    // next. Not drawing it at all fixes the contrast and the dead end together.
    return <DataTableSkeleton rows={4} columns={2} />;
  }

  /** Turns a schema message key into a sentence. */
  function message(key: string | undefined): string | undefined {
    if (!key) return undefined;
    const short = key.replace(/^validation\./, "");
    return tValidation(short as Parameters<typeof tValidation>[0]);
  }

  async function onSubmit(values: WorkOrderCreateInput) {
    if (!repositories) return;

    const wasFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.id
        : "";

    const result = await save(() =>
      repositories.workOrders.create(values, actor),
    );
    // The form keeps what was typed when the change did not reach the device.
    // Clearing it would throw away the only remaining copy of the work the
    // person just described.
    if (!result.stored) {
      // The form kept what was typed, so put the person back in it.
      setFocusRequest({ id: wasFocused || "wo-title" });
      return;
    }
    toast.success(t("created", { number: result.value.number }));
    form.reset(emptyForm(language));
    setFocusRequest({ id: "wo-title" });
    onRaised?.(result.value.number);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
          {/*
           * A fieldset, and it is not decoration: it closes a window in which a
           * person's typing was thrown away.
           *
           * WA-67 made the submit wait for the browser to store the change, and
           * `onSubmit` clears the form afterwards. Only the button was disabled
           * while that happened, so the fields stayed live — and anything typed
           * into them was wiped by the reset when the write landed. A
           * technician starting the next order while the last one saves would
           * lose it, on exactly the slow storage that makes "Saving…" last long
           * enough to invite the typing.
           *
           * `disabled` on a fieldset disables every control inside it, which is
           * the whole window rather than the one control somebody remembered.
           * The grid moves here so the layout is unchanged by construction —
           * same classes, same position — rather than relying on
           * `display: contents`, which would fail invisibly if it were not
           * honoured. `min-w-0` because a fieldset's default
           * `min-inline-size: min-content` is not reset by preflight and would
           * otherwise stop the grid from shrinking.
           */}
          <fieldset
            disabled={saving}
            aria-busy={saving}
            className="grid min-w-0 gap-4 sm:grid-cols-2"
          >
            <Field
              id="wo-asset"
              label={t("fields.asset")}
              error={
                message(form.formState.errors.assetId?.message) ??
                (presetTagIsUnknown
                  ? t("fields.assetNotFound", { tag: presetAssetTag ?? "" })
                  : undefined)
              }
            >
              {(props) => (
                <Select {...props} {...form.register("assetId")}>
                  <option value="">{t("fields.chooseAsset")}</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.assetTag} — {textFor(asset.name, locale)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              id="wo-assignee"
              label={t("fields.assignee")}
              hint={
                omitted.length > 0
                  ? t("fields.notAssignableHint", {
                      roles: omitted
                        .map((role) => tRoles(`${role}.name`))
                        .join(", "),
                    })
                  : undefined
              }
              error={message(form.formState.errors.assignedUserId?.message)}
            >
              {(props) => (
                <Select
                  {...props}
                  {...form.register("assignedUserId", {
                    setValueAs: (value: unknown) =>
                      value === "" || value === null || value === undefined
                        ? null
                        : String(value),
                  })}
                >
                  <option value="">{t("fields.unassigned")}</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              id="wo-type"
              label={t("fields.type")}
              error={message(form.formState.errors.type?.message)}
            >
              {(props) => (
                <Select {...props} {...form.register("type")}>
                  {WORK_ORDER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {tType(type)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              id="wo-priority"
              label={t("fields.priority")}
              error={message(form.formState.errors.priority?.message)}
            >
              {(props) => (
                <Select {...props} {...form.register("priority")}>
                  {WORK_ORDER_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {tPriority(priority)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              id="wo-due"
              label={t("fields.dueOn")}
              error={message(form.formState.errors.dueOn?.message)}
            >
              {(props) => (
                <Input
                  type="date"
                  className="h-8"
                  {...props}
                  {...form.register("dueOn", {
                    setValueAs: (value: unknown) =>
                      value === "" || value === null || value === undefined
                        ? null
                        : String(value),
                  })}
                />
              )}
            </Field>

            <Field
              id="wo-minutes"
              label={t("fields.estimatedMinutes")}
              error={message(form.formState.errors.estimatedMinutes?.message)}
            >
              {(props) => (
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="h-8"
                  {...props}
                  {...form.register("estimatedMinutes", {
                    // An empty optional number must arrive as null, not as 0.
                    // `Number("")` is 0, which the schema then refuses for being
                    // less than one — so leaving the field blank was rejected
                    // with a message about a number nobody had typed.
                    setValueAs: (value: unknown) => {
                      if (
                        value === "" ||
                        value === null ||
                        value === undefined
                      ) {
                        return null;
                      }
                      const parsed = Number(value);
                      return Number.isNaN(parsed) ? null : parsed;
                    },
                  })}
                />
              )}
            </Field>

            <Field
              id="wo-title"
              label={t("fields.title")}
              hint={t("fields.contentLanguageHint")}
              error={message(form.formState.errors.title?.message)}
              className="sm:col-span-2"
            >
              {(props) => (
                <Input className="h-8" {...props} {...form.register("title")} />
              )}
            </Field>

            <Field
              id="wo-description"
              label={t("fields.description")}
              className="sm:col-span-2"
              error={message(form.formState.errors.description?.message)}
            >
              {(props) => (
                <Textarea
                  rows={3}
                  {...props}
                  {...form.register("description")}
                />
              )}
            </Field>

            <input type="hidden" {...form.register("contentLanguage")} />

            <div className="sm:col-span-2">
              <Button type="submit" aria-busy={saving}>
                <Plus data-icon="inline-start" />
                {saving ? tSaving("label") : t("submit")}
              </Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
