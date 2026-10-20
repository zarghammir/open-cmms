import type {
  AssetCategory,
  LocalizedText,
  PartCategory,
  SiteCode,
  UnitOfMeasure,
} from "@/domain/types";

/**
 * The vocabulary the seed is built from.
 *
 * Equipment kinds, manufacturers and part descriptions are the same invented
 * ones the MP2 import fixture uses, so the records already in WorkAxis and the
 * records arriving from the legacy system read as one organisation's
 * equipment rather than two unrelated datasets.
 *
 * Nothing here names a real organisation, agency, vendor or person.
 */

export interface AssetTypeSeed {
  key: string;
  tagPrefix: string;
  category: AssetCategory;
  label: LocalizedText;
  manufacturers: readonly string[];
  /** Roughly how many of these a site has. Declared, and read by nothing. */
  perSite: number;
  /**
   * The oldest one of these the estate would still be running, in years.
   *
   * Every asset used to draw an age from one range, 400 to 7300 days, so a UPS
   * and a CO2 incubator could be twenty years old beside a boiler — and a
   * maintenance reader knows a twenty-year-old UPS is a battery nobody
   * replaced, not an asset. The number is per type because the honest answer is
   * per type.
   */
  maxAgeYears: number;
  /**
   * The sites that have this kind of equipment, when not every site does.
   *
   * Containment is what Moncton is; a stomacher belongs in a food laboratory.
   * A type with this field is guaranteed at each site it names and never
   * appears anywhere else, which is the difference between an estate and a
   * uniform spread of the same twelve machines.
   */
  onlyAt?: readonly SiteCode[];
}

