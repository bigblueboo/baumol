import { s, svgFragment } from "../ui/dom";
import type { GoodsIcon, ServiceIcon } from "../model/scenarios";

export type IconName = GoodsIcon | ServiceIcon | "clock" | "robot" | "coin" | "gear" | "lock" | "play" | "pause" | "reset" | "link" | "person";

/**
 * Line icons on a 24-unit grid, drawn in currentColor. `.fill` marks shapes that take a
 * flat tint (set by CSS) instead of staying open, which is what gives them the riso look.
 */
const ART: Record<IconName, string> = {
  hat: `<path class="fill" d="M7 17.5V8.6c0-.9.7-1.6 1.6-1.6h6.8c.9 0 1.6.7 1.6 1.6v8.9"/><path d="M7 13.6h10"/><path d="M3 17.5c2.5 1.9 15.5 1.9 18 0"/>`,
  gadget: `<circle class="fill" cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="2.4"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1"/>`,
  bread: `<path class="fill" d="M4.2 11.2C4.2 8.3 6.8 6.5 12 6.5s7.8 1.8 7.8 4.7c0 .9-.6 1.5-1.4 1.7v5.3c0 .6-.4 1-1 1H6.6c-.6 0-1-.4-1-1v-5.3c-.8-.2-1.4-.8-1.4-1.7z"/><path d="M9 9.2l1.2 1.8M12 9l1.2 1.8M15 9.2l1.2 1.8"/>`,
  crate: `<path class="fill" d="M4 7.5l8-4 8 4v9l-8 4-8-4z"/><path d="M4 7.5l8 4 8-4M12 11.5v9M8 5.5l8 4"/>`,
  record: `<circle class="fill" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.6" opacity=".55"/><circle cx="12" cy="12" r="2.2"/>`,
  cube: `<path class="fill" d="M12 4l7 4v8l-7 4-7-4V8z"/><path d="M5 8l7 4 7-4M12 12v8"/><path d="M19.5 1.8v3M18 3.3h3"/>`,
  code: `<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5"/><path class="accent" d="M13.4 4.5l-2.8 15"/>`,
  meal: `<path class="fill" d="M3.5 10h17v6.5c0 1.4-1.1 2.5-2.5 2.5H6c-1.4 0-2.5-1.1-2.5-2.5z"/><path d="M3.5 10l2-3.2h13l2 3.2M12 10v9"/>`,
  pill: `<g transform="rotate(-40 12 12)"><rect class="fill" x="4" y="8.2" width="16" height="7.6" rx="3.8"/><path d="M12 8.2v7.6"/></g>`,
  toy: `<rect class="fill" x="4" y="12" width="7" height="7" rx="1"/><rect x="13" y="12" width="7" height="7" rx="1"/><rect class="fill" x="8.5" y="4.5" width="7" height="7" rx="1"/>`,
  scissors: `<circle class="fill" cx="6.5" cy="17.5" r="3"/><circle class="fill" cx="17.5" cy="17.5" r="3"/><path d="M8.6 15.4L18.5 3.5M15.4 15.4L5.5 3.5"/>`,
  heart: `<path class="fill" d="M12 20s-7.5-4.6-7.5-10.2A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>`,
  book: `<path class="fill" d="M3 5.6c2.7-1.1 6.2-1 9 1 2.8-2 6.3-2.1 9-1v13c-2.7-1.1-6.2-1-9 1-2.8-2-6.3-2.1-9-1z"/><path d="M12 6.6v13"/>`,
  eye: `<path class="fill" d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.8"/>`,
  note: `<path d="M9 17.5V5.2l11-2v12.3"/><circle class="fill" cx="6.5" cy="17.5" r="2.6"/><circle class="fill" cx="17.5" cy="15.5" r="2.6"/>`,
  speech: `<path class="fill" d="M4 5h16v10.5H10L5.5 19.5V15.5H4z"/><path d="M8 9.2h8M8 12h5"/>`,
  check: `<circle class="fill" cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L21 21"/><path class="accent" d="M7.6 10.6l2 2 3.6-3.7"/>`,
  fork: `<path d="M7 3v18M4.5 3v4.8a2.5 2.5 0 0 0 5 0V3"/><path class="fill" d="M17.5 21V3c-2.2 1-3.4 4-3.4 7.5h3.4"/>`,
  cross: `<rect class="fill" x="3.5" y="3.5" width="17" height="17" rx="3"/><path class="accent" d="M12 7.5v9M7.5 12h9"/>`,
  teddy: `<circle class="fill" cx="12" cy="13.5" r="6.3"/><circle class="fill" cx="6.6" cy="7" r="2.3"/><circle class="fill" cx="17.4" cy="7" r="2.3"/><path d="M10 13h.01M14 13h.01M10.6 16c.8.6 2 .6 2.8 0"/>`,
  faucet: `<path class="fill" d="M3 9h10.5a3.5 3.5 0 0 1 3.5 3.5V14h-3.4v-1.2c0-.4-.3-.8-.8-.8H3z"/><path d="M8 9V6.2M5.5 6h5"/><path d="M15.3 17.3c-.8 1.2-.8 2 0 2.6.8-.6.8-1.4 0-2.6z"/>`,
  doc: `<path class="fill" d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 11h6M9 14h6M9 17h4"/>`,
  wrench: `<path class="fill" d="M14.5 3.5a5 5 0 0 0-4.6 6.9L3.6 16.7a2 2 0 0 0 2.8 2.8l6.3-6.3a5 5 0 0 0 6.9-4.6l-3 3-2.8-.7-.7-2.8z"/>`,
  scales: `<path d="M12 4v16M7 20h10M5 7h14"/><path class="fill" d="M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>`,
  clock: `<circle class="fill" cx="12" cy="12" r="9"/><path d="M12 6.5V12l3.6 2.2"/>`,
  robot: `<rect class="fill" x="5" y="8" width="14" height="11" rx="2.2"/><path d="M12 8V4.8"/><circle cx="12" cy="4" r="1"/><path d="M9.2 12.8h.01M14.8 12.8h.01M9.5 16h5"/>`,
  coin: `<circle class="fill" cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.6c.5-1 1.5-1.4 2.6-1.4 1.6 0 2.6.9 2.6 1.9M14.5 14.4c-.5 1-1.5 1.4-2.6 1.4-1.6 0-2.6-.9-2.6-1.9"/>`,
  gear: `<path class="fill" d="M10.3 2.8h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9-2.6-.5v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z"/><circle cx="12" cy="12" r="3.2"/>`,
  lock: `<rect class="fill" x="5" y="10.5" width="14" height="10" rx="1.6"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>`,
  play: `<path class="fill" d="M7 4.5v15l12.5-7.5z"/>`,
  pause: `<rect class="fill" x="6" y="4.5" width="4" height="15" rx="1"/><rect class="fill" x="14" y="4.5" width="4" height="15" rx="1"/>`,
  reset: `<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 3.5v4h4"/>`,
  link: `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,
  person: `<circle class="fill" cx="12" cy="7" r="3.4"/><path class="fill" d="M5.5 20.5c0-4 2.9-7 6.5-7s6.5 3 6.5 7z"/>`,
};

const templates = new Map<IconName, SVGGElement>();

function template(name: IconName): SVGGElement {
  let t = templates.get(name);
  if (!t) {
    t = svgFragment(ART[name]);
    templates.set(name, t);
  }
  return t;
}

/** An icon as an SVG group, for placing inside a larger drawing. Sized to `size` units. */
export function iconGroup(name: IconName, x: number, y: number, size: number, cls = ""): SVGGElement {
  const g = s("g", { class: `icon icon--${name} ${cls}`.trim(), transform: `translate(${x} ${y}) scale(${size / 24})` });
  g.append(...Array.from(template(name).childNodes, (n) => n.cloneNode(true)));
  return g;
}

/** An icon as a standalone inline SVG element, for HTML contexts. */
export function icon(name: IconName, cls = ""): SVGSVGElement {
  const el = s("svg", { viewBox: "0 0 24 24", class: `icon icon--${name} ${cls}`.trim(), "aria-hidden": "true" });
  el.append(...Array.from(template(name).childNodes, (n) => n.cloneNode(true)));
  return el;
}
