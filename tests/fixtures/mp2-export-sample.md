# MP2-style export fixture — data dictionary

Files in this folder:

| File | What it is |
| --- | --- |
| `mp2-export-sample.xlsx` | The fixture. Three sheets: `Equipment`, `Inventory`, `WorkOrders`. |
| `mp2-export-sample-equipment.csv` | CSV mirror of the `Equipment` sheet. |
| `mp2-export-sample-inventory.csv` | CSV mirror of the `Inventory` sheet. |
| `mp2-export-sample-workorders.csv` | CSV mirror of the `WorkOrders` sheet. |
| `mp2-export-sample.md` | This dictionary. |

## What this is, and what it is not

This is a **synthetic** spreadsheet shaped like an export from a legacy MP2 maintenance
system. It exists so the WorkAxis import wizard (WA-17) has something realistic to import
during the demo, and so the validation report has real problems to find. Nobody supplied a
real MP2 export; every value here was generated.

No real organization, agency, vendor or person is named anywhere in this file. The
laboratory network name, the manufacturers and the staff codes are invented.

The five site **cities** are a deliberate exception. Kingston, Sudbury, Moncton,
Kamloops and Regina mirror the real national laboratory footprint of the organization
this bid targets, so that an evaluator reading the import preview recognizes the scenario
as their own. That is intentional, and it is the only place where the data is drawn from
life. The network wrapped around those cities is fictional, and no real organization,
agency, vendor or person is named.

**Row numbers in this document are spreadsheet row numbers**: the header is row 1, so the
first data row is row 2. The CSV mirrors use the same numbering (header is line 1).

## The fictional network

A federal-style laboratory network — the **Dominion Laboratory Network** — with five sites.
The three-letter site code is the first segment of every `LOCATION` and `BIN` value.

| Code | Site | Province |
| --- | --- | --- |
| `KGN` | Kingston Central Laboratory | Ontario |
| `SUD` | Sudbury Regional Laboratory | Quebec |
| `MCT` | Moncton Regional Laboratory | Manitoba |
| `KAM` | Kamloops Regional Laboratory | Alberta |
| `REG` | Regina Regional Laboratory | British Columbia |

`LOCATION` is `SITE-Bnn-rrr` (site, building, room), for example `KGN-B02-219`.
`BIN` is `SITE-Xnn-nn` (site, aisle, shelf), for example `KGN-C11-05`.

## Deliberate legacy characteristics

These are properties of the fixture, not defects. They are here because a real legacy
export has them, and the importer has to cope:

- **Every date is stored as text, not as an Excel date.** Legacy exports routinely do this.
  Correct values use `YYYY-MM-DD`; the two planted malformed dates do not.
- **Codes, not labels.** Status, criticality, priority, and work-order type are short legacy
  codes. The importer maps them; see the mapping tables below. The English words on the
  right-hand side of those tables are display examples only: the importer maps each legacy
  code to a WorkAxis **domain value / catalog key** (for example the status key behind
  "Waiting for Parts"), and the English and French strings a user actually sees come from
  the `en` and `fr` catalogs, never from this file.
- **`EQUIP_NO` carries meaning** (`TYPE-SITE-NN`). It is a natural key, not an identifier
  WorkAxis should keep.
- **Blank cells are genuinely empty**, not the string "NULL".

## Sheet: Equipment (80 data rows, rows 2–81)

Maps to the WorkAxis **Asset** entity.

| Column | Type | Example | Maps to | Notes |
| --- | --- | --- | --- | --- |
| `EQUIP_NO` | text | `AHU-KGN-01` | `Asset.assetTag` | Natural key. **Not unique** — see D1, D2. 78 distinct values across 80 rows. |
| `EQUIP_DESC` | text | `Air Handling Unit` | `Asset.name` | Required. Blank on one row — see D10. |
| `LOCATION` | text | `KGN-B02-219` | `Asset.locationId` | Resolve site → `Facility`, building/room → `Location`. |
| `MFG` | text | `Norvent Systems` | `Asset.manufacturer` | Invented manufacturers, pooled by equipment category. |
| `MODEL` | text | `NS-3689X` | `Asset.model` | |
| `SERIAL_NO` | text | `H11A-47882` | `Asset.serialNumber` | Not unique-checked by the importer. |
| `INSTALL_DATE` | text date | `2007-10-16` | `Asset.installedAt` | ISO except one row — see D6. Range 1999-12-29 to 2025-07-10, all relative to today. |
| `STATUS` | code | `A` | `Asset.status` | `A`→Active, `I`→Inactive, `D`→Decommissioned. |
| `CRITICALITY` | code | `H` | `Asset.criticality` | `C`→Critical, `H`→High, `M`→Medium, `L`→Low. |

