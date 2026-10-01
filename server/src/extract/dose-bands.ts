import { DOSE_BANDS, type Active, type DoseAssessment, type DoseClass, type DoseStudy, type Regimen } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** One active's dose against the study's, classed by code so the class cannot drift between runs; pure. */
export class DoseBands {
  static classOf(ratio: number): Exclude<DoseClass, "unassessable"> {
    Trace.line(import.meta.url, "DoseBands.classOf", { ratio });
    if (ratio >= DOSE_BANDS.at_dose) return "at_dose";
    if (ratio >= DOSE_BANDS.partial) return "partial";
    return "under_dose";
  }

  /** Our daily dose is the label's amount per serving times servings per day; anything missing on either side makes the active unassessable, with the reason. */
  static assess(active: Active, regimen: Regimen | null, study: DoseStudy | undefined): DoseAssessment {
    Trace.line(import.meta.url, "DoseBands.assess", { active: active.name, studied: study?.studied_daily_dose ?? null });
    const perDay = regimen?.servings_per_day ?? null;
    const ours = active.amount !== null && perDay !== null ? DoseBands.round(active.amount * perDay) : null;
    const studied = study?.human_study ? study.studied_daily_dose : null;
    const base = {
      active: active.name,
      our_daily_dose: ours,
      studied_daily_dose: studied,
      unit: active.unit,
      studied_form: study?.studied_form ?? "",
      form_match: study?.form_match ?? "",
      study: study?.study ?? "",
      source_id: study?.source_id ?? "",
    };
    const why = DoseBands.unassessable(active, perDay, study);
    if (why || ours === null || studied === null) return { ...base, ratio: null, class: "unassessable", why: why || "no dose to compare" };
    const ratio = DoseBands.round(ours / studied);
    return { ...base, ratio, class: DoseBands.classOf(ratio), why: `${ours} ${active.unit} a day against ${studied} ${active.unit} studied` };
  }

  private static unassessable(active: Active, perDay: number | null, study: DoseStudy | undefined): string {
    Trace.line(import.meta.url, "DoseBands.unassessable", { active: active.name });
    if (active.in_blend) return "in a proprietary blend: the amount of this active is not disclosed";
    if (active.amount === null) return "the label states no amount for this active";
    if (!study) return "no study was recorded for this active";
    if (!study.human_study) return "no human study of this active was found";
    if (study.studied_daily_dose === null) return "the study states no daily dose";
    if (perDay === null) return "servings per day are not known, so the daily dose is not";
    return "";
  }

  private static round(value: number): number {
    Trace.tick(import.meta.url, "DoseBands.round");
    return Math.round(value * 1000) / 1000;
  }
}
