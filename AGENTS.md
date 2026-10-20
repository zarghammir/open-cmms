<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working in WorkAxis

WorkAxis is a computerized maintenance management system: assets, work orders,
preventive maintenance, inspections, spare parts, documents, reporting. Phase 1
is a frontend demonstration on synthetic data, in English and French.

This file is the contract between the people working on it. If you change a rule
here, say so in the pull request.

## Absolute rules

1. **This repository stands alone.** Never read from, copy from or push to
   another project's repository, tracker or wiki. Everything this project needs
   is in here.
2. **No customer names anywhere** — not in code, not in comments, not in demo
   data, not in commit messages. The organisation in the demo is fictional.
3. **No secrets, no `.env` committed, no paid services.**
4. **Nobody merges but the owner.** Open the pull request and stop.

## No hardcoded English. Ever.

Every string a person can see or hear — labels, headings, placeholders, button
text, `aria-label`, `title`, toast text, page titles — comes from
`messages/en.json` and `messages/fr.json`. That includes strings inside the
components under `src/components/ui`: several of them arrived from the shadcn
registry with English baked in and were changed to read the catalogue.

- Message keys are typed. `src/global.d.ts` declares `messages/en.json` as the
  shape, so a missing or misspelled key is a compile error.
- `tests/unit/ui-strings.test.ts` reads every file under `src/components` and
  fails on literal text between tags and on literal `aria-label`, `title`,
  `placeholder` and `alt` values. Verifying the sweep in a running browser is
  right and is not enough: the two strings that survived WA-25's sweep were the
  two nothing rendered yet — a `Close` button behind a prop no call site set,
  and a default `aria-label` every call site overrode.
- `messages/fr.json` must have exactly the same keys. A unit test enforces key
  parity, matching ICU arguments, non-empty values, real translations for
  sentences, French typographic apostrophes, and Canadian French punctuation
  spacing.
- French is written properly, not machine-translated placeholder text. In
  Canadian usage `;`, `?` and `!` attach to the preceding word and `:` takes a
  non-breaking space, U+00A0.
- A module's label comes from `modules.<key>.title`, where `<key>` is the module
  key in `src/domain/constants/navigation.ts`. One source, so a label cannot
  disagree with the route.

## Interface text is translated. A person's words are not.

Every label, heading and message comes from the catalogues. Text a person
_types_ — a work-order title, a description, a note — is content, and it stays
in the language it was written in.

`WorkOrder.contentLanguage` records that language, or is null for records
authored in both, as the seeded ones are. When someone types a title, the same
words go into both language slots and `contentLanguage` says which language
they are; a screen showing them to a reader of the other language says so (see
`workOrderDetail.asEntered`, which the description and every comment on the
work-order page use). Nothing invents a translation, and nothing puts English
under a French label without a word about it.

A `contentLanguage` of null is its own answer and not a missing one: it means
the record was authored in both languages, as every seeded one is, and it gets
no marker at all. A screen that marked it would be claiming the words were
written in one language and are being read in the other, which is the one thing
the field exists to avoid saying falsely.

The reason is practical as much as principled: a form that demands a title in
two languages from a technician standing in a mechanical room is friction, not
bilingualism, and anyone who has worked in one would recognise it as
unrealistic.

## Languages and formatting

- Locales are `en-CA` and `fr-CA`. The URL shows `/en` and `/fr`, mapped by
  `localePrefix.prefixes` in `src/i18n/routing.ts`. `params.locale` is always
  the full tag.
- Always import `Link`, `redirect`, `usePathname`, `useRouter` from
  `@/i18n/navigation`, never from `next/link` or `next/navigation`. A raw
  `next/link` drops the locale. Building a path by hand
  (`` `/${locale}${href}` ``) double-prefixes it.
- Dates and numbers go through the named presets in `src/i18n/formats.ts`, via
  `useFormatter()` in a component or `getFormatter()` on the server. Do not call
  `Intl` directly, and do not add a second date library path.
- The time zone is fixed to `America/Toronto` for everything, so a date never
  differs between the server and the browser.

## Roles decide what exists

`src/domain/constants/roles.ts` and `navigation.ts` are the only places that
answer "may this role do this".

- `modulesForRole(role)` — which modules appear in the navigation.
- `canOpenModule(role, key)` — whether a route renders or shows the
  permission-denied panel. `ModuleScreen` applies this, so route through it
  rather than checking by hand.
- `can(role, capability)` — whether a write action is available. A missing
  capability disables the control and explains why (`CapabilityAction`); it does
  not hide it silently.