export const ASSET_TYPE_SEEDS = [
  {
    key: "airHandlingUnit",
    tagPrefix: "AHU",
    category: "airHandling",
    label: {
      en: "Air handling unit",
      fr: "Centrale de traitement d’air",
    },
    manufacturers: ["Norvent Systems", "Ventura Air", "Northline Mechanical"],
    perSite: 2,
    maxAgeYears: 25,
  },
  {
    key: "exhaustFan",
    tagPrefix: "EXF",
    category: "airHandling",
    label: {
      en: "Laboratory exhaust fan",
      fr: "Ventilateur d’extraction de laboratoire",
    },
    manufacturers: ["Northline Mechanical", "Norvent Systems"],
    perSite: 1,
    maxAgeYears: 25,
  },
  {
    key: "hepaFiltrationUnit",
    tagPrefix: "HFU",
    category: "airHandling",
    label: {
      en: "HEPA filtration unit",
      fr: "Unité de filtration HEPA",
    },
    manufacturers: ["Norvent Systems"],
    perSite: 1,
    maxAgeYears: 15,
  },
  {
    key: "airCompressor",
    tagPrefix: "CMP",
    category: "airHandling",
    label: {
      en: "Oil-free air compressor",
      fr: "Compresseur d’air sans huile",
    },
    manufacturers: ["AeroFlow Systems", "Ventura Air"],
    perSite: 1,
    maxAgeYears: 20,
  },
  {
    key: "vacuumPump",
    tagPrefix: "VAC",
    category: "airHandling",
    label: {
      en: "Central vacuum pump",
      fr: "Pompe à vide centrale",
    },
    manufacturers: ["AeroFlow Systems", "ThermaCore Industries"],
    perSite: 1,
    maxAgeYears: 18,
  },
  {
    key: "boiler",
    tagPrefix: "BLR",
    category: "heatingCooling",
    label: { en: "Hot water boiler", fr: "Chaudière à eau chaude" },
    manufacturers: ["Northline Mechanical", "Norvent Systems"],
    perSite: 1,
    maxAgeYears: 30,
  },
  {
    key: "chiller",
    tagPrefix: "CHL",
    category: "heatingCooling",
    label: { en: "Centrifugal chiller", fr: "Refroidisseur centrifuge" },
    manufacturers: ["ChillWell Refrigeration", "ThermaCore Industries"],
    perSite: 1,
    maxAgeYears: 25,
  },
  {
    key: "coolingTower",
    tagPrefix: "CTW",
    category: "heatingCooling",
    label: { en: "Cooling tower", fr: "Tour de refroidissement" },
    manufacturers: ["Ventura Air"],
    perSite: 1,
    maxAgeYears: 25,
  },
  {
    key: "coldRoom",
    tagPrefix: "CLD",
    category: "heatingCooling",
    label: { en: "Walk-in cold room", fr: "Chambre froide" },
    manufacturers: ["ChillWell Refrigeration", "CryoNorth Scientific"],
    perSite: 1,
    maxAgeYears: 20,
  },
  {
    key: "laboratoryRefrigerator",
    tagPrefix: "RFR",
    category: "heatingCooling",
    label: {
      en: "Laboratory refrigerator",
      fr: "Réfrigérateur de laboratoire",
    },
    manufacturers: ["ChillWell Refrigeration", "CryoNorth Scientific"],
    perSite: 2,
    maxAgeYears: 12,
  },
  {
    key: "ultraLowFreezer",
    tagPrefix: "ULF",
    category: "heatingCooling",
    label: {
      en: "Ultra-low freezer, -80 °C",
      fr: "Congélateur à très basse température, -80 °C",
    },
    manufacturers: ["CryoNorth Scientific", "ChillWell Refrigeration"],
    perSite: 2,
    maxAgeYears: 12,
  },
  {
    key: "liquidNitrogenVessel",
    tagPrefix: "LN2",
    category: "heatingCooling",
    label: {
      en: "Liquid nitrogen storage vessel",
      fr: "Réservoir d’azote liquide",
    },
    manufacturers: ["CryoNorth Scientific"],
    perSite: 1,
    maxAgeYears: 20,
  },
  {
    key: "transferSwitch",
    tagPrefix: "ATS",
    category: "electrical",
    label: {
      en: "Automatic transfer switch",
      fr: "Commutateur de transfert automatique",
    },
    manufacturers: ["Vantage Power Group"],
    perSite: 1,
    maxAgeYears: 20,
  },
  {
    key: "emergencyGenerator",
    tagPrefix: "GEN",
    category: "electrical",
    label: {
      en: "Diesel emergency generator",
      fr: "Génératrice d’urgence au diesel",
    },
    manufacturers: ["Vantage Power Group", "Hydrotec Controls"],
    perSite: 1,
    maxAgeYears: 25,
  },
  {
    key: "uninterruptiblePowerSupply",
    tagPrefix: "UPS",
    category: "electrical",
    label: { en: "Uninterruptible power supply", fr: "Onduleur" },
    manufacturers: ["Hydrotec Controls", "Vantage Power Group"],
    perSite: 1,
    maxAgeYears: 8,
  },
  {
    key: "fireAlarmPanel",
    tagPrefix: "FAP",
    category: "lifeSafety",
    label: {
      en: "Fire alarm control panel",
      fr: "Panneau de contrôle d’alarme incendie",
    },
    manufacturers: ["Guardian Fire Systems"],
    perSite: 1,
    maxAgeYears: 15,
  },
  {
    key: "sprinklerSystem",
    tagPrefix: "SPR",
    category: "lifeSafety",
    label: {
      en: "Wet pipe sprinkler system",
      fr: "Système de gicleurs à eau",
    },
    manufacturers: ["Guardian Fire Systems"],
    perSite: 1,
    maxAgeYears: 30,
  },
  {
    key: "eyewashStation",
    tagPrefix: "EWS",
    category: "lifeSafety",
    label: {
      en: "Emergency eyewash and shower station",
      fr: "Station de lavage oculaire et douche d’urgence",
    },
    manufacturers: ["Guardian Fire Systems"],
    perSite: 2,
    maxAgeYears: 15,
  },
  {
    key: "autoclave",
    tagPrefix: "AUT",
    category: "laboratory",
    label: {
      en: "Steam sterilizer autoclave",
      fr: "Autoclave stérilisateur à vapeur",
    },
    manufacturers: ["Apex Labware", "Sterilix Medical"],
    perSite: 1,
    maxAgeYears: 20,
  },
  {
    key: "biosafetyCabinet",
    tagPrefix: "BSC",
    category: "laboratory",
    label: {
      en: "Biosafety cabinet, class II A2",
      fr: "Enceinte de sécurité biologique, classe II A2",
    },
    manufacturers: ["BioSafe Laboratories", "Apex Labware"],
    perSite: 2,
    maxAgeYears: 15,
  },
  {
    key: "fumeHood",
    tagPrefix: "FMH",
    category: "laboratory",
    label: {
      en: "Bench mounted fume hood",
      fr: "Hotte de laboratoire sur paillasse",
    },
    manufacturers: ["Apex Labware", "BioSafe Laboratories"],
    perSite: 2,
    maxAgeYears: 20,
  },
  {
    key: "centrifuge",
    tagPrefix: "CTF",
    category: "laboratory",
    label: { en: "Floor model centrifuge", fr: "Centrifugeuse sur pied" },
    manufacturers: ["Apex Labware", "Sterilix Medical"],
    perSite: 1,
    maxAgeYears: 15,
  },
  {
    key: "incubator",
    tagPrefix: "INC",
    category: "laboratory",
    label: { en: "CO2 incubator", fr: "Incubateur à CO2" },
    manufacturers: ["BioSafe Laboratories", "Sterilix Medical"],
    perSite: 1,
    maxAgeYears: 12,
  },
  {
    key: "glasswareWasher",
    tagPrefix: "GLW",
    category: "laboratory",
    label: { en: "Glassware washer", fr: "Laveuse de verrerie" },
    manufacturers: ["Apex Labware", "BioSafe Laboratories"],
    perSite: 1,
    maxAgeYears: 15,
  },
  {
    key: "waterPurificationSystem",
    tagPrefix: "WPS",
    category: "water",
    label: {
      en: "Water purification system, RO/DI",
      fr: "Système de purification d’eau OI/DI",
    },
    manufacturers: ["PureStream Water"],
    perSite: 1,
    maxAgeYears: 15,
  },
  {
    key: "dehumidifier",
    tagPrefix: "DHU",
    category: "airHandling",
    label: {
      en: "Industrial dehumidifier",
      fr: "Déshumidificateur industriel",
    },
    manufacturers: ["Norvent Systems"],
    perSite: 1,
    maxAgeYears: 15,
  },
  {
    key: "elevator",
    tagPrefix: "ELV",
    category: "conveyance",
    label: { en: "Passenger elevator", fr: "Ascenseur pour passagers" },
    manufacturers: ["Liftech Elevator"],
    perSite: 1,
    maxAgeYears: 30,
  },
  /*
   * Containment, pinned to Moncton.
   *
   * This is what the estate is defined by and the seed said nothing about it:
   * no pressure monitor, no effluent decontamination, no interlock, no backflow
   * preventer. A reader who works in a containment laboratory looks for exactly
   * these four and reads their absence as a system built by someone who had
   * not asked.
   */
  {
    key: "roomPressureMonitor",
    tagPrefix: "RPM",
    category: "lifeSafety",
    label: {
      en: "Room differential-pressure monitor",
      fr: "Moniteur de pression différentielle de local",
    },
    manufacturers: ["Cascade Controls", "Meridian Instrument"],
    perSite: 3,
    maxAgeYears: 10,
    onlyAt: ["MCT"],
  },
  {
    key: "effluentDecontamination",
    tagPrefix: "EDS",
    category: "lifeSafety",
    label: {
      en: "Effluent decontamination system",
      fr: "Système de décontamination des effluents",
    },
    manufacturers: ["Thermaxis Process", "Northline Mechanical"],
    perSite: 1,
    maxAgeYears: 20,
    onlyAt: ["MCT"],
  },
  {
    key: "airlockInterlock",
    tagPrefix: "ALI",
    category: "lifeSafety",
    label: {
      en: "Airlock door interlock",
      fr: "Verrouillage de sas",
    },
    manufacturers: ["Cascade Controls", "Volta Power Systems"],
    perSite: 2,
    maxAgeYears: 12,
    onlyAt: ["MCT"],
  },
  {
    key: "backflowPreventer",
    tagPrefix: "BFP",
    category: "water",
    label: {
      en: "Reduced-pressure backflow preventer",
      fr: "Dispositif antirefoulement à pression réduite",
    },
    manufacturers: ["Clearwater Process", "Northline Mechanical"],
    perSite: 2,
    maxAgeYears: 20,
    onlyAt: ["MCT"],
  },

  /*
   * Food laboratory instruments, at Sudbury and Kingston.
   *
   * The bench equipment a food laboratory actually runs on. Two sites rather
   * than one so the register does not read as though a single site were special
   * and the rest generic.
   */
  {
    key: "stomacher",
    tagPrefix: "STM",
    category: "laboratory",
    label: {
      en: "Laboratory paddle blender, 400 mL",
      fr: "Broyeur à palettes de laboratoire, 400 mL",
    },
    manufacturers: ["Meridian Instrument", "Laurentide Lab Works"],
    perSite: 2,
    maxAgeYears: 12,
    onlyAt: ["SUD", "KGN"],
  },
  {
    key: "bacteriologicalIncubator",
    tagPrefix: "BIN",
    category: "laboratory",
    label: {
      en: "Bacteriological incubator, 35 °C",
      fr: "Incubateur bactériologique, 35 °C",
    },
    manufacturers: ["Laurentide Lab Works", "Meridian Instrument"],
    perSite: 3,
    maxAgeYears: 12,
    onlyAt: ["SUD", "KGN"],
  },
  {
    key: "waterBath",
    tagPrefix: "WBT",
    category: "laboratory",
    label: {
      en: "Circulating water bath",
      fr: "Bain-marie à circulation",
    },
    manufacturers: ["Laurentide Lab Works", "Thermaxis Process"],
    perSite: 2,
    maxAgeYears: 12,
    onlyAt: ["SUD", "KGN"],
  },
  {
    key: "analyticalBalance",
    tagPrefix: "ABL",
    category: "laboratory",
    label: {
      en: "Analytical balance, 0.1 mg",
      fr: "Balance analytique, 0,1 mg",
    },
    manufacturers: ["Meridian Instrument", "Cascade Controls"],
    perSite: 2,
    maxAgeYears: 15,
    onlyAt: ["SUD", "KGN"],
  },
] as const satisfies readonly AssetTypeSeed[];

