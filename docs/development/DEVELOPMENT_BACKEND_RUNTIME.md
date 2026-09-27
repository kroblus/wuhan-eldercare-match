# Development Backend Runtime Setup

The C5 authenticated Mini Program transport reads one machine-local development Backend origin from Mini Program storage. The value is used only when WeChat reports `envVersion === 'develop'`; trial and release builds ignore it. Missing or invalid values make C5-backed requests unavailable without attempting login or network access.

## Configure a physical development device

1. Start the Backend with the Owner-approved C5/C4 credentials and an interface reachable from the phone.
2. Connect the Android device to the same development LAN as the PC. Use the PC's current private LAN IPv4 address; do not use `127.0.0.1`, `localhost`, a public address, or a saved/stale address.
3. Start an Owner-controlled WeChat DevTools **real-device debug** session and scan its development QR code with the target phone.
4. In the DevTools AppService Console for that device session, set the origin using the actual current address:

   ```js
   wx.setStorageSync('__dev_backend_origin_v1', 'http://<PC-private-LAN-IPv4>:8080')
   ```

   Replace the placeholder locally. Do not paste AppSecret, database credentials, login codes, or session evidence into the Mini Program or its storage.
5. Relaunch the Mini Program on the phone and verify the configured origin from the same AppService Console if needed:

   ```js
   wx.getStorageSync('__dev_backend_origin_v1')
   ```

The resolver accepts an explicit HTTP origin only for RFC1918 private IPv4 or a private/local host with a port. It also accepts HTTPS origins. It rejects loopback, malformed values, credentials, and any path, query, or fragment. A changed DHCP address must be set again locally.

HTTP may still be blocked by WeChat request-domain/TLS policy. This source setting does not turn off URL validation or establish device reachability. Treat WeChat request policy, PC-to-phone network reachability, Backend bind, C5, MySQL, and Flyway as separate readiness checks. Do not change global WeChat security settings to make a request pass.

To clear the local development override on that Mini Program installation:

```js
wx.removeStorageSync('__dev_backend_origin_v1')
```

The origin is local runtime state and must not be added to Git or copied into shared project configuration. It is not a trial/release Backend setting.
