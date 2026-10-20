import type { LocalizedText, ProvinceCode, SiteCode } from "@/domain/types";

/**
 * The parts of the seed that are not free to change.
 *
 * WA-29 ratified the network name and the five site codes, and the MP2 import
 * fixture (`tests/fixtures/mp2-export-sample.xlsx`) was generated against
 * them. Every room and bin code below is taken from that fixture: if the seed
 * does not contain them, the import resolves no location and the demo it was
 * built for stops working. A unit test compares these lists back against the
 * fixture, so an edit here cannot quietly break WA-17.
 *
 * `HAL-B01-118` is deliberately absent. It is planted defect D11 — a location
 * on a sixth site that does not exist — and the validation report has to be
 * able to find it.
 */

export interface SeedSite {
  code: SiteCode;
  name: LocalizedText;
  city: LocalizedText;
  province: ProvinceCode;
  timeZone: string;
}

export const ORGANIZATION_NAME: LocalizedText = {
  en: "Dominion Laboratory Network",
  fr: "R\u00e9seau de laboratoires Dominion",
};

/**
 * Kingston, Sudbury, Moncton, Kamloops and Regina.
 *
 * **Chosen so that they map onto no real laboratory network, and they must
 * stay that way.** Five plausible Canadian cities, spread across four
 * provinces, that no reader can line up against anybody's actual estate.
 *
 * This is a public repository. The organisation is fictional and its name is
 * invented, which AGENTS.md rule 2 has always required — but a set of city
 * names can identify an organisation without naming it, because an estate is
 * recognisable on sight to anyone who works in the field. A name is not the
 * only identifier a dataset carries.
 *
 * Written down because the opposite is an easy, good-faith mistake. A later
 * lane making the demonstration feel more real — picking the cities a
 * national laboratory network would actually be in, or matching a set
 * somebody remembers from a tender document — would reintroduce exactly that
 * recognition, and every screen would look precisely as correct as before.
 * Nothing would fail. That is why this comment exists rather than a test: the
 * property is about what a reader recognises, and a test cannot hold it.
 *
 * The same care applies to anything else that could pin the data to one
 * organisation: room and bin codes, job titles, document names, equipment
 * makes. Invented, plausible, and belonging to nobody.
 *
 * Moncton is the high-containment site, which is why the containment
 * equipment in `catalog.ts` is pinned there. One site differs from the other
 * four so the demonstration can show that distinction at all; which one it is
 * carries no meaning.
 */
export const SITES: readonly SeedSite[] = [
  {
    code: "KGN",
    name: {
      en: "Kingston Central Laboratory",
      fr: "Laboratoire central d\u2019Kingston",
    },
    city: { en: "Kingston", fr: "Kingston" },
    province: "ON",
    timeZone: "America/Toronto",
  },
  {
    code: "SUD",
    name: {
      en: "Sudbury Regional Laboratory",
      fr: "Laboratoire r\u00e9gional de Sudbury",
    },
    city: { en: "Sudbury", fr: "Sudbury" },
    province: "ON",
    timeZone: "America/Toronto",
  },
  {
    code: "MCT",
    name: {
      en: "Moncton Regional Laboratory",
      fr: "Laboratoire r\u00e9gional de Moncton",
    },
    city: { en: "Moncton", fr: "Moncton" },
    province: "NB",
    timeZone: "America/Moncton",
  },
  {
    code: "KAM",
    name: {
      en: "Kamloops Regional Laboratory",
      fr: "Laboratoire r\u00e9gional de Kamloops",
    },
    city: { en: "Kamloops", fr: "Kamloops" },
    province: "BC",
    timeZone: "America/Vancouver",
  },
  {
    code: "REG",
    name: {
      en: "Regina Regional Laboratory",
      fr: "Laboratoire r\u00e9gional de Regina",
    },
    city: { en: "Regina", fr: "Regina" },
    province: "SK",
    timeZone: "America/Regina",
  },
];

