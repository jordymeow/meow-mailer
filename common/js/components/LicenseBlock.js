/* eslint-disable no-undef */
// React & Vendor Libs
const { useState, useEffect, Fragment } = wp.element;
const { __ } = wp.i18n;

// NekoUI
import { NekoButton, NekoTypo, NekoBlock, NekoInput,
  NekoMessage, NekoModal, NekoIcon, NekoLogo } from '@neko-ui';
import { nekoFetch, getProUrl } from '@neko-ui';

// From Main Plugin
import { restUrl, prefix, domain, isPro, isRegistered, restNonce } from '@app/settings';

// Integrity checker
import { checkIntegrity } from '@common/integrity-checker';
import { NekoNoticeModal, useNekoNotice } from './NoticeModal';

const CommonApiUrl = `${restUrl}/meow-licenser/${prefix}/v1`;

const AccountLink = () => <a target='_blank' rel="noreferrer" href='https://meowapps.com'>Meow Apps</a>;
const ContactLink = () => <a target='_blank' rel="noreferrer" href='https://meowapps.com/contact/'>contact us</a>;

// The licenser already knows why a validation failed and stores it in license.issue
// (premium/licenser.php). Everything outside a short list used to land in a generic
// "unknown error" that blamed the serial key and the user's security plugins, so a
// server that simply cannot reach check.meowapps.com read as a broken licence and
// became a support ticket. These are the codes the store actually sends, kept in
// sync with the badge in admin.php: an invented one would silently never match.
const getIssueMessage = (issue) => {
  switch (issue) {
  case 'no_activations_left':
    return <span>There are no activations left for this license. You can visit your account at <AccountLink />, unregister a site, and click on <i>Retry to validate</i>.</span>;
  case 'expired':
    return <span>Your license has expired. You can get another license or renew the current one by visiting your account at <AccountLink />.</span>;
  case 'missing':
  case 'key_mismatch':
    return <span>This license key was not recognized. Please check it in your account at <AccountLink />, then enter it again.</span>;
  case 'disabled':
    return 'This license has been disabled.';
  case 'item_name_mismatch':
  case 'invalid_item_id':
  case 'missing_item_id':
    return 'This license seems to be for a different plugin... isn\'t it? :)';
  case 'bundle_activation_not_allowed':
    return <span>This license belongs to a bundle and cannot be activated directly. Use the key listed for this plugin in your account at <AccountLink />.</span>;
  case 'site_inactive':
  case 'inactive':
    return <span>This license is fine, but it is not activated for this site yet. Click on <i>Retry to validate</i> to activate it here. If the site was renamed or moved, unregister the old address in your account at <AccountLink /> first.</span>;
  case 'no_response':
    return <span>Your server could not reach our license server (check.meowapps.com). This is usually a firewall or a security plugin on your side. Ask your host to allow outgoing HTTPS to check.meowapps.com and meowapps.com, then click on <i>Retry to validate</i>.</span>;
  case 'invalid_response':
    return <span>Our license server answered, but the answer could not be read. A security plugin or a proxy on your side is probably altering it. Try again in a few minutes, and if it keeps happening, please <ContactLink /> with the details below.</span>;
  default:
    return null;
  }
};

// wp_remote_retrieve_response_code() can come back as a string, and as a print_r()
// dump when the request was a WP_Error, so never compare it to 200 directly.
const isHttpOk = (code) => parseInt(code, 10) === 200;

// licenser.php probes google.com and meowapps.com next to the licence call and runs
// detect_block() on the bodies. That tells apart "blocked on the way" from "nothing
// goes out at all", which are two different fixes for the user.
const getDebugHint = (debug) => {
  if (!debug) {
    return null;
  }
  const reasons = [ debug.license_reason, debug.meowapps_reason, debug.google_reason ].filter(Boolean);
  const cfRay = [ debug.license_cf_ray, debug.meowapps_cf_ray, debug.google_cf_ray ].filter(Boolean)[0];
  if (reasons.includes('CLOUDFLARE_SECURITY_TRIGGER')) {
    return <>A Cloudflare security check stopped the request coming from your server{cfRay ? <> (Ray ID {cfRay})</> : null}. Copy the details below and send them to us, we can see what triggered it.</>;
  }
  if (reasons.includes('GOOGLE_SECURITY_TRIGGER')) {
    return 'Your server was blocked when reaching google.com too, so the filtering is on your side and not specific to us.';
  }
  if (!isHttpOk(debug.google_response_code) && !isHttpOk(debug.meowapps_response_code)) {
    return 'Your server could not reach google.com or meowapps.com either, so its outgoing connections are blocked in general. Your host can confirm that in a minute.';
  }
  if (isHttpOk(debug.google_response_code) && !isHttpOk(debug.meowapps_response_code)) {
    return 'Your server reaches google.com but not meowapps.com, so something on your side is filtering our domains in particular.';
  }
  return null;
};

