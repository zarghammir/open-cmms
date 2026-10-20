"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CircleCheck,
  CirclePause,
  CirclePlay,
  CircleX,
  Clock,
  UserPlus,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { CapabilityAction } from "@/components/shared/capability-action";
import { RuleBlockedAction } from "./rule-blocked-action";
import { IssuePartDialog } from "@/components/work-orders/issue-part-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, Select, Textarea } from "@/components/work-orders/field";
import {
  assignablePeople,
  rolesNotAssignable,
} from "@/data/selectors/assignable";
import type { Role } from "@/domain/constants/roles";
import { fullName } from "@/domain/types/user";
import {
  workOrderAssignSchema,
  workOrderCancelSchema,
  workOrderCompleteSchemaFor,
  type WorkOrderAssignInput,
  type WorkOrderCancelInput,
  type WorkOrderCompleteInput,
} from "@/domain/schemas/work-order";
import { CANCELLATION_REASONS } from "@/domain/types/work-order";
import type { WorkOrder } from "@/domain/types";
import {
  transitionAvailability,
  isTerminal,
  TransitionRefusedError,
} from "@/domain/constants/work-order-status";
import { useActor, useRepositories } from "@/hooks/use-demo-data";
import { useSaving } from "@/hooks/use-saving";
import { contentLanguageFor } from "@/lib/localized-text";

/**
 * What a person can do to a work order, on the order's own page.
 *
 * Every control is gated by `CapabilityAction`, so a role that may not use one
 * is told which role it is holding rather than shown a screen with a hole in
 * it. And every control is offered only when the status rules allow it —
 * `canTransition` decides, the same function the repository refuses with, so a
 * button is never drawn for a move that would be rejected the moment it was
 * pressed.
 *
 * Those two gates answer different questions and both are needed. "You may not
 * do this" and "this order cannot do this" are different sentences, and a
 * screen that ran them together would tell a technician they lack a permission
 * when what is true is that the work is already finished.
 */
