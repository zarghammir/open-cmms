# 3. Facilities

Facilities is the map of the places: sites, buildings, floors and rooms. Every
asset and every work order is filed against a location, so this is the tree
everything else hangs off.

## What is on the screen

**The page heading:** **Facilities**, then the line "Sites, buildings, floors
and rooms."

**A pair of buttons** labelled **List** and **Map**, under the heading "How to
read the places". List is where you start.

Picture of the switch: `docs/screenshots/WA-105/facilities-map-1440.png`. The
older capture below was taken before the switch was added, so it does not show
these two buttons.

### The list

An expanding tree, five sites deep. Each entry shows what kind of place it is —
Site, Building, Floor or Room — and two counts beside it:

- how many pieces of equipment are recorded there,
- how many open work orders there are against them.

Open a room and you get the equipment standing in it, each one a link into the
asset register. A room with nothing in it says **Nothing recorded in this
room**, and explains that equipment is filed against the room it stands in, so
a room with none is a room nothing has been recorded in yet.

A floor with a drawing on file also offers a **Floor plan** link.

Picture: `docs/screenshots/WA-22/en-facilities-1440.png`

### The map

Press **Map** and the screen shows a floor drawing with a marker on each
machine. Above it is a **Floor** chooser for picking a different floor.

The plan is drawn from tablet width upward. On a phone it says so — "The plan is
shown from tablet width up" — and explains that a floor plan on a phone is
smaller than the machines drawn on it, so use the rooms listed below instead.

Beside the plan are two panels:

**Rooms on this floor.** Every room, with its equipment. Each machine says
whether it is **On the plan** or **Not on the plan**, and offers **Register** to
open its record.

**Selected equipment.** Empty to begin with: **Nothing selected** — "Choose a
machine on the plan, or in the rooms beside it, to see what is open against it."
Pick one and it shows how many work orders are open, how many are overdue,
whether any spare for it is below its minimum, and a list headed **Open work on
this machine**.

Pictures: `docs/screenshots/WA-105/facilities-map-1440.png`,
`docs/screenshots/WA-90/floor-map-1440.png`,
`docs/screenshots/WA-90/room-panel-1440.png` and
`docs/screenshots/WA-90/asset-panel-1440.png`

## Find a piece of equipment by where it is

1. Open **Facilities**.
2. Expand the site, then the building, then the floor, then the room.
3. The equipment in that room is listed. Click one to open its record.

## Look at a floor plan

1. Press **Map**.
2. Choose the floor from the **Floor** list.
3. Click a marker on the drawing, or a machine in the rooms panel.
4. The **Selected equipment** panel fills in with what is open against it.

Four things the plan will tell you rather than leaving you guessing:

- **No drawing on file for this floor** — the floor was surveyed and no drawing
  was filed. What stands on it is still listed.
- **Nobody has looked for a drawing of this floor** — whether one exists has
  never been recorded, which is not the same as there being none.
- **On this floor, not on the plan** — no position has been recorded for these
  machines, so the drawing cannot show where they stand. They are listed anyway.
- A marker naming equipment the records no longer hold is shown as an unreadable
  marker, not as empty floor.

## Raise a work order from the plan

1. Select a machine on the plan.
2. In the **Selected equipment** panel, press **Raise a work order**.
3. A box opens headed "Raise a work order for" and the tag. The equipment is
   already chosen.
4. Fill in the rest as described in chapter 5 and submit.

The new order appears against that machine on the plan as soon as it is stored.

## What each role can do here

Facilities is open to the administrator, the facility manager, the maintenance
coordinator and the auditor. A technician and an inspector do not have it in
their module list; opening the address gives **Not available to your role**,
with "This screen is limited to other roles. Your current role is" and the role
name.

Reading the tree and the plans is the same for all four roles that have it.

**Raise a work order**, on the plan, is the one control that differs. The
administrator, the facility manager and the maintenance coordinator may use it.
For an auditor the button stays on screen and is switched off, saying "Auditor
cannot do this. Switch role to continue."
