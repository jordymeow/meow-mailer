const { useContext, createContext, useState, useCallback } = wp.element;

import { NekoModal } from '@neko-ui';
import { options as defaultOptions } from '@app/settings';
import { refreshSettings, updateSettings, resetSettings } from '@app/requests';
import { t } from '@app/i18n';

const CoreContext = createContext();

export const CoreContextProvider = ({ children }) => {
  const [options, setOptions] = useState(defaultOptions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refreshOptions = useCallback(async () => {
    setBusy(true);
    try {
      setOptions(await refreshSettings());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  // Persist an optimistic change: show it immediately, then roll back to the
  // previous state if the server rejects it (so the UI never lies about a save).
  const saveOptions = useCallback(async (next, previous) => {
    setBusy(true);
    setOptions(next);
    try {
      const saved = await updateSettings(next);
      setOptions(saved);
      return saved;
    } catch (err) {
      if (previous !== undefined) {
        setOptions(previous);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const updateOption = useCallback((value, name) => {
    if (options[name] === value) {
      return; // no change — don't trigger a redundant save on blur
    }
    return saveOptions({ ...options, [name]: value }, options);
  }, [options, saveOptions]);

  // Update a single field inside options.providers[provider] and persist.
  const updateProviderOption = useCallback((value, field, provider) => {
    if ((options.providers[provider] || {})[field] === value) {
      return; // no change
    }
    const next = {
      ...options,
      providers: {
        ...options.providers,
        [provider]: { ...options.providers[provider], [field]: value },
      },
    };
    return saveOptions(next, options);
  }, [options, saveOptions]);

  const resetOptions = useCallback(async () => {
    if (!window.confirm(t('Reset all Meow Mailer settings to defaults?'))) {
      return;
    }
    setBusy(true);
    try {
      setOptions(await resetSettings());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const getOption = useCallback((name, fallback = null) => options[name] ?? fallback, [options]);

  const value = {
    state: { options, busy, error },
    actions: { refreshOptions, saveOptions, updateOption, updateProviderOption, resetOptions, getOption, setOptions, setError, setBusy },
  };

  return (
    <CoreContext.Provider value={value}>
      {children}
      <NekoModal isOpen={!!error} title={t('Error')} content={error}
        onRequestClose={() => setError(null)}
        okButton={{ label: t('Close'), onClick: () => setError(null) }} />
    </CoreContext.Provider>
  );
};

export const useCoreContext = () => {
  const context = useContext(CoreContext);
  if (!context) {
    throw new Error('useCoreContext must be used within a CoreContextProvider');
  }
  return context;
};
