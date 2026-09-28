/* eslint-disable no-undef */
// React & Vendor Libs
const { useState, useEffect } = wp.element;
const { __ } = wp.i18n;

// NekoUI
import { NekoButton, NekoTypo, NekoBlock, NekoInput,
  NekoMessage, NekoModal } from '@neko-ui';
import { nekoFetch } from '@neko-ui';

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

const LicenseBlock = () => {
  const [ busy, setBusy ] = useState(false);
  const [ meowMode, setMeowMode ] = useState(false);
  const [ currentModal, setCurrentModal ] = useState(null);
  const [ license, setLicense ] = useState(null);
  const [ serialKey, setSerialKey ] = useState('');
  const [ editMode, setEditMode ] = useState(false);
  const [ integrityFailed, setIntegrityFailed ] = useState(false);
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
        // Check if license has invalid format (not 32 hex chars)
        const hasInvalidFormat = res.data.key.length !== (2 << 4) || !/^[0-9a-f]{32}$/.test(res.data.key);

        // Piracy detection: Invalid format + no issue (was "accepted" but wrong format = hacked)
        // NOT piracy: Invalid format + has issue (server rejected it = user error)
        if (hasInvalidFormat && !res.data.issue) {
          // License was accepted/validated but has wrong format = forced into DB = piracy
          setIntegrityFailed(true);
          setBusy(false);
          return;
        }

        setSerialKey(res.data.key);
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

  const success = !integrityFailed && (isOverridenLicense || (license && license.license === 'valid'));
  let message = 'Your license is active. Thanks a lot for your support :)';
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
          If you obtained this from any other website than Meow Apps, <a target='_blank' rel="noreferrer" href='https://meowapps.com/contact/'>contact us</a> and dispute the charge with your credit card provider or bank immediately.
        </p>
      </>;
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
    <NekoBlock title="Pro Version (Not Installed)" className="primary">
      You will find more information about the Pro Version <a target='_blank' rel="noreferrer" href={`https://meowapps.com`}>here</a>. If you actually bought the Pro Version already, please remove the current plugin and download the Pro Version from your account at <a target='_blank' rel="noreferrer" href='https://meowapps.com/'>Meow Apps</a>.
    </NekoBlock>;

  const jsxProVersion =
    <NekoBlock title={`Pro Version (${licenseTextStatus})`} busy={busy} className="primary">

      {!integrityFailed && !isOverridenLicense && (editMode || !(license && license.key === serialKey)) && <>
        <div style={{ marginBottom: 10 }}>License Key:</div>
        <NekoInput id="mfrh_pro_serial" name="mfrh_pro_serial" disabled={busy} value={serialKey}
          onChange={(txt) => setSerialKey(txt.trim())} placeholder="Type your license key..." />
        <NekoTypo p>Insert your serial key above. If you don&apos;t have one yet, you can get one <a href="https://meowapps.com">here</a>. If there was an error during the validation, try the <i>Retry</i> to <i>validate</i> button.
        </NekoTypo>
      </>}

      {!success && <NekoMessage variant="danger">{message}</NekoMessage>}
      {success && !editMode && <NekoMessage variant="success">{message}</NekoMessage>}

      {!integrityFailed && <div style={{ marginTop: 15, display: 'flex', justifyContent: 'end', gap: 5 }}>
        {success && !editMode && <>
          <NekoButton className="secondary" disabled={busy} onClick={validateLicense}>
            Re-Validate License
          </NekoButton>
          <NekoButton className="secondary" disabled={busy} onClick={startModifyLicense}>
            Modify License
          </NekoButton>
          <NekoButton className="danger" disabled={busy} onClick={removeLicense}>
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
            onClick={validateLicense}>Validate License</NekoButton>
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
