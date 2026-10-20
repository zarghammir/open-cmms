# 14. Waiting to send

Waiting to send shows the changes saved on this device that the server has not
been told about yet. It belongs to the device rather than to a person: whoever
is holding the tablet needs to be able to see what has not gone out.

It is not in the module list. You reach it from the offline banner, which is
where the question comes up.

## Getting there

When the connection drops, a banner appears at the top of the screen headed
**Working offline** — "Changes are saved on this device and sent when the
connection returns." It counts what is waiting and offers **See what is
waiting**. Follow that.

The top bar of every screen also says **Connected** or **Working offline** at
all times, so you always know which state you are in.

Picture: `docs/screenshots/WA-15/offline-banner-1440.png`

## What is on the screen

**The page heading:** **Waiting to send**, then "Changes saved on this device
that the server has not been told about yet."

**The queue**, in the order it will be sent. Each entry says what the change
will do, in words. Entries made without a signal are marked **Saved while
offline**, and each says which role saved it.

**What happened last**, underneath, once anything has been sent.

When nothing is waiting and you have a connection, it says **Everything has been
sent** — "Nothing on this device is waiting for the server."

When nothing is waiting and you do not, it says **Nothing is waiting yet** —
"You are working offline. Anything you change now is saved on this device and
listed here until the connection returns."

Picture: `docs/screenshots/WA-15/queued-1440.png`

## What happens when the connection returns

The queue sends itself, in order, without being asked. You do not press
anything. Each change that goes through is added to the synchronization record
on Settings, which lists what has been sent since the demonstration started,
newest first.

Picture: `docs/screenshots/WA-15/sync-log-1440.png`

## When two versions disagree

If a record changed on the server while you were away, your change is not sent
and is not thrown away. It waits for you to decide.

1. A box opens headed **Two versions of** and the record. It says "This change
   was made here while offline. The server already had a different one. Nothing
   is sent until you choose."
2. Two panels side by side: **On this device**, described as your change made
   while offline, and **On the server**, naming who set it, to what, and when.
3. Press **Keep this device's version** or **Keep the server's version**.
4. The queue starts moving again.

Until you choose, the queue stops: it says that nothing else is sent until the
two versions are settled. That is deliberate. Sending later changes past a
disputed one would apply them on top of a record nobody has agreed on yet.

Picture: `docs/screenshots/WA-15/conflict-1440.png`

## When a screen cannot be opened offline

Ask for a screen this device has never shown and you get a page headed **You are
offline** — "This screen has not been opened on this device, so there is no copy
of it here to show." It adds that everything already open still works, and that
anything you change is saved on this device and sent when the connection
returns. There is a **Go back** button.

This is a plain page with nothing to load, because it is what you see when
everything else has already failed.

Picture: `docs/screenshots/WA-47/offline-refusal-390.png`

## If the device stops saving

Separately from the network, a browser can refuse to store anything — private
browsing, or storage turned off for the site. If that happens a standing notice
appears: **This device is not saving changes** — "The last change was not stored,
so it will be gone when you reload. Check that this browser is allowed to store
data for this site."

Take it seriously. It means what is on the screen is not written down anywhere.

Picture: `docs/screenshots/WA-85/en-not-saving-1440.png`

## What each role can do here

Every one of the six roles may open this screen, for the same reason it exists:
the queue belongs to the device, and whoever is holding it has to be able to see
what has not been sent. A technician is exactly the person who would otherwise
be locked out, since Settings holds the same information for the two roles that
can open Settings.

There is nothing on this screen to switch off. Reading the queue and choosing
between two versions of a record are open to whoever is holding the device: the
change is already made, and the only question left is which version stands. The
server in this demonstration is simulated, and the conflict box says so.
