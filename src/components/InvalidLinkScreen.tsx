import { bs } from '../i18n/bs';
import common from './common.module.css';
import { Monogram } from './decor/Decor';
import { Screen } from './Screen';

export function InvalidLinkScreen() {
  return (
    <Screen title={bs.invalid.title}>
      <Monogram size={84} />
      <p className={common.text}>{bs.invalid.body}</p>
      <p className={`${common.text} ${common.italic}`}>{bs.invalid.contact}</p>
    </Screen>
  );
}
