# 5. Work orders

A work order carries a whole job: the equipment, who is doing it, the tasks, the
parts used and the record of what happened. This screen is the queue of them
all, and the form for raising a new one.

## What is on the screen

**The page heading:** **Work orders**, then "Corrective and preventive work,
from request to completion." A **New work order** button sits at the top right;
pressing it jumps you down to the form.

**The queue**, first, because you normally come here to find work rather than
to raise it. Above the table:

- a search box, "Number, title or asset tag",
- filter buttons for status, priority, type, site, due date and who it is
  assigned to,
- **Columns** and **Clear filters**,
- a count on the right.

The due-date filter offers Any due date, Overdue, Due today, Due in 7 days, Due
in 30 days and No due date. The assignee filter offers Anyone, Unassigned, the
people by name, and "A crew, not a person".

**The table.** Number, Title, Status, Priority, Due, Assigned to, Site, Type.
Overdue work says how many days late it is. Work with nobody on it says
**Unassigned**.

**The form**, below the queue, headed **Raise a work order**.

Pictures: `docs/screenshots/WA-38/en-queue-1440.png` and
`docs/screenshots/WA-38/queue-narrowed-1440.png`

## The six statuses

An order moves along a fixed path. It cannot jump.

| Status            | Can move to                             |
| ----------------- | --------------------------------------- |
| Open              | Assigned, Cancelled                     |
| Assigned          | In progress, Cancelled                  |
| In progress       | Waiting for parts, Completed, Cancelled |
| Waiting for parts | In progress, Cancelled                  |
| Completed         | nothing                                 |
| Cancelled         | nothing                                 |

Completed and Cancelled are final. A completed order is not reopened; you raise
a new one. If something is attempted that the path does not allow, the screen
says "That is not a move this order can make from" and the status it is in.

## Raise a work order

1. Scroll to **Raise a work order**, or press the button at the top right.
2. **Equipment** — choose the machine. If you came from the asset register it
   is already filled in.
3. **Assign to** — a person, or leave it as **Nobody yet**.
4. **Type** and **Priority**.
5. **Due date** and **Estimated minutes**, if you know them.
6. **Title** and **Description**. A note under these says to write in the
   language you work in: it is recorded as you typed it and is not translated.
7. Press **Raise work order**. It confirms with the new number.

Some roles are not offered in the **Assign to** list. The form says which, and
why: a role that cannot change anything is not given work. The same sentence
appears when assigning an existing order, and is visible in
`docs/screenshots/WA-88/en-assign-dialog-1440.png`; the two form captures below
were taken before it was added.

Pictures: `docs/screenshots/WA-27/work-order-form-1440.png` and
`docs/screenshots/WA-27/work-order-form-invalid-1440.png`

## Open one order

Click the number. The order opens with everything recorded against it:

- the number, priority and status at the top, and when it was raised,
- **Details** — equipment, site, location, due date, who it is assigned to,
- **Description**, labelled with the language it was written in,
- **Tasks**, ticked off one at a time, showing how many of how many are done,
- **Parts used**,
- **Time logged**,
- **Status history** — every move, who made it and when,
- **Comments**,
- **Attachments**.

Picture: `docs/screenshots/WA-38/en-order-1440.png`

## Do the work

The buttons across the top of an open order change with its status.

**Assign it.** Press **Assign**. The box says "Choose who this work belongs to.
They are told, and it moves to Assigned." People are grouped into **At this
site** and **Other sites**. Pick one and press **Assign**.

**Start it.** Press **Start work**. It confirms first: "Recorded as started now,
against your name."

**Tick tasks off.** Tick each one as you go. A note says that ticking records
your name and the time.

**Pause for parts.** Press **Waiting for parts**. "The order stays open and
stops counting as work in progress." Press **Resume work** to come back.

**Issue a part to the job.** Press **Issue a part**. Choose the part — each is
listed with how many are on hand — enter how many, and press **Issue**. Stock
comes out of the store and the movement is recorded against this order.

**Log time without finishing.** Press **Log time**, enter the minutes, press
**Log time**. It is recorded against your name and does not change the status.

**Finish it.** Press **Complete**. The box warns that this closes the order,
records the time against your name, and cannot be undone. Enter how long it
took, and what the next person should know. Press **Complete order**.

**Call it off.** Press **Cancel order**. Cancelling always asks why, from a
fixed list: Duplicate of another order, No longer required, Asset
decommissioned, Handled under another order. Add a note if you want, then press
**Cancel order**. It cannot be undone.

Pictures: `docs/screenshots/WA-39/en-actions-1440.png`,
`docs/screenshots/WA-39/en-complete-dialog.png`,
`docs/screenshots/WA-39/en-cancel-dialog.png`,
`docs/screenshots/WA-88/en-assign-dialog-1440.png` and
`docs/screenshots/WA-40/en-issue-part-390.png`

## Attach a document

1. Open the order and find **Attachments**.
2. Press **Attach a document**.
3. Choose the kind — Manual, Certificate, Drawing, Procedure, Contract, Report
   or Photo.
4. Choose the file. PDF, Word and Excel files are accepted; anything else is
   refused with a message saying so.
5. It confirms that the file was recorded, and says plainly that the file itself
   is not stored in this demonstration.

Picture: `docs/screenshots/WA-21/en-work-order-attachments-1440.png`

## What each role can do here

Every role may open Work orders and read the queue. What they may do to an order
differs, and a control they may not use is always left on screen, switched off,
saying the role name and "cannot do this. Switch role to continue."

| Action               | Administrator | Facility manager | Maintenance coordinator | Technician | Inspector | Auditor |
| -------------------- | ------------- | ---------------- | ----------------------- | ---------- | --------- | ------- |
| Raise a work order   | Yes           | Yes              | Yes                     | Yes        | Yes       | No      |
| Assign               | Yes           | Yes              | Yes                     | No         | No        | No      |
| Start, pause, resume | Yes           | Yes              | Yes                     | Yes        | No        | No      |
| Tick tasks, log time | Yes           | Yes              | Yes                     | Yes        | No        | No      |
| Complete             | Yes           | Yes              | Yes                     | Yes        | No        | No      |
| Cancel               | Yes           | Yes              | Yes                     | No         | No        | No      |
| Issue a part         | Yes           | Yes              | Yes                     | Yes        | No        | No      |
| Attach a document    | Yes           | Yes              | Yes                     | Yes        | Yes       | No      |

Two rules are worth naming. Assigning and cancelling are held apart from doing
the work: handing a job out and calling a job off are decisions about the
schedule, and cancelling is the one act on an order that cannot be undone. And
an auditor holds nothing: every button on this screen is visible and switched
off for them, which is how the rule is shown rather than hidden.

Pictures: `docs/screenshots/WA-39/en-role-technician.png`,
`docs/screenshots/WA-39/en-role-auditor.png` and
`docs/screenshots/WA-88/auditor-cannot-assign-1440.png`
