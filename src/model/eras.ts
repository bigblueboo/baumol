/**
 * The tool eras behind the big button. Each press doubles what one engineer
 * ships in an hour. Nothing on this list touches babysitting.
 */

export interface Era {
  /** Software units per engineer-hour once this era lands. */
  aEng: number;
  /** Name shown on the era marker. */
  name: string;
  /** Compact name for chart annotations. */
  short: string;
  /** Label for the button that summons the era. */
  button: string;
  /** One line about what changed at the studio. */
  flavor: string;
}

export const ERAS: Era[] = [
  {
    aEng: 1,
    name: "Text editors",
    short: "1999",
    button: "Better tools",
    flavor: "Engineers ship code by hand, one unit an hour.",
  },
  {
    aEng: 2,
    name: "IDEs & Stack Overflow",
    short: "IDEs",
    button: "Install IDEs",
    flavor: "Autocomplete and answered questions. Output doubles.",
  },
  {
    aEng: 4,
    name: "Open-source frameworks",
    short: "Frameworks",
    button: "Adopt frameworks",
    flavor: "Don't write it, import it. Output doubles again.",
  },
  {
    aEng: 8,
    name: "Cloud & app stores",
    short: "Cloud",
    button: "Move to the cloud",
    flavor: "Deploy to the planet from a laptop.",
  },
  {
    aEng: 16,
    name: "AI pair programmer",
    short: "AI pair",
    button: "Turn on AI autocomplete",
    flavor: "The machine writes half the code.",
  },
  {
    aEng: 32,
    name: "AI agents",
    short: "Agents",
    button: "Delegate to agents",
    flavor: "Describe the feature; review the pull request.",
  },
];

/** Index of the era in effect at a given productivity target. */
export function eraIndex(aEngTarget: number): number {
  const i = Math.round(Math.log2(aEngTarget));
  return Math.max(0, Math.min(ERAS.length - 1, i));
}

export function currentEra(aEngTarget: number): Era {
  return ERAS[eraIndex(aEngTarget)] ?? ERAS[0]!;
}

/** The era the next press would bring, or null at the end of the road. */
export function nextEra(aEngTarget: number): Era | null {
  const i = eraIndex(aEngTarget) + 1;
  return i < ERAS.length ? (ERAS[i] ?? null) : null;
}
