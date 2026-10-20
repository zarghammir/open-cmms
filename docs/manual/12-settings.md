# 12. Settings

Settings holds the organization's own details, the demonstration controls, the
record of what the system would have emailed, and the way to bring data in from
the old system. It is open to an administrator and a facility manager only.

## What is on the screen

**The page heading:** **Settings**, then "Organization, languages and demo
data." An **Import from MP2** button sits at the top right.

**Organization** — "The organization this demonstration runs for, and the sites
it covers. Read-only in Phase 1." It shows the organization's Name, its Code,
how many Sites it has, and then a table of those sites: Code, Site, Location.

**Demo controls** — "Puts the demonstration back to where it started: the
original records, English, the Administrator role and an expanded module rail."
Under the button is a reminder that the records live in this browser only, and
that resetting affects nobody else.

**Email log** — "What this demonstration would have sent, to whom, and in which
language." It says plainly that nothing is sent: there is no mail server in the
demonstration, and this is the record of the decision. Columns are When, To,
Language and Subject. Mail is written in the recipient's language, not the
reader's, and the screen says so. A note adds that Phase 2 sends these for real
and the screens do not change.

**Synchronization** — "What has been sent since the demonstration started,
newest first." Chapter 14 covers this and the queue behind it.

**A panel at the bottom**, headed "The rest of settings arrives with the screens
it describes". It explains that resetting works now, above, and names the three
things still to come: the default language and time zone, the vocabulary lists
such as asset types and failure causes in both languages, and work-order
numbering with the default due date.

Pictures: `docs/screenshots/WA-31/en-settings-1440.png`,
`docs/screenshots/WA-22/en-settings-organization.png` and
`docs/screenshots/WA-18/en-email-log-1440.png`

## Reset the demonstration

The opener of this manual has the steps. In short: **Demo controls**, then
**Reset the demonstration**, then confirm. Every change made in this browser is
discarded, the original records are rebuilt for today, the language returns to
English and the role to Administrator.

Picture: `docs/screenshots/WA-26/reset-confirm-1440.png`

## Bring data in from MP2

The import takes an MP2 spreadsheet export and creates equipment, parts and work
orders from it. It is deliberately five steps, and nothing is written until the
last one.

1. Press **Import from MP2** at the top right. The screen is headed **Import
   from MP2** — "Bring equipment, parts and work orders across from a
   spreadsheet export." A line tells you which step you are on.

**Step 1, Choose a file.** Press **Choose a file** and pick an `.xlsx` export
with a sheet for equipment, one for parts and one for work orders. It reports
how many sheets and rows it found. A file it cannot open says **That file could
not be read**. A file with no recognisable tabs says **No sheets we recognize**.

**Step 2, Match the columns.** Most columns are matched by name. The ones that
are not are listed, because MP2 spells them differently from one installation to
another. For each, pick the WorkAxis field, or **Do not import**. Required
fields are marked. The step tells you how many are still to match, and will not
let you continue while a required field has nothing behind it.

**Step 3, Check the data.** Every row is read and anything wrong is listed, with
the sheet, the row, the column and the problem. Two kinds:

- **Cannot import** — the row is blocked.
- **Imports anyway** — the row comes in, with a note.

Press **Fix this row** to type a replacement value; the rows are read again.
Nothing has been written at this point. A clean file says **Nothing to report**.

**Step 4, Look before committing.** A list of exactly what would be created —
equipment, parts, work orders and assignments — with a total, and a count of any
rows left out. Imported work orders arrive with no time logged, and the screen
says so.

**Step 5, Commit.** It tells you how many records will be written, as one
change, with one entry in the trail. Press the button to write them. When it is
done you get **Imported** and the count. If anything goes wrong you get
**Nothing was written** — "The import was refused and the records are exactly as
they were."

**Undo.** After a successful import an **Undo this import** button removes every
record it created, and confirms with **Import undone**.

Pictures: `docs/screenshots/WA-35/en-upload-desktop.png`,
`docs/screenshots/WA-35/en-map-1440.png`,
`docs/screenshots/WA-35/en-report-1440.png` and
`docs/screenshots/WA-35/en-preview-1440.png`

## What each role can do here

Settings is open to the **administrator** and the **facility manager**.

The other four roles do not have it in their module list. If one of them opens
the address, the screen says **Not available to your role**, then "This screen
is limited to other roles. Your current role is" and the role name.

Both roles that can open Settings may reset the demonstration and may run the
import: resetting and changing the rules the application follows are rights they
both hold. Reading the organization details, the email log and the
synchronization record needs nothing beyond being able to open the screen.

Your own notification choices are not here. They are on **My notifications**,
chapter 13, which every role can reach, because what a person wants to hear
about is theirs. The email log stays here because it is the organization's
record of what would have been sent to everybody.