/**
 * Every kind of equipment, as a union of literal keys.
 *
 * `as const` above is what makes this possible: with the array annotated as
 * `readonly AssetTypeSeed[]`, `key` widened to `string` and a map over the
 * types could silently miss one. The union is what makes `PART_POOLS`
 * exhaustive at compile time — new equipment does not build until somebody
 * says what it consumes.
 */
export type AssetTypeKey = (typeof ASSET_TYPE_SEEDS)[number]["key"];

export interface PartSeed {
  /**
   * Three digits, where every stock number in the MP2 fixture has four. The
   * shapes cannot collide, and a unit test proves the two sets are disjoint.
   */
  partNumber: string;
  name: LocalizedText;
  category: PartCategory;
  unitOfMeasure: UnitOfMeasure;
  unitCost: number;
  reorderPoint: number;
}

export const PART_SEEDS: readonly PartSeed[] = [
  {
    partNumber: "FLT-201",
    name: {
      en: "Pleated air filter, MERV 13, 24x24x2",
      fr: "Filtre à air plissé, MERV 13, 24x24x2",
    },
    category: "filters",
    unitOfMeasure: "each",
    unitCost: 41.5,
    reorderPoint: 12,
  },
  {
    partNumber: "FLT-202",
    name: {
      en: "HEPA filter, 99.97%, 24x24x12",
      fr: "Filtre HEPA, 99,97 %, 24x24x12",
    },
    category: "filters",
    unitOfMeasure: "each",
    unitCost: 386.75,
    reorderPoint: 4,
  },
  {
    partNumber: "FLT-203",
    name: {
      en: "Washable aluminum mesh prefilter",
      fr: "Préfiltre lavable en mailles d’aluminium",
    },
    category: "filters",
    unitOfMeasure: "each",
    unitCost: 27.9,
    reorderPoint: 8,
  },
  {
    partNumber: "BLT-204",
    name: {
      en: "V-belt, A-section, 48 in",
      fr: "Courroie trapézoïdale, section A, 48 po",
    },
    category: "beltsAndSeals",
    unitOfMeasure: "each",
    unitCost: 22.4,
    reorderPoint: 6,
  },
  {
    partNumber: "BLT-205",
    name: {
      en: "Cogged belt, BX-section, 60 in",
      fr: "Courroie crantée, section BX, 60 po",
    },
    category: "beltsAndSeals",
    unitOfMeasure: "each",
    unitCost: 34.15,
    reorderPoint: 6,
  },
  {
    partNumber: "GSK-206",
    name: {
      en: "Autoclave door gasket, silicone",
      fr: "Joint de porte d’autoclave, silicone",
    },
    category: "beltsAndSeals",
    unitOfMeasure: "each",
    unitCost: 212.0,
    reorderPoint: 2,
  },
  {
    partNumber: "GSK-207",
    name: {
      en: "Cold room door seal, 2.1 m",
      fr: "Joint de porte de chambre froide, 2,1 m",
    },
    category: "beltsAndSeals",
    unitOfMeasure: "each",
    unitCost: 148.6,
    reorderPoint: 2,
  },
  {
    partNumber: "LMP-208",
    name: {
      en: "Germicidal UV lamp, 30 W",
      fr: "Lampe germicide UV, 30 W",
    },
    category: "lamps",
    unitOfMeasure: "each",
    unitCost: 63.25,
    reorderPoint: 6,
  },
  {
    partNumber: "LMP-209",
    name: {
      en: "LED tube, 4 ft, 4000 K",
      fr: "Tube DEL, 4 pi, 4000 K",
    },
    category: "lamps",
    unitOfMeasure: "box",
    unitCost: 89.4,
    reorderPoint: 4,
  },
  {
    partNumber: "SEN-210",
    name: {
      en: "Duct temperature sensor, 10 kΩ",
      fr: "Sonde de température de conduit, 10 kΩ",
    },
    category: "sensors",
    unitOfMeasure: "each",
    unitCost: 74.8,
    reorderPoint: 5,
  },
  {
    partNumber: "SEN-211",
    name: {
      en: "Type K thermocouple probe",
      fr: "Sonde thermocouple de type K",
    },
    category: "sensors",
    unitOfMeasure: "each",
    unitCost: 56.3,
    reorderPoint: 5,
  },
  {
    partNumber: "SEN-212",
    name: {
      en: "Differential pressure switch",
      fr: "Pressostat différentiel",
    },
    category: "sensors",
    unitOfMeasure: "each",
    unitCost: 118.95,
    reorderPoint: 3,
  },
  {
    partNumber: "VLV-213",
    name: {
      en: "Two-way control valve, 1 in",
      fr: "Vanne de régulation deux voies, 1 po",
    },
    category: "valves",
    unitOfMeasure: "each",
    unitCost: 264.0,
    reorderPoint: 2,
  },
  {
    partNumber: "VLV-214",
    name: { en: "Steam trap, 3/4 in", fr: "Purgeur de vapeur, 3/4 po" },
    category: "valves",
    unitOfMeasure: "each",
    unitCost: 197.45,
    reorderPoint: 2,
  },
  {
    partNumber: "PMP-215",
    name: {
      en: "Circulating pump seal kit",
      fr: "Trousse de joints pour pompe de circulation",
    },
    category: "pumps",
    unitOfMeasure: "kit",
    unitCost: 143.2,
    reorderPoint: 3,
  },
  {
    partNumber: "PMP-216",
    name: {
      en: "Vacuum pump oil, 1 L",
      fr: "Huile pour pompe à vide, 1 L",
    },
    category: "pumps",
    unitOfMeasure: "litre",
    unitCost: 38.7,
    reorderPoint: 8,
  },
  {
    partNumber: "MTR-217",
    name: {
      en: "Motor bearing, 6205-2RS",
      fr: "Roulement de moteur, 6205-2RS",
    },
    category: "pumps",
    unitOfMeasure: "each",
    unitCost: 29.85,
    reorderPoint: 8,
  },
  {
    partNumber: "MTR-218",
    name: {
      en: "Flexible coupling insert",
      fr: "Garniture d’accouplement flexible",
    },
    category: "pumps",
    unitOfMeasure: "each",
    unitCost: 46.1,
    reorderPoint: 4,
  },
  {
    partNumber: "ELC-219",
    name: { en: "Contactor, 3-pole, 40 A", fr: "Contacteur, 3 pôles, 40 A" },
    category: "electrical",
    unitOfMeasure: "each",
    unitCost: 132.5,
    reorderPoint: 3,
  },
  {
    partNumber: "ELC-220",
    name: { en: "Control relay, 24 V DC", fr: "Relais de commande, 24 V c.c." },
    category: "electrical",
    unitOfMeasure: "each",
    unitCost: 41.75,
    reorderPoint: 6,
  },
  {
    partNumber: "ELC-221",
    name: {
      en: "Sealed lead-acid battery, 12 V 7 Ah",
      fr: "Batterie plomb-acide scellée, 12 V 7 Ah",
    },
    category: "electrical",
    unitOfMeasure: "each",
    unitCost: 68.9,
    reorderPoint: 10,
  },
  {
    partNumber: "WTR-222",
    name: {
      en: "Reverse osmosis membrane",
      fr: "Membrane d’osmose inverse",
    },
    category: "water",
    unitOfMeasure: "each",
    unitCost: 512.3,
    reorderPoint: 2,
  },
  {
    partNumber: "WTR-223",
    name: {
      en: "Deionization resin cartridge",
      fr: "Cartouche de résine de déionisation",
    },
    category: "water",
    unitOfMeasure: "each",
    unitCost: 287.6,
    reorderPoint: 3,
  },
  {
    partNumber: "FIR-224",
    name: {
      en: "Pendent sprinkler head, 68 °C",
      fr: "Tête de gicleur pendante, 68 °C",
    },
    category: "lifeSafety",
    unitOfMeasure: "each",
    unitCost: 23.15,
    reorderPoint: 12,
  },
  {
    partNumber: "MSC-225",
    name: {
      en: "Chart recorder paper roll",
      fr: "Rouleau de papier d’enregistreur",
    },
    category: "consumables",
    unitOfMeasure: "box",
    unitCost: 54.2,
    reorderPoint: 5,
  },
];

