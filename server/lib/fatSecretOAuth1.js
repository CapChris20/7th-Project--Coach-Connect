/**
 * FatSecret OAuth 1.0 signed requests (Consumer Key + Shared Secret).
 */
const crypto = require('crypto');
const axios = require('axios');

function oauthEncode(str) {
  return encodeURIComponent(String(str))
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function signOAuth1(method, url, params, consumerSecret, tokenSecret = '') {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${oauthEncode(k)}=${oauthEncode(params[k])}`)
    .join('&');
  const base = [method.toUpperCase(), oauthEncode(url), oauthEncode(sorted)].join('&');
  const key = `${oauthEncode(consumerSecret)}&${oauthEncode(tokenSecret)}`;
  return crypto.createHmac('sha1', key).update(base).digest('base64');
}

async function fatSecretOAuth1Get(params, consumerKey, consumerSecret) {
  const url = 'https://platform.fatsecret.com/rest/server.api';
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
  };
  const allParams = { ...params, ...oauth };
  oauth.oauth_signature = signOAuth1('GET', url, allParams, consumerSecret);
  const res = await axios.get(url, {
    params: { ...params, ...oauth },
    timeout: 15000,
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw new Error(res.data?.error?.message || res.data?.message || `HTTP ${res.status}`);
  }
  return res.data;
}

module.exports = { fatSecretOAuth1Get };
