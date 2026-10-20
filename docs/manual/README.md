# WorkAxis user manual

WorkAxis is maintenance management for laboratory facilities. It holds the
equipment, the work orders, the preventive maintenance plans, the inspections
and the spare parts for a network of sites, so that the people who look after
those buildings can see what needs doing and record what they did.

This manual has one chapter per tab in the left-hand module list, plus a
chapter on the six roles. Each chapter says what the screen is for, what is on
it, how to do each job on it, and what your role may and may not do there.

Everything here was checked against the product as it stands. Where a screen is
not finished, the chapter says so in those words rather than describing
something that is not there.

## Contents

| Chapter                           | Screen                         |
| --------------------------------- | ------------------------------ |
| [1](01-my-work-today.md)          | My work today, and Scan        |
| [2](02-dashboard.md)              | Dashboard                      |
| [3](03-facilities.md)             | Facilities                     |
| [4](04-assets.md)                 | Assets                         |
| [5](05-work-orders.md)            | Work orders                    |
| [6](06-preventive-maintenance.md) | Preventive maintenance         |
| [7](07-inspections.md)            | Inspections                    |
| [8](08-inventory.md)              | Inventory, and the shelf count |
| [9](09-documents.md)              | Documents                      |
| [10](10-reports.md)               | Reports                        |
| [11](11-users-and-roles.md)       | Users and roles                |
| [12](12-settings.md)              | Settings, and the import       |
| [13](13-my-notifications.md)      | My notifications               |
| [14](14-waiting-to-send.md)       | Waiting to send                |
| [15](15-roles.md)                 | The six roles                  |

## Who uses it

Six kinds of people, and the system asks which one you are before it shows you
anything. The short version is below; chapter 15 has the full table.

| Role                    | What they do                                             |
| ----------------------- | -------------------------------------------------------- |
| Administrator           | Full access, including users, roles and settings.        |
| Facility manager        | Runs one or more sites: assets, work, plans and reports. |
| Maintenance coordinator | Plans and assigns the daily work across trades.          |
| Technician              | Carries out assigned work orders on site.                |
| Inspector               | Completes inspections and raises findings.               |
| Auditor                 | Reads records and reports. Changes nothing.              |

Those six sentences are the ones the product itself shows when you pick a role,
so what you read here is what you will read on screen.

## The two views

WorkAxis is one product with two faces, and your role decides which one you
get.

The **desk view** is for a computer. A module list runs down the left, a bar
across the top, and the rest of the width is given to the table you are
reading. Administrators, facility managers, maintenance coordinators and
auditors get this.

The **field view** is for a phone. There is no module list down the side: a
menu button at the top left opens it as a panel, and the rest of the screen is
one job at a time. Technicians and inspectors get this. The panel describes
itself as "Built for a phone in a corridor: today's work, one order at a time."

## Signing in, in the demonstration

There is no sign-in. The session menu says so in as many words: "No sign-in in
the demo. Switch role to see the application as someone else."

To change who you are:

1. Find the button at the top right of the screen. It shows a person icon and
   the name of the role you are currently holding.
2. Click it. The menu opens with the heading **Demo session**.
3. Under **Switch role**, pick one of the six. Each is listed with the one-line
   description from the table above.
4. The screen reloads as that role, and a message appears saying "Now viewing
   as" and the role name.

Where you land depends on whether the new role is allowed on the screen you
were looking at. If it is, you stay where you were. If it is not, you go to
that role's home screen: the Dashboard for the four desk roles, My work today
for a technician or an inspector.

Picture: `docs/screenshots/WA-25/desk-session-menu-1440.png`

## When a role is not allowed

Two things can happen, and they look different on purpose.

A **whole screen** you may not open shows a panel headed **Not available to
your role**. Underneath it says "This screen is limited to other roles. Your
current role is" and your role name, and below that, in smaller type, "Switch
role from the session menu to see it."

A **single button** you may not press is still there, still readable, and
switched off. Hover over it or move to it with the keyboard and it explains
itself: your role name, then "cannot do this. Switch role to continue." The
button is left in place deliberately, so you can see that the feature exists
and that the rule, not a missing feature, is what is stopping you.

Pictures: `docs/screenshots/WA-25/desk-permission-denied-1440.png` and
`docs/screenshots/WA-39/en-role-auditor.png`

## Changing the language

The whole product is in English and French, and you can switch at any moment
without losing your place.

In the desk view the switch is the small **EN | FR** control in the top bar. In
the field view it is in the same bar, to the left of the session menu. You can
also switch from the session menu, under **Language**.

Three things to know. The switch keeps you on the same screen with the same
filters. The address changes between `/en` and `/fr`, so a link you copy
carries the language with it. And anything a person typed — a work-order title,
a completion note — stays in the language they typed it in and is labelled as
such, because the system records what was written rather than translating it.

## Working without a signal

The field view keeps working with no network. This matters in a plant room or a
basement, where the signal usually fails.

The top bar always says which state you are in: **Connected**, or **Working
offline**. When you go offline a banner appears saying "Changes are saved on
this device and sent when the connection returns." It carries a count of how
many changes are waiting and a link to see them.

What you can do offline: read anything already open on the device, tick tasks,
record time and parts, and complete a job. What you cannot do: open a screen
this device has never shown. Ask for one and you get a page headed **You are
offline**, which says "This screen has not been opened on this device, so there
is no copy of it here to show." It offers a way back.

Chapter 14 covers the queue and what happens when a change cannot be sent.

Pictures: `docs/screenshots/WA-15/offline-banner-1440.png` and
`docs/screenshots/WA-47/offline-refusal-390.png`

## Putting the demonstration back

Everything you do in the demonstration is stored in your own browser and
nowhere else. Resetting affects nobody but you.

1. Open **Settings** from the module list.
2. Find the card headed **Demo controls**.
3. Press **Reset the demonstration**.
4. A box asks you to confirm. It says every change made in this browser is
   discarded and the original records are rebuilt for today, and that the
   language returns to English and the role to Administrator.
5. Press **Reset the demonstration** again to confirm.

An administrator or a facility manager may do this. For anyone else the button
is switched off with the usual explanation, and Settings itself is closed to the
other four roles in any case.

Pictures: `docs/screenshots/WA-26/settings-demo-controls-1440.png` and
`docs/screenshots/WA-26/reset-confirm-1440.png`

## The organization in the demonstration

The records belong to a made-up organization, the Dominion Laboratory Network,
code DLN. It has five sites:

| Code | Site                         | Where        |
| ---- | ---------------------------- | ------------ |
| KGN  | Kingston Central Laboratory  | Kingston, ON |
| SUD  | Sudbury Regional Laboratory  | Sudbury, QC  |
| MCT  | Moncton Regional Laboratory  | Moncton, MB  |
| KAM  | Kamloops Regional Laboratory | Kamloops, AB |
| REG  | Regina Regional Laboratory   | Regina, BC   |

Every asset tag, room code and work-order number you see belongs to that
organization.
