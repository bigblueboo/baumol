import type { Calibration } from "./economy";
import type { Params } from "./params";

export type GoodsIcon = "hat" | "gadget" | "bread" | "crate" | "record" | "cube" | "code" | "meal" | "pill" | "toy" | "faucet" | "doc";
export type ServiceIcon = "scissors" | "heart" | "book" | "eye" | "note" | "speech" | "check" | "fork" | "cross" | "teddy" | "wrench" | "scales";
export type Facade = "shop" | "home" | "school" | "tower" | "hall" | "parlor" | "studio" | "diner" | "clinic" | "nursery" | "workshop" | "office";

interface Noun {
  one: string;
  many: string;
}

/**
 * A scenario is a skin over one engine. Everything that differs between "hats and haircuts"
 * and "code and review" lives here: words, pictures, display units and the defaults the Lab
 * loads. The equations never look at a scenario except through `baseShare` (how the town
 * starts out) and `machineQuality` (how good the automated substitute is).
 */
export interface Scenario {
  id: ScenarioId;
  title: string;
  /** A short tag used on chips: "Education", "Public safety". */
  domain: string;
  /**
   * Units one worker makes, or serves, per hour at the start, in both sectors alike. The model
   * works in normalized units; this only scales them for display ("2 hats an hour").
   */
  perHour: number;
  goods: Noun & { icon: GoodsIcon; building: string; worker: Noun };
  service: Noun & { icon: ServiceIcon; building: string; worker: Noun; facade: Facade };
  /** The people the service is for, used in coverage readouts. */
  clients: Noun;
  machine: Noun & { quality: number };
  /** Share of workers in the service sector when the story starts. */
  baseShare: number;
  defaults: Partial<Params>;
  /** What caseload means here ("class size", "patients per nurse"). */
  caseloadLabel: string;
  teaches: string;
  complication: string;
  /** Optional extra framing shown in the lab, as [term, explanation] pairs. */
  lens?: { title: string; items: [string, string][] };
}

export const SCENARIO_IDS = [
  "hats",
  "care",
  "lessons",
  "watch",
  "concerts",
  "conversation",
  "review",
  "restaurants",
  "health",
  "childcare",
  "trades",
  "law",
] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

