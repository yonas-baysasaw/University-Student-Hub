/** Maps backend schoolYear (1–7) to a short label for public display. */
export function schoolYearToAcademicLevel(y) {
  if (typeof y !== 'number' || !Number.isFinite(y)) return null;
  const yi = Math.round(y);
  if (yi === 7) return 'Graduate';
  if (yi >= 1 && yi <= 6) return `Year ${yi}`;
  return null;
}