// An allowlist and not a blacklist, on purpose: tickets travel by plain email, and
// key, check_url and logs each carry the license key or the admin email address. A
// new field added to the option later must be opted in here, never leak by default.
const buildSupportDetails = (license) => {
  const lic = license || {};
  return JSON.stringify({
    plugin: domain,
    issue: lic.issue || null,
    license: lic.license || null,
    expires: lic.expires || null,
    debug: lic.debug || null
  }, null, 2);
};

// The License tab is also where a free user notices Pro, so free says why Pro is worth it: how we
// look after Pro users, not a feature list. No per-plugin lists on purpose: they drift out of
// date (Media Cleaner kept selling a scan switched off a year earlier). NekoUI parts only.
const PRO_REASONS = [
  { icon: 'user', tint: [ '#eaf0fc', '#1e5bd6' ], title: 'We take care of you', text: 'Direct help from the developer. Your sites are in good hands.' },
  { icon: 'sparkles', tint: [ '#f3edfc', '#7a4fc9' ], title: 'Better features', text: 'More powerful tools, shaped by what Pro users ask for.' },
  { icon: 'rocket-launch', tint: [ '#e6f5ec', '#23864f' ], title: 'Always moving forward', text: 'Frequent updates that keep up with WordPress and AI.' }
];

// A slow light sweep on the gold tile and a nudging arrow: just enough life to draw the eye.
const LICENSE_FX = `
@keyframes mwk-shine { 0%, 70% { transform: translateX(-120%) rotate(20deg); } 100% { transform: translateX(220%) rotate(20deg); } }
@keyframes mwk-nudge { 0%, 100% { transform: translateX(0); opacity: .55; } 50% { transform: translateX(5px); opacity: 1; } }
.mwk-shine { position: relative; overflow: hidden; }
.mwk-shine::after { content: ''; position: absolute; top: -20%; left: 0; width: 40%; height: 140%;
  background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.55), rgba(255,255,255,0));
  animation: mwk-shine 4.5s ease-in-out infinite; }
.mwk-nudge { animation: mwk-nudge 2.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .mwk-shine::after, .mwk-nudge { animation: none; } }
`;
// The same tiles as the header: silver while free, gold once Pro is active.
const TIER_TILE = {
  free: 'linear-gradient(145deg, #f1f3f7, #c3c9d4 60%, #9aa3b2)',
  pro: 'linear-gradient(145deg, #ffe7a3, #f5c04a 60%, #d99a1e)'
};
const TierTile = ({ tier, label }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    <div className={tier === 'pro' ? 'mwk-shine' : undefined} style={{ width: 64, height: 64, padding: 13, boxSizing: 'border-box', borderRadius: 16, background: TIER_TILE[tier],
      boxShadow: tier === 'pro'
        ? 'inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 3px 12px rgba(217, 154, 30, 0.28)'
        : 'inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 1px 3px rgba(30, 40, 60, 0.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <NekoLogo />
    </div>
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tier === 'pro' ? '#b07a12' : '#8a93a3' }}>{label}</span>
  </div>
);

// The same opening for every state, so free, "almost there" and active Pro feel like one story.
const LicenseHero = ({ tiers, title, children }) => (
  <div style={{ textAlign: 'center', padding: '22px 12px 8px' }}>
    <style>{LICENSE_FX}</style>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      {tiers.map((t, i) => <Fragment key={t}>
        {i > 0 && <div className="mwk-nudge" style={{ marginBottom: 22 }}>
          <NekoIcon icon="arrow-right" width={22} height={22} color="#9aa3b2" />
        </div>}
        <TierTile tier={t} label={t === 'pro' ? 'PRO' : 'FREE'} />
      </Fragment>)}
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, color: '#1d2327', marginTop: 22 }}>{title}</div>
    {children && <div style={{ fontSize: 14, color: '#50575e', lineHeight: 1.6, maxWidth: 560, margin: '8px auto 0' }}>{children}</div>}
  </div>
);

