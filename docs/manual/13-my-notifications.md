# 13. My notifications

My notifications is where you choose what you hear about, and how. The screen
says it plainly: "These are your own choices and nobody else's." Every one of
the six roles can reach it, because what somebody wants to be told is theirs
rather than the organization's.

It is not in the module list. You reach it from two places.

## Getting there

- **From the bell**, top right of any screen: open it and follow
  **Notification settings** at the bottom.
- **From the session menu**, the button showing your role: open it and pick
  **Notification settings**.

## What is on the screen

**The page heading:** **My notifications**, then "Choose what you hear about,
and how. These are your own choices and nobody else's."

**A table** with three columns: **Alert**, **In the app**, and **By email**.
Each row is a kind of alert, with a switch under each column.

The six kinds are:

| Alert            | What raises it                                   |
| ---------------- | ------------------------------------------------ |
| Due soon         | A work order is approaching its due date         |
| Overdue          | A work order has passed its due date             |
| Assigned to you  | A job has been given to you by name              |
| Low stock        | A part has fallen below its minimum              |
| Inspections due  | Equipment is due for inspection                  |
| Changes not sent | Something saved on this device could not be sent |

Two other kinds of alert appear in the bell and have no switch on this screen.
**Failed inspections** comes with the demonstration's starting records.
**Preventive maintenance** is raised when a planned visit comes due and a work
order is generated for it. Neither can be turned on or off yet, so if you see
one in the bell and look for its switch here, it is not missing.

**A line underneath** saying which language mail would be written in.

Picture: `docs/screenshots/WA-18/en-toggles-auditor-1440.png`

## Change what reaches you

1. Find the row for the kind of alert.
2. Turn **In the app** on or off.
3. Turn **By email** on or off.
4. A message confirms: "Your choices were saved".

There is no save button. Each switch takes effect as you set it.

**In the app** controls the bell. **By email** controls whether the alert would
also be mailed to you. Nothing is actually sent in this demonstration — there is
no mail server — but every decision to send is written to the email log on
Settings, so you can see exactly what would have gone out and in which language.
Chapter 12 covers that log.

## Read what you have been told

1. Press the bell at the top right. It carries a count of anything unread.
2. The panel is headed **Notifications** and groups them by kind, saying how
   many in each group are unread.
3. Click one to open the record it is about.
4. Press **Mark all read** to clear them.

When there is nothing waiting it says **Nothing needs your attention** —
"Overdue work, failed inspections and parts below their minimum will be listed
here." When everything has been read it says **Nothing unread** — "Everything
here has been read. New alerts appear as the records change."

While the records are still being read, the panel says it is checking rather
than claiming there is nothing.

Picture: `docs/screenshots/WA-18/en-bell-open-1440.png`

## What each role can do here

Every one of the six roles may open this screen and see the switches. That is
deliberate: it used to sit inside Settings, which only two roles can open, so a
technician — the person "Assigned to you" is written for — could not choose what
reached them.

Five of the six roles may change their own switches: the administrator, the
facility manager, the maintenance coordinator, the technician and the inspector.

An **auditor** may not. The screen tells them why, in its own words: **An
auditor reads, and does not change settings** — "The switches are shown so the
rule is visible rather than hidden. An auditor's role is to read the records and
the trail, so nothing here can be changed." The switches stay on screen and are
switched off, rather than the screen being empty.

Nobody can change anybody else's choices. There is no screen for that, in any
role.
