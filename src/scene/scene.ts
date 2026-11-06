import type { Snapshot } from "../model/economy";
import type { Scenario } from "../model/scenarios";

export interface SceneOptions {
  scenario: Scenario;
  title: string;
  compact: boolean;
  /** Draw the far sidewalk where a waiting list forms. */
  queue?: boolean;
}

/**
 * A drawing of the town. Static art is built once per scenario; each frame renders straight
 * from the model's snapshot, so the picture can't disagree with the numbers.
 */
export interface Scene {
  /** The drawing plus, on phones, the HTML strip that stands in for the noticeboard. */
  readonly el: HTMLElement;
  /** Jump the crowd to a snapshot's staffing without anyone walking: for fresh runs. */
  place(snap: Snapshot): void;
  setScenario(sc: Scenario): void;
  render(snap: Snapshot, dt: number): void;
}
