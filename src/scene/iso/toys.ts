import { s, setAttr } from "../../ui/dom";
import type { Job } from "../layout";
import type { Figure } from "../people";

const HEIGHT = 46;
/** Every pose is padded to the same height; this box is wide enough that height always governs. */
const BOX = HEIGHT * 0.7;
/** Pose 0 stands; poses 1–3 are the steps of a walk, drawn heading toward +x. */
const WALK_FRAMES = 3;

/** One sheet per character, each drawn in both outfits, so a person looks the same in either job. */
const POSES = import.meta.glob<string>("./sprites/people/*.webp", { eager: true, import: "default" });
const CHARACTERS = new Set(Object.keys(POSES).map((k) => k.match(/char-(\d+)-/)?.[1])).size;

function poseUrl(character: number, job: Job, n: number): string {
  const url = POSES[`./sprites/people/char-${character}-${job}-${n}.webp`];
  if (!url) throw new Error(`missing pose char-${character}-${job}-${n}`);
  return url;
}

/** A toy townsperson for the isometric town: one character, who stands and walks in either outfit. */
export function toyFigure(id: number): Figure {
  const character = id % CHARACTERS;
  const img = s("image", { x: -BOX / 2, y: -HEIGHT, width: BOX, height: HEIGHT, preserveAspectRatio: "xMidYMax meet" });
  const el = s("g", { class: "person__toy" }, img);
  return {
    el,
    bubbleLift: HEIGHT - 34,
    pose(moving, phase, facing, job) {
      setAttr(img, "href", poseUrl(character, job, moving ? 1 + (Math.floor(phase * WALK_FRAMES) % WALK_FRAMES) : 0));
      setAttr(el, "transform", moving && facing < 0 ? "scale(-1 1)" : "");
    },
  };
}
