# WorkAxis design system

The tokens live in `src/app/globals.css`. Change them there and here together.
Nothing in a component should carry a raw colour, font or size that is not a
token.

## What this has to look like

An operational tool a facility manager opens every morning and a technician
opens in a corridor. Dense but not cramped, calm, predictable, and legible at a
glance on a laboratory floor. Not a marketing site, not a generic analytics
dashboard: no decorative gradients, no glassmorphism, no oversized display type,
no animation that is not feedback.

## Colour

The palette is a deep petrol green taken from laboratory casework and instrument
enclosures, on a paper-grey canvas. It is deliberately not the default
enterprise blue, and it leaves blue free to mean something (assigned work).

| Token                     | Value     | Used for                                 |
| ------------------------- | --------- | ---------------------------------------- |
| `--background`            | `#f4f6f5` | Application canvas                       |
| `--card`, `--popover`     | `#ffffff` | Panels, menus, the surfaces data sits on |
| `--foreground`            | `#0f1c1b` | Primary text                             |
| `--muted-foreground`      | `#56635f` | Secondary text, labels, descriptions     |
| `--border`                | `#d5dbd8` | Hairlines between rows and sections      |
| `--input`                 | `#c7d0cc` | Field outlines, stronger than a hairline |
| `--primary`               | `#0f4340` | Primary actions, the brand mark          |
| `--secondary`, `--accent` | `#e6efed` | Selected rows, quiet emphasis            |
| `--destructive`           | `#a32027` | Destructive actions                      |
| `--ring`                  | `#12534f` | Keyboard focus                           |
| `--sidebar`               | `#0c2e2b` | The module rail                          |
| `--sidebar-foreground`    | `#e8efed` | Rail text                                |
| `--sidebar-muted`         | `#9fb3af` | Rail labels and the tagline              |
| `--sidebar-accent`        | `#16423e` | Rail hover and the current module        |
| `--sidebar-ring`          | `#cfdcd9` | Focus inside the rail                    |

Every text pairing above clears WCAG 2.1 AA (4.5:1) against the surface it is
used on. `--muted-foreground` is the lightest text token that still clears AA on
the canvas, which is why there is no lighter one.

The rail is dark so that the data area is the brightest surface on the screen
and the eye goes to the records, not the navigation.

## Status and priority

Seven signal tones, separate from the structural palette:

| Tone        | Value     | Meaning                                       |
| ----------- | --------- | --------------------------------------------- |
| `neutral`   | `#475a67` | Nothing has happened yet (open)               |
| `info`      | `#1a4f87` | Someone owns it (assigned)                    |
| `attention` | `#8a5300` | In progress, or due soon                      |
| `waiting`   | `#5b3fa0` | Blocked on something else (waiting for parts) |
| `positive`  | `#1a6b3c` | Finished, passed, in stock                    |
| `quiet`     | `#5e6866` | Cancelled, inactive, closed                   |
| `critical`  | `#a32027` | Overdue, failed, critical priority            |

**Colour is never the only signal.** `StatusChip`
(`src/components/shared/status-chip.tsx`) requires a `label` and an `icon`
alongside the tone, so a status that is only a colour cannot be expressed. WA-26
maps work-order statuses and priorities onto these tones; it must not introduce
a second way of drawing a status.

## Typography

IBM Plex Sans for the interface and IBM Plex Mono for identifiers. Plex was
drawn for technical documentation, carries French diacritics properly, and its
mono cut reads the way an equipment nameplate does — which is what asset tags
and work-order numbers are.

| Token       | Size | Used for                                     |
| ----------- | ---- | -------------------------------------------- |
| `text-2xs`  | 11px | Uppercase eyebrows and micro-labels, in mono |
| `text-xs`   | 12px | Captions, helper text, badges                |
| `text-sm`   | 13px | Table rows, buttons, menus                   |
| `text-base` | 14px | Body text, the default                       |
| `text-lg`   | 16px | Panel and card titles                        |
| `text-xl`   | 18px | Section headings                             |
| `text-2xl`  | 22px | Page title                                   |
| `text-3xl`  | 28px | Reserved for the field view                  |

Numbers in tables use `font-variant-numeric: tabular-nums` so columns line up.
Identifiers (asset tags, work-order numbers) are set in mono, uppercase, with
`tracking-[0.12em]`.

## Spacing, shape and density

Tailwind's 4px scale. `--radius` is `0.25rem`: a 4px corner reads as an
instrument panel, where a 10px corner reads as a consumer app. Controls are 32px
high on the desk view (`size="sm"` on buttons) and at least 44px in the field
view, where the target is a gloved thumb.

## Focus and motion

Focus is a 2px `--ring` outline at 2px offset, and inside the rail it flips to
`--sidebar-ring` so it stays visible on the dark surface. Every interactive
element shows it; nothing suppresses it.

Motion is feedback only: menus and sheets, and nothing else.
`prefers-reduced-motion: reduce` cuts all of it in `globals.css`.

## Language and formatting

The locales are `en-CA` and `fr-CA`, shown in the URL as `/en` and `/fr`. All
formatting goes through the presets in `src/i18n/formats.ts` so a date looks the
same everywhere it appears.

The 24-hour clock is used in **both** languages (`hour12: false`). Left alone,
`en-CA` prints "02:05 p.m." while `fr-CA` prints "14 h 05", and a maintenance
record that changes clock convention with the interface language is unreadable
across a shift handover.

French follows Canadian, not French, punctuation spacing: `;`, `?` and `!` are
attached to the preceding word, and `:` takes a non-breaking space. A unit test
enforces this (`src/i18n/messages.test.ts`).

## Widths

Desktop first at 1440. Tablet at 1024. Phone usable at 390 through the field
view, and the desk view stays usable there as well — the rail becomes a panel.
No screen scrolls sideways; the browser suite asserts that at all three widths.

## Themes

Phase 1 ships one light theme. There is no theme switch, and the toaster is
pinned to light so it cannot disagree with the application on a machine set to
dark. The token structure would support a dark theme later; nothing depends on
its absence.
