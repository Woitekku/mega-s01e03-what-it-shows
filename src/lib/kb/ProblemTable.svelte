<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import { uniqueById, type Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';
  import { problemsOf, sharedSubjects, type Problem } from '#lib/kb/problems';

  // tickets: where each problem is filed now, problem → ticket URL.
  let { ticket, tickets = {} }: { ticket: number; tickets?: Partial<Record<Problem, string>> } = $props();

  const rows = $derived((reports as Report[]).filter((r) => r.mergedInto === ticket));
  const merged = $derived(uniqueById(rows));
  const problems = $derived(problemsOf(merged, tenantOf, notes.oneDayMove));
  const subjects = $derived(sharedSubjects(problems));
  const tally = (n: Record<string, number>) =>
    Object.entries(n)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ×${v}`)
      .join(' · ');
  const issue = (url: string) => `#${url.split('/').pop()}`;
</script>

<p class="sum">
  <strong>{merged.length}</strong> reports merged into #{ticket} ·
  <strong>{problems.length}</strong>
  {problems.length === 1 ? 'problem' : 'problems'}
</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>tenants</th><th>channels</th><th>tagged as</th><th>seen</th><th>ticket</th></tr>
  </thead>
  <tbody>
    {#each problems as p (p.problem)}
      {@const url = tickets[p.problem]}
      <tr>
        <td><code>{p.problem}</code></td>
        <td>{p.reports.length}</td>
        <td>{p.tenants.length}</td>
        <td class="tags">{tally(p.channels)}</td>
        <td class="tags">{tally(p.taggedAs)}</td>
        <td>{p.firstSeen} → {p.lastSeen}</td>
        <td>{#if url}<a href={url}>{issue(url)}</a>{:else}<span class="none">no ticket yet</span>{/if}</td>
      </tr>
    {/each}
  </tbody>
</table>

{#each problems.filter((p) => p.filedUnder.length) as p (p.problem)}
  <p class="note">
    The {p.reports.length} <code>{p.problem}</code> reports are filed under
    {#each p.filedUnder as cause, i (cause)}{i ? ', ' : ''}<code>{cause}</code>{/each} by tenant and counted there too.
  </p>
{/each}
<p class="note">
  The export holds {rows.length} rows for these {merged.length} reports: its pages overlap, so each report counts once.
  {subjects.shared} of {subjects.subjects} subject lines turn up under more than one problem.
</p>

<style>
  .sum { font-size: 1.1rem; }
  .tags { color: var(--muted); font-size: 0.85em; }
  .note { color: var(--muted); font-size: 0.85em; }
  .none { color: var(--warn); font-weight: 600; }
</style>