Equipment mix is realistic laboratory and building plant: air handling units, chillers,
boilers, cooling towers, emergency generators, UPS units, transfer switches, elevators,
fire alarm panels, sprinkler systems, backflow preventers, autoclaves, fume hoods,
biosafety cabinets, ultra-low freezers, laboratory refrigerators, CO2 incubators,
centrifuges, RO/DI water systems, air compressors, vacuum pumps, eyewash and shower
stations, walk-in cold rooms, laboratory exhaust fans, glassware washers, liquid nitrogen
vessels, HEPA filtration units and industrial dehumidifiers.

Rows are spread evenly across the five sites (16 per site, less the one row whose location
was deliberately pointed at a sixth, non-existent site).

## Sheet: Inventory (40 data rows, rows 2–41)

Maps to the WorkAxis **Part** entity.

| Column | Type | Example | Maps to | Notes |
| --- | --- | --- | --- | --- |
| `STOCK_NO` | text | `FLT-7571` | `Part.partNumber` | Natural key. Unique across all 40 rows. |
| `DESCRIPTION` | text | `Air Filter, Pleated MERV 13, 24x24x2` | `Part.name` | Required. Present on every row. |
| `QTY_ON_HAND` | integer | `9` | `Part.quantityOnHand` | Must be ≥ 0. One row is negative — see D9. |
| `MIN_QTY` | integer | `4` | `Part.reorderPoint` | Reorder trigger. |
| `UNIT_COST` | decimal | `93.49` | `Part.unitCost` | CAD. Range 9.23 to 1402.24. One row holds text — see D12. |
| `BIN` | text | `KGN-C11-05` | `Part.inventoryLocationId` | Resolve site → `Facility`, remainder → `InventoryLocation`. |

Parts are consumables and spares that match the equipment list: filters, belts, gaskets and
door seals, UV and LED lamps, sensors and thermocouples, valves and steam traps, pumps and
seal kits, motor bearings and couplings, contactors, relays, fuses and batteries, water
filter cartridges, RO membranes and DI resin, sprinkler heads, smoke detectors,
extinguishers, refrigerant, grease and chart paper.

## Sheet: WorkOrders (120 data rows, rows 2–121)

Maps to the WorkAxis **WorkOrder** entity.

| Column | Type | Example | Maps to | Notes |
| --- | --- | --- | --- | --- |
| `WO_NO` | text | `WO-100001` | `WorkOrder.number` | Natural key, `WO-100001` … `WO-100120`. Unique. |
| `EQUIP_NO` | text | `EWS-KAM-01` | `WorkOrder.assetId` | Required foreign key into the Equipment sheet. Three do not resolve — see D3, D4, D5. |
| `WO_TYPE` | code | `PM` | `WorkOrder.type` | `PM`→Preventive, `CM`→Corrective, `EM`→Emergency, `INSP`→Inspection, `CAL`→Calibration, `SAF`→Safety. |
| `PRIORITY` | integer | `2` | `WorkOrder.priority` | MP2 numbers run high-to-low: `1`→Critical, `2`→High, `3`→Medium, `4`→Low. |
| `DATE_REQUESTED` | text date | `2025-08-08` | `WorkOrder.requestedAt` | ISO on every row. Within roughly the last 18 months, relative to today. |
| `DATE_DUE` | text date | `2025-09-22` | `WorkOrder.dueAt` | ISO except one row — see D7. |
| `DATE_COMPLETED` | text date | `2025-09-19` | `WorkOrder.completedAt` | Populated only where `STATUS` is `COMP`; blank otherwise. One is in the future — see D8. |
| `STATUS` | code | `ASSGN` | `WorkOrder.status` | `OPEN`→Open, `ASSGN`→Assigned, `INPRG`→In Progress, `WMATL`→Waiting for Parts, `COMP`→Completed, `CANC`→Cancelled. |
| `ASSIGNED_TO` | code | `TECH03` | `WorkOrderAssignment.userId` | Trade/crew code, not a person. See "Known gaps" below. |
| `DESCRIPTION` | text | `Quarterly preventive maintenance per manufacturer checklist` | `WorkOrder.description` | Required. Present on every row. |

Status spread: 56 `COMP`, 18 `OPEN`, 15 `INPRG`, 14 `WMATL`, 12 `ASSGN`, 5 `CANC` — so the
import lands work in every WorkAxis status, including the two that are not part of the
straight-line flow. Type spread: 60 `PM`, 29 `CM`, 13 `INSP`, 10 `CAL`, 5 `SAF`, 3 `EM`.

