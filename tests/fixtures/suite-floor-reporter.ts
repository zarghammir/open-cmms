import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import {
  floorVerdict,
  gatesOf,
  type ParkedNote,
  type TestRecord,
} from "./suite-floor";

/**
 * Prints the collected and executed counts side by side, and fails the run when
 * a test disappeared without a gate to explain it.
 *
 * Registered after the list reporter so its line is the last thing on screen,
 * which is where somebody reads a total.
 */
export default class SuiteFloorReporter implements Reporter {
  private tests: TestRecord[] = [];
  private ran = new Set<string>();
  private parked = new Map<string, ParkedNote>();
  private cache = new Map<string, readonly string[]>();

  onBegin(_config: FullConfig, suite: Suite): void {
    this.tests = suite.allTests().map((t: TestCase) => ({
      file: t.location.file,
      title: t.titlePath().filter(Boolean).join(" › "),
      ran: false,
    }));
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // "Ran" means Playwright executed the body. A skip — whether from a gate or
    // from anything else — is what this counts, so `skipped` is the status that
    // matters and every other status is a run.
    const title = test.titlePath().filter(Boolean).join(" › ");
    if (result.status !== "skipped") {
      this.ran.add(title);
      return;
    }
    // `test.fixme()` is a declared, permanent absence. Playwright carries it
    // as an annotation with the line it was written on and whatever the park
    // said, so both are read from the annotation rather than from the source.
    // The description is where the ticket has to be; a park without one is not
    // a declaration and the verdict treats it as unexplained.
    const fixme = test.annotations.find((a) => a.type === "fixme");
    if (fixme) {
      const at = fixme.location
        ? `${fixme.location.file.split("/").slice(-2).join("/")}:${fixme.location.line}`
        : "unknown location";
      this.parked.set(title, { at, description: fixme.description });
    }
  }

  onEnd(result: FullResult): void | Promise<void> {
    const tests = this.tests.map((t) => ({ ...t, ran: this.ran.has(t.title) }));

    const gatesFor = (file: string): readonly string[] => {
      const hit = this.cache.get(file);
      if (hit) return hit;
      let gates: readonly string[] = [];
      try {
        gates = gatesOf(file);
      } catch {
        // A file we cannot read is not a file we may excuse.
        gates = [];
      }
      this.cache.set(file, gates);
      return gates;
    };

    const verdict = floorVerdict(tests, gatesFor, process.env, this.parked);
    console.log("\n" + verdict.line);

    if (verdict.parked.length) {
      console.log(
        "parked with test.fixme(), so never run, each with its ticket:",
      );
      for (const { title, at, ticket } of verdict.parked)
        console.log(`  ${title}  (${ticket}, ${at})`);
    }

    if (verdict.unexplained.length) {
      console.log(
        "these tests were collected and never ran, and no gate explains them:",
      );
      for (const name of verdict.unexplained.slice(0, 40)) {
        console.log("  " + name);
      }
      if (verdict.unexplained.length > 40) {
        console.log(`  …and ${verdict.unexplained.length - 40} more`);
      }
      // The cheapest way to make this line go away is to take the reporter out
      // of playwright.config.ts, which restores exactly the silence the line
      // exists to break. Say so where it is read.
      console.log(
        "a parked test names its ticket; removing this reporter is not the fix",
      );
    }

    if (!verdict.ok && result.status === "passed") {
      // The whole point: a green run that did not run everything is not green.
      result.status = "failed";
    }
  }
}
