import { nekoFetch } from "@neko-ui";
import { apiUrl, restNonce } from "@app/settings";
import { t } from "@app/i18n";

const post = async (path, json) => {
  const res = await nekoFetch(`${apiUrl}${path}`, { method: 'POST', nonce: restNonce, json });
  if (res && res.success === false) {
    throw new Error(res.message || t('Request failed.'));
  }
  return res;
};

const get = async (path) => {
  const res = await nekoFetch(`${apiUrl}${path}`, { method: 'GET', nonce: restNonce });
  if (res && res.success === false) {
    throw new Error(res.message || t('Request failed.'));
  }
  return res;
};

// Settings
export const refreshSettings = async () => (await get('/settings/list')).options;
export const updateSettings = async (options) => (await post('/settings/update', { options })).options;
export const resetSettings = async () => (await post('/settings/reset')).options;

// Logs
export const fetchLogs = async ({ page, limit, filters, sort }) =>
  await post('/logs/list', { page, limit, filters, sort });
export const fetchLog = async (id) => (await post('/logs/get', { id })).log;
export const deleteLogs = async (ids) => await post('/logs/delete', { ids });
export const clearLogs = async () => await post('/logs/clear');
export const resendLog = async (id) => await post('/logs/resend', { id });
export const exportLogs = async (filters, sort) => (await post('/logs/export', { filters, sort })).csv;

// Tools
export const sendTestEmail = async (to, format) => await post('/mail/test', { to, format });
export const getOAuthUrl = async (provider) => await post('/oauth/auth-url', { provider });
export const disconnectOAuth = async (provider) => (await post('/oauth/disconnect', { provider })).options;