/**
 * Every room the import fixture points at, `SITE-Bnn-rrr`. The hundreds digit
 * of the room number is its floor, which is where the floor level of the
 * location tree comes from.
 */
export const ROOM_CODES: readonly string[] = [
  "REG-B01-152",
  "REG-B01-230",
  "REG-B01-251",
  "REG-B01-280",
  "REG-B01-300",
  "REG-B01-355",
  "REG-B02-106",
  "REG-B02-374",
  "REG-B03-258",
  "REG-B03-279",
  "REG-B04-109",
  "REG-B04-120",
  "REG-B04-153",
  "REG-B04-270",
  "REG-B04-352",
  "REG-B04-379",
  "KAM-B01-154",
  "KAM-B01-189",
  "KAM-B01-194",
  "KAM-B01-238",
  "KAM-B01-280",
  "KAM-B01-327",
  "KAM-B02-200",
  "KAM-B02-203",
  "KAM-B02-267",
  "KAM-B03-165",
  "KAM-B03-199",
  "KAM-B03-332",
  "KAM-B04-128",
  "KAM-B04-173",
  "KAM-B04-202",
  "KAM-B04-243",
  "KGN-B01-151",
  "KGN-B01-165",
  "KGN-B01-183",
  "KGN-B01-217",
  "KGN-B02-219",
  "KGN-B02-253",
  "KGN-B02-293",
  "KGN-B02-300",
  "KGN-B02-322",
  "KGN-B03-117",
  "KGN-B03-243",
  "KGN-B04-191",
  "KGN-B04-302",
  "KGN-B04-373",
  "KGN-B04-398",
  "SUD-B01-104",
  "SUD-B01-106",
  "SUD-B01-165",
  "SUD-B01-211",
  "SUD-B01-252",
  "SUD-B01-386",
  "SUD-B02-129",
  "SUD-B02-206",
  "SUD-B02-207",
  "SUD-B02-304",
  "SUD-B02-319",
  "SUD-B02-337",
  "SUD-B02-366",
  "SUD-B03-103",
  "SUD-B03-240",
  "SUD-B04-247",
  "MCT-B01-127",
  "MCT-B01-187",
  "MCT-B01-262",
  "MCT-B01-264",
  "MCT-B01-296",
  "MCT-B01-376",
  "MCT-B02-108",
  "MCT-B02-283",
  "MCT-B02-335",
  "MCT-B03-260",
  "MCT-B03-290",
  "MCT-B03-348",
  "MCT-B04-205",
  "MCT-B04-231",
  "MCT-B04-237",
  "MCT-B04-300",
];

/** Every bin the import fixture points at, `SITE-Xnn-nn`: aisle, then shelf. */
export const BIN_CODES: readonly string[] = [
  "REG-A01-01",
  "REG-C04-06",
  "REG-C13-03",
  "REG-C17-04",
  "REG-D01-08",
  "REG-D08-06",
  "REG-D10-02",
  "REG-D11-01",
  "KAM-A16-05",
  "KAM-A16-07",
  "KAM-B10-07",
  "KAM-D01-01",
  "KAM-D07-08",
  "KAM-D16-05",
  "KGN-B01-04",
  "KGN-B06-03",
  "KGN-B14-05",
  "KGN-C11-01",
  "KGN-C11-05",
  "KGN-C17-05",
  "KGN-D12-04",
  "KGN-D13-09",
  "SUD-A02-04",
  "SUD-A04-04",
  "SUD-A06-02",
  "SUD-B07-02",
  "SUD-C02-09",
  "SUD-D03-09",
  "SUD-D15-09",
  "SUD-D18-06",
  "MCT-A02-03",
  "MCT-A13-05",
  "MCT-A14-02",
  "MCT-B03-01",
  "MCT-B03-08",
  "MCT-B06-02",
  "MCT-C05-03",
  "MCT-C17-08",
];

/**
 * The site that must not exist. Planted defect D11 points at it, and the
 * import's validation report is expected to say so.
 */
export const UNKNOWN_FIXTURE_SITE = "HAL";
