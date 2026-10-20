# 1. My work today

This is the home screen for a technician and an inspector, and it shows one
thing: the work that has been given to you. It is built for a phone held in one
hand, so there is nothing on it competing with the list of jobs.

The other four roles do not have this screen. They start at the Dashboard.

## What is on the screen

**The top bar**, which stays put as you scroll:

- A menu button on the far left. It opens the module list as a panel over the
  screen.
- The WorkAxis mark and name.
- **Connected** or **Working offline**, on the right.
- The bell, with a count of anything unread.
- The language switch, **EN | FR**.
- The session button, showing your role.

**The page heading:** today's date, then **My work today**, then the line "The
work assigned to you, one job at a time."

**A Scan button**, top right of the heading.

**One card, headed "Assigned to me"**, described as "Your open work, most
urgent first." Inside it is a list of jobs. Each row shows, in this order:

- the work-order number,
- a priority tag (Critical, High, Medium or Low),
- a status tag (Open, Assigned, In progress, Waiting for parts, Completed or
  Cancelled),
- the title of the job,
- the site, then either how many days late it is, the date it is due, or "No
  due date".

If nothing is assigned to you the card says **Nothing assigned to you**, with
the line "Work assigned to you appears here, one card at a time."

"Assigned to me" means assigned to you by name. Work handed to a crew rather
than a person does not appear here.

Picture: `docs/screenshots/WA-25/field-my-work-390.png`

## Open a job

1. Tap any row in the list.
2. The work order opens in full. Chapter 5 describes that screen.

Rows are made deliberately tall so they can be hit with a thumb, or with a
glove on.

## Move to another screen

1. Tap the menu button at the top left.
2. The module list slides in, headed **Modules**, with the line "Built for a
   phone in a corridor: today's work, one order at a time."
3. Tap where you want to go. The panel closes.

A technician sees: My work today, Assets, Work orders, Inventory, Documents.
An inspector sees: My work today, Assets, Work orders, Inspections, Documents.

Picture: `docs/screenshots/WA-25/field-navigation-390.png`

## Scan a label

Every asset, part and storeroom bin in WorkAxis can carry a printed label.
Scanning one opens its record without typing anything.

1. From My work today, tap **Scan** at the top right.
2. The screen is headed **Scan**, with the line "Point the camera at a label,
   or upload a photo of one."
3. There are two ways to do it, and both are offered from the start.

**With the camera:**

1. Under **Camera**, press **Start camera**. The screen says "Starting the
   camera…" while it opens.
2. Point it at the label.
3. When it reads the code the screen says **Asset found** or **Part found**,
   with the record's name.
4. Press **Open** to go to the record.
5. Press **Stop camera** when you are done.

**With a photo instead:**

1. Under **Upload a photo** — "Works with no camera, and on a desktop" — press
   **Choose a photo**.
2. Pick a picture of the label from the device.
3. The same **Asset found** or **Part found** result appears, with **Open**.

If the camera will not start, the screen says which of three things happened:

- **The camera is blocked** — "This browser is not letting WorkAxis use the
  camera. Allow it from the address bar, or upload a photo of the label
  instead."
- **No camera on this device** — "Upload a photo of the label instead."
- **The camera did not start** — "Try again, or upload a photo of the label
  instead."

If the code is not one of ours, a message says the code "is not a WorkAxis
label."

## What each role can do here

My work today can only be opened by a technician or an inspector. It is their
home screen. For the other four roles it is not in the module list at all; if
one of them reaches the address anyway, the screen says **Not available to your
role**, then "This screen is limited to other roles. Your current role is" and
the role name.

Nothing on this screen is switched off for the two roles that have it. Both may
scan, both may open a job. What they may then do inside that job differs, and
chapter 5 sets it out.
