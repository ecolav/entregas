export function formatDateISOToBR(isoDate: string | Date): string {
  const d = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTimeISOToBR(isoDateTime: string | Date): string {
  const d = typeof isoDateTime === 'string' ? new Date(isoDateTime) : isoDateTime;
  if (isNaN(d.getTime())) return '';
  const date = formatDateISOToBR(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${date} ${hh}:${mi}`;
}


