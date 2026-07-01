const prefix = window.mwmail.prefix;
const domain = window.mwmail.domain;
const restUrl = window.mwmail.rest_url.replace(/\/+$/, "");
const apiUrl = window.mwmail.api_url.replace(/\/+$/, "");
const pluginUrl = window.mwmail.plugin_url.replace(/\/+$/, "");
const restNonce = window.mwmail.rest_nonce;
const options = window.mwmail.options;

export { prefix, domain, apiUrl, restUrl, pluginUrl, restNonce, options };