- The demo role lives in the `wa_demo_role` cookie and is read on the server
  (`src/lib/server-session.ts`), so the first paint is already correct. Phase 2
  replaces the cookie with a signed-in user and nothing else changes.

## Two experiences

`viewForRole(role)` picks the shell in `src/app/[locale]/(app)/layout.tsx`:
`DeskShell` for Administrator, Facility manager, Maintenance coordinator and
Auditor; `FieldShell` for Technician and Inspector. Same routes, same data, same
catalogue. Build a feature once and let both shells hold it.

## The data boundary

Pages never import the records. The flow is:

```
page / feature UI → hook in src/hooks → repository interface → in-memory
implementation over one Zustand store persisted to IndexedDB
```

Phase 2 swaps the implementation for REST calls and nothing above the repository
changes. Keep the implementation lightweight; it is not a backend.

Nothing under `src/app` or `src/components` may import `@/stores`,
`@/data/seed`, `@/data/mock` or `@/data/repositories` — including by a relative
path. Two things enforce it, on purpose:

- `tests/unit/data-boundary.test.ts` reads every page and component and fails on
  any of them. It is the evidence.
- `no-restricted-imports` and `no-restricted-syntax` in `eslint.config.mjs` tell
  you in the editor, before the commit.

`src/data/selectors` is not on that list and screens may import from it:
selectors are pure functions over a snapshot they are handed, they never reach
the store, and Phase 2 changes where the snapshot comes from rather than what
they do.

Both cover a dynamic `import()`, not only a static one. `no-restricted-imports`
does not see `dynamic(() => import("@/stores/…"))` at all, which is why the
`no-restricted-syntax` rule sits beside it — a lazy-loaded table is written
exactly that way, so it is the form a breach is most likely to arrive in. The
test's control asserts all seven spellings: `import … from`, `export … from`,
bare `import "…"`, `require()`, `await import()`, `dynamic(() => import())`,
and a relative path.

`useDemoBoot` and `useDemoReset` exist because seeding and resetting are
store-level operations that no single repository owns. They are still hooks:
that is what keeps the rule absolute rather than "absolute except the two
components that needed it".

Every tenant-owned entity carries `organizationId`. Every mutation writes an
audit event — not by convention but by construction: repositories cannot write,
they describe a change and hand it to `applyMutation`, which writes the record
and the audit entry in one step. There is no security in Phase 1 and no
pretending there is.

A schema version bump **rebuilds rather than migrates**: the stored records are
discarded and the seed is generated again. That is the right call for data that
is entirely generated, and it is worth saying plainly because nothing is carried
across — changes a reviewer made in the browser do not survive a bump.

Every pull request that adds a collection to the persisted store bumps
`SEED_VERSION`; when two are in flight, whichever lands second merges `main` and
bumps again, because one bump cannot stand for two shapes.

### `experimental.useOffline` is not the offline feature

Leave it off. Next has an offline path that, when a navigation's payload cannot
be fetched, waits for the connection to come back and retries instead of failing
(`fetch-server-response.js`, gated on `process.env.__NEXT_USE_OFFLINE`). With it
on, a technician taps a link with no connection and nothing happens at all —
no screen, no error, no explanation, until the network returns. A refusal only
the person in the plant room can see is indistinguishable from being ignored.

The mechanism we use instead is `src/lib/offline-routes.ts`: a short list of
addresses the page asks the service worker to fetch into the cache while there
is still a connection, because a page is only cached once it has been opened and
the screen a person needs when the network is gone is the one they had no reason
to open. Warming a page also warms the chunks its HTML references — a cached
document whose code is missing opens to the error boundary, which was measured
rather than guessed.

### Three states, never two

`useDemoData` and `useRepositories` return a `status` alongside the data. Before
the browser has finished reading IndexedDB the status is `unknown`: there are no
records **and no answer**, which is not the same as there being none. A table
that draws "nothing here" during that moment is telling a reviewer something
untrue. Draw a skeleton for `unknown`, the empty state for `ready` with nothing
in it.

The same rule runs through the data. A work order with no due date is not
overdue and not on time. A crew code the organisation does not use is not
"unassigned". `assignmentForCrewCode` returns `undefined` for an unknown code
and `{ kind: "contractor" }` for external work, and those are three different
answers.

### Audit text

