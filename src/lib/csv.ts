import type { RSVP } from '@/types/database';
export function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@\t\r\n]/.test(text.trimStart()) || /^[\t\r\n]/.test(text))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export const csvHeader =
  '\uFEFF' +
  ['Nombre', 'Correo', 'Asistencia', 'Personas', 'Nota', 'Fecha UTC']
    .map(csvCell)
    .join(',') +
  '\r\n';
export function rsvpCsvRow(row: RSVP) {
  return (
    [
      row.guest_name,
      row.guest_email || '',
      row.attendance ? 'Sí' : 'No',
      row.attendance ? row.party_size : 0,
      row.note,
      row.created_at,
    ]
      .map(csvCell)
      .join(',') + '\r\n'
  );
}
