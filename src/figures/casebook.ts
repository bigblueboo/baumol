import type { Snapshot } from "../model/economy";
import { makeParams, type Params } from "../model/params";
import { SCENARIOS, calibrationOf, type ScenarioId } from "../model/scenarios";
import { TownSim, type Course } from "../sim/townSim";
import { paramsFor, type Recipe } from "./lab/store";
import { RUN_YEARS, type RunSample } from "./runCharts";

export interface Source {
  authors: string;
  year: string;
  title: string;
  outlet: string;
  url: string;
}

/**
 * One industry run through the engine for forty years, with what readers tend to expect of it
 * and what studies of the real thing have found.
 */
export interface Case {
  scenario: ScenarioId;
  /** Rules at year `t`, on top of the scenario's own defaults. */
  rules: (t: number) => Partial<Params>;
  intuition: string;
  evidence: string;
  sources: Source[];
}

/** Every case runs at the same pace, so the industries differ only in what makes them different. */
export const CASE_GROWTH = 0.06;

const phaseIn = (t: number, to: number) => to * Math.min(1, t / RUN_YEARS);

/** Non-empty by construction, so the figure always has a first case to show. */
export const CASES: [Case, ...Case[]] = [
  {
    scenario: "concerts",
    rules: () => ({}),
    intuition:
      "A Schubert quartet takes four players about forty minutes, as it did in 1828. Every other way of hearing music has become cheap.",
    evidence:
      "Baumol and Bowen first made the cost-disease argument about exactly this case: performing-arts budgets kept outrunning ticket revenue because live performance can't speed up. Half a century later, Flanagan's study of American symphony orchestras finds the same gap, closed by donations and endowment income (and, outside the United States, by government subsidy) rather than by ticket prices.",
    sources: [
      {
        authors: "William J. Baumol and William G. Bowen",
        year: "1965",
        title: "On the Performing Arts: The Anatomy of Their Economic Problems",
        outlet: "American Economic Review",
        url: "https://www.jstor.org/stable/1816292",
      },
      {
        authors: "Robert J. Flanagan",
        year: "2012",
        title: "The Perilous Life of Symphony Orchestras",
        outlet: "Yale University Press",
        url: "https://yalebooks.yale.edu/book/9780300171938/the-perilous-life-of-symphony-orchestras/",
      },
    ],
  },
  {
    scenario: "health",
    rules: () => ({}),
    intuition:
      "A nurse can't check on twice as many patients because the pill factory doubled its output, and few people accept a cheaper substitute for care when they are ill.",
    evidence:
      "Across OECD countries, Hartwig found that health spending grows faster where wages outrun productivity, the signature of the Baumol effect, though a 2020 replication by Atanda and Reed argues he tested the wrong hypothesis. Bates and Santerre find the same pattern across the 50 U.S. states from 1980 to 2009. A 2025 panel of 23 OECD countries finds the effect in both acute and long-term care, and stronger in long-term care, the most hands-on part of the system. (The model's runaway share is a toy's exaggeration: in the United States health care is roughly a sixth of the economy.)",
    sources: [
      {
        authors: "Jochen Hartwig",
        year: "2008",
        title: "What drives health care expenditure? Baumol's model of 'unbalanced growth' revisited",
        outlet: "Journal of Health Economics",
        url: "https://ideas.repec.org/a/eee/jhecon/v27y2008i3p603-623.html",
      },
      {
        authors: "Laurie J. Bates and Rexford E. Santerre",
        year: "2013",
        title: "Does the U.S. health care sector suffer from Baumol's cost disease? Evidence from the 50 states",
        outlet: "Journal of Health Economics",
        url: "https://ideas.repec.org/a/eee/jhecon/v32y2013i2p386-391.html",
      },
      {
        authors: "Akinwande Atanda and W. Robert Reed",
        year: "2020",
        title: "Not Evidence for Baumol's Cost Disease: A replication study of Hartwig (2008)",
        outlet: "International Journal for Re-Views in Empirical Economics",
        url: "https://doaj.org/article/8c4932fba9664bdab57eb2de551bdab9",
      },
      {
        authors: "Kaan Celebi, Jochen Hartwig and Anna Pauliina Sandqvist",
        year: "2025",
        title: "Baumol's cost disease in acute versus long-term care: Do the differences loom large?",
        outlet: "International Journal of Health Economics and Management",
        url: "https://link.springer.com/article/10.1007/s10754-025-09392-9",
      },
    ],
  },
  {
    scenario: "lessons",
    // Classes creep up in size as costs bite.
    rules: (t) => ({ caseload: 1 + phaseIn(t, 0.5) }),
    intuition:
      "A seminar of twelve needs one teacher for an hour. The bakery down the road needs a sliver of a worker per loaf, and a smaller sliver every year.",
    evidence:
      "Archibald and Feldman compare explanations for rising college costs and find that the cost-disease account fits the data better than the idea that colleges simply spend whatever they can raise. Helland and Tabarrok make the broader case that education and health prices rose because those sectors' wages rose with everyone else's, not mainly because of administrative bloat. Others dispute how much of the rise that explains, which is why the model also lets class sizes creep up and tracks what that does to quality.",
    sources: [
      {
        authors: "Robert B. Archibald and David H. Feldman",
        year: "2008",
        title: "Explaining Increases in Higher Education Costs",
        outlet: "The Journal of Higher Education (working-paper version)",
        url: "https://economics.wm.edu/wp/cwm_wp42.pdf",
      },
      {
        authors: "Eric Helland and Alexander Tabarrok",
        year: "2019",
        title: "Why Are the Prices So Damn High?",
        outlet: "Mercatus Center",
        url: "https://papers.ssrn.com/abstract=3392666",
      },
    ],
  },
  {
    scenario: "childcare",
    // Ratio rules fix the product; gains lean slightly to the top.
    rules: () => ({ qualityStandard: true, concentration: 0.3 }),
    intuition:
      "Rules set how many toddlers one adult may watch. That ratio is the product, so the usual escape of bigger groups is closed.",
    evidence:
      "Hotz and Xiao study U.S. state child-care regulations, staff-to-child ratios among them. Stricter rules raise the quality of care but reduce the number of centers, and the drop is largest in lower-income markets. With the ratio fixed by law, the cost disease lands hardest on the families who can least afford it.",
    sources: [
      {
        authors: "V. Joseph Hotz and Mo Xiao",
        year: "2011",
        title: "The Impact of Regulations on the Supply and Quality of Care in Child Care Markets",
        outlet: "American Economic Review (NBER working-paper version)",
        url: "https://www.nber.org/papers/w11873",
      },
    ],
  },
  {
    scenario: "restaurants",
    // Stagnant for twenty years, then ordering screens and better kitchens arrive.
    rules: (t) => ({ serviceGrowth: t < RUN_YEARS / 2 ? 0 : 0.03 }),
    intuition:
      "Cooking and serving a meal to order looks permanently stuck, until ordering screens, delivery apps and better kitchen equipment show up.",
    evidence:
      "The Bureau of Labor Statistics finds that restaurant output from 1990 to 2019 grew mostly by adding hours, with little productivity growth, and that measured productivity then accelerated sharply after 2019. A stagnant sector can change regimes. In the model, service productivity starts growing at year twenty, and from then on the price climbs about half as fast.",
    sources: [
      {
        authors: "U.S. Bureau of Labor Statistics",
        year: "2025",
        title: "Industry growth patterns: output, productivity, and hours worked from 1990 to 2024",
        outlet: "Monthly Labor Review",
        url: "https://www.bls.gov/opub/mlr/2025/article/industry-growth-patterns-a-closer-look-at-output-productivity-and-hours-worked-from-1990-to-2024.htm",
      },
    ],
  },
  {
    scenario: "trades",
    rules: () => ({}),
    intuition:
      "The faucet comes from a factory that keeps getting better. Fitting it still takes a plumber, a van and an afternoon, and there is no app for a leak behind the wall.",
    evidence:
      "Goolsbee and Syverson find that U.S. construction productivity has been flat or falling for decades while manufacturing kept improving. Building and repairing things on site is a textbook stagnant activity, and because households can't do without it, the model's repair trades end up employing a large share of the town.",
    sources: [
      {
        authors: "Austan Goolsbee and Chad Syverson",
        year: "2023",
        title: "The Strange and Awful Path of Productivity in the U.S. Construction Sector",
        outlet: "NBER Working Paper 30845",
        url: "https://www.nber.org/papers/w30845",
      },
    ],
  },
  {
    scenario: "law",
    // AI drafting tools take a growing share of the work.
    rules: (t) => ({ automation: phaseIn(t, 0.45) }),
    intuition:
      "A will, a lease, a contract: the form is nearly free now. Advice about your particular situation still takes a lawyer's time.",
    evidence:
      "In “Law's Cost Disease,” Abramowicz gathers cost, caseload and trial-rate statistics suggesting that legal services have stagnated and grown dearer, and argues that AI could be the productivity shock the sector has never had. In the model, drafting tools take over a growing share of the work: the price climbs more slowly, and part of what clients buy is no longer a person's judgment.",
    sources: [
      {
        authors: "Michael Abramowicz",
        year: "2026",
        title: "Law's Cost Disease",
        outlet: "Florida State University Law Review, vol. 52",
        url: "https://www.fsulawreview.com/wp-content/uploads/2026/01/1_Abramowicz_PDF-READY.pdf",
      },
    ],
  },
  {
    scenario: "review",
    rules: () => ({}),
    intuition:
      "If software writes more code every year, someone still has to decide whether it is correct, safe and what was actually wanted.",
    evidence:
      "Aghion, Jones and Jones model AI as the latest stage of automation and draw on Baumol to argue that growth may be “constrained not by what we are good at but rather by what is essential and yet hard to improve.” Careful human review is a candidate: the more code machines write, the more each hour of trustworthy checking is worth. This one is partly about bottlenecks and induced demand, so treat it as an extension of the idea rather than the classic case.",
    sources: [
      {
        authors: "Philippe Aghion, Benjamin F. Jones and Charles I. Jones",
        year: "2017",
        title: "Artificial Intelligence and Economic Growth",
        outlet: "NBER Working Paper 23928",
        url: "https://www.nber.org/papers/w23928",
      },
    ],
  },
];

