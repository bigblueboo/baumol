import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/plates.css";
import "./styles/controls.css";
import "./styles/scene.css";
import { FIGURES, type FigureName } from "./figures/registry";
import { initSoundToggle } from "./ui/sound";

function isFigureName(name: string | undefined): name is FigureName {
  return name !== undefined && name in FIGURES;
}

/** Mount each figure shortly before it scrolls into view; the first screen stays light. */
const mounter = new IntersectionObserver(
  (records) => {
    for (const r of records) {
      if (!r.isIntersecting) continue;
      const host = r.target;
      mounter.unobserve(host);
      if (!(host instanceof HTMLElement)) continue;
      const name = host.dataset.figure;
      if (isFigureName(name)) FIGURES[name](host);
    }
  },
  { rootMargin: "800px 0px" },
);

for (const host of document.querySelectorAll<HTMLElement>("[data-figure]")) mounter.observe(host);

const masthead = document.querySelector(".masthead");
const onScroll = () => masthead?.classList.toggle("is-scrolled", window.scrollY > 240);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// A shared lab link carries its settings in the hash; bring the lab into view (it mounts, and
// reads the hash, as it arrives). Links within the page go through openLab instead.
if (location.hash.startsWith("#lab?")) document.getElementById("lab")?.scrollIntoView();

const toggle = document.querySelector<HTMLButtonElement>("[data-sound-toggle]");
if (toggle) initSoundToggle(toggle);