export function WorkOrderActions({
  order,
  role,
}: {
  order: WorkOrder;
  role: Role;
}) {
  const t = useTranslations("workOrderDetail.write");
  const tStatus = useTranslations("workOrderStatus");
  const { repositories } = useRepositories();
  const actor = useActor(role);
  // Only `save` here: this bar's controls are `ConfirmDialog`s, and the saving
  // state a person sees belongs to the button they are actually looking at,
  // which is the one inside the confirmation.
  const { save } = useSaving();

  if (!repositories) return null;

  /**
   * Runs a write and says what happened.
   *
   * A refusal from the repository is shown rather than swallowed. The rules
   * live there precisely so every route meets them, and a screen that caught
   * the error and did nothing would turn "this order cannot do that" into a
   * button that appears to be broken.
   */
  async function attempt(work: () => void): Promise<boolean> {
    try {
      // The status chip changing *is* this control's "done" — there is no
      // toast behind it — so it must not change before the browser has stored
      // the move. `save` answers false when it could not, and the confirmation
      // stays open behind the standing message rather than closing on a change
      // that is not on the device.
      return (await save(work)).stored;
    } catch (error) {
      if (error instanceof TransitionRefusedError) {
        toast.error(t("refused", { status: tStatus(order.status) }));
        return false;
      }
      throw error;
    }
  }

  /*
   * The organisation's rules, read through the repository like any other
   * record. Null before the store has answered, which `transitionAvailability`
   * reads as "the application's own flow" rather than as a guess in either
   * direction — the screen has already returned above if the repositories are
   * not there at all.
   */
  const rules = repositories.settings.workflowRules();

  /**
   * Whether this order may make a move, and if not, which gate stopped it.
   *
   * Three answers rather than a boolean: a control the flow has no edge for is
   * not drawn at all — a finished order offering a disabled "Start work" would
   * be claiming somebody withheld something — while a control an administrator
   * switched off stays on screen, disabled, and says so.
   */
  const availability = (to: WorkOrder["status"]) =>
    transitionAvailability(rules, order.status, to);

  const move = (to: WorkOrder["status"]) => () =>
    attempt(() => {
      repositories.workOrders.transition(order.id, to, actor);
    });

  return (
    /*
      Forty-four pixels on a phone, and only on a phone.
      
      These are `size="sm"` buttons, which is right at a desk and about
      thirty-two pixels tall — under the target a person wearing gloves in a
      plant room can reliably hit. `max-sm:` raises every control in the bar at
      once, including the ones the dialogs bring, so a control added here later
      cannot quietly miss it; and it leaves the desk layout untouched, which is
      why no desktop picture moves.
    */
    <div
      data-slot="work-order-actions"
      className="flex flex-wrap items-center gap-2 max-sm:[&_button]:min-h-11"
    >
      {availability("inProgress") === "notInFlow" ? null : availability(
          "inProgress",
        ) === "turnedOff" ? (
        <RuleBlockedAction
          label={t(
            order.status === "waitingForParts"
              ? "actions.resume"
              : "actions.start",
          )}
          icon={<CirclePlay data-icon="inline-start" />}
        />
      ) : (
        <CapabilityAction
          role={role}
          capability="workOrder.complete"
          label={t(
            order.status === "waitingForParts"
              ? "actions.resume"
              : "actions.start",
          )}
          icon={<CirclePlay data-icon="inline-start" />}
        >
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="outline">
                <CirclePlay data-icon="inline-start" />
                {t(
                  order.status === "waitingForParts"
                    ? "actions.resume"
                    : "actions.start",
                )}
              </Button>
            }
            title={t(
              order.status === "waitingForParts"
                ? "actions.resume"
                : "actions.start",
            )}
            description={t(
              order.status === "waitingForParts"
                ? "consequence.resume"
                : "consequence.start",
            )}
            confirmLabel={t(
              order.status === "waitingForParts"
                ? "actions.resume"
                : "actions.start",
            )}
            onConfirm={move("inProgress")}
          />
        </CapabilityAction>
      )}

      {availability("waitingForParts") === "notInFlow" ? null : availability(
          "waitingForParts",
        ) === "turnedOff" ? (
        <RuleBlockedAction
          label={t("actions.pause")}
          icon={<CirclePause data-icon="inline-start" />}
        />
      ) : (
        <CapabilityAction
          role={role}
          capability="workOrder.complete"
          label={t("actions.pause")}
          icon={<CirclePause data-icon="inline-start" />}
        >
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="outline">
                <CirclePause data-icon="inline-start" />
                {t("actions.pause")}
              </Button>
            }
            title={t("actions.pause")}
            description={t("consequence.pause")}
            confirmLabel={t("actions.pause")}
            onConfirm={move("waitingForParts")}
          />
        </CapabilityAction>
      )}

      {availability("completed") === "notInFlow" ? null : availability(
          "completed",
        ) === "turnedOff" ? (
        <RuleBlockedAction
          label={t("actions.complete")}
          icon={<CircleCheck data-icon="inline-start" />}
        />
      ) : (
        <CapabilityAction
          role={role}
          capability="workOrder.complete"
          label={t("actions.complete")}
          icon={<CircleCheck data-icon="inline-start" />}
        >
          <CompleteDialog order={order} role={role} />
        </CapabilityAction>
      )}

      {/*
        Assigning is not a status move, so it is not gated on `canTransition`.
        It is offered while the order can still be worked — handing a completed
        or cancelled order to somebody would be asking them to do nothing.
      */}
      {isTerminal(order.status) ? null : (
        <CapabilityAction
          role={role}
          capability="workOrder.assign"
          label={t("actions.assign")}
          icon={<UserPlus data-icon="inline-start" />}
        >
          <AssignDialog order={order} role={role} />
        </CapabilityAction>
      )}

      {availability("cancelled") === "notInFlow" ? null : availability(
          "cancelled",
        ) === "turnedOff" ? (
        <RuleBlockedAction
          label={t("actions.cancel")}
          icon={<CircleX data-icon="inline-start" />}
        />
      ) : (
        <CapabilityAction
          role={role}
          capability="workOrder.cancel"
          label={t("actions.cancel")}
          icon={<CircleX data-icon="inline-start" />}
        >
          <CancelDialog order={order} role={role} />
        </CapabilityAction>
      )}

      <CapabilityAction
        role={role}
        capability="workOrder.complete"
        label={t("actions.logTime")}
        icon={<Clock data-icon="inline-start" />}
      >
        <LogTimeDialog order={order} role={role} />
      </CapabilityAction>

      {/*
        Issuing a part is gated on `inventory.issue`, not on `workOrder.complete`:
        they are different permissions held by different roles, and folding them
        together would let "may finish the job" decide "may take stock out of
        the store". `IssuePartDialog` carries its own gate for that reason.

        Only while the order can still receive work. A completed or cancelled
        order taking stock would be a movement against a job nobody is doing.
      */}
      {isTerminal(order.status) ? null : (
        <IssuePartDialog order={order} role={role} />
      )}
    </div>
  );
}

