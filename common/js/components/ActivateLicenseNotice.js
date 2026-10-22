/* eslint-disable no-undef */
// NekoUI
import { NekoMessage } from '@neko-ui';

// From Main Plugin
import { isPro, isRegistered } from '@app/settings';

// Plugins used to gate their free-version box on !isRegistered alone, so a customer who
// installed Pro but had not activated it yet was told the box is "only displayed in the
// free version" and offered to buy what they already own. Render this where that box
// is, and gate the upsell on !isPro instead:
//   {!isPro && <FreeVersionBox />}
//   <ActivateLicenseNotice settingsUrl={...} />
const ActivateLicenseNotice = ({ settingsUrl = null, style = null }) => {
  if (!isPro || isRegistered) {
    return null;
  }
  const where = settingsUrl ? <a href={settingsUrl}>Settings → License</a> : <b>Settings → License</b>;
  return (
    <NekoMessage variant="warning" style={style}>
      You have the Pro version, it just needs to be activated. Enter your license key in {where} to unlock the Pro features. You will find it in your account at <a target='_blank' rel="noreferrer" href='https://meowapps.com'>Meow Apps</a>.
    </NekoMessage>
  );
};

export { ActivateLicenseNotice };
