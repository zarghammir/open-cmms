# 8. Inventory

Inventory is the spare-parts register: what is on the shelf, where it is kept,
and what has been issued to which job. Stock only means something next to a
minimum, so every part is recorded with the level it should not fall below.

## What is on the screen

**The page heading:** **Inventory**, then "Spare parts, stock levels and what
was issued to which job." A **Verify inventory** button sits at the top right.

**A toolbar**: a search box, "Stock number, name or bin", filter buttons,
**Columns**, **Clear filters**, and a count on the right.

**The table**: "Spare parts, with what is on hand and where it is kept".

Columns are Stock number, Part, Stock, On hand, Minimum, Category, Bin, Unit
cost, and Actions. The Stock column says **Low** or **In stock**. A part is Low
when what is on hand is below the minimum; a part sitting exactly on its
minimum is at it, not below it, and reads as In stock.

On a phone the table becomes cards, each saying how many are on hand and what
the minimum is.

Pictures: `docs/screenshots/WA-12/en-parts-register-1440.png` and
`docs/screenshots/WA-12/en-parts-register-390.png`

## Find a part

1. Type into the search box — it matches the stock number, the name and the bin.
2. Or filter by category, site or stock state.
3. **Clear filters** starts again.

To see only what needs ordering, filter the Stock column to Low. The Dashboard
card **Parts below minimum** brings you here with that filter already on.

## Act on a row without opening it

1. Click the actions button at the end of a row.
2. Two choices:
   - **Print label** — opens the printable label for that part.
   - **Copy stock number** — copies it and confirms.

## Open one part

Click the stock number. The record shows:

**Details** — category, site, bin, what is on hand, the minimum, and the unit
cost.

**Movements** — every receipt, issue, adjustment and return recorded against
the part, each showing how many moved in or out, who did it, and which work
order it was against. A movement not tied to a job says so. If nothing has
moved, it says "Nothing has moved against this part."

Picture: `docs/screenshots/WA-12/en-part-ledger-1440.png`

## Issue a part to a job

Parts leave stock from the work order, not from this screen, so that what was
used is attached to the job it was used on. Chapter 5 has the steps: open the
order, press **Issue a part**, choose the part and the quantity, press
**Issue**.

## Count a shelf

**Verify inventory** is for checking what is physically there against what the
system thinks.

1. Press **Verify inventory** at the top right.
2. The screen is headed **Inventory verification** — "Scan the parts on a shelf
   and record what you counted."
3. Scan a part label with the camera, or upload a photo of one. The camera and
   the photo option work exactly as chapter 1 describes.
4. The part joins the **Count sheet**. Before you scan anything the sheet says
   "Scan a part label to add it to the sheet."
5. Each row shows the part, its bin, and **On record:** with the quantity the
   system holds.
6. Type what you actually counted into the **Counted** box.
7. Press **Record count**.

What happens next depends on the number:

- If it matches, the row says "The count matched the records. Nothing was
  changed." Checking a number is not a movement, so nothing is written to stock.
- If it differs, the row says "Stock adjusted, and the movement was written to
  the records." The new figure becomes the stock level and the change appears in
  that part's Movements.

**Remove** takes a row off the sheet. A count must be a whole number, zero or
more; anything else is refused with that sentence. Scanning an asset label
instead of a part says "That is an asset label. Scan a part to count it."

## What each role can do here

Inventory is open to the administrator, the facility manager, the maintenance
coordinator, the technician and the auditor. An **inspector** does not have it
in their module list; opening the address gives **Not available to your role**,
with "This screen is limited to other roles. Your current role is" and the role
name.

Reading the register, opening a part and printing a label are the same for all
five roles that have it.

**Recording a count** needs the right to correct a stock count. The
administrator, the facility manager, the maintenance coordinator and the
technician hold it. An auditor may open the verification screen and scan, but
the screen tells them plainly: **You cannot record counts** — "Your role may
open this screen but may not change stock levels."

**Issuing a part**, on a work order, needs a separate right. The same four roles
hold it. The two are deliberately apart: issuing takes a known quantity out
against a job, while adjusting overrides the recorded count with what was found
on the shelf.