/**
 * Why a shelf count disagreed with the record.
 *
 * A storekeeper's own words, so they are not translated — and, unlike a
 * work-order comment, an `InventoryTransaction` has **no `contentLanguage`
 * field**, so a ledger cannot tell a reader which language a note was written
 * in. These are written in English for that reason: a French note would be
 * shown to an English reader with nothing marking it, which is the one thing
 * `contentLanguage` exists to prevent everywhere else in the product. Giving
 * the record that field is a persisted-shape change and its own decision.
 */
export const COUNT_NOTES: readonly string[] = [
  "Two boxes found open on the lower shelf; damaged stock written off.",
  "Recount after the aisle was reorganised.",
  "Short against the record; storeroom transfer never recorded.",
];

/**
 * Which parts each kind of equipment plausibly consumes, by stock number.
 *
 * WA-10's review found a water purification system consuming a pleated air
 * filter, an ultra-low freezer a mesh prefilter, and a fire alarm control panel
 * a HEPA filter and a 48-inch V-belt. The derivation was correct; the pairing
 * was seed content — a movement took its part by rotation over the whole
 * catalogue — and a maintenance evaluator reads that instantly.
 *
 * **Why by type and by stock number, rather than by category.** Pooling by
 * `AssetCategory` was tried first and is not fine enough, which a screenshot
 * caught rather than an argument: it still put a pendent sprinkler head and a
 * steam trap on an emergency eyewash station, a control valve on a fire alarm
 * panel, and a cold room door seal on a passenger elevator — all correct by
 * category. The reason is in the catalogue itself: these part names are
 * type-specific. A *duct* temperature sensor and a Type K thermocouple are both
 * `sensors`, and only one of them belongs on a cold room; an *autoclave* door
 * gasket and a *cold room* door seal are both `beltsAndSeals`. No category map
 * can separate those, because the distinction is in the name.
 *
 * So the pool names parts. It is longer, and it is the only version that can
 * actually be read and checked by someone who knows the equipment.
 *
 * Keyed by every asset type, exhaustively: `AssetTypeKey` is a union of the
 * keys in `ASSET_TYPE_SEEDS`, so adding equipment without saying what it
 * consumes does not compile. `seed-integrity` adds what types cannot: every
 * pool is non-empty and every stock number in one exists.
 */
