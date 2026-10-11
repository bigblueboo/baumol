import { mountAfford } from "./afford";
import { mountBasket } from "./basket";
import { mountBridge } from "./bridge";
import { mountCases } from "./cases";
import { mountChoices } from "./choices";
import { mountDemand } from "./demand";
import { mountHats } from "./hats";
import { mountHero } from "./hero";
import { mountLab } from "./lab/lab";
import { mountMinutes } from "./minutes";
import { mountMorph } from "./morph";

export const FIGURES = {
  hero: mountHero,
  hats: mountHats,
  minutes: mountMinutes,
  morph: mountMorph,
  bridge: mountBridge,
  basket: mountBasket,
  choices: mountChoices,
  demand: mountDemand,
  afford: mountAfford,
  cases: mountCases,
  lab: mountLab,
} satisfies Record<string, (host: HTMLElement) => void>;

export type FigureName = keyof typeof FIGURES;