`ASSIGNED_TO` uses `TECH01`–`TECH12`, `HVAC01`–`HVAC04`, `ELEC01`–`ELEC03` and `CONT01`
(external contractor).

## The 12 planted defects

Every one of these is deliberate. Each row below was verified by reading the saved
`.xlsx` back off disk. Each defect is the **only** anomaly in its row: the surrounding
values were kept internally consistent so the validation report has exactly one thing to
say about each.

| # | Sheet | Row | Column | Value | What the validation report should say |
| --- | --- | --- | --- | --- | --- |
| D1 | Equipment | **19** | `EQUIP_NO` | `BLR-MCT-01` | Duplicate asset tag — also on row 14. Same boiler entered twice with a conflicting room (`MCT-B01-187` vs `MCT-B04-237`), serial number and install date. |
| D2 | Equipment | **54** | `EQUIP_NO` | `ATS-MCT-01` | Duplicate asset tag — also on row 34. Same transfer switch entered twice with a conflicting room, serial number and install date. |
| D3 | WorkOrders | **23** | `EQUIP_NO` | `AHU-KGN-99` | Work order references an asset that is not in the Equipment sheet. |
| D4 | WorkOrders | **58** | `EQUIP_NO` | `BSC-HAL-01` | Work order references an asset that is not in the Equipment sheet. |
| D5 | WorkOrders | **101** | `EQUIP_NO` | `PMP-MCT-07` | Work order references an asset that is not in the Equipment sheet. |
| D6 | Equipment | **33** | `INSTALL_DATE` | `15/03/2022` | Date is not `YYYY-MM-DD`. Day-first format; unambiguous (day 15) but not the expected one. |
| D7 | WorkOrders | **44** | `DATE_DUE` | `12/24/2025` | Date is not `YYYY-MM-DD`. Month-first format; unambiguous (day 24) but not the expected one. |
| D8 | WorkOrders | **76** | `DATE_COMPLETED` | `2029-06-08` | Work order is `COMP` but its completion date is in the future. |
| D9 | Inventory | **12** | `QTY_ON_HAND` | `-4` | Quantity on hand cannot be negative. |
| D10 | Equipment | **47** | `EQUIP_DESC` | *(blank)* | Required description is missing; the asset has no name to import. |
| D11 | Equipment | **62** | `LOCATION` | `HAL-B01-118` | Location refers to site `HAL`, which is not one of the five sites in the network. |
| D12 | Inventory | **27** | `UNIT_COST` | `N/A` | Unit cost is text where a number is required. |

Defect counts are exact. Across the whole workbook there are exactly two duplicate asset
tags, exactly three unresolvable work-order asset references, exactly two non-ISO dates,
exactly one future completion date on a completed order, exactly one negative quantity,
exactly one missing required description, exactly one unknown-site location, and exactly
one non-numeric unit cost. There are no other anomalies.

Suggested severity for the validation report: D3–D5, D10 and D11 block the affected row
(the record cannot be created without a resolved asset, a name, or a location). D1, D2, D6,
D7, D8, D9 and D12 are recoverable — the wizard can ask the user to pick a winner, confirm
a date interpretation, or supply a value.

## Fixture expiry

This is a static, committed artifact, and the generator that anchors dates to today is
deliberately kept outside the repository — so the file cannot refresh itself.

**D8 expires on 2029-06-08.** Its defect is "completed, with a completion date in the
future," and the stored completion date is `2029-06-08`. That only reads as a defect while
the date is still ahead, so the last day D8 holds is **2029-06-07**. From 2029-06-08 the row
becomes an ordinary completed work order, the workbook holds **11** defects rather than the
12 this dictionary promises, and nothing in the file itself would say so. The failure is
silent: the validation report simply shows one fewer row.

The offset was set deliberately long (1000 days from generation) so this cannot bite during
the bid, the demo, or any plausible follow-on work. The safety net is a **fixture-integrity
test owned by WA-17**: it asserts three sheets, 80 / 40 / 120 data rows, and exactly 12
defects, and fails loudly rather than letting the count drop quietly. If that test ever goes
red on the date above, the fix is to regenerate D8 with a longer offset, not to lower the
expected count.

**The open work orders' due dates also age**, and unlike D8 that is deliberate — see
"Work-order due dates" below. They are spread so that roughly a third of the open orders
read as overdue, a third as due this month and a third as later, and that spread drifts
later every week the demonstration is not refreshed. It degrades gracefully: the
proportions shift, nothing becomes wrong, and the refresh instruction is recorded with the
spread.

Every other date in the workbook sits in the past or is malformed by design, so nothing
else changes meaning as time passes. An earlier version of this sentence claimed that of
*every* date, which was already untrue of two `DATE_DUE` cells — rows 30 and 93 — before
the spread was applied.

