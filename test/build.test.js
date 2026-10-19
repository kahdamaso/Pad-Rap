const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, buildSw } = require('../build.js');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('index.html e sw.js estão atualizados com src/ (rode npm run build)', () => {
  const html = build();
  assert.equal(read('index.html'), html);
  assert.equal(read('sw.js'), buildSw(html));
});

test('index.html não depende de arquivos locais', () => {
  const html = build();
  assert.doesNotMatch(html, /src="src\//);
  assert.doesNotMatch(html, /href="src\//);
});

test('arquivos do app instalável existem', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  manifest.icons.forEach((icon) => assert.ok(fs.existsSync(path.join(root, icon.src)), icon.src));
  const assets = read('src/sw.js').match(/const ASSETS = \[([\s\S]*?)\]/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assets.filter((a) => a !== './').forEach((a) => assert.ok(fs.existsSync(path.join(root, a)), a));
});
