/**
 * Firebase Cloud Functions for WeChat & QQ OAuth login
 *
 * Flow:
 *   1. PWA redirects to /wechatLogin?redirect=<pwa-url>
 *   2. This function redirects to WeChat/QQ OAuth URL (with redirect encoded in state)
 *   3. Provider redirects back here with ?code=...&state=...
 *   4. This function exchanges code for access token, gets user info,
 *      creates a Firebase custom token, and redirects back to the PWA:
 *         <pwa-url>?customToken=<firebase-token>&provider=wechat
 *   5. PWA detects customToken in URL and calls firebase.auth().signInWithCustomToken()
 *
 * Requirements:
 *   firebase functions:config:set wechat.appid="xxx" wechat.secret="xxx"
 *   firebase functions:config:set qq.appid="xxx" qq.secret="xxx"
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// ---- Helpers ----

function decodeState(state) {
  try {
    return JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function encodeState(redirect) {
  return Buffer.from(JSON.stringify({ redirect })).toString('base64');
}

function sanitizeRedirect(url) {
  // Only allow http/https URLs to prevent open redirect abuse
  if (!url || !/^https?:\/\//.test(url)) return null;
  return url.split('#')[0].split('?')[0];
}

// ---- WeChat Login ----

exports.wechatLogin = functions.https.onRequest(async (req, res) => {
  const config = functions.config().wechat;
  if (!config || !config.appid || !config.secret) {
    sendErrorPage(res, 'WeChat OAuth not configured.\nRun:\n  firebase functions:config:set wechat.appid="xxx" wechat.secret="xxx"');
    return;
  }

  // Handle provider error (e.g. user declined in QQ)
  if (req.query.error) {
    const stateData = decodeState(req.query.state);
    const pwaOrigin = stateData?.redirect || req.query.redirect || '';
    if (pwaOrigin) return res.redirect(pwaOrigin + '?loginError=' + encodeURIComponent('用户取消了授权'));
    return sendErrorPage(res, 'Authorization cancelled by user');
  }

  // === Step 2: Callback from WeChat ===
  if (req.query.code) {
    try {
      const stateData = decodeState(req.query.state);
      const pwaOrigin = stateData?.redirect || req.query.redirect || '';

      // Exchange authorization code for access token
      const tokenResp = await fetch(
        'https://api.weixin.qq.com/sns/oauth2/access_token' +
        '?appid=' + config.appid +
        '&secret=' + config.secret +
        '&code=' + req.query.code +
        '&grant_type=authorization_code'
      );
      const tokenData = await tokenResp.json();

      if (tokenData.errcode) {
        return res.redirect(pwaOrigin + '?loginError=' + encodeURIComponent(tokenData.errmsg));
      }

      // Get user info
      const userResp = await fetch(
        'https://api.weixin.qq.com/sns/userinfo' +
        '?access_token=' + tokenData.access_token +
        '&openid=' + tokenData.openid
      );
      const userData = await userResp.json();

      // Store user profile in Firestore
      const uid = 'wechat:' + tokenData.openid;
      await admin.firestore().doc('userProfiles/' + uid).set({
        provider: 'wechat',
        displayName: userData.nickname || 'WeChat User',
        photoURL: userData.headimgurl || '',
        openid: tokenData.openid,
        unionid: tokenData.unionid || '',
      }, { merge: true });

      // Create Firebase custom token
      const customToken = await admin.auth().createCustomToken(uid);
      return res.redirect(pwaOrigin + '?customToken=' + customToken + '&provider=wechat');

    } catch (e) {
      console.error('WeChat OAuth error:', e);
      const stateData = decodeState(req.query.state);
      const pwaOrigin = stateData?.redirect || '';
      if (pwaOrigin) return res.redirect(pwaOrigin + '?loginError=' + encodeURIComponent(e.message));
      return sendErrorPage(res, 'WeChat login failed: ' + e.message);
    }
  }

  // === Step 1: Initial redirect to WeChat OAuth ===
  const redirectUrl = sanitizeRedirect(req.query.redirect);
  if (!redirectUrl) return sendErrorPage(res, 'Missing or invalid ?redirect parameter');

  const cfUrl = req.protocol + '://' + req.headers.host + req.path;
  const state = encodeState(redirectUrl);

  const authUrl =
    'https://open.weixin.qq.com/connect/qrconnect' +
    '?appid=' + config.appid +
    '&redirect_uri=' + encodeURIComponent(cfUrl) +
    '&response_type=code' +
    '&scope=snsapi_login' +
    '&state=' + encodeURIComponent(state) +
    '#wechat_redirect';

  // Redirect directly to WeChat QR code page
  res.redirect(authUrl);
});

// ---- QQ Login ----

exports.qqLogin = functions.https.onRequest(async (req, res) => {
  const config = functions.config().qq;
  if (!config || !config.appid || !config.secret) {
    sendErrorPage(res, 'QQ OAuth not configured.\nRun:\n  firebase functions:config:set qq.appid="xxx" qq.secret="xxx"');
    return;
  }

  // === Step 2: Callback from QQ ===
  if (req.query.code) {
    try {
      const stateData = decodeState(req.query.state);
      const pwaOrigin = stateData?.redirect || req.query.redirect || '';
      const cfUrl = req.protocol + '://' + req.headers.host + req.path;

      // Exchange code for access token
      const tokenResp = await fetch(
        'https://graph.qq.com/oauth2.0/token' +
        '?grant_type=authorization_code' +
        '&client_id=' + config.appid +
        '&client_secret=' + config.secret +
        '&code=' + req.query.code +
        '&redirect_uri=' + encodeURIComponent(cfUrl)
      );
      const tokenText = await tokenResp.text();

      // QQ returns application/x-www-form-urlencoded, not JSON
      const tokenParams = new URLSearchParams(tokenText);
      const accessToken = tokenParams.get('access_token');
      if (!accessToken) {
        return res.redirect(pwaOrigin + '?loginError=' + encodeURIComponent('Failed to get QQ access token'));
      }

      // Get openid
      const openidResp = await fetch(
        'https://graph.qq.com/oauth2.0/me?access_token=' + accessToken
      );
      const openidText = await openidResp.text();
      // QQ returns: callback( {"client_id":"xxx","openid":"xxx"} );
      const openidMatch = openidText.match(/"openid"\s*:\s*"([^"]+)"/);
      const openid = openidMatch ? openidMatch[1] : null;
      if (!openid) {
        return res.redirect(pwaOrigin + '?loginError=' + encodeURIComponent('Failed to get QQ openid'));
      }

      // Get user info
      const userResp = await fetch(
        'https://graph.qq.com/user/get_user_info' +
        '?access_token=' + accessToken +
        '&oauth_consumer_key=' + config.appid +
        '&openid=' + openid
      );
      const userData = await userResp.json();

      // Store user profile
      const uid = 'qq:' + openid;
      await admin.firestore().doc('userProfiles/' + uid).set({
        provider: 'qq',
        displayName: userData.nickname || 'QQ User',
        photoURL: userData.figureurl_qq_2 || userData.figureurl_qq_1 || '',
        openid: openid,
      }, { merge: true });

      // Create custom token
      const customToken = await admin.auth().createCustomToken(uid);
      return res.redirect(pwaOrigin + '?customToken=' + customToken + '&provider=qq');

    } catch (e) {
      console.error('QQ OAuth error:', e);
      const stateData = decodeState(req.query.state);
      const pwaOrigin = stateData?.redirect || '';
      if (pwaOrigin) return res.redirect(pwaOrigin + '?loginError=' + encodeURIComponent(e.message));
      return sendErrorPage(res, 'QQ login failed: ' + e.message);
    }
  }

  // === Step 1: Initial redirect to QQ OAuth ===
  const redirectUrl = sanitizeRedirect(req.query.redirect);
  if (!redirectUrl) return sendErrorPage(res, 'Missing or invalid ?redirect parameter');

  const cfUrl = req.protocol + '://' + req.headers.host + req.path;
  const state = encodeState(redirectUrl);

  const authUrl =
    'https://graph.qq.com/oauth2.0/authorize' +
    '?response_type=code' +
    '&client_id=' + config.appid +
    '&redirect_uri=' + encodeURIComponent(cfUrl) +
    '&scope=get_user_info' +
    '&state=' + encodeURIComponent(state);

  // Redirect directly to QQ OAuth page
  res.redirect(authUrl);
});

function sendErrorPage(res, msg) {
  res.status(500).send(
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>登录错误</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{margin:40px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#333;}' +
    'pre{background:#f5f5f5;padding:16px;border-radius:8px;overflow-x:auto;}</style></head>' +
    '<body><h2>⚠️ 登录配置错误</h2><pre>' + msg + '</pre></body></html>'
  );
}
