"use client";

import { useDemoBoot, useDemoData } from "@/hooks/use-demo-data";

/**
 * Fills the store the first time the demonstration is opened, and says when it
 * has. Mounted once, in the application layout, so it is on every screen in
 * both shells.
 *
 * The waiting and the seeding live in `useDemoBoot`; a component's job here is
 * only to be somewhere in the tree that runs on the client.
 *
 * The marker it renders is for the browser tests, and it is worth the one
 * element. A test that wants to click something has to know the click will
 * land, and every screen-specific proxy for that — a button being enabled, a
 * heading being visible — is true of the server-rendered markup before React
 * has bound a single handler. `data-demo-status` can only read "ready" after a
 * client component has re-rendered with an answer from the store, so it proves
 * both halves at once: React is running, and the records are there.
 *
 * Without it, every test guesses at a proxy of its own, and nineteen of them
 * guessed wrong — which is what WA-52 was.
 */
export function DemoBoot() {
  useDemoBoot();
  const { status } = useDemoData();

  return <span hidden data-slot="demo-boot" data-demo-status={status} />;
}
