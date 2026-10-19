const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const build = require('../build.js');

test('index.html está atualizado com src/ (rode npm run build)', () => {
  const current = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.equal(current, build());
});

test('index.html não depende de arquivos locais', () => {
  const html = build();
  assert.doesNotMatch(html, /src="src\//);
  assert.doesNotMatch(html, /href="src\//);
});