const formatExpiry = (expires) => {
  if (!expires) {
    return null;
  }
  if (expires === 'lifetime') {
    return 'Lifetime license';
  }
  const date = new Date(String(expires).replace(' ', 'T'));
  return isNaN(date.getTime()) ? null :
    `Renews on ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;
};

const LicenseBlock = () => {
  const [ busy, setBusy ] = useState(false);
  const [ meowMode, setMeowMode ] = useState(false);
  const [ currentModal, setCurrentModal ] = useState(null);
  const [ license, setLicense ] = useState(null);
  const [ serialKey, setSerialKey ] = useState('');
  const [ editMode, setEditMode ] = useState(false);
  const [ integrityFailed, setIntegrityFailed ] = useState(false);
  const [ keyLooksWrong, setKeyLooksWrong ] = useState(false);
  const [ copied, setCopied ] = useState(false);
  const { notice, showNotice, closeNotice } = useNekoNotice();
  // isRegistered is localised by PHP when the page is built, so it is frozen: after a
  // failed re-validation it still claims the site is registered. That made a failure
  // render as "Forced License / force-enabled" and hid the real error until a reload,
  // and a recovery keep saying "Disabled" after it had worked. Trust the licence we
  // just fetched, and fall back to the page-load value only until it arrives.
  const liveRegistered = license ? !license.issue : isRegistered;
  const isOverridenLicense = liveRegistered && (!license || license.license !== 'valid');

  const showLicenseError = (message) => {
    showNotice(message, { title: __( 'License Error', domain ) });
  };

  const copySupportDetails = async () => {
    const details = buildSupportDetails(license);
    try {
      // The admin is not always served over HTTPS, and navigator.clipboard does not
      // exist outside a secure context, which is exactly the kind of install that
      // ends up here. Keep the old execCommand path as a fallback.
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(details);
      }
      else {
        const el = document.createElement('textarea');
        el.value = details;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    catch (err) {
      showLicenseError(__( 'The details could not be copied. They are in your browser console, you can copy them from there.', domain ));
      console.error(err, details);
    }
  };

  const checkLicense = async () => {
    if (!isPro) {
      return;
    }
    setBusy(true);
    try {
      const res = await nekoFetch(`${CommonApiUrl}/get_license`, {
        method: 'POST',
        nonce: restNonce
      });
      setLicense(res.data);
      if (res.data && res.data.key) {
        // Keys are 32 lowercase hex chars, but a genuine one typed in uppercase or set
        // through the wp-config constant with stray spaces used to fail this test and
        // be shown as a tampered copy, telling a paying customer to dispute the charge.
        // Normalise first, and treat a key that still looks wrong as a typo, not piracy.
        const key = String(res.data.key).trim().toLowerCase();
        const hasInvalidFormat = key.length !== (2 << 4) || !/^[0-9a-f]{32}$/.test(key);
        if (hasInvalidFormat && !res.data.issue) {
          setKeyLooksWrong(true);
        }
        setSerialKey(key);
      }
    }
    catch (err) {
      showLicenseError(__( 'Error while checking the license. Check your console for more information.', domain ));
      console.error(err);
    }
    setBusy(false);
  };

  const removeLicense = async () => {
    setBusy(true);
    try {
      const res = await nekoFetch(`${CommonApiUrl}/set_license`, {
        method: 'POST',
        nonce: restNonce,
        json: { serialKey: null }
      });
      if (res.success) {
        setSerialKey('');
        setLicense(null);
        setCurrentModal('licenseRemoved');
      }
    }
    catch (err) {
      showLicenseError(__( 'Error while removing the license. Check your console for more information.', domain ));
      console.error(err);
    }
    setBusy(false);
  };

  const forceLicense = async () => {
    setBusy(true);
    try {
      const res = await nekoFetch(`${CommonApiUrl}/set_license`, {
        method: 'POST',
        nonce: restNonce,
        json: {
          serialKey,
          override: true
        }
      });
      if (res.success) {
        setLicense(res.data);
        if (res.data && !res.data.issue) {
          setCurrentModal('licenseAdded');
        }
      }
    }
    catch (err) {
      showLicenseError(__( 'Error while forcing the license. Check your console for more information.', domain ));
      console.error(err);
    }
    setBusy(false);
  };

  const validateLicense = async () => {
    if ( serialKey === 'MEOW_OVERRIDE' ) {
      setMeowMode(true);

      const isValid = checkIntegrity();

      if (!isValid) {
        setIntegrityFailed(true);
        return;
      }

      setLicense(null);
      setSerialKey("");
      return;
    }
    setBusy(true);
    try {
      const res = await nekoFetch(`${CommonApiUrl}/set_license`, {
        method: 'POST',
        nonce: restNonce,
        json: { serialKey }
      });
      if (res.success) {
        setLicense(res.data);
        if (res.data && !res.data.issue) {
          setEditMode(false);
          setCurrentModal('licenseAdded');
        }
      }
    }
    catch (err) {
      showLicenseError(__( 'Error while validating the license. Check your console for more information.', domain ));
      console.error(err);
    }
    setBusy(false);
  };

  const startModifyLicense = () => {
    setEditMode(true);
    setSerialKey('');
  };

  const cancelModifyLicense = () => {
    setEditMode(false);
    setSerialKey(license && license.key ? license.key : '');
  };

  // Run integrity check on mount
  useEffect(() => {
    if (!isPro) {
      return;
    }

    const isValid = checkIntegrity();

    if (!isValid) {
      setIntegrityFailed(true);
    }
  }, []);

  useEffect(() => { checkLicense(); }, []);

  const licenseTextStatus = isOverridenLicense ? 'Forced License' : liveRegistered ? 'Enabled' : 'Disabled';

  const success = !integrityFailed && !keyLooksWrong && (isOverridenLicense || (license && license.license === 'valid'));
  // A Pro buyer who has never typed a key is not in error: no red box, just the next step.
  const needsKey = !success && !integrityFailed && !keyLooksWrong && (!license || !license.key);
  const expiry = formatExpiry(license && license.expires);
  let message = `Pro is active.${expiry ? ` ${expiry}.` : ''} Thank you for supporting an independent developer :)`;
  if ( isOverridenLicense ) {
    message = 'This license has been force-enabled for you.';
    if (license && license.check_url ) {
      message = <><span>{message}</span><br /><small>To check your license status, please click <a target="_blank" href={license.check_url + '&cache=' + (Math.random() * (642000))} rel="noreferrer">here</a>.</small></>;
    }
  }
  if (!success) {
    if (integrityFailed) {
      message = <>
        <p>
          This copy does not match the official release. It appears to have been tampered with and may contain <strong>malicious code, spyware, or other security risks</strong>. For your safety, delete this version immediately and download only from the official source: <a target='_blank' rel="noreferrer" href='https://meowapps.com'>Meow Apps</a>.
        </p>
        <p>
          If you downloaded it from your account at Meow Apps and still see this, please <ContactLink /> and we will sort it out.
        </p>
      </>;
    }
    else if (keyLooksWrong) {
      message = <span>This license key does not look right. Please copy it again from your account at <AccountLink />, then enter it below.</span>;
    }
    else if (!license || !license.key) {
      message = 'Please enter your license key below to activate Pro features.';
    }
    else {
      const issueMessage = getIssueMessage(license.issue);
      if (!issueMessage) {
        console.error({ license });
      }
      const hint = getDebugHint(license.debug);
      message = <>
        {issueMessage || <span>This license could not be validated, and the status we got back ({license.issue || 'none'}) is one we do not know. Sorry about that! Please <ContactLink /> with the details below and we will sort it out.</span>}
        {hint && <><br /><br /><small>{hint}</small></>}
      </>;
    }
  }

  const jsxNonPro =
    <NekoBlock title="Pro Version is not installed" className="primary" contentStyle={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '18px 32px 36px', textAlign: 'center' }}>
        <LicenseHero tiers={[ 'free', 'pro' ]} title="Why should you consider it?" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 28,
          maxWidth: 820, margin: '30px auto 0' }}>
          {PRO_REASONS.map((r) => <div key={r.icon} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 999, background: r.tint[0], display: 'flex',
              alignItems: 'center', justifyContent: 'center' }}>
              <NekoIcon icon={r.icon} width={22} height={22} color={r.tint[1]} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1d2327' }}>{r.title}</span>
            <span style={{ fontSize: 13, color: '#50575e', lineHeight: 1.55, maxWidth: 230 }}>{r.text}</span>
          </div>)}
        </div>
      </div>
      <div style={{ background: '#f6f8fb', borderTop: '1px solid #edf0f4', padding: '24px 32px 22px', display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <NekoButton large onClick={() => window.open(getProUrl(undefined, 'license-tab'), '_blank', 'noopener,noreferrer')}>
          Get the Pro Version
        </NekoButton>
        <span style={{ fontSize: 12, color: '#646970' }}>Already bought it? Download Pro from <a target="_blank" rel="noreferrer"
          href="https://meowapps.com/account/">your account</a>.</span>
      </div>
    </NekoBlock>;

  const jsxProVersion =
    <NekoBlock title={needsKey ? 'Pro Version is installed' : (success && !isOverridenLicense ? 'Pro Version' : `Pro Version (${licenseTextStatus})`)} busy={busy} className="primary">

      {needsKey && <div style={{ marginBottom: 18 }}><LicenseHero tiers={[ 'free', 'pro' ]} title="Almost there">
        Thank you for getting the Pro version! Paste your license key below to switch everything on. You will find it in
        your purchase email, and anytime in <a target="_blank" rel="noreferrer" href="https://meowapps.com/account/">your account</a>.
      </LicenseHero>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', maxWidth: 560, margin: '18px auto 12px' }}>
        <div style={{ flex: 1 }}>
          <NekoInput id="mfrh_pro_serial" name="mfrh_pro_serial" disabled={busy} value={serialKey} aria-label="License key"
            onChange={(txt) => setSerialKey(txt.trim())} placeholder="Paste your license key" />
        </div>
        <NekoButton disabled={busy || !serialKey} onClick={validateLicense}>Activate</NekoButton>
      </div></div>}

      {success && !editMode && !isOverridenLicense && <div style={{ marginBottom: 10 }}><LicenseHero tiers={[ 'pro' ]} title="Pro is active">
        {expiry ? `${expiry}. ` : ''}Thank you for supporting an independent developer :)
      </LicenseHero></div>}


      {!integrityFailed && !isOverridenLicense && !needsKey && (editMode || !(license && license.key === serialKey)) && <>
        <div style={{ marginBottom: 10 }}>License Key:</div>
        <NekoInput id="mfrh_pro_serial" name="mfrh_pro_serial" disabled={busy} value={serialKey}
          onChange={(txt) => setSerialKey(txt.trim())} placeholder="Type your license key..." />
        {!needsKey && !success && license && <NekoTypo p>If there was an error during the validation, try the <i>Retry to validate</i> button.</NekoTypo>}
      </>}

      {!success && !needsKey && <NekoMessage variant="danger">{message}</NekoMessage>}
      {success && !editMode && isOverridenLicense && <NekoMessage variant="success">{message}</NekoMessage>}
      {success && license && license.grace_until && <NekoMessage variant="warning" style={{ marginTop: 10 }}>
        We could not confirm your license recently{license.grace_issue ? <> ({license.grace_issue})</> : null}. Pro stays active until {new Date(license.grace_until * 1000).toLocaleDateString()} and we will keep retrying. If it has expired, you can renew it in your account at <AccountLink />.
      </NekoMessage>}

      {!integrityFailed && !needsKey && <div style={{ marginTop: 15, display: 'flex', justifyContent: success && !editMode && !isOverridenLicense ? 'center' : 'end', gap: 5, marginBottom: success && !editMode ? 8 : 0 }}>
        {success && !editMode && <>
          <NekoButton className="secondary" disabled={busy} onClick={validateLicense}>
            Re-Validate License
          </NekoButton>
          <NekoButton className="secondary" disabled={busy} onClick={startModifyLicense}>
            Modify License
          </NekoButton>
          <NekoButton className="secondary" disabled={busy} onClick={removeLicense}>
            Remove License
          </NekoButton>
        </>}
        {success && editMode && <>
          <NekoButton className="secondary" disabled={busy} onClick={cancelModifyLicense}>
            Cancel
          </NekoButton>
          <NekoButton disabled={busy || !serialKey}
            onClick={validateLicense}>Validate License</NekoButton>
        </>}
        {!success && <>
          {license && license.issue && <NekoButton className="secondary" disabled={busy}
            onClick={copySupportDetails}>{copied ? 'Copied' : 'Copy details for support'}
          </NekoButton>}
          {license && <NekoButton className="secondary" disabled={busy || !serialKey}
            onClick={validateLicense}>Retry to validate
          </NekoButton>}
          {license && license.key === serialKey && <NekoButton className="danger" disabled={busy || !serialKey}
            onClick={removeLicense}>Remove License
          </NekoButton>}
          <NekoButton disabled={busy || !serialKey || (license && license.key === serialKey)}
            onClick={validateLicense}>{needsKey ? 'Activate' : 'Validate License'}</NekoButton>
          {meowMode && <NekoButton disabled={busy || !serialKey || (license && license.key === serialKey)}
            onClick={forceLicense} className="danger">Force License</NekoButton>}
        </>}
      </div>}

      <NekoModal
        isOpen={currentModal === 'licenseAdded'}
        title="Thank you :)"
        content="The Pro features have been enabled. This page should be now reloaded."
        okButton={{
          label: "Reload",
          onClick: () => location.reload()
        }}
      />

      <NekoModal
        isOpen={currentModal === 'licenseRemoved'}
        title="Goodbye :("
        content="The Pro features have been disabled. This page should be now reloaded."
        okButton={{
          label: "Reload",
          onClick: () => location.reload()
        }}
      />

      <NekoNoticeModal notice={notice} onClose={closeNotice} />

    </NekoBlock>;

  return (isPro ? jsxProVersion : jsxNonPro);
};

export { LicenseBlock };
