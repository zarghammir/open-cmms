# 6. Preventive maintenance

Preventive maintenance is the recurring work that keeps equipment from failing:
the plans, when each visit is next due, and the work orders those visits raise.
It is how compliance dates get met without somebody keeping a list of their own.

## What is on the screen

**The page heading:** **Preventive maintenance**, then "Recurring plans that
raise work before something fails."

**Three buttons** under the heading, labelled **Planned visits**, **Month** and
**Plans**, under "Which view". Planned visits is where you start.

### Planned visits

A table, soonest first: "Planned visits, soonest first, with what is late and
what can be raised now".

Columns are Tag, Equipment, Plan, Due, Next due, Site, Every, Last done, and
Actions. The Due column says one of four things:

- **Late**, with how many days,
- **Today**,
- **Can be raised** — the visit is close enough that the order may be raised
  now,
- **Not yet**.

Equipment never serviced shows **Never** under Last done. A **Run** button sits
above the table when anything is due.

Pictures: `docs/screenshots/WA-19/en-planned-visits-1440.png` and
`docs/screenshots/WA-19/en-planned-visits-390.png`

### Month

A calendar, one month at a time, with **Previous month**, **This month** and
**Next month**. Visits are grouped under the week they fall in, headed "Week
of" and the date. A month with nothing in it says "Nothing is planned in" and
the month name.

Picture: `docs/screenshots/WA-19/en-month-1440.png`

### Plans

The plans themselves: "The maintenance plans, what they service and how often".

Columns are Code, Plan, State, Equipment type, Every, Equipment, Raised before,
and Estimate. State is **Active** or **Not in use**. "Every" is the frequency —
Weekly, Monthly, Quarterly, Twice a year or Yearly. "Raised before" is how many
days ahead of the due date the work order is allowed to be raised. "Equipment"
counts how many machines are on the plan; a plan with none says **No
equipment**.

Picture: `docs/screenshots/WA-19/en-plans-1024.png`

## Raise the work for one visit

1. Stay on **Planned visits**.
2. Find the row. Its Due column should say **Late**, **Today** or **Can be
   raised**.
3. Click the actions button at the end of the row.
4. Choose **Generate work order**.
5. A message confirms the new number and which equipment it is for.

The new order appears in the work-order queue like any other, and the plan's
next due date moves on.

## Raise everything that is due at once

1. On **Planned visits**, press the **Run** button above the table. It shows
   how many visits are due.
2. Every due visit becomes a work order.
3. A message tells you how many were raised. If one could not be raised, it
   names the schedule.

This is the quickest way to start a week: run what is due, then work the queue.

## Find a plan or a visit

Both tables have the same toolbar as the rest of the product: a search box,
filter buttons, **Columns**, **Clear filters**, and a count on the right.
Planned visits searches on "Tag, equipment or plan"; Plans searches on "Code or
plan name".

## When a visit cannot be read

Occasionally a planned visit points at a plan or a machine the records no longer
hold. The screen says so above the table, counting them, rather than dropping
the row quietly. A visit that cannot be read is not the same as a visit that is
not there.

## What each role can do here

Preventive maintenance is open to the administrator, the facility manager, the
maintenance coordinator and the auditor. A technician and an inspector do not
have it in their module list; opening the address gives **Not available to your
role**, with "This screen is limited to other roles. Your current role is" and
the role name.

Reading the three views is the same for all four roles that have it.

**Generate work order** and **Run** need the right to change a maintenance plan.
The administrator, the facility manager and the maintenance coordinator hold it.
For an auditor both controls stay on screen, switched off, saying "Auditor
cannot do this. Switch role to continue."
