/** Routes timed practice only; it neither grants nor overwrites independent mastery. */
export function chooseFlowOutcome(report, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return 'manual';
  const { polish = false, demo = false } = options;
  if (typeof polish !== 'boolean' || demo || !report || typeof report !== 'object' || Array.isArray(report) || report.demo ||
      report.metric !== 'timed-notes-v1' || report.finished !== true ||
      !Number.isSafeInteger(report.total) || report.total <= 0 || !Number.isSafeInteger(report.firstAttemptCorrect) ||
      report.firstAttemptCorrect < 0 || report.firstAttemptCorrect > report.total ||
      report.earlyAbort !== undefined && typeof report.earlyAbort !== 'boolean') return 'manual';
  const percent = Number(BigInt(report.firstAttemptCorrect) * 100n / BigInt(report.total));
  if (report.scorePercent !== undefined && report.scorePercent !== percent) return 'manual';
  if (report.earlyAbort || percent < 60) return 'retry';
  if (report.firstAttemptCorrect === report.total) return 'complete';
  return polish ? 'retry' : 'offer-polish';
}
