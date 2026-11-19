import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
const license = (await readFile('LICENSE.bgutils-js.txt', 'utf8')).replace(/\r\n/g, '\n');
await build({
  entryPoints: ['entry.js'], bundle: true, format: 'iife', globalName: 'TTWebPo',
  platform: 'browser', target: 'es2020', minify: true, legalComments: 'inline',
  outfile: '../web_po.min.js',
  banner: {js: '/*! Third-party component: bgutils-js 4.0.3.\n' + license + '\n*/'}
});
