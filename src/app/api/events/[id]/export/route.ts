import { z } from 'zod';
import { hasSupabase } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { csvHeader, rsvpCsvRow } from '@/lib/csv';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!hasSupabase())
    return Response.json({ error: 'Servicio no disponible.' }, { status: 503 });
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: 'Evento no disponible.' }, { status: 404 });
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    return Response.json({ error: 'Inicia sesión.' }, { status: 401 });
  const { data: event, error } = await supabase
    .from('events')
    .select('id,slug')
    .eq('id', id)
    .eq('owner_id', auth.user.id)
    .maybeSingle();
  if (error)
    return Response.json(
      { error: 'No pudimos preparar la exportación.' },
      { status: 503 },
    );
  if (!event)
    return Response.json({ error: 'Evento no disponible.' }, { status: 404 });
  const cutoff = new Date().toISOString();
  const encoder = new TextEncoder();
  let page = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        if (page === 0) controller.enqueue(encoder.encode(csvHeader));
        const { data, error: readError } = await supabase
          .from('rsvps')
          .select('*')
          .eq('event_id', id)
          .lte('created_at', cutoff)
          .order('created_at')
          .order('id')
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (readError) {
          controller.error(
            new Error('Exportación interrumpida. Vuelve a intentarlo.'),
          );
          return;
        }
        controller.enqueue(
          encoder.encode((data ?? []).map(rsvpCsvRow).join('')),
        );
        page += 1;
        if (!data || data.length < 1000) controller.close();
      } catch {
        controller.error(new Error('Exportación interrumpida.'));
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}-respuestas.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
