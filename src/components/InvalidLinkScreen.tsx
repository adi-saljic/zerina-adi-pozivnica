import { bs } from '../i18n/bs';
import { Screen } from './Screen';

export function InvalidLinkScreen() {
  return (
    <Screen title={bs.invalid.title}>
      <p>{bs.invalid.body}</p>
      <p>{bs.invalid.contact}</p>
    </Screen>
  );
}
