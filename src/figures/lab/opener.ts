import { prefersReducedMotion } from "../../ui/dom";
import { encode, type Recipe } from "./store";

let loader: ((recipe: Recipe) => void) | null = null;

/** The lab registers how to load a recipe once it has mounted. */
export function registerLab(load: (recipe: Recipe) => void): void {
  loader = load;
}

/**
 * Send the reader to the lab with a recipe. A mounted lab loads it now; an unmounted one finds
 * it in the address bar when it mounts. Either way the page scrolls there once.
 */
export function openLab(recipe: Recipe): void {
  history.pushState(null, "", encode(recipe));
  loader?.(recipe);
  document.getElementById("lab")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}
