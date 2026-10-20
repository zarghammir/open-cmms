# 4. Assets

Assets is the equipment register: every piece of equipment, what it is, where
it stands, and how critical it is. It is the backbone of the system, because
work orders, maintenance plans, inspections and documents all attach to an
asset.

## What is on the screen

**The page heading:** **Assets**, then "The equipment register: what it is,
where it is, how critical it is." An **Add asset** button sits at the top right.

**A toolbar** above the table:

- a search box, "Tag, name or room",
- filter buttons for narrowing by site, status, criticality and type,
- **Columns**, for choosing which columns to show,
- **Clear filters**, which appears once a filter is on,
- a count on the right. With no filter it counts the rows. Turn one on and it
  reads "Showing", then how many rows you are looking at out of how many there
  are.

**The table.** Columns are Tag, Equipment, Type, Site, Room, Status,
Criticality, Installed, and Actions. Status is Active, Inactive or
Decommissioned. Criticality is Critical, High, Medium or Low. Both are shown as
a word with an icon, never colour alone, so they survive printing.

**Paging** underneath: which page you are on, **Previous** and **Next**.

On a phone the table becomes a list of cards instead, one per asset.

Pictures: `docs/screenshots/WA-27/assets-1440.png` and
`docs/screenshots/WA-27/assets-390.png`

## Find a piece of equipment

1. Type into the search box. It matches the tag, the name and the room.
2. Or use the filter buttons to narrow by site, status, criticality or type.
3. Filters stack, and the count on the right tells you how many rows are left.
4. Press **Clear filters** to start again.

If nothing matches you get **No matches** — "No records match the current search
and filters" — with a button to clear them.

Picture: `docs/screenshots/WA-27/assets-facet-filter-1440.png`

## Act on a row without opening it

1. Click the actions button at the end of a row.
2. Two choices:
   - **New work order** — opens the work-order screen with this equipment
     already chosen.
   - **Copy tag** — copies the tag to the clipboard and confirms it.

## Open one piece of equipment

Click the tag. The record opens with eight tabs.

**Overview.** Identification — asset tag, name, type, manufacturer, model,
serial number, installed date — and Location: the site, building, floor and
room. Anything blank says **Not recorded**.

**History.** "Everything that has happened to this asset, newest first." Work,
inspections, parts and changes, mixed into one list.

**Work orders.** "Work raised against this asset, open first." Each entry
carries its due date.

**Maintenance.** "The plans this asset is on, and when each is next due." Each
row shows the frequency, when it was last done, and how overdue it is.

**Inspections.** "What has been inspected on this asset." Each result is
Scheduled, In progress, Passed or Failed.

**Documents.** "Paperwork filed against this asset." Each entry gives the kind,
the file name, the size, the version and the date it was filed. The panel says
plainly that this demonstration records the document, not the file itself.

**Parts.** "Spares that have been fitted to this asset." Each shows what is on
hand against its minimum, marked **Low** or **In stock**.

**Label.** A printable QR and barcode label for the asset.

Pictures: `docs/screenshots/WA-10/asset-overview-1440.png`,
`docs/screenshots/WA-10/asset-history-1440.png` and
`docs/screenshots/WA-10/asset-label-1440.png`

## Print a label for a machine

1. Open the asset and go to the **Label** tab.
2. Press **Print label**. It prints the label on its own, without the rest of
   the screen.
3. Stick it on the machine. Scanning it later opens this record — see chapter 1.

The label carries the tag and the room in readable text beside the code, so a
damaged label is still usable by a person.

## Change what is recorded about a machine

1. Open the asset.
2. Press **Edit asset**, top right.
3. A box opens: "Change what this system records about" and the tag. It tells
   you the tag, type and location are fixed.
4. You may change Status, Criticality, Manufacturer, Model and Serial number.
5. Press **Save changes**. It confirms with **Asset updated**. If you changed
   nothing it says **Nothing was changed**.

Picture: `docs/screenshots/WA-10/asset-edit-1440.png`

## What each role can do here

Every one of the six roles may open Assets and read the register. It is one of
three screens everybody can see.

**Edit asset** needs the right to change a piece of equipment. The
administrator, the facility manager and the maintenance coordinator have it. For
a technician, an inspector or an auditor the button stays on screen, switched
off, saying the role name and "cannot do this. Switch role to continue."

**Add asset**, at the top right of the register, is governed by the same right.
For the three roles that do not hold it, it is switched off with that same
sentence. For the three that do, pressing it currently answers "Not built yet.
This screen arrives with the records." Adding equipment by hand is not finished;
equipment arrives through the import in chapter 12.

**New work order**, in the row actions, opens the work-order screen. Whether you
may then raise the order is covered in chapter 5.
