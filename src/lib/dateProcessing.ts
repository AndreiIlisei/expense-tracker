// --- helpers (put near top of file) ---

/** dd, mm, yyyy validators (no timezone assumptions here) */
function isValidYMD(y: number, m: number, d: number) {
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  const mdays = [
    31,
    (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return d >= 1 && d <= mdays[m - 1];
}

/** Expand 2-digit year with pivot (e.g., 00–49 -> 2000–2049; 50–99 -> 1950–1999) */
function expandYY(yy: number, pivot = 50) {
  return yy + (yy <= pivot ? 2000 : 1900);
}

/** Try to parse many common formats from a string; return a JS Date or null */
export function parseDateFlexible(s?: string | null): Date | null {
  if (!s) return null;
  const str = s.trim();

  // 1) ISO-like: yyyy-mm-dd / yyyy.mm.dd / yyyy/mm/dd
  let m = str.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (m) {
    const y = +m[1],
      mo = +m[2],
      d = +m[3];
    if (isValidYMD(y, mo, d)) return new Date(Date.UTC(y, mo - 1, d));
  }

  // 2) European: dd-mm-yyyy / dd.mm.yyyy / dd/mm/yyyy
  m = str.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (m) {
    const d = +m[1],
      mo = +m[2],
      y = +m[3];
    if (isValidYMD(y, mo, d)) return new Date(Date.UTC(y, mo - 1, d));
  }

  // 3) European with 2-digit year: dd-mm-yy / dd.mm.yy / dd/mm/yy
  m = str.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2})\b/);
  if (m) {
    const d = +m[1],
      mo = +m[2],
      y = expandYY(+m[3]);
    if (isValidYMD(y, mo, d)) return new Date(Date.UTC(y, mo - 1, d));
  }

  // 4) Compact ISO: yyyymmdd (seen on some receipts)
  m = str.match(/\b(20\d{2}|19\d{2})(\d{2})(\d{2})\b/);
  if (m) {
    const y = +m[1],
      mo = +m[2],
      d = +m[3];
    if (isValidYMD(y, mo, d)) return new Date(Date.UTC(y, mo - 1, d));
  }

  // 5) Danish month names (kort/lang) e.g., 10 sep 2025 / 10. sep 25
  // jan, feb, mar, apr, maj, jun, jul, aug, sep, okt, nov, dec
  m = str.match(
    /\b(\d{1,2})[.\s/-]*(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)[a-z]*[.\s/-]*(\d{2,4})\b/i
  );
  if (m) {
    const d = +m[1];
    const mon =
      [
        'jan',
        'feb',
        'mar',
        'apr',
        'maj',
        'jun',
        'jul',
        'aug',
        'sep',
        'okt',
        'nov',
        'dec',
      ].indexOf(m[2].toLowerCase()) + 1;
    let y = +m[3];
    if (y < 100) y = expandYY(y);
    if (isValidYMD(y, mon, d)) return new Date(Date.UTC(y, mon - 1, d));
  }

  // Fallback: let JS try; if invalid, return null
  const js = new Date(str);
  if (!isNaN(js.getTime())) {
    // normalize to UTC date (strip time)
    return new Date(
      Date.UTC(js.getUTCFullYear(), js.getUTCMonth(), js.getUTCDate())
    );
  }
  return null;
}
