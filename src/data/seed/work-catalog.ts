import type {
  LocalizedText,
  ScheduleFrequency,
  WorkOrderType,
} from "@/domain/types";

/**
 * The wording the seed builds work from: maintenance plans, inspection
 * checklists, and the phrases a work order is described with.
 *
 * Every line is written in both languages here rather than translated later.
 * A demo that shows French labels over English records is not a bilingual
 * demo.
 */

export interface MaintenancePlanSeed {
  code: string;
  assetTypeKey: string;
  name: LocalizedText;
  description: LocalizedText;
  frequency: ScheduleFrequency;
  leadTimeDays: number;
  estimatedMinutes: number;
  tasks: readonly LocalizedText[];
}

export const MAINTENANCE_PLAN_SEEDS: readonly MaintenancePlanSeed[] = [
  {
    code: "PM-AHU-Q",
    assetTypeKey: "airHandlingUnit",
    name: {
      en: "Air handling unit, quarterly service",
      fr: "Centrale de traitement d’air, entretien trimestriel",
    },
    description: {
      en: "Filter change, belt and bearing check, coil condition and control verification.",
      fr: "Changement de filtres, vérification des courroies et des roulements, état des serpentins et contrôle des commandes.",
    },
    frequency: "quarterly",
    leadTimeDays: 7,
    estimatedMinutes: 120,
    tasks: [
      {
        en: "Replace return and supply filters",
        fr: "Remplacer les filtres de reprise et d’alimentation",
      },
      {
        en: "Inspect belts and adjust tension",
        fr: "Inspecter les courroies et ajuster la tension",
      },
      {
        en: "Check bearings and lubricate",
        fr: "Vérifier les roulements et lubrifier",
      },
      {
        en: "Verify supply air temperature against setpoint",
        fr: "Vérifier la température de l’air soufflé par rapport à la consigne",
      },
    ],
  },
  {
    code: "PM-BSC-A",
    assetTypeKey: "biosafetyCabinet",
    name: {
      en: "Biosafety cabinet, annual certification",
      fr: "Enceinte de sécurité biologique, certification annuelle",
    },
    description: {
      en: "Annual airflow certification and HEPA integrity test by a qualified contractor.",
      fr: "Certification annuelle du débit d’air et essai d’intégrité du filtre HEPA par un entrepreneur qualifié.",
    },
    frequency: "annual",
    leadTimeDays: 30,
    estimatedMinutes: 180,
    tasks: [
      {
        en: "Measure inflow and downflow velocity",
        fr: "Mesurer la vitesse d’entrée et de descente d’air",
      },
      {
        en: "Perform HEPA filter leak test",
        fr: "Effectuer l’essai d’étanchéité du filtre HEPA",
      },
      {
        en: "Verify alarm set points",
        fr: "Vérifier les points de consigne des alarmes",
      },
      {
        en: "Affix certification label",
        fr: "Apposer l’étiquette de certification",
      },
    ],
  },
  {
    code: "PM-GEN-M",
    assetTypeKey: "emergencyGenerator",
    name: {
      en: "Emergency generator, monthly load test",
      fr: "Génératrice d’urgence, essai de charge mensuel",
    },
    description: {
      en: "Monthly run under load with fuel, coolant and battery checks.",
      fr: "Essai mensuel sous charge avec vérification du carburant, du liquide de refroidissement et des batteries.",
    },
    frequency: "monthly",
    leadTimeDays: 3,
    estimatedMinutes: 90,
    tasks: [
      {
        en: "Run under load for thirty minutes",
        fr: "Faire fonctionner sous charge pendant trente minutes",
      },
      {
        en: "Record voltage, frequency and oil pressure",
        fr: "Consigner la tension, la fréquence et la pression d’huile",
      },
      {
        en: "Check fuel level and coolant",
        fr: "Vérifier le niveau de carburant et le liquide de refroidissement",
      },
      {
        en: "Test battery charger output",
        fr: "Vérifier la sortie du chargeur de batterie",
      },
    ],
  },
  {
    code: "PM-ULF-S",
    assetTypeKey: "ultraLowFreezer",
    name: {
      en: "Ultra-low freezer, semi-annual service",
      fr: "Congélateur à très basse température, entretien semestriel",
    },
    description: {
      en: "Condenser cleaning, door seal check and temperature verification against the alarm set point.",
      fr: "Nettoyage du condenseur, vérification du joint de porte et de la température par rapport au seuil d’alarme.",
    },
    frequency: "semiAnnual",
    leadTimeDays: 14,
    estimatedMinutes: 60,
    tasks: [
      {
        en: "Clean condenser and filter",
        fr: "Nettoyer le condenseur et le filtre",
      },
      {
        en: "Inspect and replace door seal if required",
        fr: "Inspecter le joint de porte et le remplacer au besoin",
      },
      {
        en: "Verify temperature against the alarm set point",
        fr: "Vérifier la température par rapport au seuil d’alarme",
      },
    ],
  },
  {
    code: "PM-FAP-Q",
    assetTypeKey: "fireAlarmPanel",
    name: {
      en: "Fire alarm panel, quarterly inspection",
      fr: "Panneau d’alarme incendie, inspection trimestrielle",
    },
    description: {
      en: "Quarterly panel inspection, device sampling and battery load test.",
      fr: "Inspection trimestrielle du panneau, échantillonnage des dispositifs et essai de charge des batteries.",
    },
    frequency: "quarterly",
    leadTimeDays: 7,
    estimatedMinutes: 150,
    tasks: [
      {
        en: "Verify trouble and supervisory signals",
        fr: "Vérifier les signaux de dérangement et de supervision",
      },
      {
        en: "Test a sample of initiating devices",
        fr: "Mettre à l’essai un échantillon de dispositifs de déclenchement",
      },
      {
        en: "Load test standby batteries",
        fr: "Effectuer un essai de charge des batteries de secours",
      },
    ],
  },
  {
    code: "PM-CHL-A",
    assetTypeKey: "chiller",
    name: {
      en: "Chiller, annual overhaul",
      fr: "Refroidisseur, révision annuelle",
    },
    description: {
      en: "Tube cleaning, refrigerant check, oil analysis and control calibration before the cooling season.",
      fr: "Nettoyage des tubes, vérification du réfrigérant, analyse d’huile et étalonnage des commandes avant la saison de refroidissement.",
    },
    frequency: "annual",
    leadTimeDays: 30,
    estimatedMinutes: 480,
    tasks: [
      { en: "Clean condenser tubes", fr: "Nettoyer les tubes du condenseur" },
      {
        en: "Check refrigerant charge and log pressures",
        fr: "Vérifier la charge de réfrigérant et consigner les pressions",
      },
      {
        en: "Send oil sample for analysis",
        fr: "Envoyer un échantillon d’huile pour analyse",
      },
    ],
  },
  {
    code: "PM-EWS-M",
    assetTypeKey: "eyewashStation",
    name: {
      en: "Eyewash and shower, monthly flush",
      fr: "Lavage oculaire et douche, rinçage mensuel",
    },
    description: {
      en: "Monthly activation and flush, with flow and water clarity recorded.",
      fr: "Activation et rinçage mensuels, avec consignation du débit et de la clarté de l’eau.",
    },
    frequency: "monthly",
    leadTimeDays: 2,
    estimatedMinutes: 20,
    tasks: [
      { en: "Flush for three minutes", fr: "Rincer pendant trois minutes" },
      {
        en: "Record flow and water clarity",
        fr: "Consigner le débit et la clarté de l’eau",
      },
      {
        en: "Confirm the path to the station is clear",
        fr: "Confirmer que l’accès à la station est dégagé",
      },
    ],
  },
  {
    code: "PM-WPS-Q",
    assetTypeKey: "waterPurificationSystem",
    name: {
      en: "Water purification system, quarterly service",
      fr: "Système de purification d’eau, entretien trimestriel",
    },
    description: {
      en: "Cartridge replacement, resistivity check and sanitization of the distribution loop.",
      fr: "Remplacement des cartouches, vérification de la résistivité et assainissement de la boucle de distribution.",
    },
    frequency: "quarterly",
    leadTimeDays: 7,
    estimatedMinutes: 90,
    tasks: [
      {
        en: "Replace pre-treatment cartridges",
        fr: "Remplacer les cartouches de prétraitement",
      },
      {
        en: "Record resistivity at the point of use",
        fr: "Consigner la résistivité au point d’utilisation",
      },
      {
        en: "Sanitize the distribution loop",
        fr: "Assainir la boucle de distribution",
      },
    ],
  },
  {
    code: "PM-RPM-M",
    assetTypeKey: "roomPressureMonitor",
    name: {
      en: "Room pressure monitor, monthly verification",
      fr: "Moniteur de pression des salles, vérification mensuelle",
    },
    description: {
      en: "Differential pressure read against the posted setpoint, with the alarm and the transducer checked on each containment room.",
      fr: "Lecture de la pression différentielle par rapport à la consigne affichée, avec vérification de l’alarme et du transducteur dans chaque salle de confinement.",
    },
    frequency: "monthly",
    leadTimeDays: 3,
    estimatedMinutes: 45,
    tasks: [
      {
        en: "Record the differential pressure at the room",
        fr: "Consigner la pression différentielle à la salle",
      },
      {
        en: "Compare the reading with the posted setpoint",
        fr: "Comparer la lecture à la consigne affichée",
      },
      {
        en: "Test the low-pressure alarm",
        fr: "Mettre à l’essai l’alarme de basse pression",
      },
      {
        en: "Verify the transducer zero",
        fr: "Vérifier le zéro du transducteur",
      },
    ],
  },
  {
    code: "PM-EDS-Q",
    assetTypeKey: "effluentDecontamination",
    name: {
      en: "Effluent decontamination system, quarterly service",
      fr: "Système de décontamination des effluents, entretien trimestriel",
    },
    description: {
      en: "Thermal cycle run and recorded, vessel probes calibrated, transfer pumps and seals inspected.",
      fr: "Exécution et consignation du cycle thermique, étalonnage des sondes de la cuve, inspection des pompes de transfert et des joints.",
    },
    frequency: "quarterly",
    leadTimeDays: 14,
    estimatedMinutes: 240,
    tasks: [
      {
        en: "Run a full thermal kill cycle",
        fr: "Exécuter un cycle thermique complet",
      },
      {
        en: "Calibrate the vessel temperature probes",
        fr: "Étalonner les sondes de température de la cuve",
      },
      {
        en: "Inspect transfer pumps and seals",
        fr: "Inspecter les pompes de transfert et les joints",
      },
      {
        en: "Record the cycle chart for the file",
        fr: "Consigner le diagramme du cycle au dossier",
      },
    ],
  },
  {
    code: "PM-ALI-S",
    assetTypeKey: "airlockInterlock",
    name: {
      en: "Airlock interlock, semi-annual test",
      fr: "Verrouillage de sas, essai semestriel",
    },
    description: {
      en: "Both doors tested against the interlock, with the emergency override reset and the door seals checked.",
      fr: "Essai des deux portes contre le verrouillage, avec réinitialisation de la dérogation d’urgence et vérification des joints de porte.",
    },
    frequency: "semiAnnual",
    leadTimeDays: 7,
    estimatedMinutes: 60,
    tasks: [
      {
        en: "Confirm the second door cannot open while the first is open",
        fr: "Confirmer que la deuxième porte ne peut s’ouvrir pendant que la première est ouverte",
      },
      {
        en: "Test the emergency override and reset it",
        fr: "Mettre à l’essai la dérogation d’urgence et la réinitialiser",
      },
      {
        en: "Inspect door seals and sweeps",
        fr: "Inspecter les joints et les bas de porte",
      },
      {
        en: "Verify the status indicator lights",
        fr: "Vérifier les voyants d’état",
      },
    ],
  },
  {
    code: "PM-BFP-A",
    assetTypeKey: "backflowPreventer",
    name: {
      en: "Backflow preventer, annual certification",
      fr: "Dispositif antirefoulement, certification annuelle",
    },
    description: {
      en: "Tested by a certified tester, relief valve and check valves verified, and the report filed with the water authority.",
      fr: "Essai par un vérificateur certifié, vérification de la soupape de décharge et des clapets, puis dépôt du rapport auprès du service des eaux.",
    },
    frequency: "annual",
    leadTimeDays: 30,
    estimatedMinutes: 90,
    tasks: [
      {
        en: "Test the relief valve opening point",
        fr: "Mettre à l’essai le point d’ouverture de la soupape de décharge",
      },
      {
        en: "Verify each check valve holds",
        fr: "Vérifier l’étanchéité de chaque clapet",
      },
      {
        en: "Replace worn seats and rubber parts",
        fr: "Remplacer les sièges et les pièces de caoutchouc usés",
      },
      {
        en: "File the test report with the water authority",
        fr: "Déposer le rapport d’essai auprès du service des eaux",
      },
    ],
  },
  {
    code: "PM-STO-S",
    assetTypeKey: "stomacher",
    name: {
      en: "Stomacher blender, semi-annual service",
      fr: "Broyeur à palettes, entretien semestriel",
    },
    description: {
      en: "Sample chamber cleaned and disinfected, paddles inspected for wear, speed and timer verified against the setting.",
      fr: "Nettoyage et désinfection de la chambre d’échantillonnage, inspection de l’usure des palettes, vérification de la vitesse et de la minuterie par rapport au réglage.",
    },
    frequency: "semiAnnual",
    leadTimeDays: 5,
    estimatedMinutes: 45,
    tasks: [
      {
        en: "Clean and disinfect the sample chamber",
        fr: "Nettoyer et désinfecter la chambre d’échantillonnage",
      },
      {
        en: "Inspect the paddles for wear",
        fr: "Inspecter l’usure des palettes",
      },
      {
        en: "Verify speed and timer against the setting",
        fr: "Vérifier la vitesse et la minuterie par rapport au réglage",
      },
      {
        en: "Check the door latch and gasket",
        fr: "Vérifier le loquet et le joint de la porte",
      },
    ],
  },
  {
    code: "PM-BIN-Q",
    assetTypeKey: "bacteriologicalIncubator",
    name: {
      en: "Bacteriological incubator, quarterly verification",
      fr: "Incubateur bactériologique, vérification trimestrielle",
    },
    description: {
      en: "Temperature mapped at the shelves against a reference thermometer, controller adjusted to the measured offset.",
      fr: "Cartographie de la température aux tablettes par rapport à un thermomètre de référence, régulateur ajusté selon l’écart mesuré.",
    },
    frequency: "quarterly",
    leadTimeDays: 7,
    estimatedMinutes: 60,
    tasks: [
      {
        en: "Map temperature at the shelves against the reference thermometer",
        fr: "Cartographier la température aux tablettes par rapport au thermomètre de référence",
      },
      {
        en: "Adjust the controller to the measured offset",
        fr: "Ajuster le régulateur selon l’écart mesuré",
      },
      {
        en: "Inspect the door gasket",
        fr: "Inspecter le joint de porte",
      },
      {
        en: "Clean and disinfect the interior",
        fr: "Nettoyer et désinfecter l’intérieur",
      },
    ],
  },
  {
    code: "PM-WTB-Q",
    assetTypeKey: "waterBath",
    name: {
      en: "Water bath, quarterly service",
      fr: "Bain-marie, entretien trimestriel",
    },
    description: {
      en: "Tank drained and descaled, refilled with treated water, temperature and low-water cut-out verified.",
      fr: "Vidange et détartrage de la cuve, remplissage avec de l’eau traitée, vérification de la température et de la protection contre le manque d’eau.",
    },
    frequency: "quarterly",
    leadTimeDays: 5,
    estimatedMinutes: 40,
    tasks: [
      {
        en: "Drain and descale the tank",
        fr: "Vidanger et détartrer la cuve",
      },
      {
        en: "Refill with treated water",
        fr: "Remplir avec de l’eau traitée",
      },
      {
        en: "Verify the temperature against a reference thermometer",
        fr: "Vérifier la température par rapport à un thermomètre de référence",
      },
      {
        en: "Test the low-water cut-out",
        fr: "Mettre à l’essai la protection contre le manque d’eau",
      },
    ],
  },
  {
    code: "PM-BAL-A",
    assetTypeKey: "analyticalBalance",
    name: {
      en: "Analytical balance, annual calibration",
      fr: "Balance analytique, étalonnage annuel",
    },
    description: {
      en: "Levelled and cleaned, calibrated with certified weights, repeatability recorded before the label is affixed.",
      fr: "Mise à niveau et nettoyage, étalonnage avec des masses certifiées, consignation de la répétabilité avant l’apposition de l’étiquette.",
    },
    frequency: "annual",
    leadTimeDays: 21,
    estimatedMinutes: 60,
    tasks: [
      {
        en: "Level the balance and clean the pan",
        fr: "Mettre la balance à niveau et nettoyer le plateau",
      },
      {
        en: "Calibrate with certified weights",
        fr: "Étalonner avec des masses certifiées",
      },
      {
        en: "Record repeatability over ten readings",
        fr: "Consigner la répétabilité sur dix lectures",
      },
      {
        en: "Affix the calibration label",
        fr: "Apposer l’étiquette d’étalonnage",
      },
    ],
  },
];