`summaryKey` and `summaryParams` are a catalogue key and its arguments, never a
built sentence — an English sentence stored in August is still English in the
French demo in October. One argument, `status`, holds a domain value rather than
a literal: pass the entry through `auditSummaryParams` before `t()`, or the
sentence will read "moved to waitingForParts" in both languages.

**No error's words go into `summaryParams` or a notification's `params`.** Every
value there comes from a record. The rule is about the language first and about
what leaks second, and the second is why it is enforced rather than trusted: a
neighbouring project stored a caught error on a record and later served it from
a screen, so a connection failure put an internal hostname in front of whoever
could read it — and the fix for their log did not touch it, because the sink was
different and the string was the same.

Two boundaries here have a platform error in hand, and both collapse it before
anything can store it: `run()` in `idb-storage.ts` rejects and the screen shows
`states.saving.failedTitle`, and `cameraStateForError` in `scan-panel.tsx` reads
a message, chooses between three states and throws the words away. Classify an
error, never carry it. `tests/unit/error-strings-in-params.test.ts` reads the
source for the four spellings, because a `Record<string, string | number>`
cannot say where a string came from.

`ImportBatch.fileName` is the one free string this application stores and then
renders — a spreadsheet's own name, shown when offering to undo. That is
deliberate and it is watched: the same test fails if a second one is added, so a
field that a screen will show is a decision somebody makes rather than one that
appears.

## The seed, and the contract it has with the import fixture

`buildSeed(today)` is pure. Give it the same day and it returns the same
records, on every machine and in every run: the randomness comes from one seeded
generator and the dates are offsets from the day you pass in. Nothing in
`src/data/seed` may call `Math.random()` or read the clock.

The organisation, the five site codes, the room codes and the bin codes are not
free to change. `tests/fixtures/mp2-export-sample.xlsx` was generated against
them for WA-17's import, and `src/data/seed/reference.ts` holds them with the
reason written next to them. Three tests hold the contract up:

- `tests/unit/seed-integrity.test.ts` — every reference resolves, every room and
  bin the fixture names exists, the sixth site it names does **not** exist
  (planted defect D11 depends on that), every crew code maps, every status path
  is legal, and the seed is identical across runs.
- `tests/unit/seed-disjoint.test.ts` — no asset tag, stock number or work-order
  number is shared with the fixture. If one were, WA-17's validation report
  would grow a duplicate nobody planted and the demo script built on "twelve
  defects" would be wrong.
- `tests/unit/data-boundary.test.ts` — above.

Each of those carries a control that fails on purpose, because a check that
cannot fail is not a check.

## Tables and forms

`src/components/data-table` holds the table every register screen is drawn
with — the shell, the toolbar, facet filters, pagination, row actions and the
skeleton. A screen brings its own columns and its own data; it does not bring
its own table.

- **TanStack Table v9, not v8.** There is no `useReactTable` and no
  `getCoreRowModel`: features are opted into explicitly and the row models are
  factories that live in the same object, all of it in
  `data-table/table-features.ts`. A v8-shaped compatibility layer exists at
  `@tanstack/react-table/legacy` and is deliberately not used — every later
  table copies this one, and inheriting a deprecation is worse than learning
  the current shape once. Read the installed typings before reaching for a
  pattern you remember; v9 is recent enough that most of what is written down
  elsewhere is about v8.
- **Column priority is data.** A column says how important it is (1 never
  drops, 3 is desktop only) and `column-priority.ts` decides what a width can
  hold, so a missing column at 1024 has a reason with a number rather than a
  media query. At 390 the table is not a table: rows become cards.
- **Skeleton while the status is `unknown`.** Never an empty table, never
  "no results", never a zero.
- **No new registry components.** Facet filters and column visibility are built
  from the `DropdownMenu` already vendored; form selects are native `<select>`,
  which on a phone gives the platform picker a technician already knows; the
  label, hint and error wiring is `src/components/work-orders/field.tsx`, which is
  smaller than the component it would replace.
- **Zod says whether the form is filled in; the repository says whether the
  record may exist.** The form calls `repositories.workOrders.create`, which
  writes the order, its first history row and the audit entry in one commit.
  Validation messages are catalogue keys, so they read correctly in French.

## Work-order status rules

Open → Assigned → In progress → Completed. In progress ↔ Waiting for parts.
Open, Assigned, In progress and Waiting for parts → Cancelled, which requires a
reason. Priorities: Low, Medium, High, Critical.

`WORK_ORDER_TRANSITIONS` in `src/domain/constants/work-order-status.ts` is the
only description of it, `canTransition` is the only question to ask, and the
work-order repository is the only thing that may move an order — so a button, a
keyboard path and a future import all meet the same answer. It is never a free
dropdown.

