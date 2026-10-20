# Third-party notices

Every dependency WorkAxis uses, with the licence it is distributed under.
Versions are pinned exactly in `package.json`; this file is updated in the same
pull request as any dependency change.

No dependency requires a paid licence or a commercial subscription.

## Development and test only

| Package         | Version | Licence | Used for                                             |
| --------------- | ------- | ------- | ---------------------------------------------------- |
| read-excel-file | 9.3.10  | MIT     | Reading the MP2 import fixture in its integrity test |

`read-excel-file` reads a workbook and nothing else — it cannot write one — and
it needs no network at run time. WA-35 promotes it to a shipped dependency when
the import wizard reads a spreadsheet in the browser.

**SheetJS `xlsx` was rejected on security.** The only release on npm is 0.18.5,
published in March 2022, and it carries two HIGH advisories:
GHSA-4r6h-8v6p-xvw6 (prototype pollution) and GHSA-5pgg-2g8v-p4x9 (regular
expression denial of service). Both are fixed only in versions SheetJS
distributes from their own CDN rather than to npm. Shipping a dependency with
two open HIGH advisories — visible to anyone who runs `npm audit` — is not
defensible on a bid whose 4.1.4 turns on a security assessment.

`exceljs` (MIT) and `@e965/xlsx` (Apache-2.0, a maintained SheetJS fork) are
both clean of advisories and were viable; they were not chosen because they are
21 MB and 7.9 MB installed respectively, most of it a spreadsheet **writer** we
have no use for.

## Shipped with the application

| Package                  | Version | Licence    | Used for                                                   |
| ------------------------ | ------- | ---------- | ---------------------------------------------------------- |
| next                     | 16.3.5  | MIT        | Application framework (App Router)                         |
| react                    | 19.2.8  | MIT        | User interface library                                     |
| react-dom                | 19.2.8  | MIT        | React renderer for the browser                             |
| next-intl                | 4.14.4  | MIT        | English and French routing, messages and formats           |
| radix-ui                 | 1.6.7   | MIT        | Accessible interaction primitives behind the UI components |
| class-variance-authority | 0.7.1   | Apache-2.0 | Component variant definitions                              |
| cn                       | 0.3.0   | MIT        | Class-name merging for Tailwind                            |
| tw-animate-css           | 1.4.0   | MIT        | Animation utilities used by the UI components              |
| shadcn                   | 4.21.0  | MIT        | Component registry CLI and its base stylesheet             |
| lucide-react             | 1.45.0  | ISC        | Icon set                                                   |
| sonner                   | 2.0.8   | MIT        | Toasts                                                     |
| @tanstack/react-table    | 9.2.4   | MIT        | Data tables (first use lands in WA-27)                     |
| react-hook-form          | 7.88.0  | MIT        | Forms (first use lands in WA-27)                           |
| @hookform/resolvers      | 5.9.1   | MIT        | Connects Zod schemas to forms (first use lands in WA-27)   |
| zod                      | 4.6.4   | MIT        | Validation schemas (first use lands in WA-26)              |
| zustand                  | 5.0.15  | MIT        | Client store (first use lands in WA-26)                    |
| date-fns                 | 4.4.0   | MIT        | Date arithmetic (first use lands in WA-26)                 |
| recharts                 | 3.10.1  | MIT        | Charts (first use lands in WA-27)                          |
| qrcode.react             | 4.2.0   | ISC        | QR codes on asset and part labels                          |
| jsbarcode                | 3.12.3  | MIT        | Code 128 barcodes on asset and part labels                 |
| qr-scanner               | 1.4.2   | MIT        | Reading a label from the camera or an uploaded photo       |

Seven packages are installed ahead of their first use — @tanstack/react-table,
react-hook-form, @hookform/resolvers, zod, zustand, date-fns and recharts —
because the stack was approved as a whole and installs are serialised across
lanes. Each one is marked in the table above. They add no code to a page that
does not import them.

The three scanning and labelling packages added by WA-16 are all permissive
(ISC, MIT, MIT), carry their own TypeScript types, and work with no network
call at run time. Two alternatives were rejected on those grounds and the
reasons are worth keeping: `barcode-detector` reaches a CDN for its WebAssembly
file unless overridden, which is a network dependency inside a feature the RFP
requires to work offline; and `html5-qrcode` renders its own interface with
English baked in, which no amount of configuration translates.

`qr-scanner` decodes in a Web Worker and uses the browser's own
`BarcodeDetector` where it exists, so the code it ships is a fallback rather
than the usual path.

react-dom, tw-animate-css and shadcn look unimported to a search of `src/` and
are not in that list: react-dom is the renderer, and the other two are imported
by `src/app/globals.css`.

## Development and testing only

Not distributed with the application.

| Package                     | Version | Licence    |
| --------------------------- | ------- | ---------- |
| typescript                  | 5.9.3   | Apache-2.0 |
| tailwindcss                 | 4.3.3   | MIT        |
| @tailwindcss/postcss        | 4.3.3   | MIT        |
| eslint                      | 9.39.5  | MIT        |
| eslint-config-next          | 16.3.5  | MIT        |
| eslint-config-prettier      | 10.1.8  | MIT        |
| prettier                    | 3.9.6   | MIT        |
| prettier-plugin-tailwindcss | 0.8.1   | MIT        |
| vitest                      | 4.1.11  | MIT        |
| jsdom                       | 29.1.1  | MIT        |
| @testing-library/react      | 16.3.3  | MIT        |
| @testing-library/jest-dom   | 7.0.1   | MIT        |
| @testing-library/user-event | 14.6.7  | MIT        |
| @playwright/test            | 1.63.0  | Apache-2.0 |
| @axe-core/playwright        | 4.13.0  | MPL-2.0    |
| @types/node                 | 22.20.2 | MIT        |
| @types/react                | 19.3.0  | MIT        |
| @types/react-dom            | 19.3.0  | MIT        |

`@axe-core/playwright` is Mozilla Public Licence 2.0. It runs in the test suite
only, is never bundled, and is not modified, so the licence's source-disclosure
obligation does not reach the application.

## Fonts

IBM Plex Sans and IBM Plex Mono, SIL Open Font Licence 1.1. Served from the
application's own domain by `next/font`, which downloads them at build time; no
request goes to a font host at run time.

## Components vendored into this repository

The components under `src/components/ui` come from the shadcn/ui registry (MIT)
and are source in this repository rather than a dependency. Local changes to
them are listed in `AGENTS.md`.