export const PART_POOLS: Record<AssetTypeKey, readonly string[]> = {
  // Air handling: filters, drive belts, and the sensors that watch a duct.
  airHandlingUnit: [
    "FLT-201",
    "FLT-203",
    "BLT-204",
    "SEN-210",
    "SEN-212",
    "MTR-217",
  ],
  exhaustFan: ["BLT-204", "BLT-205", "MTR-217", "MTR-218", "SEN-212"],
  hepaFiltrationUnit: ["FLT-202", "FLT-203", "SEN-212"],
  airCompressor: ["FLT-203", "BLT-204", "MTR-217", "SEN-212", "VLV-213"],
  vacuumPump: ["PMP-216", "PMP-215", "MTR-217", "SEN-212"],
  dehumidifier: ["FLT-201", "FLT-203", "SEN-210", "MTR-217"],

  // Conveyance: a lift is belts, bearings and switchgear.
  elevator: ["BLT-205", "MTR-217", "MTR-218", "ELC-219", "ELC-220"],

  // Electrical: contactors, relays and the battery that actually sits in one.
  transferSwitch: ["ELC-219", "ELC-220"],
  emergencyGenerator: ["ELC-221", "ELC-219", "BLT-204", "MTR-217"],
  uninterruptiblePowerSupply: ["ELC-221", "ELC-220"],

  // Heating and cooling. The door seal is the cold room's, not the autoclave's,
  // and the probe is a thermocouple rather than a duct sensor.
  boiler: ["VLV-213", "VLV-214", "PMP-215", "SEN-211", "SEN-212"],
  chiller: ["PMP-215", "MTR-217", "VLV-213", "SEN-210", "SEN-212"],
  coolingTower: ["BLT-205", "MTR-217", "PMP-215", "VLV-213"],
  coldRoom: ["GSK-207", "SEN-211", "MTR-217", "ELC-220"],
  laboratoryRefrigerator: ["GSK-207", "SEN-211", "ELC-220"],
  ultraLowFreezer: ["GSK-207", "SEN-211", "MTR-217", "MSC-225"],
  liquidNitrogenVessel: ["SEN-211", "VLV-213", "MSC-225"],

  // Laboratory. The autoclave gets the autoclave gasket and the steam trap; the
  // biosafety cabinet gets the HEPA and the germicidal lamp that are in one.
  autoclave: ["GSK-206", "VLV-214", "VLV-213", "SEN-211", "MSC-225"],
  biosafetyCabinet: ["FLT-202", "FLT-203", "LMP-208", "SEN-212"],
  fumeHood: ["SEN-212", "LMP-209", "FLT-203"],
  centrifuge: ["MTR-217", "MTR-218", "ELC-220"],
  incubator: ["SEN-211", "GSK-206", "LMP-208", "MSC-225"],
  glasswareWasher: ["PMP-215", "VLV-213", "GSK-206", "MTR-217"],

  // Life safety. The panel takes its sealed battery, the sprinkler system takes
  // the sprinkler head, and the eyewash station takes neither.
  fireAlarmPanel: ["ELC-221", "ELC-220"],
  sprinklerSystem: ["FIR-224", "VLV-213"],
  eyewashStation: ["VLV-213"],

  // Water treatment: the membrane and the resin the system is built around.
  waterPurificationSystem: [
    "WTR-222",
    "WTR-223",
    "SEN-212",
    "PMP-215",
    "VLV-213",
  ],

  /*
   * WA-87's containment and food-lab equipment.
   *
   * These eight were written because the build refused without them: this is a
   * `Record` over every asset type, so adding equipment and saying nothing
   * about what it consumes does not compile. The guard earning itself — the
   * alternative was eight machines falling back to the whole catalogue and a
   * sprinkler head turning up on an analytical balance.
   */
  roomPressureMonitor: ["SEN-212", "ELC-220"],
  effluentDecontamination: ["VLV-213", "VLV-214", "PMP-215", "SEN-211"],
  airlockInterlock: ["ELC-219", "ELC-220", "SEN-212"],
  backflowPreventer: ["VLV-213", "VLV-214"],
  stomacher: ["BLT-204", "MTR-217", "ELC-220"],
  bacteriologicalIncubator: ["SEN-211", "GSK-206", "MSC-225", "LMP-208"],
  waterBath: ["SEN-211", "VLV-213", "MSC-225"],
  analyticalBalance: ["MSC-225", "SEN-211"],
};

