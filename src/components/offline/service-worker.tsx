"use client";

import { useEffect } from "react";
import { offlineRefusalPages, REFUSAL_MESSAGE } from "@/lib/offline-refusal";
import { WARM_MESSAGE, WARM_ROUTES } from "@/lib/offline-routes";

/**
 * Registers the worker that lets the application open with no network.
 *
 * Production only. In development the worker would serve cached HTML while
 * somebody is editing, which looks exactly like a change that did not take.
 *
 * Renders nothing, and is deliberately quiet: a registration failure is not
 * worth a message to a person who did not ask for one, and the offline tests
 * assert registration explicitly rather than trusting it happened.
 *
 * It also hands the worker two things, once, when there is a worker in control:
 * the pages it answers with when an address is not on this device, which cost
 * nothing to build and go over whatever the connection is doing; and the
 * addresses in `WARM_ROUTES` to fetch into the cache, asked for only when there
 * is a connection to fetch them with.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // `ready` resolves with an active worker, which is not the same as one
        // controlling this page: `controller` is what says the messages will be
        // heard.
        const worker =
          navigator.serviceWorker.controller ?? registration.active;
        if (!worker) return;

        // The refusal pages first, and whatever the connection is doing: they
        // are built here rather than fetched, so there is nothing to wait for,
        // and they are what a person reads when a warm has not happened.
        worker.postMessage({
          type: REFUSAL_MESSAGE,
          pages: offlineRefusalPages(),
        });

        // Offline there is nothing to warm with.
        if (!navigator.onLine) return;

        worker.postMessage({ type: WARM_MESSAGE, urls: [...WARM_ROUTES] });
      })
      .catch(() => {
        // Nothing to do: the application works without it, only not offline.
      });
  }, []);

  return null;
}
