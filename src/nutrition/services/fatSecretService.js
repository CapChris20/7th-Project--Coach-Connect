/**
 * FatSecret API Service
 * Integrates with FatSecret API for food search and nutrition data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const FATSECRET_CLIENT_ID = process.env.FATSECRET_CLIENT_ID; // KEY MOVED TO SERVER
const FATSECRET_CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET; // KEY MOVED TO SERVER
const FATSECRET_API_KEY = process.env.FATSECRET_API_KEY; // KEY MOVED TO SERVER

// Storage keys
const ACCESS_TOKEN_KEY = '@fatsecret_access_token';
const REFRESH_TOKEN_KEY = '@fatsecret_refresh_token';
const TOKEN_EXPIRY_KEY = '@fatsecret_token_expiry';

class FatSecretService {
  constructor() {
    this.baseURL = 'https://platform.fatsecret.com/rest/server.api';
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Initialize the service and load stored tokens
   */
  async initialize() {
    await this.loadStoredTokens();
    
    // Check if token needs refresh
    if (this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Load stored tokens from AsyncStorage
   */
  async loadStoredTokens() {
    try {
      this.accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
      this.refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      const expiry = await AsyncStorage.getItem(TOKEN_EXPIRY_KEY);
      this.tokenExpiry = expiry ? new Date(expiry) : null;
    } catch (error) {
      console.error('Error loading stored tokens:', error);
    }
  }

  /**
   * Save tokens to AsyncStorage
   */
  async saveTokens(accessToken, refreshToken, expiresIn) {
    try {
      const expiry = new Date(Date.now() + expiresIn * 1000);
      
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      await AsyncStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toISOString());
      
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.tokenExpiry = expiry;
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }

  /**
   * Check if token is expired or will expire soon
   */
  isTokenExpired() {
    if (!this.tokenExpiry) return true;
    
    // Refresh 5 minutes before expiry
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    return this.tokenExpiry <= fiveMinutesFromNow;
  }

  /**
   * Try OAuth1.0 authentication test
   */
  async getAccessTokenWithAPIKey() {
    try {
      console.log('🔑 Testing FatSecret OAuth1.0 authentication...');
      
      // Try v1 endpoint (the original working version)
      const url = `https://platform.fatsecret.com/rest/foods/v1?search_expression=test&format=json`;
      const params = this.generateOAuth1Params({}, 'GET', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `OAuth oauth_consumer_key="${FATSECRET_CLIENT_ID}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${params.oauth_timestamp}", oauth_nonce="${params.oauth_nonce}", oauth_version="1.0", oauth_signature="${encodeURIComponent(params.oauth_signature)}"`,
        },
      });

      console.log('🔑 OAuth1.0 test response status:', response.status);

      if (response.ok) {
        // Check if response is XML or JSON
        const responseText = await response.text();
        console.log('🔑 OAuth1.0 response type:', responseText.substring(0, 100));
        
        if (responseText.startsWith('<?xml')) {
          // Got XML response - parse it
          console.log('🔑 Got XML response, parsing...');
          const parsed = this.parseXMLResponse(responseText);
          
          if (parsed.error) {
            console.error('🔑 FatSecret XML Error:', parsed.error);
            throw new Error(`FatSecret Error: ${parsed.error.message}`);
          }
          
          console.log('🔑 OAuth1.0 authentication works!');
          return 'oauth1_success';
        } else if (responseText.startsWith('{')) {
          // Got JSON response - parse it
          console.log('🔑 Got JSON response, parsing...');
          const data = JSON.parse(responseText);
          
          if (data.error) {
            console.error('🔑 FatSecret JSON Error:', data.error);
            throw new Error(`FatSecret Error: ${data.error.message}`);
          }
          
          console.log('🔑 OAuth1.0 authentication works!');
          return 'oauth1_success';
        } else {
          // Try to parse as JSON anyway
          const data = JSON.parse(responseText);
          console.log('🔑 OAuth1.0 authentication works!');
          return 'oauth1_success';
        }
      } else {
        const errorText = await response.text();
        console.error('🔑 OAuth1.0 auth failed:', errorText);
        throw new Error(`OAuth1.0 auth failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('🔑 OAuth1.0 authentication error:', error);
      throw error;
    }
  }

  /**
   * Parse XML response from FatSecret
   */
  parseXMLResponse(xmlText) {
    try {
      // Simple XML parser for FatSecret responses
      const result = {};
      
      console.log('🔑 Full XML response:', xmlText.substring(0, 500));
      
      // Extract error message if present
      const errorMatch = xmlText.match(/<error[^>]*>([\s\S]*?)<\/error>/);
      if (errorMatch) {
        console.log('🔑 Found error tag:', errorMatch[1]);
        
        const messageMatch = errorMatch[1].match(/<message[^>]*>(.*?)<\/message>/);
        const codeMatch = errorMatch[1].match(/<code[^>]*>(.*?)<\/code>/);
        
        result.error = {
          message: messageMatch ? messageMatch[1] : 'Unknown error',
          code: codeMatch ? codeMatch[1] : 'xml_error'
        };
        
        console.log('🔑 Parsed error:', result.error);
        return result;
      }
      
      // Extract search results
      const foodsMatch = xmlText.match(/<food[^>]*>([\s\S]*?)<\/food>/g);
      if (foodsMatch) {
        result.foods = foodsMatch.map(foodXml => {
          const idMatch = foodXml.match(/<food_id[^>]*>(.*?)<\/food_id>/);
          const nameMatch = foodXml.match(/<food_name[^>]*>(.*?)<\/food_name>/);
          const descMatch = foodXml.match(/<food_description[^>]*>(.*?)<\/food_description>/);
          
          return {
            food_id: idMatch ? idMatch[1] : '',
            food_name: nameMatch ? nameMatch[1] : '',
            food_description: descMatch ? descMatch[1] : ''
          };
        });
      }
      
      return result;
    } catch (error) {
      console.error('🔑 Error parsing XML:', error);
      return { error: { message: 'XML parse error', code: 'parse_error' } };
    }
  }

  /**
   * Get OAuth2 access token (fallback)
   */
  async getAccessToken() {
    try {
      console.log('🔑 Requesting FatSecret OAuth2 access token...');
      
      const response = await fetch('https://oauth.fatsecret.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: FATSECRET_CLIENT_ID,
          client_secret: FATSECRET_CLIENT_SECRET,
        }),
      });

      console.log('🔑 FatSecret token response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔑 FatSecret token error response:', errorText);
        
        // Try OAuth1.0 method as fallback
        console.log('🔑 OAuth2 failed, trying OAuth1.0 method...');
        try {
          await this.getAccessTokenWithAPIKey();
          console.log('🔑 Using OAuth1.0 authentication');
          this.authMethod = 'oauth1';
          return 'oauth1_success';
        } catch (oauth1Error) {
          console.error('🔑 OAuth1.0 also failed:', oauth1Error.message);
          throw new Error('Both OAuth2 and OAuth1.0 authentication failed');
        }
      }

      const data = await response.json();
      console.log('🔑 FatSecret token received successfully');
      
      await this.saveTokens(
        data.access_token,
        data.refresh_token,
        data.expires_in
      );

      this.authMethod = 'oauth2';
      return data.access_token;
    } catch (error) {
      console.error('🔑 Error getting access token:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    // For now, just try to get a new token
    return await this.getAccessToken();
  }

  /**
   * Ensure we have a valid access token
   */
  async ensureValidToken() {
    if (!this.accessToken || this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
    return this.accessToken;
  }

  /**
   * Search for foods in FatSecret database
   */
  async searchFoods(query, maxResults = 20) {
    try {
      console.log('🔍 Searching FatSecret for:', query);
      
      if (this.authMethod === 'oauth1') {
        // Use OAuth1.0 method
        return await this.searchWithOAuth1(query, maxResults);
      } else {
        // Use OAuth2 method
        const token = await this.ensureValidToken();
        return await this.searchWithOAuth2(token, query, maxResults);
      }
    } catch (error) {
      console.error('🔍 Error searching foods:', error);
      throw error;
    }
  }

  /**
   * Generate OAuth1.0 signature - proper HMAC-SHA1
   */
  generateOAuth1Signature(params, httpMethod, url) {
    // Create parameter string (sorted and encoded)
    const parameterString = Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    // Create base string
    const baseString = `${httpMethod.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(parameterString)}`;
    
    // Create signing key
    const signingKey = `${encodeURIComponent(FATSECRET_CLIENT_SECRET)}&`;
    
    console.log('🔑 Base string:', baseString);
    console.log('🔑 Signing key:', signingKey);
    
    // Generate proper HMAC-SHA1 signature
    const signature = this.hmacSHA1Base64(baseString, signingKey);
    
    console.log('🔑 Generated signature:', signature);
    return signature;
  }

  /**
   * HMAC-SHA1 with Base64 output for React Native
   */
  hmacSHA1Base64(message, key) {
    // Convert to UTF-8 bytes
    const messageBytes = this.stringToUtf8Bytes(message);
    const keyBytes = this.stringToUtf8Bytes(key);
    
    // HMAC inner and outer padding
    const blockSize = 64; // SHA-1 block size
    const ipad = new Array(blockSize).fill(0x36);
    const opad = new Array(blockSize).fill(0x5c);
    
    // If key is longer than block size, hash it first
    let processedKey = keyBytes;
    if (keyBytes.length > blockSize) {
      processedKey = this.sha1Bytes(keyBytes);
    }
    
    // Pad key to block size
    while (processedKey.length < blockSize) {
      processedKey.push(0);
    }
    
    // Create inner and outer padded keys
    const innerKey = processedKey.map((byte, i) => byte ^ ipad[i]);
    const outerKey = processedKey.map((byte, i) => byte ^ opad[i]);
    
    // Compute inner hash: H(K ^ ipad || message)
    const innerHash = this.sha1Bytes(innerKey.concat(messageBytes));
    
    // Compute outer hash: H(K ^ opad || inner_hash)
    const outerHash = this.sha1Bytes(outerKey.concat(innerHash));
    
    // Convert to base64
    return this.bytesToBase64(outerHash);
  }

  /**
   * SHA-1 hash implementation
   */
  sha1Bytes(bytes) {
    // SHA-1 constants
    const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
    
    // Initial hash values
    let H0 = 0x67452301, H1 = 0xefcdab89, H2 = 0x98badcfe, H3 = 0x10325476, H4 = 0xc3d2e1f0;
    
    // Pre-processing: append "1" bit, pad with zeros, and append original length
    const msg = bytes.slice();
    const msgLen = msg.length * 8; // length in bits
    
    // Append "1" bit
    msg.push(0x80);
    
    // Pad with zeros until length ≡ 448 (mod 512)
    while (msg.length % 64 !== 56) {
      msg.push(0);
    }
    
    // Append original length as 64-bit big-endian integer
    for (let i = 7; i >= 0; i--) {
      msg.push((msgLen >>> (i * 8)) & 0xff);
    }
    
    // Process in 512-bit chunks
    for (let chunk = 0; chunk < msg.length; chunk += 64) {
      const w = new Array(80);
      
      // Break chunk into sixteen 32-bit big-endian words
      for (let i = 0; i < 16; i++) {
        w[i] = (msg[chunk + i * 4] << 24) |
               (msg[chunk + i * 4 + 1] << 16) |
               (msg[chunk + i * 4 + 2] << 8) |
               msg[chunk + i * 4 + 3];
      }
      
      // Extend the sixteen words into eighty words
      for (let i = 16; i < 80; i++) {
        w[i] = this.rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      }
      
      // Initialize hash value for this chunk
      let a = H0, b = H1, c = H2, d = H3, e = H4;
      
      // Main loop
      for (let i = 0; i < 80; i++) {
        let f, k;
        if (i < 20) {
          f = (b & c) | (~b & d);
          k = K[0];
        } else if (i < 40) {
          f = b ^ c ^ d;
          k = K[1];
        } else if (i < 60) {
          f = (b & c) | (b & d) | (c & d);
          k = K[2];
        } else {
          f = b ^ c ^ d;
          k = K[3];
        }
        
        const temp = (this.rotl(a, 5) + f + e + k + w[i]) >>> 0;
        e = d;
        d = c;
        c = this.rotl(b, 30);
        b = a;
        a = temp;
      }
      
      // Add this chunk's hash to result so far
      H0 = (H0 + a) >>> 0;
      H1 = (H1 + b) >>> 0;
      H2 = (H2 + c) >>> 0;
      H3 = (H3 + d) >>> 0;
      H4 = (H4 + e) >>> 0;
    }
    
    // Produce the final hash value as a byte array
    return [
      (H0 >>> 24) & 0xff, (H0 >>> 16) & 0xff, (H0 >>> 8) & 0xff, H0 & 0xff,
      (H1 >>> 24) & 0xff, (H1 >>> 16) & 0xff, (H1 >>> 8) & 0xff, H1 & 0xff,
      (H2 >>> 24) & 0xff, (H2 >>> 16) & 0xff, (H2 >>> 8) & 0xff, H2 & 0xff,
      (H3 >>> 24) & 0xff, (H3 >>> 16) & 0xff, (H3 >>> 8) & 0xff, H3 & 0xff,
      (H4 >>> 24) & 0xff, (H4 >>> 16) & 0xff, (H4 >>> 8) & 0xff, H4 & 0xff
    ];
  }

  /**
   * Rotate left operation
   */
  rotl(value, shift) {
    return (value << shift) | (value >>> (32 - shift));
  }

  /**
   * Convert string to UTF-8 bytes
   */
  stringToUtf8Bytes(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6));
        bytes.push(0x80 | (code & 0x3f));
      } else {
        bytes.push(0xe0 | (code >> 12));
        bytes.push(0x80 | ((code >> 6) & 0x3f));
        bytes.push(0x80 | (code & 0x3f));
      }
    }
    return bytes;
  }

  /**
   * Convert bytes to base64
   */
  bytesToBase64(bytes) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i];
      const b = bytes[i + 1] || 0;
      const c = bytes[i + 2] || 0;
      
      const bitmap = (a << 16) | (b << 8) | c;
      
      result += chars.charAt((bitmap >> 18) & 63);
      result += chars.charAt((bitmap >> 12) & 63);
      result += i + 1 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
      result += i + 2 < bytes.length ? chars.charAt(bitmap & 63) : '=';
    }
    
    return result;
  }

  /**
   * HMAC-SHA1 implementation
   */
  hmacSHA1(message, key) {
    // Convert strings to arrays of bytes
    const messageBytes = this.stringToBytes(message);
    const keyBytes = this.stringToBytes(key);
    
    // If key is longer than 64 bytes, hash it first
    const actualKey = keyBytes.length > 64 ? this.sha1(keyBytes) : keyBytes;
    
    // Create inner and outer pads
    const iPad = new Array(64).fill(0x36);
    const oPad = new Array(64).fill(0x5c);
    
    // XOR key with pads
    for (let i = 0; i < 64; i++) {
      iPad[i] = i < actualKey.length ? actualKey[i] ^ 0x36 : 0x36;
      oPad[i] = i < actualKey.length ? actualKey[i] ^ 0x5c : 0x5c;
    }
    
    // Inner hash: H(key ^ ipad, message)
    const innerHash = this.sha1([...iPad, ...messageBytes]);
    
    // Outer hash: H(key ^ opad, innerHash)
    const outerHash = this.sha1([...oPad, ...innerHash]);
    
    // Convert to base64
    return this.bytesToBase64(outerHash);
  }

  /**
   * Simple SHA-1 implementation
   */
  sha1(bytes) {
    // Initialize hash values
    let h0 = 0x67452301;
    let h1 = 0xEFCDAB89;
    let h2 = 0x98BADCFE;
    let h3 = 0x10325476;
    let h4 = 0xC3D2E1F0;
    
    // Process message in 512-bit chunks
    const ml = bytes.length * 8;
    const chunks = this.padMessage(bytes);
    
    for (const chunk of chunks) {
      const w = this.expandChunk(chunk);
      
      let [a, b, c, d, e] = [h0, h1, h2, h3, h4];
      
      for (let i = 0; i < 80; i++) {
        const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : (b & c) | (b | d);
        const k = i < 20 ? 0x5A827999 : i < 40 ? 0x6ED9EBA1 : i < 60 ? 0x8F1BBCDC : 0xCA62C1D6;
        
        const temp = (this.rotl(a, 5) + f + e + k + w[i]) >>> 0;
        e = d;
        d = c;
        c = this.rotl(b, 30);
        b = a;
        a = temp;
      }
      
      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
    }
    
    // Produce final hash value
    return new Uint8Array([
      (h0 >>> 24) & 0xFF,
      (h0 >>> 16) & 0xFF,
      (h0 >>> 8) & 0xFF,
      h0 & 0xFF,
      (h1 >>> 24) & 0xFF,
      (h1 >>> 16) & 0xFF,
      (h1 >>> 8) & 0xFF,
      h1 & 0xFF,
      (h2 >>> 24) & 0xFF,
      (h2 >>> 16) & 0xFF,
      (h2 >>> 8) & 0xFF,
      h2 & 0xFF,
      (h3 >>> 24) & 0xFF,
      (h3 >>> 16) & 0xFF,
      (h3 >>> 8) & 0xFF,
      h3 & 0xFF,
      (h4 >>> 24) & 0xFF,
      (h4 >>> 16) & 0xFF,
      (h4 >>> 8) & 0xFF,
      h4 & 0xFF,
    ]);
  }

  /**
   * Expand 512-bit chunk into 80 words
   */
  expandChunk(chunk) {
    const w = new Array(80);
    
    // Copy first 16 words
    for (let i = 0; i < 16; i++) {
      w[i] = (chunk[i * 4] << 24) | (chunk[i * 4 + 1] << 16) | (chunk[i * 4 + 2] << 8) | chunk[i * 4 + 3];
    }
    
    // Extend remaining words
    for (let i = 16; i < 80; i++) {
      const s0 = this.rotl(w[i - 15], 7) ^ this.rotl(w[i - 2], 18) ^ (w[i - 16] >>> 3);
      const s1 = this.rotl(w[i - 7], 17) ^ this.rotl(w[i - 2], 19) ^ (w[i - 15] >>> 10);
      w[i] = (s1 + w[i - 16]) >>> 0;
      w[i] = (w[i] + s0) >>> 0;
    }
    
    return w;
  }

  /**
   * Rotate left operation
   */
  rotl(value, shift) {
    return (value << shift) | (value >>> (32 - shift));
  }

  /**
   * Pad message to multiple of 512 bits
   */
  padMessage(bytes) {
    const ml = bytes.length * 8;
    const padding = new Array(64 - (bytes.length % 64));
    
    // Add 0x80 byte
    padding[0] = 0x80;
    
    // Add 64-bit message length
    const lengthBytes = [
      (ml >>> 56) & 0xFF,
      (ml >>> 48) & 0xFF,
      (ml >>> 40) & 0xFF,
      (ml >>> 32) & 0xFF,
      (ml >>> 24) & 0xFF,
      (ml >>> 16) & 0xFF,
      (ml >>> 8) & 0xFF,
      ml & 0xFF,
    ];
    
    // Combine message, padding, and length
    const padded = [...bytes, ...padding, ...lengthBytes];
    
    // Split into 512-bit chunks
    const chunks = [];
    for (let i = 0; i < padded.length; i += 64) {
      chunks.push(padded.slice(i, i + 64));
    }
    
    return chunks;
  }

  /**
   * Convert string to bytes
   */
  stringToBytes(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    return bytes;
  }

  /**
   * Convert bytes to base64
   */
  bytesToBase64(bytes) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    
    while (i < bytes.length) {
      const a = bytes[i++];
      const b = i < bytes.length ? bytes[i++] : 0;
      const c = i < bytes.length ? bytes[i++] : 0;
      
      const bitmap = (a << 16) | (b << 8) | c;
      
      result += chars.charAt((bitmap >> 18) & 63);
      result += chars.charAt((bitmap >> 12) & 63);
      result += i - 2 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
      result += i - 1 < bytes.length ? chars.charAt(bitmap & 63) : '=';
    }
    
    return result;
  }

  /**
   * Generate OAuth1.0 parameters with signature
   */
  generateOAuth1Params(params, httpMethod = 'GET', url = null) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 15);
    
    const oauthParams = {
      oauth_consumer_key: FATSECRET_CLIENT_ID,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
    };
    
    // Combine all parameters
    const allParams = { ...oauthParams, ...params };
    
    // Use provided URL or fallback to baseURL
    const targetUrl = url || this.baseURL;
    
    // Generate signature
    const signature = this.generateOAuth1Signature(allParams, httpMethod, targetUrl);
    
    // Add signature to parameters
    return {
      ...allParams,
      oauth_signature: signature,
    };
  }

  /**
   * Search using OAuth1.0 authentication
   */
  async searchWithOAuth1(query, maxResults = 20) {
    try {
      console.log('🔍 Searching with OAuth1.0...');
      
      // Use v1 URL-based integration (this actually works!)
      const url = `https://platform.fatsecret.com/rest/foods/v1?search_expression=${encodeURIComponent(query)}&max_results=${maxResults}&format=json`;
      const params = this.generateOAuth1Params({}, 'GET', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `OAuth oauth_consumer_key="${FATSECRET_CLIENT_ID}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${params.oauth_timestamp}", oauth_nonce="${params.oauth_nonce}", oauth_version="1.0", oauth_signature="${encodeURIComponent(params.oauth_signature)}"`,
        },
      });

      console.log('🔍 OAuth1.0 search response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 OAuth1.0 search error:', errorText);
        throw new Error(`OAuth1.0 search failed: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('🔍 OAuth1.0 search response type:', responseText.substring(0, 100));
      
      let data;
      if (responseText.startsWith('<?xml')) {
        // Parse XML response
        console.log('🔍 Parsing XML response...');
        const parsed = this.parseXMLResponse(responseText);
        
        if (parsed.error) {
          console.error('🔍 FatSecret XML Error:', parsed.error);
          throw new Error(`FatSecret API Error: ${parsed.error.message}`);
        }
        
        // Convert XML format to match expected JSON structure (v1 format)
        data = {
          foods: {
            food: parsed.foods || []
          }
        };
      } else if (responseText.startsWith('{')) {
        // Parse JSON response
        console.log('🔍 Parsing JSON response...');
        data = JSON.parse(responseText);
        
        if (data.error) {
          console.error('🔍 FatSecret JSON Error:', data.error);
          throw new Error(`FatSecret API Error: ${data.error.message}`);
        }
      } else {
        // Try to parse as JSON anyway
        data = JSON.parse(responseText);
      }
      
      console.log('🔍 OAuth1.0 search results received');
      
      if (data.error) {
        console.error('🔍 FatSecret API Error:', data.error);
        throw new Error(`FatSecret API Error: ${data.error.message}`);
      }

      // Handle v1 format: data.foods.food (not data.foods_search.results.food)
      const foods = data.foods?.food || [];
      const results = Array.isArray(foods) ? foods : [foods];
      
      // Filter for English-only results
      const englishResults = results.filter(food => {
        const foodName = food.food_name || food.product_name || '';
        const brandName = food.brand_name || food.brands || '';
        
        // Check if food name and brand name are English (basic check)
        return this.isEnglish(foodName) && this.isEnglish(brandName);
      });
      
      const formattedResults = this.formatSearchResults(englishResults);
      
      console.log(`🔍 Found ${formattedResults.length} English foods from FatSecret (filtered from ${results.length} total)`);
      return formattedResults;
    } catch (error) {
      console.error('🔍 OAuth1.0 search error:', error);
      throw error;
    }
  }

  /**
   * Check if text is primarily English
   */
  isEnglish(text) {
    if (!text || typeof text !== 'string') {
      return true; // Allow empty/missing text
    }
    
    // Basic English check - contains mostly ASCII characters and common English words
    const asciiPattern = /^[\x00-\x7F]*$/;
    const hasNonASCII = !asciiPattern.test(text);
    
    // Check for common non-English characters
    const nonEnglishPatterns = /[àáâãäåæçèéêëìíîïñòóôõöøùúûüýÿß]/i;
    const hasNonEnglishChars = nonEnglishPatterns.test(text);
    
    // Allow if it's mostly ASCII and doesn't have obvious non-English characters
    return !hasNonASCII || !hasNonEnglishChars;
  }

  /**
   * Search using OAuth2 authentication
   */
  async searchWithOAuth2(token, query, maxResults = 20) {
    try {
      console.log('🔍 Searching with OAuth2...');
      
      const params = new URLSearchParams({
        method: 'foods.search',
        search_expression: query,
        max_results: maxResults.toString(),
        format: 'json',
      });

      const response = await fetch(`${this.baseURL}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('🔍 OAuth2 search response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 OAuth2 search error:', errorText);
        throw new Error(`OAuth2 search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔍 OAuth2 search results received');
      
      if (data.error) {
        console.error('🔍 FatSecret API Error:', data.error);
        throw new Error(`FatSecret API Error: ${data.error.message}`);
      }

      const results = this.formatSearchResults(data.foods_search?.results?.food || []);
      console.log(`🔍 Found ${results.length} foods from FatSecret (OAuth2)`);
      return results;
    } catch (error) {
      console.error('🔍 OAuth2 search error:', error);
      throw error;
    }
  }

  /**
   * Get detailed nutrition information for a specific food
   */
  async getFoodDetails(foodId) {
    try {
      const token = await this.ensureValidToken();
      
      const params = new URLSearchParams({
        method: 'food.get',
        food_id: foodId.toString(),
        format: 'json',
      });

      const response = await fetch(`${this.baseURL}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Food details request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`FatSecret API Error: ${data.error.message}`);
      }

      return this.formatFoodDetails(data.food);
    } catch (error) {
      console.error('Error getting food details:', error);
      throw error;
    }
  }

  /**
   * Format search results from FatSecret API
   */
  formatSearchResults(results) {
    return results.map(food => ({
      food_id: food.food_id,
      food_name: food.food_name,
      brand_name: food.brand_name || null,
      food_type: food.food_type || 'Generic',
      food_description: food.food_description || null,
      calories: parseFloat(food.calories) || 0,
      protein: parseFloat(food.protein) || 0,
      carbs: parseFloat(food.carbohydrate) || 0,
      fat: parseFloat(food.fat) || 0,
      sodium: parseFloat(food.sodium) || 0,
      serving_size: food.serving_description || '1 serving',
      serving_unit: food.serving_unit || 'serving',
      serving_weight_grams: parseFloat(food.serving_weight_grams) || 0,
      source: 'fatsecret',
      last_updated: new Date().toISOString(),
    }));
  }

  /**
   * Format detailed food information from FatSecret API
   */
  formatFoodDetails(food) {
    const servings = food.servings?.serving || [];
    const primaryServing = servings[0] || {};

    return {
      food_id: food.food_id,
      food_name: food.food_name,
      brand_name: food.brand_name || null,
      food_type: food.food_type || 'Generic',
      food_description: food.food_description || null,
      calories: parseFloat(primaryServing.calories) || 0,
      protein: parseFloat(primaryServing.protein) || 0,
      carbs: parseFloat(primaryServing.carbohydrate) || 0,
      fat: parseFloat(primaryServing.fat) || 0,
      sodium: parseFloat(primaryServing.sodium) || 0,
      serving_size: primaryServing.serving_description || '1 serving',
      serving_unit: primaryServing.metric_serving_unit || 'serving',
      serving_weight_grams: parseFloat(primaryServing.metric_serving_amount) || 0,
      source: 'fatsecret',
      last_updated: new Date().toISOString(),
      all_servings: servings.map(serving => ({
        serving_id: serving.serving_id,
        serving_description: serving.serving_description,
        calories: parseFloat(serving.calories) || 0,
        protein: parseFloat(serving.protein) || 0,
        carbs: parseFloat(serving.carbohydrate) || 0,
        fat: parseFloat(serving.fat) || 0,
        sodium: parseFloat(serving.sodium) || 0,
        serving_weight_grams: parseFloat(serving.metric_serving_amount) || 0,
      })),
    };
  }

  /**
   * Clear stored tokens (for logout)
   */
  async clearTokens() {
    try {
      await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
      await AsyncStorage.removeItem(TOKEN_EXPIRY_KEY);
      
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }
}

export default new FatSecretService();
