# 10. Reports

Reports turn the same records the screens use into something you can read
across, print, or send to somebody. A number in a report can always be traced
back to the work orders behind it, because nothing here is kept separately.

## What is on the screen

**The page heading:** **Reports**, then "Operational reporting on work,
compliance and stock."

**A row of four buttons** under the heading, labelled **Report**. They are the
four reports:

| Report               | What it shows                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Work-order aging     | "How long the open work has been open. Buckets rather than an average, because the job open since March is the row anybody acts on." |
| Completion by site   | "What each site raised, and what it finished."                                                                                       |
| Inventory status     | "What is on the shelf, and what is under its minimum."                                                                               |
| Inspection pass rate | "How many inspections passed. Work not yet done sits outside the rate rather than counting as a failure."                            |

**A site filter**, the same control the Dashboard uses. It starts on **All
sites**.

**The table** for whichever report you picked.

**A count** of how many rows are on the report, and an **Export these rows**
button.

Pictures: `docs/screenshots/WA-22/en-reports-filtered-1440.png` and
`docs/screenshots/WA-22/en-reports-export-1440.png`

## What each report holds

**Work-order aging.** Columns: Open for, Work orders, Oldest (days). The rows
are four buckets — A week or less, 8 to 30 days, 31 to 90 days, More than 90
days. Reading the bottom row first tells you what has been ignored longest.

**Completion by site.** Columns: Site, Raised, Completed, Rate. One row per
site, with the rate as a percentage.

**Inventory status.** Columns: Stock number, Part, Category, On hand, Minimum,
State. State is **Below minimum** or **In stock**. This is the ordering list.

**Inspection pass rate.** Columns: Site, Passed, Failed, Not yet done, Rate.
Inspections not yet done are counted in their own column and left out of the
rate, so unfinished work does not read as failed work.

## Read a report

1. Press one of the four report buttons.
2. The table changes. The line under the chooser says what the report is for.
3. Narrow to one site with the site filter if you want.
4. The count above the table tells you how many rows you are looking at.

The report you chose and the site you chose are both kept in the page address,
so you can copy the link and send it to somebody and they will open the same
report.

If a report has nothing to say for the site you picked, it says **Nothing to
report here** — "This report has no rows for the site you have chosen. Widen the
filter to every site to see the rest."

## Export a report

1. Set the report and the site filter the way you want them.
2. Press **Export these rows**.
3. A CSV file downloads, holding exactly the rows on the screen.
4. A message confirms how many rows were exported and notes that the trail
   records it.

The export follows the language you are reading in, so a French reader gets
French column headings.

## Print a report

Use the browser's own print command. The report prints what is on the screen,
with the filters you have applied.

## What each role can do here

Reports is open to the administrator, the facility manager, the maintenance
coordinator and the auditor. A technician and an inspector do not have it in
their module list; opening the address gives **Not available to your role**,
with "This screen is limited to other roles. Your current role is" and the role
name.

All four roles that have it can do everything on this screen, including
**Export these rows**. Nothing here is switched off for anybody, because
reporting is reading, and an auditor whose job is to read the records needs to
be able to take them away. Every export is written to the trail with the name of
whoever ran it.
