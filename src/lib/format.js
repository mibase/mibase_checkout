// "2026-12-20" -> "20/12/26" (narrow table columns).
export function formatShortDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

// "2026-12-20" -> "Sun 20 Dec 2026" (local, no timezone shift).
export function formatDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
