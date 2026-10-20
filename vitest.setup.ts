import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

/**
 * Testing Library empties the document after each test through a global
 * `afterEach`. This project runs Vitest without globals, so nothing ever
 * registered it: every render stayed on screen for the next test in the file,
 * and a query that should have found one element found two — or found the
 * previous test's markup and passed on it.
 *
 * Registered here rather than per file so that a new component test cannot
 * forget. Every test file loads this setup, including the eighteen that run in
 * the node environment; `cleanup` there has no mounted container to unmount and
 * does nothing, which was checked by running the whole suite rather than
 * assumed. Comment the line out and five tests fail immediately, which is how
 * the defect was found in the first place.
 */
afterEach(cleanup);