Two tests, deliberately at different levels: the map's own test walks all
thirty-six ordered pairs against a table written out from this paragraph, and
the repository's test proves the guard is actually _reached_. A guard that is
reachable is not a guard that is reached.

Cancelling always carries a reason, including when a source system has none —
the MP2 import records `notRecordedInSource` rather than inventing one or
quietly skipping the rule.

Status and priority are drawn with `StatusChip`, which requires a label and an
icon, so colour is never the only signal.

## Addressing a record in a URL

A route names a record by the identifier people say out loud — the asset tag
`AHU-KGN-01`, the stock number `FLT-2101` — never by `Id`.

`Id` is opaque by declaration: `src/domain/types/common.ts` says so, and nothing
may parse meaning out of it. It is also not stable. `buildSeed(today)` rebuilds
every record whenever the demonstration is reset, so an address built on an
`Id` stops resolving the moment someone presses Reset — and a label printed on
Tuesday has to still open its asset on Thursday. The tag is the only part that
survives.

This is not only about printing. The same rule is what lets a scan, a typed
search, a handheld barcode reader and a pasted link all arrive at one lookup:
`byTag` and `byNumber` on the repositories, with `resolveScan` in
`src/lib/scan.ts` as the single description of what a scanned string means.

**Name the segment after what it holds.** `/assets/[tag]/label`, not
`/assets/[id]/label`; `/inventory/[stock]/label` for a stock number. The folder
name is the only hint the next caller gets about what belongs in it, and a
folder called `[id]` holding a tag invites someone to pass `asset.id` — which
resolves to nothing. Next.js allows only **one slug name at a given path
position**, so the first route merged at that position fixes the name for every
route added beside it later; getting it wrong is cheap now and permanent
afterwards.

Two consequences worth knowing before you write a route:

- Resolving is allowed to answer **unknown**. An identifier this system does not
  hold is not the nearest record and not an empty result — see "Three states,
  never two". A label that says `assets` and carries a stock number resolves to
  nothing, because disagreeing with the label is guessing.
- A scanned address is read for its **path only**. The host is ignored on
  purpose: a scan looks the identifier up in our own records rather than
  navigating where it was told, so a code printed by someone else cannot send a
  technician anywhere.

## Adding a module screen

1. Add the key to `ModuleKey` and an entry to `MODULES` in
   `src/domain/constants/navigation.ts` — href, icon, and the roles allowed.
2. Add `modules.<key>.{title,description,emptyTitle,emptyBody,point1,point2,point3}`
   to **both** catalogues.
3. Create `src/app/[locale]/(app)/<route>/page.tsx` returning `<ModuleScreen
moduleKey="<key>" />`, and export `generateMetadata` using `moduleMetadata`.
4. Run `npm test` — the navigation test checks the order, unique hrefs, role
   reachability and that both catalogues name the module.

## Server and client components

- A server component may not pass a **function** to a client component. Passing
  an icon as `icon={Plus}` fails at run time with "Functions cannot be passed
  directly to Client Components"; pass a rendered element instead
  (`icon={<Plus data-icon="inline-start" />}`).
- `useTranslations` works in both server and client components. Async server
  components use `getTranslations`.

## Components we own

`src/components/ui` is vendored shadcn/ui source, not a dependency. Changes made
here on purpose — re-adding a component from the registry would revert them:

| File                                        | Change                                                        | Why                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sidebar.tsx`                               | `SidebarInset` renders a `div`, not `main`                    | It nested a second `main` landmark inside the shell's own `main` and swallowed the header's `banner` role                                                                                                                                                                                                                                                                         |
| `sidebar.tsx`                               | Trigger, rail and mobile sheet strings read the catalogue     | They shipped with English hardcoded                                                                                                                                                                                                                                                                                                                                               |
| `dialog.tsx`, `sheet.tsx`, `breadcrumb.tsx` | Close, "More" and breadcrumb labels read the catalogue        | Same                                                                                                                                                                                                                                                                                                                                                                              |
| `breadcrumb.tsx`                            | Links and the current page carry `min-h-6` with `inline-flex` | The registry's link is 19.5px tall at 390 — too small to press with a thumb, on the one control that is on every desk screen. Height, not padding: padding would move the words off the separator                                                                                                                                                                                 |
| `dialog.tsx`                                | `DialogFooter` takes a local `showCloseButton` prop           | The registry's footer is a plain `div`; re-adding it from the registry would drop the prop silently                                                                                                                                                                                                                                                                               |
| `sonner.tsx`                                | Pinned to the light theme, `next-themes` removed              | Phase 1 is light only; following the operating system made the toaster disagree with the application                                                                                                                                                                                                                                                                              |
| `toggle.tsx`                                | Pressed state is a filled `primary`, not `bg-muted`           | The vendored rule was a 1.15:1 tint against the card and 1.06:1 against the page — below 1.4.11's 3:1 for a state cue, on five call sites including the language switcher in every header. The fill is 11.07:1 and 10.20:1, and it is one constant (`PRESSED_STATE`) so a border-plus-check variant is one edit                                                                   |
| `use-mobile.ts`                             | Rewritten with `useSyncExternalStore`                         | The original set state inside an effect, which the React lint rules reject                                                                                                                                                                                                                                                                                                        |
| `dropdown-menu.tsx`                         | `DropdownMenu` defaults `modal` to `false`                    | Radix's modal menu calls `hideOthers`, marking the skip link, the module rail and the trigger `aria-hidden` while they stay focusable — `aria-hidden-focus`, serious, on every menu since WA-9                                                                                                                                                                                    |
| `table.tsx`                                 | The scroll container carries `tabIndex`                       | The registry's container scrolls sideways and cannot be reached by keyboard, so columns past the edge are unreachable rather than awkward — `scrollable-region-focusable`, serious, and only visible once the content overflows. No role and no label on it: every table here carries a `TableCaption`, so naming the container would announce the same words twice on the way in |

Use the components; put layout classes in `className`, not colours or type
sizes. If a component needs a new colour, it needs a token
(`docs/DESIGN_SYSTEM.md`).

## Folder structure

```
src/app/[locale]/(app)/...        routes, one folder per module
src/components/{ui,layout,shared} ui = vendored shadcn, layout = shell, shared = reusable screen parts
src/components/<module>           a module's own screens: dashboard, assets, work-orders
src/components/data-table         the table every register screen is drawn with
src/domain/{types,schemas,constants}
src/data/{repositories,seed,selectors}
src/stores  src/lib  src/hooks  src/i18n
messages/{en,fr}.json
tests/{e2e,accessibility,fixtures,unit}
docs/
```

A module's screens live under `src/components/<module>`, not under a separate
`src/features`, because the two checks that hold the line — the data boundary
and the hardcoded-string sweep — read `src/app` and `src/components` and
nothing else. Feature UI anywhere outside those two directories is feature UI
neither of them is looking at, which is the shape of every guard that is
correct at its own layer while a neighbour reintroduces what it excludes.

`tests/unit` is Vitest's, for checks that belong to no single file; Playwright
ignores it (`testIgnore` in `playwright.config.ts`) or it would try to load
those files as browser specs.

Unit tests sit next to the file they test (`*.test.ts`). Browser tests live in
`tests/`.

## Verifying a change

Passing tests are not evidence on their own. Every change goes through:

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run test:e2e
```

That is continuous integration's order, and `format:check` is second for a
reason: it runs before the typecheck, the tests and the build, so one unformatted
file stops everything after it and the run tells you nothing about the code.
`npm run format` fixes it.

Run the browser suite as `npm run test:e2e`, not `npx playwright test`. The
`pretest:e2e` script frees the suite's port first, and npm only runs it for the
former. Playwright reuses an existing server locally, which is what makes a
second run fast and is also a trap: a `next start` left over from an earlier
build keeps holding the port, the suite reuses it, and every assertion about the
change you just made is then measured against code that is no longer on disk.
The failure is uniform and confident-looking, and it has cost two lanes twenty
minutes each. Continuous integration disables reuse and starts its own server,
so the guard does nothing there.

then **open the application in a browser and use the thing you changed**, at
1440, 1024 and 390, in both languages, with the console open. Check the keyboard
path and that focus is visible. `WA_SCREENSHOTS=1 npm run test:screenshots`
refreshes `docs/screenshots/`.

**Scan a screen with its controls open, not only as it loads.** A screen scanned
only at rest is a screen scanned in one of its states. Three findings so far were
visible in no other way, the largest being WA-49: every dropdown menu in the
application marked the shell `aria-hidden` while leaving it focusable, serious
under `aria-hidden-focus`, and it sat on main from WA-9 until the first scan that
opened a menu.

