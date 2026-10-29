// The problems a big ticket's reports show. The cause by tenant comes from causes.ts; the desk's one-day
// moves (desk-notes.json) are a problem of their own, because a day-month swap cannot move a date by one day.
import { causeOf, type Cause, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = Cause | 'one-day' | 'unplaced';

export function problemOf(r: Report, t: Tenant | undefined, oneDayMove: readonly string[]): Problem {
  return oneDayMove.includes(r.id) ? 'one-day' : (causeOf(r, t) ?? 'unplaced');
}

export type ProblemGroup = {
  problem: Problem;
  reports: Report[];
  tenants: string[];
  // channel → count, and what intake tagged them as: tag → count.
  channels: Record<string, number>;
  taggedAs: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
};

const tally = (rs: Report[], key: (r: Report) => string) =>
  rs.reduce<Record<string, number>>((n, r) => ({ ...n, [key(r)]: (n[key(r)] ?? 0) + 1 }), {});

export function groupByProblem(
  reports: Report[],
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): ProblemGroup[] {
  const byProblem = new Map<Problem, Report[]>();
  for (const r of reports) {
    const p = problemOf(r, tenantOf(r), oneDayMove);
    byProblem.set(p, [...(byProblem.get(p) ?? []), r]);
  }
  return [...byProblem.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs,
        tenants: [...new Set(rs.map((r) => r.tenant))].sort(),
        channels: tally(rs, (r) => r.channel),
        taggedAs: tally(rs, (r) => r.meta.intakeTag),
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
}

// Subject lines as triage compares them (decision 0001): lowercased, punctuation stripped.
const subjectKey = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();

// How many subject lines turn up under more than one problem: what subject-only dedupe cannot tell apart.
export function sharedSubjects(groups: ProblemGroup[]): { subjects: number; shared: number } {
  const problemsBySubject = new Map<string, Set<Problem>>();
  for (const g of groups) {
    for (const r of g.reports) {
      const k = subjectKey(r.subject);
      problemsBySubject.set(k, (problemsBySubject.get(k) ?? new Set()).add(g.problem));
    }
  }
  const sets = [...problemsBySubject.values()];
  return { subjects: sets.length, shared: sets.filter((s) => s.size > 1).length };
}
