import type { GuestDto } from '../../shared/schemas';
import { bs } from '../i18n/bs';

/**
 * Name to show for a guest. Placeholder members ("Ljubo +1") are never shown by
 * their placeholder text: the name the guest typed in, or a label ("Pratnja").
 */
export function guestDisplayName(
  guest: Pick<GuestDto, 'name' | 'role' | 'isPlaceholder' | 'nameFromGuest'>,
): string {
  if (!guest.isPlaceholder) return guest.name;
  return guest.nameFromGuest || bs.placeholderLabels[guest.role];
}
