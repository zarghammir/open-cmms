# 7. Inspections

Inspections will hold the inspection templates, the inspections that have been
completed, and the findings they raise. It is the module that makes a result
auditable: a fixed set of questions with a recorded answer for each.

**This screen is not built yet.** Everything below describes what is on it
today and what it will hold. Nothing else in this chapter should be read as a
description of working software.

## What is on the screen today

**The page heading:** **Inspections**, then "Templates, completed inspections
and the findings they raise."

**One panel**, headed **No inspection templates yet**, which explains that an
inspection is a fixed set of questions with a recorded answer for each, and
that this is what makes the result auditable. Under it are the three things the
screen will hold:

- Reusable templates with pass, fail and measured-value questions.
- Completed inspections with who did them and when.
- Findings that become work orders without being retyped.

There is nothing to press on this screen and nothing to fill in.

## What you can see about inspections today

Two things elsewhere in the product already work, and they are worth knowing
while this module is being built.

**On a piece of equipment.** Open any asset and go to the **Inspections** tab.
It lists what has been inspected on that machine, with the result — Scheduled,
In progress, Passed or Failed — and the date it was done or is scheduled for.
See chapter 4.

**On the Dashboard.** The card **Inspections scheduled** counts what is still to
run. Clicking it brings you here. See chapter 2.

An inspection report can also be filed as a document against an asset or a work
order. See chapter 9.

## What each role will be able to do here

The module is already open to the administrator, the facility manager, the
maintenance coordinator, the inspector and the auditor. A **technician** does
not have it in their module list, and opening the address gives **Not available
to your role**, with "This screen is limited to other roles. Your current role
is" and the role name.

Recording an inspection is a right held by the administrator, the facility
manager and the inspector. A maintenance coordinator and an auditor may read
inspections but not record them. When the screen is built, the controls they may
not use will be on it and switched off, saying the role name and then "cannot do
this. Switch role to continue." That is how every other screen does it.