/**
 * What each part's shelf held before the first movement the seed records.
 *
 * **Why these are literals and not arithmetic.** The ledger has to add up:
 * opening plus every movement in order equals `quantityOnHand`. If the seed
 * *computed* either end of that — the opening from the on-hand, or the on-hand
 * from the opening — the arithmetic would be true by construction and the test
 * asserting it could only fail by failing to compile. Changing a movement's
 * quantity would silently re-derive the other side and the assertion would
 * stay green, which is the shape of a test that measures nothing.
 *
 * Pinned, the three numbers are independent: `quantityOnHand` is drawn when
 * the part is built, the movements are seeded, and these are written down. Any
 * one of the three changing without the others makes `seed-integrity` red and
 * names the part.
 *
 * So they carry the same discipline as `fingerprint.test.ts`'s hashes: when a
 * movement changes on purpose, these are re-derived and updated **in the same
 * commit**, and the pull request says which parts moved. They were derived
 * once, from the on-hand each part already had, so no part's stock level — and
 * therefore no low-stock notification — moved to make the ledger balance.
 *
 * Keyed by stock number rather than by index, because a part's position in the
 * catalogue is not a fact about the part.
 */
export const OPENING_COUNTS: Record<string, number> = {
  // Re-derived at WA-87, twice: once when the containment and food-lab
  // equipment moved the generator's draws, and again when those types got
  // maintenance plans and the schedules moved them further. Three parts left
  // the ledger and three joined it. The figures are literals precisely so they
  // go red when the data moves, rather than quietly following it.
  "FLT-201": 6,
  "FLT-202": 4,
  "FLT-203": 25,
  "BLT-204": 18,
  "GSK-206": 6,
  "SEN-211": 9,
  "VLV-213": 25,
  "MTR-217": 11,
  "ELC-220": 19,
  "ELC-221": 6,
};

