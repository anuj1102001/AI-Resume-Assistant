/**
 * Rule-based clarity feedback for a resume bullet. Deterministic and instant: the editor shows it as you type, and
 * labels it as rules rather than AI.
 */
export type LintNote = { id: string; kind: "clarity" | "impact" | "style"; text: string };

const WEAK_OPENERS = /^(responsible for|worked on|helped( to)?|assisted( with| in)?|involved in|participated in|tasked with|duties included|in charge of)\b/i;
// "I" anywhere; me/my/we/our at any case; "us" only lowercase, so "US" (the country) isn\'t flagged.
const FIRST_PERSON = /\bI\b|\b(?:[Mm]e|[Mm]y|[Ww]e|[Oo]ur|us)\b/;
const PASSIVE = /\b(was|were|been|being|is|are)\s+(\w+ed|\w*(?:built|made|done|led|run|written|given|taken|shown|grown|cut))\b/i;
const HAS_NUMBER = /\d|\[[^\]]*\]/;

export function lintBullet(text: string): LintNote[] {
  const t = text.trim();
  const notes: LintNote[] = [];
  if (!t) return notes;
  const words = t.split(/\s+/).length;
  if (words > 30) notes.push({ id: "length", kind: "clarity", text: `${words} words. Recruiters skim; aim for under 30.` });
  if (WEAK_OPENERS.test(t)) notes.push({ id: "opener", kind: "impact", text: "Opens with a duty, not what you did. Start with an action verb." });
  if (FIRST_PERSON.test(t)) notes.push({ id: "pronoun", kind: "style", text: "Uses first person. Resume bullets usually leave it out." });
  if (PASSIVE.test(t)) notes.push({ id: "passive", kind: "clarity", text: "Passive voice hides who did it. Say what you did." });
  if (!HAS_NUMBER.test(t)) notes.push({ id: "number", kind: "impact", text: "No number. If you know one (people, time, %, money, scale), it makes the result concrete." });
  if (/ {2,}| [,.;:]/.test(t)) notes.push({ id: "spacing", kind: "style", text: "Extra spaces around words or punctuation." });
  return notes;
}

/** Notes that depend on the other bullets: the same opening word used again and again. */
export function lintDocument(bullets: { id: string; text: string }[]): Record<string, LintNote[]> {
  const first = (s: string) => s.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  const counts = new Map<string, number>();
  for (const b of bullets) counts.set(first(b.text), (counts.get(first(b.text)) ?? 0) + 1);
  const out: Record<string, LintNote[]> = {};
  for (const b of bullets) {
    const notes = lintBullet(b.text);
    const w = first(b.text);
    const n = counts.get(w) ?? 0;
    if (w && n >= 3) notes.push({ id: "repeat", kind: "style", text: `${n} bullets open with “${b.text.trim().split(/\s+/)[0]}”. Vary the verbs.` });
    out[b.id] = notes;
  }
  return out;
}
