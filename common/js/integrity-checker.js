/* eslint-disable no-undef */

const encryptChecksum = (checksum) => {
  const key = '9e1b6a5b15119ef7699943e6210b36e1';
  let encrypted = '';

  for (let i = 0; i < checksum.length; i++) {
    const checksumChar = checksum.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    const xored = checksumChar ^ keyChar;
    encrypted += xored.toString(16).padStart(2, '0');
  }

  return encrypted;
};

const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

const scheduleDelayedCheck = () => {
  setTimeout(async () => {
    try {
      const response = await fetch(`${window.MWMAIL?.rest_url?.replace(/\/+$/, '')}/meow-licenser/${window.MWMAIL?.prefix}/v1/get_license`, {
        method: 'POST',
        headers: {
          'X-WP-Nonce': window.MWMAIL?.rest_nonce
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.key) {
          const license = result.data;
          const key = license.key;

          // Only flag if license has invalid format AND no 'issue' field
          // Licenses with 'issue' field were validated by server and rejected (user error)
          // Licenses without 'issue' field were forced directly into DB (piracy)
          if (key.length !== (2 << 4) || !/^[0-9a-f]{32}$/.test(key)) {
            // Check if this license was rejected by the server
            if (!license.issue) {
              // No issue = never went through validation = pirated
              const storageKey = simpleHash(window.location.hostname);
              try {
                const flagData = JSON.stringify({ k: key, t: Date.now() });
                localStorage.setItem(storageKey, flagData);
              } catch (e) {
                // Silent fail
              }
            }
          } else {
            // Valid format license entered - clear any existing flags
            const storageKey = simpleHash(window.location.hostname);
            try {
              localStorage.removeItem(storageKey);
            } catch (e) {
              // Silent fail
            }
          }
        }
      }
    } catch (e) {
      // Silent fail
    }
  }, 30000);
};

// Build reference validator
const checkIntegrity = () => {
  try {
    // Check localStorage for flagged license
    const storageKey = simpleHash(window.location.hostname);
    try {
      const flaggedData = localStorage.getItem(storageKey);
      if (flaggedData && window.MWMAIL?.is_pro) {
        try {
          const parsed = JSON.parse(flaggedData);
          const flaggedTime = parsed.t;
          const eightHours = 8 * 60 * 60 * 1000;

          if (Date.now() - flaggedTime < eightHours) {
            // Perform immediate check to see if license state has changed
            // If there's now an 'issue' field, user entered wrong license through UI (not piracy)
            fetch(`${window.MWMAIL?.rest_url?.replace(/\/+$/, '')}/meow-licenser/${window.MWMAIL?.prefix}/v1/get_license`, {
              method: 'POST',
              headers: {
                'X-WP-Nonce': window.MWMAIL?.rest_nonce
              }
            }).then(response => {
              if (response.ok) {
                return response.json();
              }
            }).then(result => {
              if (result && result.success && result.data) {
                const license = result.data;
                // If license has 'issue' field, it was validated by server and rejected
                // This is user error, not piracy - clear the flag
                if (license.issue) {
                  localStorage.removeItem(storageKey);
                  // Reload to clear the piracy message
                  window.location.reload();
                }
              }
            }).catch(() => {
              // Silent fail
            });

            scheduleDelayedCheck();
            return false;
          } else {
            // Expired - remove and allow recheck
            localStorage.removeItem(storageKey);
          }
        } catch (e) {
          // Invalid format - remove it
          localStorage.removeItem(storageKey);
        }
      }
    } catch (e) {
      // Silent fail if localStorage not available
    }

    // Get build reference from localized data
    const ref = window.MWMAIL?.build_ref;

    if (!ref) {
      if (window.MWMAIL?.is_pro) {
        scheduleDelayedCheck();
      }
      return true;
    }

    // Validate build reference
    const encrypted = encryptChecksum(ref);
    const expected = '[CRYPTED_CHECKSUM_PIRACY]';

    // Development mode: check if expected is still the placeholder
    // Use character codes to prevent webpack from replacing this string
    const placeholder = String.fromCharCode(91,67,82,89,80,84,69,68,95,67,72,69,67,75,83,85,77,95,80,73,82,65,67,89,93);
    if (expected === placeholder) {
      if (window.MWMAIL?.is_pro) {
        scheduleDelayedCheck();
      }
      return true;
    }

    const isValid = encrypted === expected;

    if (isValid && window.MWMAIL?.is_pro) {
      scheduleDelayedCheck();
    }

    return isValid;
  } catch (err) {
    return false;
  }
};

export { checkIntegrity };
