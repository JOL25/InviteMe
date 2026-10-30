'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { guestDetailsSchema } from '@/lib/invite-rules';
import { createInvitee, updateInvitee, manageInvitee } from '@/lib/invitees';
export type InviteState = { error?: string; success?: string };
function refresh(id: string) {
  revalidatePath(`/dashboard/events/${id}/invitees`);
  revalidatePath(`/dashboard/events/${id}/guests`);
}
export async function saveInvitee(
  _state: InviteState,
  form: FormData,
): Promise<InviteState> {
  const { user } = await requireUser();
  const eventId = String(form.get('eventId') ?? ''),
    id = String(form.get('guestId') ?? '');
  if (
    !z.uuid().safeParse(eventId).success ||
    (id && !z.uuid().safeParse(id).success)
  )
    return { error: 'Invitación no válida.' };
  const input = guestDetailsSchema.safeParse({
    name: form.get('name'),
    email: String(form.get('email') ?? ''),
    max_party_size: form.get('max_party_size'),
  });
  if (!input.success) return { error: input.error.issues[0].message };
  try {
    const ok = id
      ? await updateInvitee(eventId, user.id, id, input.data)
      : await createInvitee(eventId, user.id, input.data);
    if (!ok)
      return {
        error: 'Invitado no disponible o con una respuesta ya registrada.',
      };
  } catch {
    return { error: 'No pudimos guardar al invitado. Inténtalo de nuevo.' };
  }
  refresh(eventId);
  return {
    success: id
      ? 'Datos del invitado guardados.'
      : 'Invitado añadido a la lista.',
  };
}
export async function changeInviteeLink(
  _state: InviteState,
  form: FormData,
): Promise<InviteState> {
  const { user } = await requireUser();
  const eventId = String(form.get('eventId') ?? ''),
    id = String(form.get('guestId') ?? '');
  const intent = z
    .enum(['renew', 'revoke', 'delete'])
    .safeParse(form.get('intent'));
  if (
    !z.uuid().safeParse(eventId).success ||
    !z.uuid().safeParse(id).success ||
    !intent.success
  )
    return { error: 'Acción no válida.' };
  try {
    if (!(await manageInvitee(eventId, user.id, id, intent.data)))
      return {
        error:
          'No se pudo actualizar. Las invitaciones con respuesta se conservan.',
      };
  } catch {
    return { error: 'No pudimos actualizar el enlace.' };
  }
  refresh(eventId);
  return {
    success:
      intent.data === 'delete'
        ? 'Invitado eliminado.'
        : intent.data === 'renew'
          ? 'Enlace renovado. El anterior dejó de funcionar.'
          : 'Enlace desactivado. La respuesta y el registro se conservan.',
  };
}