The screenshot specs are skipped unless `WA_SCREENSHOTS` is set, so for a long
time nothing ran them and a green build on a pull request that changed one meant
the build had not looked. Continuous integration now runs them on the same
production build as the browser suite, with `WA_SCREENSHOT_ROOT` pointed at a
directory it throws away — so the step proves the specs pass without writing a
tracked file. Locally the root defaults to `docs/screenshots`, which is what
makes the command above still refresh the pictures. Every spec takes its folder
from `screenshotDir("WA-nn")`; a new one that writes a path by hand is a spec CI
cannot run.

Write tests that assert the outcome a person would see, not the mechanism. If a
test cannot fail, it is not a test: break the code on purpose once and watch it
go red.

**A check's result is its exit status.** Never pipe a check through `head`,
`tail` or `grep` before `&&`, or before reporting it green: the pipe's exit
status is the pager's, always zero, so the chain runs on and the report is made
against whatever the grep happened to match. Run it bare, or `set -o pipefail`
first, and report the exit code.

**An enabled button is not a bound button.** Before a browser test clicks,
types or focuses, wait for something the _store_ draws — never for markup the
server already sent. A heading, a button, `toBeEnabled()`: all of them are true
of the server-rendered HTML before React has attached a single handler, so a
test that waits for one and then clicks is waiting for markup and acting on a
handler that does not exist. The click lands on nothing and the failure arrives
later, somewhere else, as a focus that never moved. Wait again after every
navigation: a `goto` loads a new document, so anything proved about the page
before it says nothing about the page after it.

WA-52 was this, nineteen times over, and it turned main red twice on a tree that
had already been green — the giveaway being a retry that failed too. Measured on
a production build with the CPU throttled 8x, the case that broke main failed
five runs in five without the wait and passed ten in ten with it; unthrottled,
this machine never lost the race at all, which is why it reached main.

**The write, then the navigation — and the screen updating is not the write
landing.** After a test performs a write, do not navigate on the strength of the
screen having changed. A status chip, a row appearing, a number moving: all of
them are the page showing the new world optimistically, and none of them says
the write reached the device. Navigating on one tears the document down with the
write still in flight, and the next screen reads a world where it never
happened.

**The dialog closing is the durability signal.** A write dialog closes only
after `save()` reports `stored`, so a shut dialog means the device has it —
`work-order-actions.tsx`, `issue-part-dialog.tsx` and `asset-edit-dialog.tsx`
all guard that way, and `demo-controls.tsx` keeps its confirmation open by
answering false instead. So wait for the dialog to be gone before leaving the
page. `demo-controls.tsx` has carried the reasoning in a comment since WA-67,
where the demonstration reset lost itself the same way.

Two tests broke this in one afternoon and each failed somewhere else entirely.
In WA-88 the second of two assignments silently never wrote, and the failure
surfaced ten lines later as a missing sentence in the activity feed. In WA-91
the equipment history read "In progress" on one cold run in three. The tell for
the second kind is the shape of the red: steady polls inside a run, but a
result that varies between runs, is a race rather than an instrument that
measures nothing.

**Run a deletion control only after committing the fix.** Restoring with `git
checkout` reverts uncommitted work too, so the control deletes the very change
it is testing — and a weaker test would have gone green with the fix gone.

**Never `git checkout <old-commit> -- <file>` to carry work forward.** It
replaces the whole file and silently reverts everything that has landed in it
since. Re-apply your edits to the current file instead.

**A browser test picks what the screen shows, not a name that happens to be on
the first page.** Naming a record in advance — the busiest asset, a particular
work order — makes the test pass or fail on whether that record lands on page
one of a paginated table, which has nothing to do with the thing being tested.
Read the first row the screen is actually rendering, take its identifier from
the DOM, and assert against that. WA-10 found this the only way it can be found:
a screenshot run failed while the equivalent assertion in the suite stayed green,
because the asset it named happened to be on page one that day.

## Environment notes

- Node 22 or newer; `.nvmrc` pins the line CI uses. Vitest is held at 4.x
  because 5.0 refuses Node 25, which is what the development machine runs.
- Playwright needs its browser once: `npx playwright install chromium`.
- `npm run test:e2e` builds first locally and reuses the CI build step in CI.

## Tickets and pull requests

Ticket first. Branch `feat/WA-n-slug`, commits
`type(WA-n): ...`, one ticket per pull request into `main`, merge commits only.
The pull request body carries: Purpose, What works (with screenshots), Test
evidence, Accessibility notes, Deviations from the ticket, Known limitations,
Risk and rollback.
