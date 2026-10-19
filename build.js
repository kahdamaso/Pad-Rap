// Gera index.html autocontido (CSS e JS embutidos) a partir de src/.
// Assim o app abre com dois cliques, mesmo sem a pasta src/ ao lado.
const fs = require('fs');
const path = require('path');

const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

function build() {
  const safe = (code) => code.replace(/<\/script/gi, '<\\/script');
  return src('template.html')
    .replace('<link rel="stylesheet" href="src/styles.css">', () => `<style>\n${src('styles.css')}</style>`)
    .replace('<script src="src/game.js"></script>', () => `<script>\n${safe(src('game.js'))}</script>`)
    .replace('<script src="src/app.js"></script>', () => `<script>\n${safe(src('app.js'))}</script>`);
}

module.exports = build;

if (require.main === module) {
  fs.writeFileSync(path.join(__dirname, 'index.html'), build());
  console.log('index.html gerado.');
}
