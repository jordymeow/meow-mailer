/* eslint-disable no-undef */
// React & Vendor Libs
const { useState, useEffect } = wp.element;

// NekoUI
import { NekoButton, NekoTypo, NekoBlock, NekoInput,
  NekoMessage, NekoModal } from '@neko-ui';
import { nekoFetch } from '@neko-ui';

// From Main Plugin
import { restUrl, prefix, isPro, isRegistered, restNonce } from '@app/settings';

// Integrity checker
import { checkIntegrity } from '@common/integrity-checker';

const CommonApiUrl = `${restUrl}/meow-licenser/${prefix}/v1`;

const LicenseBlock = () => {
  const [ busy, setBusy ] = useState(false);
  const [ meowMode, setMeowMode ] = useState(false);
  const [ currentModal, setCurrentModal ] = useState(null);
  const [ license, setLicense ] = useState(null);
  const [ serialKey, setSerialKey ] = useState('');
  const [ editMode, setEditMode ] = useState(false);
  const [ integrityFailed, setIntegrityFailed ] = useState(false);
  const isOverridenLicense = isRegistered && (!license || license.license !== 'valid');

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
      alert('Error while checking the license. Check your console for more information.');
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
      alert('Error while removing the license. Check your console for more information.');
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
      alert('Error while forcing the license. Check your console for more information.');
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
      alert('Error while validating the license. Check your console for more information.');
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

  const licenseTextStatus = isOverridenLicense ? 'Forced License' : isRegistered ? 'Enabled' : 'Disabled';

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
    else if (license.issue === 'no_activations_left') {
      message = <span>There are no activations left for this license. You can visit your account at <a target='_blank' rel="noreferrer" href='https://meowapps.com'>Meow Apps</a>, unregister a site, and click on <i>Retry to validate</i>.</span>;
    }
    else if (license.issue === 'expired') {
      message = <span>Your license has expired. You can get another license or renew the current one by visiting your account at <a target='_blank' rel="noreferrer" href='https://meowapps.com'>Meow Apps</a>.</span>;
    }
    else if (license.issue === 'missing') {
      message = 'This license does not exist.';
    }
    else if (license.issue === 'disabled') {
      message = 'This license has been disabled.';
    }
    else if (license.issue === 'item_name_mismatch') {
      message = 'This license seems to be for a different plugin... isn\'t it? :)';
    }
    else if (license.issue === 'forced') {
      message = 'ABC';
    }
    else {
      message = <span>There is an unknown error related to the system or this serial key. Really sorry about this! Make sure your security plugins and systems are off temporarily. If you are still experiencing an issue, please <a target='_blank' rel="noreferrer" href='https://meowapps.com/contact/'>contact us</a>.</span>;
      console.error({ license });
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

    </NekoBlock>;

  return (isPro ? jsxProVersion : jsxNonPro);
};

export { LicenseBlock };