const n = (one: string, many: string = `${one}s`): Noun => ({ one, many });

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  hats: {
    id: "hats",
    title: "Hats and Haircuts",
    domain: "Haircuts",
    perHour: 2,
    goods: { ...n("hat"), icon: "hat", building: "Hat works", worker: n("hatter") },
    service: { ...n("haircut"), icon: "scissors", building: "Barbershop", worker: n("barber"), facade: "shop" },
    clients: n("customer"),
    machine: { ...n("clipper kiosk"), quality: 0.45 },
    baseShare: 1 / 3,
    defaults: {},
    caseloadLabel: "Chairs per barber",
    teaches: "The bare relative-price mechanism, with nothing at stake.",
    complication: "Low stakes, and it is easy to imagine faster clippers.",
  },
  care: {
    id: "care",
    title: "Things and Care",
    domain: "Eldercare",
    perHour: 1,
    goods: { ...n("gadget"), icon: "gadget", building: "Gadget plant", worker: n("machinist") },
    service: { one: "care-hour", many: "care-hours", icon: "heart", building: "Care house", worker: n("caregiver"), facade: "home" },
    clients: n("resident"),
    machine: { ...n("care robot"), quality: 0.5 },
    baseShare: 1 / 3,
    defaults: { substitutability: 0.5, essentialFloor: 0.6 },
    caseloadLabel: "Residents per caregiver",
    teaches: "The core case: an hour of attentive care still takes a caregiver an hour.",
    complication: "Need and quality have to be stated outright, or the numbers mislead.",
  },
  lessons: {
    id: "lessons",
    title: "Bread and Lessons",
    domain: "Education",
    perHour: 8,
    goods: { one: "loaf", many: "loaves", icon: "bread", building: "Bakery", worker: n("baker") },
    service: { one: "student-hour", many: "student-hours", icon: "book", building: "Schoolhouse", worker: n("teacher"), facade: "school" },
    clients: n("child", "children"),
    machine: { ...n("automated lesson"), quality: 0.55 },
    baseShare: 1 / 4,
    defaults: { substitutability: 0.6, incomeSensitivity: 1.3, funding: "public" },
    caseloadLabel: "Class size (× 8 pupils)",
    teaches: "Augmenting a teacher, batching pupils and replacing the lesson are three different things.",
    complication: "Pupils taught is not the same as learning.",
    lens: {
      title: "Three things called efficiency",
      items: [
        ["Augmentation", "Schoolhouse productivity growth: tools that let one teacher do more without anyone learning less."],
        ["Batching", "Class size: more pupils per teacher, each getting less attention. Watch quality."],
        ["Substitution", "Hours handed to the automated lesson: cheaper, and a different product."],
      ],
    },
  },
  watch: {
    id: "watch",
    title: "Factory and Watchtower",
    domain: "Public safety",
    perHour: 1,
    goods: { ...n("crate"), icon: "crate", building: "Crate factory", worker: n("packer") },
    service: { one: "guard-hour", many: "guard-hours", icon: "eye", building: "Watchtower", worker: n("guard"), facade: "tower" },
    clients: n("household"),
    machine: { ...n("camera"), quality: 0.6 },
    baseShare: 1 / 6,
    defaults: { funding: "public", substitutability: 1, incomeSensitivity: 1 },
    caseloadLabel: "Towers per guard",
    teaches: "Public budgets: why a frozen budget means fewer hours on watch.",
    complication: "Fixed guard demand alone does not make the guard's share of the town grow.",
  },
  concerts: {
    id: "concerts",
    title: "Copies and Concerts",
    domain: "Live performance",
    perHour: 20,
    goods: { ...n("record"), icon: "record", building: "Pressing plant", worker: n("presser") },
    service: { one: "concert seat", many: "concert seats", icon: "note", building: "Concert hall", worker: n("musician"), facade: "hall" },
    clients: n("listener"),
    machine: { ...n("recording"), quality: 0.6 },
    baseShare: 1 / 6,
    defaults: { substitutability: 1.6, incomeSensitivity: 1.2 },
    caseloadLabel: "Seats per musician",
    teaches: "Baumol's own example: a quartet still needs four players for forty minutes.",
    complication: "Musicians are specialists, and a recording is a different product.",
  },
  conversation: {
    id: "conversation",
    title: "Replicators and Conversation",
    domain: "Attention",
    perHour: 1,
    goods: { ...n("object"), icon: "cube", building: "Replicator", worker: n("operator") },
    service: { one: "conversation-hour", many: "conversation-hours", icon: "speech", building: "Listening room", worker: n("listener"), facade: "parlor" },
    clients: n("visitor"),
    machine: { ...n("chatbot"), quality: 0.45 },
    baseShare: 1 / 4,
    defaults: { substitutability: 0.6, incomeSensitivity: 1.4, goodsGrowth: 0.1 },
    caseloadLabel: "Visitors per listener",
    teaches: "Objects become nearly free; attention stays scarce.",
    complication: "Abstract, and loaded: whose attention, and for what?",
  },
  review: {
    id: "review",
    title: "Generated Code and Human Review",
    domain: "AI-era verification",
    perHour: 4,
    goods: { ...n("generated module"), icon: "code", building: "Code generator", worker: n("prompter") },
    service: { one: "reviewed module", many: "reviewed modules", icon: "check", building: "Review desk", worker: n("reviewer"), facade: "studio" },
    clients: n("team"),
    machine: { ...n("automated check"), quality: 0.6 },
    baseShare: 1 / 3,
    defaults: { substitutability: 0.4, goodsGrowth: 0.12 },
    caseloadLabel: "Modules per review pass",
    teaches: "Why trustworthy human judgment gets dearer as generation gets cheaper.",
    complication: "Partly bottleneck and induced-demand economics, not pure Baumol.",
  },
  restaurants: {
    id: "restaurants",
    title: "Packaged Meals and Table Service",
    domain: "Restaurants",
    perHour: 4,
    goods: { ...n("packaged meal"), icon: "meal", building: "Meal factory", worker: n("line worker") },
    service: { one: "served meal", many: "served meals", icon: "fork", building: "Diner", worker: n("server"), facade: "diner" },
    clients: n("diner"),
    machine: { ...n("order kiosk"), quality: 0.7 },
    baseShare: 1 / 4,
    defaults: { substitutability: 1.2, serviceGrowth: 0.01, goodsGrowth: 0.05 },
    caseloadLabel: "Tables per server",
    teaches: "A relatable case, and a reminder that stagnant sectors can change pace.",
    complication: "Measured restaurant productivity sped up after 2019. Industries switch regimes.",
  },
  health: {
    id: "health",
    title: "Medicine and Nursing",
    domain: "Healthcare",
    perHour: 2,
    goods: { ...n("pill pack"), icon: "pill", building: "Pharma plant", worker: n("technician") },
    service: { one: "nurse visit", many: "nurse visits", icon: "cross", building: "Clinic", worker: n("nurse"), facade: "clinic" },
    clients: n("patient"),
    machine: { ...n("remote monitor"), quality: 0.55 },
    baseShare: 1 / 4,
    defaults: { substitutability: 0.4, incomeSensitivity: 1.3, funding: "public", goodsGrowth: 0.05 },
    caseloadLabel: "Patients per nurse",
    teaches: "The production-side core of rising health costs.",
    complication: "Real healthcare adds insurance, market power and administration on top.",
  },
  childcare: {
    id: "childcare",
    title: "Toys and Childcare",
    domain: "Childcare",
    perHour: 4,
    goods: { ...n("toy"), icon: "toy", building: "Toy factory", worker: n("assembler") },
    service: { one: "child-hour", many: "child-hours", icon: "teddy", building: "Nursery", worker: n("carer"), facade: "nursery" },
    clients: n("family", "families"),
    machine: { ...n("screen"), quality: 0.25 },
    baseShare: 1 / 4,
    defaults: { substitutability: 0.5, essentialFloor: 0.7, goodsGrowth: 0.05 },
    caseloadLabel: "Toddlers per carer (× 4)",
    teaches: "Ratios are the product: one adult can only watch so many toddlers.",
    complication: "Parents' own time is the unpriced alternative.",
  },
  trades: {
    id: "trades",
    title: "Fixtures and Tradespeople",
    domain: "Home repair",
    perHour: 1,
    goods: { ...n("fixture"), icon: "faucet", building: "Fixture works", worker: n("fitter") },
    service: { one: "repair-hour", many: "repair-hours", icon: "wrench", building: "Repairs", worker: n("plumber"), facade: "workshop" },
    clients: n("household"),
    machine: { one: "DIY kit", many: "DIY kits", quality: 0.4 },
    baseShare: 1 / 5,
    defaults: { substitutability: 0.3, essentialFloor: 0.7, trainingYears: 3, goodsGrowth: 0.05 },
    caseloadLabel: "Jobs juggled per plumber",
    teaches: "Why the faucet is cheap and the plumber who fits it isn't.",
    complication: "Apprenticeships take years, so a shortage of tradespeople shows up as waits before it shows up in prices.",
  },
  law: {
    id: "law",
    title: "Templates and Lawyers",
    domain: "Legal advice",
    perHour: 2,
    goods: { ...n("printed form"), icon: "doc", building: "Form press", worker: n("printer") },
    service: { one: "half-hour of advice", many: "half-hours of advice", icon: "scales", building: "Law office", worker: n("lawyer"), facade: "office" },
    clients: n("client"),
    machine: { one: "AI drafting tool", many: "AI drafting tools", quality: 0.65 },
    baseShare: 1 / 6,
    defaults: { substitutability: 0.8, incomeSensitivity: 1.3, goodsGrowth: 0.06 },
    caseloadLabel: "Matters per lawyer",
    teaches: "Forms became nearly free; the judgment applied to them did not.",
    complication: "Legal output is hard to measure, and AI may be the first real productivity shock the sector has had.",
  },
};

/** The standard town: 24 people. The warm-up figures use a smaller town of 12. */
export const TOWN_SIZE = 24;

export function calibrationOf(sc: Scenario, population = TOWN_SIZE): Calibration {
  return { population, baseShare: sc.baseShare, machineQuality: sc.machine.quality };
}

/** Human minutes in one unit of output, from either sector, at productivity `tech`. */
export function minutesPerUnit(s: Scenario, tech: number): number {
  return 60 / (s.perHour * tech);
}
