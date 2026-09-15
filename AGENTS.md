# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Web preview URLs (required)

Do not verify web UI on localhost. Do not give the user a localhost URL.

When the work changes anything a browser would see (UI, layout, styling, routing, client state, or rendered data):

1. Run `npm run deploy:preview`. That exports the web build and uploads a Cloudflare Worker version. The alias comes from the current git branch, so the URL stays stable for that branch.
2. Copy the `PREVIEW_URL=` line from the command output. Ignore localhost and ignore `serve:web`.
3. Open that URL in the browser tools and exercise the changed flow there. If you fix something after that, run `npm run deploy:preview` again and re-check the same URL.
4. Put the preview URL in your final message so the user can open it.

`expo start --web` is fine while you iterate. It is not the finish line. Before you say the work is done, the preview must be deployed and checked.

Native iOS/Android work still uses the simulator or Expo Go. This rule is for web.

If Wrangler is not logged in or the upload fails, stop and tell the user. Do not fall back to localhost as completed verification.
