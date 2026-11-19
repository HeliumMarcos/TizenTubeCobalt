# Web PO browser bundle

Build-only dependencies are pinned in `package-lock.json`. Rebuild with
`npm ci --ignore-scripts` and `npm run build` from this directory. Python's
`scripts/build_u_js.py` embeds the committed `scripts/web_po.min.js`, so normal
userscript generation does not require npm.

Source: [BgUtils 4.0.3](https://github.com/LuanRT/BgUtils), MIT license in
`LICENSE.bgutils-js.txt`. The wrapper executes only the interpreter returned by
the Google challenge endpoint, through a narrowly scoped Trusted Types policy
and a script element using the page nonce. It does not install a permissive
default policy or disable CSP.

The complete MIT notice is embedded in the generated bundle so it remains
present when a slim CDN branch distributes only `u.js`.

This dependency replaces diagnostic calls to private, minified YouTube player
functions, whose names change between player versions. Tokens, integrity
responses and authenticated streaming URLs must remain in browser memory.