export interface InspectionTemplateItemSeed {
  prompt: LocalizedText;
  requiresNoteOnFail: boolean;
}

export interface InspectionTemplateSeed {
  code: string;
  assetTypeKeys: readonly string[];
  name: LocalizedText;
  description: LocalizedText;
  items: readonly InspectionTemplateItemSeed[];
}

export const INSPECTION_TEMPLATE_SEEDS: readonly InspectionTemplateSeed[] = [
  {
    code: "INS-FMH",
    assetTypeKeys: ["fumeHood"],
    name: {
      en: "Fume hood safety check",
      fr: "Vérification de sécurité des hottes",
    },
    description: {
      en: "Face velocity, sash operation and alarm verification.",
      fr: "Vitesse frontale, fonctionnement de la guillotine et vérification des alarmes.",
    },
    items: [
      {
        prompt: {
          en: "Face velocity within specification",
          fr: "Vitesse frontale conforme à la spécification",
        },
        requiresNoteOnFail: true,
      },
      {
        prompt: {
          en: "Sash moves freely and holds position",
          fr: "La guillotine coulisse librement et tient sa position",
        },
        requiresNoteOnFail: false,
      },
      {
        prompt: {
          en: "Airflow alarm sounds when tested",
          fr: "L’alarme de débit d’air se déclenche à l’essai",
        },
        requiresNoteOnFail: true,
      },
      {
        prompt: {
          en: "Work surface clear of stored material",
          fr: "Surface de travail libre de matériel entreposé",
        },
        requiresNoteOnFail: false,
      },
    ],
  },
  {
    code: "INS-EWS",
    assetTypeKeys: ["eyewashStation"],
    name: {
      en: "Eyewash and shower inspection",
      fr: "Inspection du lavage oculaire et de la douche",
    },
    description: {
      en: "Monthly activation, flow and access check.",
      fr: "Activation mensuelle, vérification du débit et de l’accès.",
    },
    items: [
      {
        prompt: {
          en: "Both eyewash heads deliver an even stream",
          fr: "Les deux douchettes oculaires produisent un jet uniforme",
        },
        requiresNoteOnFail: true,
      },
      {
        prompt: {
          en: "Shower valve opens and stays open",
          fr: "La valve de douche s’ouvre et reste ouverte",
        },
        requiresNoteOnFail: true,
      },
      {
        prompt: {
          en: "Water runs clear within one minute",
          fr: "L’eau devient claire en moins d’une minute",
        },
        requiresNoteOnFail: false,
      },
      {
        prompt: { en: "Access path unobstructed", fr: "Voie d’accès dégagée" },
        requiresNoteOnFail: false,
      },
    ],
  },
  {
    code: "INS-FAP",
    assetTypeKeys: ["fireAlarmPanel", "sprinklerSystem"],
    name: {
      en: "Life safety system round",
      fr: "Ronde des systèmes de sécurité",
    },
    description: {
      en: "Panel status, supervisory signals and sprinkler valve position.",
      fr: "État du panneau, signaux de supervision et position des vannes de gicleurs.",
    },
    items: [
      {
        prompt: {
          en: "Panel shows normal status",
          fr: "Le panneau indique un état normal",
        },
        requiresNoteOnFail: true,
      },
      {
        prompt: {
          en: "No trouble or supervisory signals present",
          fr: "Aucun signal de dérangement ou de supervision",
        },
        requiresNoteOnFail: true,
      },
      {
        prompt: {
          en: "Sprinkler control valves open and secured",
          fr: "Vannes de contrôle des gicleurs ouvertes et verrouillées",
        },
        requiresNoteOnFail: true,
      },
      {
        prompt: {
          en: "Gauge pressures within range",
          fr: "Pressions des manomètres dans la plage prévue",
        },
        requiresNoteOnFail: false,
      },
    ],
  },
  {
    code: "INS-CLD",
    assetTypeKeys: ["coldRoom", "ultraLowFreezer", "laboratoryRefrigerator"],
    name: {
      en: "Cold storage temperature round",
      fr: "Ronde de température des espaces réfrigérés",
    },
    description: {
      en: "Temperature, alarm and door seal verification for cold storage.",
      fr: "Vérification de la température, des alarmes et des joints de porte des espaces réfrigérés.",
    },
    items: [
      {
        prompt: {
          en: "Temperature within the recorded range",
          fr: "Température dans la plage consignée",
        },
        requiresNoteOnFail: true,
      },
      {
        prompt: {
          en: "Alarm set point matches the plan",
          fr: "Le seuil d’alarme correspond au plan",
        },
        requiresNoteOnFail: true,
      },
      {
        prompt: {
          en: "Door seal intact, no frost build-up",
          fr: "Joint de porte intact, aucune accumulation de givre",
        },
        requiresNoteOnFail: false,
      },
    ],
  },
];

