/**
 * The five steps, in order, and what each one needs before it can be reached.
 *
 * Kept out of the component so the rule "you cannot preview before the columns
 * are matched" is a fact about the import rather than a detail of how the
 * screen happens to be wired.
 */

export const IMPORT_STEPS = [
  "upload",
  "map",
  "report",
  "preview",
  "commit",
] as const;
export type ImportStep = (typeof IMPORT_STEPS)[number];

export interface StepReadiness {
  /** A file has been read and at least one sheet recognised. */
  hasSheets: boolean;
  /** Every required field has a column behind it, on every sheet. */
  mappingComplete: boolean;
  /** The rows have been read and the report built. */
  hasRun: boolean;
  /** The import has been written. */
  committed: boolean;
}

/**
 * Whether a step can be opened yet.
 *
 * Deliberately not "has the person clicked this far": going back and changing a
 * mapping invalidates the report, so reachability is asked of the state rather
 * than of a furthest-reached marker that would let a stale report be reopened.
 */
export function canReach(step: ImportStep, state: StepReadiness): boolean {
  switch (step) {
    case "upload":
      return true;
    case "map":
      return state.hasSheets;
    case "report":
      return state.hasSheets && state.mappingComplete;
    case "preview":
      return state.hasSheets && state.mappingComplete && state.hasRun;
    case "commit":
      return (
        state.hasSheets &&
        state.mappingComplete &&
        state.hasRun &&
        !state.committed
      );
  }
}

/** The furthest step the current state allows, for "Continue". */
export function furthestReachable(state: StepReadiness): ImportStep {
  let furthest: ImportStep = "upload";
  for (const step of IMPORT_STEPS) {
    if (canReach(step, state)) furthest = step;
  }
  return furthest;
}

export function stepIndex(step: ImportStep): number {
  return IMPORT_STEPS.indexOf(step);
}

/** The step before this one, or null at the start. */
export function previousStep(step: ImportStep): ImportStep | null {
  const index = stepIndex(step);
  return index <= 0 ? null : (IMPORT_STEPS[index - 1] ?? null);
}

/** The next step, when the state allows it. Null when it does not. */
export function nextStep(
  step: ImportStep,
  state: StepReadiness,
): ImportStep | null {
  const candidate = IMPORT_STEPS[stepIndex(step) + 1];
  if (!candidate) return null;
  return canReach(candidate, state) ? candidate : null;
}
