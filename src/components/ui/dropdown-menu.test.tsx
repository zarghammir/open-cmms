// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/**
 * An open menu does not tell a screen reader the rest of the page is gone.
 *
 * Radix's menu is modal by default, and `MenuRootContentModal` calls
 * `hideOthers(content)` — verified in the installed source at
 * `@radix-ui/react-menu/dist/index.js:203`, which is the only place that
 * function is called. Everything outside the menu is marked `aria-hidden` and
 * stays focusable: the skip link, the module rail, and the trigger itself. A
 * keyboard reaches what a screen reader has been told is not there. axe calls
 * it `aria-hidden-focus`, serious, and it has been true of every menu in the
 * application since WA-9 — the site filter, the notifications and user menus,
 * the row actions and all four registers' facet filters — because no scan had
 * ever opened a menu.
 *
 * **What this test does not do, on purpose.** The obvious reading was that the
 * dialog gets this right and the menu should copy it. It does not: the dialog
 * calls the same `hideOthers` (`react-dialog` line 145) and produces the same
 * markup. It passes because axe's `aria-hidden-focus` exempts a visible
 * `[aria-modal=true]`, which a Radix dialog is and a menu is not. Giving a
 * filter menu `aria-modal` would silence the checker and tell a lie about the
 * control, so the fix is the other way: a menu is not modal (the WAI-ARIA menu
 * button pattern says so), and a non-modal menu never hides anything.
 *
 * The assertion is the condition axe's rule is about, not the rule's name: no
 * element marked hidden from assistive technology may contain something a
 * keyboard can reach.
 */

/** What a keyboard can land on. The list axe's own rule works from. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function describeNode(node: Element): string {
  const slot = node.getAttribute("data-slot");
  return [
    node.tagName.toLowerCase(),
    node.id ? `#${node.id}` : "",
    slot ? `[data-slot=${slot}]` : "",
  ].join("");
}

/**
 * Every way a region can be hidden from assistive technology.
 *
 * `[inert]` as well as `[aria-hidden]`, and that is not padding. The
 * `aria-hidden` package's own `suppressOthers` prefers `inert` where the
 * browser supports it; Radix imports `hideOthers` directly today, so `inert`
 * never enters — the handover diagnostic measured `[inert] hosts: (none)` for
 * both the menu and the dialog. But a library that switched to the preferred
 * call would move this defect to an attribute the test was not looking at, and
 * the test would go green on a screen that had not changed. The assertion is
 * about the condition, so it names both ways of producing it.
 */
const HIDDEN_HOSTS = '[aria-hidden="true"], [inert]';

function focusableInsideHiddenHosts(): string[] {
  return [...document.querySelectorAll(HIDDEN_HOSTS)].flatMap((host) =>
    [...host.querySelectorAll(FOCUSABLE)].map(describeNode),
  );
}

function shellWithAnOpenMenu() {
  return render(
    <div>
      {/* The two things the shell puts outside the menu, and the two that
          proved it: the skip link and the module rail. */}
      <a id="skip" href="#main">
        Skip to main content
      </a>
      <nav aria-label="Modules">
        {/* Fragment hrefs, not routes: the harness needs focusable anchors,
            and real page paths trip `no-html-link-for-pages` in a file that is
            not a page. Still `a[href]`, which is all the assertion reads. */}
        <a href="#dashboard">Dashboard</a>
        <a href="#work-orders">Work orders</a>
      </nav>
      <main id="main">
        <DropdownMenu open>
          <DropdownMenuTrigger>Filter</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Open</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </main>
    </div>,
  );
}

it("leaves nothing focusable inside a region it has hidden", () => {
  shellWithAnOpenMenu();

  /*
   * The floor, and this test is worthless without it.
   *
   * Every assertion below is an absence. A menu that failed to render — a
   * changed export, a portal that went nowhere, a version bump that moved the
   * primitive — produces no hidden host, no focusable inside one, and a green
   * run that has measured nothing at all.
   */
  expect(
    document.querySelector('[role="menu"]'),
    "the menu never opened, so nothing below is being tested",
  ).not.toBeNull();

  expect(focusableInsideHiddenHosts()).toEqual([]);
});

/**
 * The notifications panel is a `Popover`, not a menu, and it never had this.
 *
 * Worth an assertion rather than a sentence, because the dispatch listed
 * notifications among the menus this fix repairs and it is not one: the fix
 * does not touch it. Radix's popover defaults `modal` to **false**, so it takes
 * the branch that never calls `hideOthers`, and nothing in the application
 * passes `modal` to it.
 *
 * That makes this a guard rather than a measurement of a defect: if somebody
 * later passes `modal` to the notifications popover — reasonable-looking, and
 * it would trap focus the way a dialog does — it acquires exactly the defect
 * the menu just lost, on a control a person opens from every screen. Reporting
 * it as "green after the fix" without this would also have implied the fix did
 * something it did not.
 */
it("the notifications popover is not in this state, and must not enter it", () => {
  render(
    <div>
      <a id="skip" href="#main">
        Skip to main content
      </a>
      <main id="main">
        <Popover open>
          <PopoverTrigger>Notifications</PopoverTrigger>
          <PopoverContent>
            <a href="#one">A notification</a>
          </PopoverContent>
        </Popover>
      </main>
    </div>,
  );

  expect(
    document.querySelector('[data-slot="popover-content"]'),
    "the popover never opened, so nothing below is being tested",
  ).not.toBeNull();

  expect(focusableInsideHiddenHosts()).toEqual([]);
});
