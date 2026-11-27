/** Navigation after a real native lesson; a route never grants mastery. */
export function chooseNativeRoute(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return 'manual';
  const { native = false, demo = false, breakdown = false, kind = 'course', mode = 'learn',
    report, next = false, whole = false, simple = false } = options;
  if (native !== true || demo || breakdown || !['course', 'composition'].includes(kind) || !['learn', 'check'].includes(mode) ||
      !report || typeof report !== 'object' || Array.isArray(report) || report.demo === true || report.breakdown === true ||
      report.finished !== true || report.metric !== 'first-attempt-v1' ||
      !Number.isSafeInteger(report.total) || report.total <= 0 || !Number.isSafeInteger(report.firstAttemptCorrect) ||
      report.firstAttemptCorrect < 0 || report.firstAttemptCorrect > report.total) return 'manual';
  // Accuracy includes later corrections; passed/rounded score may be stale.
  // Only the canonical per-target first attempt counts determine this gate.
  if (report.firstAttemptCorrect * 10 < report.total * 8) return simple ? 'retry' : 'review';
  if (kind === 'course') return mode === 'learn' ? 'course-check' : next ? 'course-next' : 'finish';
  if (whole) return 'finish';
  return next ? 'study-next' : 'review';
}