export interface WorkOrderPhrase {
  title: LocalizedText;
  description: LocalizedText;
}

/**
 * What a work order of each kind says. The asset's own name is added to the
 * title when the record is built, so "Quarterly preventive maintenance" reads
 * as "Quarterly preventive maintenance — Air handling unit AHU-KGN-11".
 */
export const WORK_ORDER_PHRASES: Readonly<
  Record<WorkOrderType, readonly WorkOrderPhrase[]>
> = {
  preventive: [
    {
      title: {
        en: "Scheduled preventive maintenance",
        fr: "Entretien préventif planifié",
      },
      description: {
        en: "Carry out the scheduled service for this equipment and record the readings on the checklist.",
        fr: "Effectuer l’entretien planifié de cet équipement et consigner les relevés sur la liste de vérification.",
      },
    },
    {
      title: {
        en: "Quarterly filter and belt service",
        fr: "Entretien trimestriel des filtres et des courroies",
      },
      description: {
        en: "Replace filters, check belt tension and confirm the unit returns to normal operation.",
        fr: "Remplacer les filtres, vérifier la tension des courroies et confirmer le retour au fonctionnement normal.",
      },
    },
  ],
  corrective: [
    {
      title: {
        en: "Repair reported fault",
        fr: "Réparer la défaillance signalée",
      },
      description: {
        en: "Staff reported abnormal operation. Diagnose the fault, repair it and note the parts used.",
        fr: "Le personnel a signalé un fonctionnement anormal. Diagnostiquer la défaillance, la réparer et noter les pièces utilisées.",
      },
    },
    {
      title: {
        en: "Investigate temperature excursion",
        fr: "Enquêter sur un écart de température",
      },
      description: {
        en: "The unit ran outside its recorded range. Find the cause, correct it and confirm the reading holds for an hour.",
        fr: "L’appareil a fonctionné hors de sa plage consignée. Trouver la cause, la corriger et confirmer la stabilité du relevé pendant une heure.",
      },
    },
    {
      title: {
        en: "Replace failed component",
        fr: "Remplacer un composant défaillant",
      },
      description: {
        en: "Replace the failed component, test under load and return the equipment to service.",
        fr: "Remplacer le composant défaillant, le mettre à l’essai sous charge et remettre l’équipement en service.",
      },
    },
  ],
  emergency: [
    {
      title: {
        en: "Emergency response, equipment down",
        fr: "Intervention d’urgence, équipement hors service",
      },
      description: {
        en: "Equipment is out of service and affecting laboratory work. Attend immediately and report the cause.",
        fr: "L’équipement est hors service et nuit aux travaux de laboratoire. Intervenir immédiatement et signaler la cause.",
      },
    },
  ],
  inspection: [
    {
      title: {
        en: "Scheduled safety inspection",
        fr: "Inspection de sécurité planifiée",
      },
      description: {
        en: "Complete the inspection checklist and raise a corrective order for anything that fails.",
        fr: "Remplir la liste de vérification et ouvrir un bon correctif pour tout élément non conforme.",
      },
    },
  ],
  calibration: [
    {
      title: { en: "Instrument calibration", fr: "Étalonnage d’instrument" },
      description: {
        en: "Calibrate against the reference standard, record the readings before and after, and apply the label.",
        fr: "Étalonner selon l’étalon de référence, consigner les relevés avant et après, puis apposer l’étiquette.",
      },
    },
  ],
  safety: [
    {
      title: {
        en: "Safety compliance check",
        fr: "Vérification de conformité en sécurité",
      },
      description: {
        en: "Verify the safety devices, guards and signage, and record anything that needs correcting.",
        fr: "Vérifier les dispositifs de sécurité, les protecteurs et la signalisation, puis consigner tout élément à corriger.",
      },
    },
  ],
};