/** Turns a schema message key into a sentence, the way the create form does. */
function useMessage() {
  const tValidation = useTranslations("validation");
  return (key: string | undefined): string | undefined => {
    if (!key) return undefined;
    const short = key.replace(/^validation\./, "");
    return tValidation(short as Parameters<typeof tValidation>[0]);
  };
}

/**
 * Finishing an order: how long it took, and what the next person needs to know.
 *
 * A form rather than a confirmation, because both answers are required and a
 * confirmation has nowhere to put them. The consequence is still said in the
 * description — a completed order cannot be reopened, which the status map
 * makes true rather than the wording.
 */
function CompleteDialog({ order, role }: { order: WorkOrder; role: Role }) {
  const t = useTranslations("workOrderDetail.write.complete");
  const tWrite = useTranslations("workOrderDetail.write");
  const { repositories } = useRepositories();
  const actor = useActor(role);
  const { saving, save } = useSaving();
  const tSaving = useTranslations("states.saving");
  const locale = useLocale();
  const message = useMessage();
  const [open, setOpen] = useState(false);
  /*
   * Defaults to required while the records are still being read. That is the
   * application's own behaviour and the safer of the two answers: a form that
   * assumed optional for a moment would let a note-less completion through in
   * the one instant nobody could have configured anything.
   */
  const requireNote =
    repositories?.settings.workflowRules()?.requireCompletionNote ?? true;

  const form = useForm<WorkOrderCompleteInput>({
    // The same record the repository reads, so the form and the write
    // cannot disagree about whether a note is needed.
    resolver: zodResolver(workOrderCompleteSchemaFor(requireNote)),
    defaultValues: {
      actualMinutes: 30,
      note: "",
      contentLanguage: contentLanguageFor(locale),
    },
    mode: "onSubmit",
  });

  async function onSubmit(values: WorkOrderCompleteInput) {
    if (!repositories) return;
    const { stored } = await save(() => {
      repositories.workOrders.complete(
        order.id,
        {
          minutes: values.actualMinutes,
          note: values.note,
          contentLanguage: values.contentLanguage,
        },
        actor,
      );
    });
    // `save` has already said what went wrong. Leaving the dialog open is the
    // rest of that sentence: the work is not recorded, so the form that would
    // record it stays where it is.
    if (!stored) return;
    toast.success(
      t("done", { number: order.number, minutes: values.actualMinutes }),
    );
    setOpen(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CircleCheck data-icon="inline-start" />
          {tWrite("actions.complete")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { number: order.number })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
        >
          <Field
            id="wo-complete-minutes"
            label={t("minutes")}
            hint={t("minutesHint")}
            error={message(form.formState.errors.actualMinutes?.message)}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={1}
                {...form.register("actualMinutes", { valueAsNumber: true })}
              />
            )}
          </Field>
          <Field
            id="wo-complete-note"
            label={t("note")}
            hint={t("noteHint")}
            error={message(form.formState.errors.note?.message)}
          >
            {(props) => (
              <Textarea {...props} rows={3} {...form.register("note")} />
            )}
          </Field>
          <DialogFooter>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? tSaving("label") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Calling an order off.
 *
 * The reason is required by the schema and by the repository, and it is a key
 * rather than free text so the trail reads in both languages. The note is the
 * detail beside it, never the record of the decision.
 */
function CancelDialog({ order, role }: { order: WorkOrder; role: Role }) {
  const t = useTranslations("workOrderDetail.write.cancel");
  const tWrite = useTranslations("workOrderDetail.write");
  const tReason = useTranslations("cancellationReason");
  const { repositories } = useRepositories();
  const actor = useActor(role);
  const { saving, save } = useSaving();
  const tSaving = useTranslations("states.saving");
  const message = useMessage();
  const [open, setOpen] = useState(false);

  const form = useForm<WorkOrderCancelInput>({
    resolver: zodResolver(workOrderCancelSchema),
    defaultValues: { reasonKey: "noLongerRequired", note: null },
    mode: "onSubmit",
  });

  async function onSubmit(values: WorkOrderCancelInput) {
    if (!repositories) return;
    const { stored } = await save(() => {
      repositories.workOrders.transition(order.id, "cancelled", actor, {
        key: values.reasonKey,
        note: values.note?.trim() ? values.note.trim() : null,
      });
    });
    if (!stored) return;
    toast.success(t("done", { number: order.number }));
    setOpen(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CircleX data-icon="inline-start" />
          {tWrite("actions.cancel")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { number: order.number })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
        >
          <Field
            id="wo-cancel-reason"
            label={t("reason")}
            error={message(form.formState.errors.reasonKey?.message)}
          >
            {(props) => (
              <Select {...props} {...form.register("reasonKey")}>
                {CANCELLATION_REASONS.filter(
                  // The importer's reason, not a person's. Offering it would
                  // let somebody record that a source system had no reason for
                  // a decision they are making themselves.
                  (reason) => reason !== "notRecordedInSource",
                ).map((reason) => (
                  <option key={reason} value={reason}>
                    {tReason(reason)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            id="wo-cancel-note"
            label={t("note")}
            hint={t("noteHint")}
            error={message(form.formState.errors.note?.message)}
          >
            {(props) => (
              <Textarea {...props} rows={2} {...form.register("note")} />
            )}
          </Field>
          <DialogFooter>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? tSaving("label") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Handing the work to a person.
 *
 * The repository could always do this — `assign(id, userId, actor)` has been
 * there since the queue was built, writing the assignment, the status move it
 * implies and the notice in one commit. Nothing rendered a control for it, so
 * the only way an order could change hands was to raise it again. WA-88 is
 * that control and nothing else: no new write path, no second definition of
 * what assigning means.
 *
 * People at this order's site come first. An order is at one building and most
 * of the people who can go and look at it are too, so a list that opens
 * alphabetically across five sites asks the coordinator to do the filtering
 * the screen already knows how to do. Everyone else is still there, under a
 * heading, because "who can I give this to" is occasionally answered by
 * somebody from another site.
 */
function AssignDialog({ order, role }: { order: WorkOrder; role: Role }) {
  const t = useTranslations("workOrderDetail.write.assign");
  const tWrite = useTranslations("workOrderDetail.write");
  // The role names come from the roles catalogue, the one source every screen
  // names a role from, so the hint cannot call a role something else.
  const tRoles = useTranslations("roles");
  const { repositories } = useRepositories();
  const actor = useActor(role);
  const { saving, save } = useSaving();
  const tSaving = useTranslations("states.saving");
  const message = useMessage();
  const [open, setOpen] = useState(false);

  /*
   * The person already holding it is not offered.
   *
   * Handing work to whoever already has it is not a change, and the trail
   * should not carry an entry describing one. Two ways to prevent that: the
   * repository refuses, or the interface does not offer it. The interface,
   * because a refusal needs an error path and a message for a case a select
   * can simply not contain — and because the repository must stay able to
   * express it, since an import or a seed may legitimately re-state an
   * assignment that has not changed.
   *
   * The repository's own test still asserts it does not LIE about that case:
   * assigning the current holder again is recorded as an assignment, never as
   * a handover from somebody to themselves.
   */
  const holder = repositories?.workOrders.assignmentFor(order.id)?.userId;
  /*
   * The same rule the create form uses, from the same place. This dialog
   * filtered out the current holder and nothing else, so it offered the
   * auditor too — and two surfaces choosing an assignee by two different
   * rules is how one of them ends up wrong without the other noticing.
   */
  const everyone = repositories?.users.list() ?? [];
  const people = assignablePeople(everyone).filter(
    (person) => person.id !== holder,
  );
  const omitted = rolesNotAssignable(everyone);
  const here = people.filter(
    (person) => person.homeFacilityId === order.facilityId,
  );
  const elsewhere = people.filter(
    (person) => person.homeFacilityId !== order.facilityId,
  );

  const form = useForm<WorkOrderAssignInput>({
    resolver: zodResolver(workOrderAssignSchema),
    defaultValues: { assignedUserId: "" },
    mode: "onSubmit",
  });

  async function onSubmit(values: WorkOrderAssignInput) {
    if (!repositories) return;
    const person = people.find(
      (candidate) => candidate.id === values.assignedUserId,
    );
    const { stored } = await save(() => {
      repositories.workOrders.assign(order.id, values.assignedUserId, actor);
    });
    if (!stored) return;
    toast.success(
      t("done", {
        number: order.number,
        name: person ? fullName(person) : values.assignedUserId,
      }),
    );
    setOpen(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus data-icon="inline-start" />
          {tWrite("actions.assign")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { number: order.number })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
        >
          <Field
            id="wo-assign-assignee"
            label={t("assignee")}
            hint={
              omitted.length > 0
                ? t("notAssignableHint", {
                    roles: omitted
                      .map((role) => tRoles(`${role}.name`))
                      .join(", "),
                  })
                : undefined
            }
            error={message(form.formState.errors.assignedUserId?.message)}
          >
            {(props) => (
              <Select {...props} {...form.register("assignedUserId")}>
                {/*
                  An empty VALUE, but not an empty option.

                  No preselected person, because the schema requires a choice
                  and preselecting one would let a distracted press hand the
                  work to whoever happened to sort first. The label is there
                  because without it the closed select draws as a blank box —
                  which looks like a control that failed to load rather than
                  one waiting for an answer. Found by looking at the
                  screenshot; every assertion was green. The create form's own
                  assignee select has labelled its empty option all along.
                */}
                <option value="">{t("choose")}</option>
                {here.length > 0 ? (
                  <optgroup label={t("atThisSite")}>
                    {here.map((person) => (
                      <option key={person.id} value={person.id}>
                        {fullName(person)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {elsewhere.length > 0 ? (
                  <optgroup label={t("elsewhere")}>
                    {elsewhere.map((person) => (
                      <option key={person.id} value={person.id}>
                        {fullName(person)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </Select>
            )}
          </Field>
          <DialogFooter>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? tSaving("label") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Time on an order that is not finishing, which is most of the time logged. */
function LogTimeDialog({ order, role }: { order: WorkOrder; role: Role }) {
  const t = useTranslations("workOrderDetail.write.logTime");
  const tWrite = useTranslations("workOrderDetail.write");
  const tComplete = useTranslations("workOrderDetail.write.complete");
  const { repositories } = useRepositories();
  const actor = useActor(role);
  const { saving, save } = useSaving();
  const tSaving = useTranslations("states.saving");
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(30);

  async function submit() {
    if (!repositories || minutes <= 0) return;
    const { stored } = await save(() => {
      repositories.workOrders.logLabour(order.id, { minutes }, actor);
    });
    if (!stored) return;
    toast.success(t("done", { number: order.number, minutes }));
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Clock data-icon="inline-start" />
          {tWrite("actions.logTime")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title", { number: order.number })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Field id="wo-log-minutes" label={tComplete("minutes")}>
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={1}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          )}
        </Field>
        <DialogFooter>
          <Button
            size="sm"
            onClick={() => void submit()}
            disabled={minutes <= 0 || saving}
            aria-busy={saving}
          >
            {saving ? tSaving("label") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
