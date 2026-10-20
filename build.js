// Gera index.html autocontido (CSS e JS embutidos) e sw.js a partir de src/.
// Assim o app abre com dois cliques, mesmo sem a pasta src/ ao lado.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

function build() {
  const safe = (code) => code.replace(/<\/script/gi, '<\\/script');
  return src('template.html')
    .replace('<link rel="stylesheet" href="src/styles.css">', () => `<style>\n${src('styles.css')}</style>`)
    .replace(/<script src="src\/([\w-]+\.js)"><\/script>/g, (_, file) => `<script>\n${safe(src(file))}</script>`);
}

// O service worker muda de versão sempre que o app muda, para o celular baixar a atualização.
function buildSw(html) {
  const manifest = fs.readFileSync(path.join(__dirname, 'manifest.webmanifest'), 'utf8');
  const version = crypto.createHash('sha256').update(html).update(manifest).digest('hex').slice(0, 10);
  return src('sw.js').replace('__VERSION__', version);
}

module.exports = { build, buildSw };

if (require.main === module) {
  const html = build();
  fs.writeFileSync(path.join(__dirname, 'index.html'), html);
  fs.writeFileSync(path.join(__dirname, 'sw.js'), buildSw(html));
  console.log('index.html e sw.js gerados.');
}