/**
 * Notes people leave on a work order.
 *
 * Each is one string in one language, because that is what a comment is: the
 * words somebody typed. Both languages appear here deliberately, so the
 * demonstration shows an English reader a French note marked as French and the
 * reverse — the behaviour WA-27's content-language rule describes.
 */
export const WORK_ORDER_COMMENTS: readonly {
  body: string;
  language: "en" | "fr";
}[] = [
  {
    body: "Isolated the unit and locked out the panel before starting. Breaker labelling on this floor does not match the drawing.",
    language: "en",
  },
  {
    body: "Filter differential still climbing after the change. Worth watching on the next visit.",
    language: "en",
  },
  {
    body: "Part arrived damaged in transit; returned it and reordered rather than fit it.",
    language: "en",
  },
  {
    body: "Access requires the laboratory to be unoccupied. Scheduled with the floor coordinator for early morning.",
    language: "en",
  },
  {
    body: "Vibration on the intake side is louder than on the sister unit. Recorded a reading for comparison.",
    language: "en",
  },
  {
    body: "Vanne d’isolement grippée. Dégagée et graissée, mais elle est à surveiller.",
    language: "fr",
  },
  {
    body: "Impossible d’accéder au local avant 7 h. Intervention reportée au lendemain matin.",
    language: "fr",
  },
  {
    body: "Le joint fourni n’est pas au bon diamètre. Pièce commandée, bon de travail en attente.",
    language: "fr",
  },
  {
    body: "Essai de charge réussi. La génératrice a tenu la pleine charge pendant trente minutes.",
    language: "fr",
  },
];
