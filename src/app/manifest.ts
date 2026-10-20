import type { MetadataRoute } from "next";

/**
 * What a phone needs to keep this on a home screen.
 *
 * Next's own metadata route rather than a package: a manifest is a dozen fields
 * and a dependency for it would be a dependency to licence and explain.
 *
 * `start_url` is the bare root so the locale middleware decides which language
 * opens, the same as any other visit. Pinning it to /en would make an installed
 * French app open in English.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WorkAxis",
    short_name: "WorkAxis",
    description:
      "Maintenance management for facilities: assets, work orders, inspections and parts.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0f4340",
    // PNG as well as SVG, because the two platforms disagree: Chrome is happy
    // with the vector, and iOS wants raster. Both were rendered from the same
    // source file rather than drawn twice, so they cannot drift apart.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/workaxis.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
