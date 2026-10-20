# 2. Dashboard

The Dashboard is the home screen for the four desk roles, and it answers one
question: what needs attention across every site today. Every number on it is
counted from the records in your own browser, so an empty screen means an empty
site rather than a screen that failed to load.

## What is on the screen

**The page heading:** today's date, then **Dashboard**, then the line "What
needs attention across every site today."

**A site filter**, just below the heading. It starts on **All sites**. It
drives everything else on the screen at once, so the cards, the picture and the
lists are always describing the same set of records.

**Five numbers across the top.** Each is a link into the records behind it:

| Card                  | Takes you to                            |
| --------------------- | --------------------------------------- |
| Open work orders      | The work-order queue                    |
| Overdue               | The queue, already filtered to overdue  |
| Critical, open        | The queue, already filtered to critical |
| Parts below minimum   | Inventory, filtered to low stock        |
| Inspections scheduled | Inspections, filtered to scheduled      |

Overdue, Critical and Parts below minimum are coloured when they are above
zero. The colour is never the only signal: the label says what is counted and
the icon repeats it.

While the records are still being read, a card shows a grey placeholder rather
than a zero. A zero would be a claim that nothing is overdue before anything
had been counted.

**Needs attention**, a list, described as "Late work first, then critical work
that is still open." Each row is a work order: number, priority, status, title,
site, and how late it is. Click a row to open the order. When there is nothing
to show it says **Nothing late, nothing critical** — "No work order here is past
its due date or set to critical."

**Work orders by status**, a bar chart, described as "Every status, including
the ones with nothing in them." Each bar is labelled with its status and its
count, so a status sitting at zero still appears. If there is no work at all it
says **No work orders**.

**Maintenance due soon** — "Planned visits in the next two weeks." Each row
shows the equipment tag, the plan name, and either **Due today** or the date
and how many days away it is. Click a row to open that plan in Preventive
maintenance. Visits already late are not here; they are in Needs attention, so
the same problem is not counted twice.

**Recent activity** — "Every change to the records, newest first." Each line
says what changed, then who did it and when. Changes made by the system itself
are attributed to WorkAxis.

Picture: `docs/screenshots/WA-9/desk-dashboard-1440.png`

## Look at one site only

1. Click the site button under the heading. It shows **All sites** to begin
   with.
2. The list opens, headed **Site**, with **All sites** first and then the five
   sites by name.
3. Pick one.

Every card, the chart and all three lists narrow to that site at once. The site
is kept in the page address, so you can copy the link, reload it, or send it to
somebody and they will see the same screen.

To go back, open the same button and pick **All sites**.

Pictures: `docs/screenshots/WA-9/facility-filter-open-1440.png` and
`docs/screenshots/WA-9/desk-dashboard-one-site-1440.png`

## Go from a number to the records behind it

1. Click any of the five cards.
2. You land on the matching screen with the filter already applied. Clicking
   **Overdue**, for example, opens the work-order queue showing overdue work
   only.

This is the fastest way into the work: read the number, click it, act on the
list.

## What each role can do here

The Dashboard is open to the administrator, the facility manager, the
maintenance coordinator and the auditor. All four see exactly the same screen,
because everything on it is reading rather than changing. There are no
switched-off controls here.

A technician or an inspector does not have the Dashboard in their module list.
Their home is My work today, chapter 1. If one of them opens the address
directly, the screen says **Not available to your role**, then "This screen is
limited to other roles. Your current role is" and the role name, and below that
"Switch role from the session menu to see it."

An auditor can read every number and follow every link. Where a link lands on a
screen with buttons — the work-order queue, for instance — those buttons will
be switched off for them, and will say so.