const SAMPLE_YEARS = 0.5;

/**
 * A case as a course: its scenario's defaults, the shared pace, then the case's own twist at
 * year `t`. The casebook test checks every twist stays inside the schema's ranges.
 */
export function courseOf(c: Case): Course {
  const base = makeParams({ ...paramsFor(c.scenario), goodsGrowth: CASE_GROWTH });
  return { years: RUN_YEARS, rules: (t): Params => ({ ...base, ...c.rules(t) }) };
}

export interface CaseRun {
  start: Snapshot;
  end: Snapshot;
  samples: RunSample[];
}

/** Forty years of a case, run off-screen and sampled for the charts. */
export function runCase(c: Case): CaseRun {
  const sim = new TownSim(courseOf(c), calibrationOf(SCENARIOS[c.scenario]));
  const start = sim.snap;
  const samples = [{ t: 0, snap: start }];
  while (!sim.done) {
    sim.advance(SAMPLE_YEARS);
    samples.push({ t: sim.year, snap: sim.snap });
  }
  return { start, end: sim.snap, samples };
}

/** The lab runs fixed settings, so a case opens there with its settings in the final year. */
export function recipeOf(c: Case): Recipe {
  return { scenario: c.scenario, params: makeParams(courseOf(c).rules(RUN_YEARS)) };
}