/**
 * The reason on the opening row.
 *
 * It has to read as an opening balance and **not** as a delivery, which is why
 * the row is an `adjustment` and not a `receipt`: a receipt means goods
 * arrived, and nothing arrived here — this is what the shelf already held when
 * the storeroom came onto WorkAxis. The note says so in as many words, because
 * a positive adjustment with no reason is exactly the row a reader would
 * assume was stock coming in.
 *
 * English, for the reason `COUNT_NOTES` gives: an `InventoryTransaction` has
 * no `contentLanguage`, so a French note would reach an English reader with
 * nothing marking it.
 */
export const OPENING_NOTE =
  "Opening balance: stock already on the shelf when the storeroom came onto WorkAxis. Not a delivery.";

/**
 * How many units arrived in each ledger part's receipt.
 *
 * WA-12 wrote these as `6 + index`, chosen when the ledger was history and
 * nothing had to add up. Two of the three then could not be reconciled against
 * the on-hand the part already had: FLT-201 would have had to open at **-4**,
 * and FLT-202's shelf would have dipped to **-2** in the middle of its own
 * history. A shelf that holds a negative number of filters is the same kind of
 * defect as an air filter in a water purification system — it is not wrong
 * arithmetic, it is a story that cannot have happened.
 *
 * So the quantity that gave way is the receipt, deliberately: it is the only
 * one of the four rows that is neither drawn nor fixed by what the count
 * found. FLT-203's is unchanged.
 */
export const LEDGER_RECEIPTS: readonly number[] = [1, 4, 8];
