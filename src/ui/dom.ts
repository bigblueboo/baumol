type AttrValue = string | number | boolean | null | undefined;
type Attrs = Record<string, AttrValue>;
type Child = Node | string | number | null | undefined | false;

const SVG_NS = "http://www.w3.org/2000/svg";

function apply(el: Element, attrs: Attrs | undefined, children: Child[]): void {
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs, children);
  return el;
}

export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, attrs, children);
  return el;
}

/** Parse a fragment of SVG markup into a group. Used for icon art kept as strings. */
export function svgFragment(markup: string, attrs?: Attrs): SVGGElement {
  const g = s("g", attrs);
  const doc = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${markup}</svg>`, "image/svg+xml");
  for (const node of Array.from(doc.documentElement.childNodes)) g.append(document.importNode(node, true));
  return g;
}

/** Write-if-changed helpers: per-frame code calls these freely without touching the DOM needlessly. */
export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function setAttr(el: Element, name: string, value: string | number): void {
  const v = String(value);
  if (el.getAttribute(name) !== v) el.setAttribute(name, v);
}

export function toggleClass(el: Element, name: string, on: boolean): void {
  if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Replay a one-shot CSS animation by removing and re-adding its class. */
export function restartAnimation(el: Element, cls: string): void {
  el.classList.remove(cls);
  void el.getBoundingClientRect();
  el.classList.add(cls);
}