## Work-order due dates

The generated due dates were an artefact of how the fixture was built rather than a
picture of a maintenance backlog: **57 of the 59 open work orders were already past due**,
and the rest would have followed within the week. Imported as-is, every operational screen
in the demonstration showed a service that never finishes anything — not the impression
the data should give, and not what a real backlog looks like.

So `DATE_DUE` was respread across the open orders — `OPEN`, `ASSGN`, `INPRG` and `WMATL` —
as a surgical edit. Measured after the change: **20 overdue, 19 due this month, 19
later.**

The oldest requests were made overdue and the newest given the later dates, because that
is the shape a real backlog has: what is late is late because it has been waiting. Every
new due date is strictly after its own `DATE_REQUESTED`, checked on every row, so the edit
could not introduce a thirteenth anomaly of its own.

**What was not touched.** Only `DATE_DUE`, only on open orders, only where the existing
value was already a readable ISO date. A cell-by-cell comparison of the whole workbook
before and after reports exactly **58 changed cells, all in `WorkOrders!DATE_DUE`** — no
other column, no other sheet, no row count, and no planted defect. Row 44 (D7, the
deliberately malformed due date) and row 76 (D8, the future completion) are both
untouched, and the twelve defects still verify at the rows listed above with their
mutation controls intact.

The changed rows, by bucket:

| Bucket | Rows |
| --- | --- |
| Overdue (20) | 4, 9, 10, 14, 17, 24, 54, 58, 69, 70, 73, 83, 87, 91, 94, 96, 97, 98, 106, 115 |
| Due this month (19) | 2, 6, 7, 8, 13, 18, 20, 32, 35, 48, 52, 62, 63, 64, 89, 95, 107, 111, 113 |
| Later (19) | 23, 29, 34, 46, 51, 53, 55, 61, 66, 78, 79, 93, 99, 100, 102, 103, 108, 109, 121 |

Completed and cancelled orders keep the due dates they were generated with. Their due date
is history, and moving it would rewrite what happened.

**Refreshing it.** The spread is anchored to 2026-09-13. It does not break as that date
recedes — orders simply drift from "later" toward "overdue" — but if the demonstration is
given long after the bid, respread it the same way and update the table above. The
fixture-integrity test deliberately does not police the proportions, only the structure
and the twelve defects: a test that failed every week for a cosmetic reason is a test
somebody turns off.

## Known gaps

- **`ASSIGNED_TO` has no user to map to yet.** The codes are trade/crew codes
  (`TECH01`, `HVAC02`, `CONT01`), not people. Mapping them onto `WorkOrderAssignment.userId`
  needs a code-to-user table that the seed data (WA-26) has to provide. Until it exists,
  the importer should treat an unmatched code as an unassigned work order rather than
  inventing a user. **This is an open dependency, not something this fixture can close.**
- **The five site codes are ratified and bind the seed data.** `KGN`, `SUD`, `MCT`, `KAM`
  and `REG`, under the Dominion Laboratory Network name, were ratified on WA-29 and are
  binding on the seed ticket (WA-26). If the seed ever uses different codes the import will
  report every location as unknown and this fixture has to be regenerated to match.
- **The five cancelled work orders carry no cancellation reason.** MP2 has no reason column,
  so rows 19, 28, 33, 118 and 120 (`WO-100018`, `WO-100027`, `WO-100032`, `WO-100117`,
  `WO-100119`) import into a status whose required field cannot be filled from the source.
  The WorkAxis rule that Cancelled requires a reason still stands — this is a gap in the
  source data, not a reason to relax the rule. The importer (WA-17) records the explicit
  value `"No reason recorded in source system"` rather than inventing a reason, and lists
  those rows in the validation report so the gap is visible. **Owner: WA-17.**
- **No French content.** Legacy MP2 descriptions in a bilingual organization would often be
  mixed English and French. Everything here is English, which understates how messy a real
  import is. Worth revisiting if the demo shows the import in French.
- **No accented characters or encoding damage.** A real legacy export frequently carries
  mojibake. Not planted, because the ticket asked for exactly 12 defects.

## Regenerating

The generator is a Python script using `openpyxl`, kept **outside** the repository
(`~/.claude/cmms-work/wa29-generate.py` on the owner's machine) with a throwaway virtual
environment, so no Python toolchain or dependency enters this project. It is deterministic:
`random.seed(20260913)`. Regenerating shifts every non-defect value but keeps the defects on
the rows listed above. If you regenerate, re-verify against this dictionary before
committing — the row numbers here are load-bearing for the demo script.
