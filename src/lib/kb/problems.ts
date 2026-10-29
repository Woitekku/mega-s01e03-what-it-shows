// The problems a big ticket's reports show, counted the desk's way: every report under the cause its
// tenant files it under (causes.ts). The desk's one-day moves (desk-notes.json) are a problem of their
// own, because a day-month swap cannot move a date by one day; they stay counted where they are filed.
import { groupByCause, type CauseGroup, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = CauseGroup['cause'] | 'one-day';

export type ProblemRow = {
  problem: Problem;
  reports: Report[];
  // For one-day moves: the causes they are filed and counted under.
  filedUnder: CauseGroup['cause'][];
  tenants: string[];
  // channel → count, and what intake tagged them as: tag → count.
  channels: Record<string, number>;
  taggedAs: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
};

const tally = (rs: Report[], key: (r: Report) => string) =>
  rs.reduce<Record<string, number>>((n, r) => ({ ...n, [key(r)]: (n[key(r)] ?? 0) + 1 }), {});

function row(problem: Problem, rs: Report[], filedUnder: CauseGroup['cause'][]): ProblemRow {
  const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
  return {
    problem,
    reports: rs,
    filedUnder,
    tenants: [...new Set(rs.map((r) => r.tenant))].sort(),
    channels: tally(rs, (r) => r.channel),
    taggedAs: tally(rs, (r) => r.meta.intakeTag),
    firstSeen: days[0],
    lastSeen: days[days.length - 1],
  };
}

export function problemsOf(
  reports: Report[],
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): ProblemRow[] {
  const groups = groupByCause(reports, tenantOf);
  const rows = groups.map((g) => row(g.cause, g.reports, []));
  const moved = reports.filter((r) => oneDayMove.includes(r.id));
  if (moved.length) {
    rows.push(row('one-day', moved, groups.filter((g) => g.reports.some((r) => oneDayMove.includes(r.id))).map((g) => g.cause)));
  }
  return rows;
}

// Subject lines as triage compares them (decision 0001): lowercased, punctuation stripped.
const subjectKey = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();

// How many subject lines turn up under more than one problem: what subject-only dedupe cannot tell apart.
// A one-day move counts under its own problem here, not under the cause it is filed under.
export function sharedSubjects(rows: ProblemRow[]): { subjects: number; shared: number } {
  const moved = new Set(rows.filter((r) => r.problem === 'one-day').flatMap((r) => r.reports.map((x) => x.id)));
  const problemsBySubject = new Map<string, Set<Problem>>();
  for (const row of rows) {
    for (const r of row.reports) {
      if (row.problem !== 'one-day' && moved.has(r.id)) continue;
      const k = subjectKey(r.subject);
      problemsBySubject.set(k, (problemsBySubject.get(k) ?? new Set()).add(row.problem));
    }
  }
  const sets = [...problemsBySubject.values()];
  return { subjects: sets.length, shared: sets.filter((s) => s.size > 1).length };
}
