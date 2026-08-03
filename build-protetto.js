/* Build del sito per il deploy protetto:
 * incorpora payroll-engine.js dentro index.html e scrive dist/index.html,
 * pronto per la cifratura con StatiCrypt nel workflow GitHub Actions. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'payroll-engine.js'), 'utf8');

const tag = '<script src="payroll-engine.js"></script>';
if (!html.includes(tag)) {
  console.error('ERRORE: tag script del motore non trovato in index.html');
  process.exit(1);
}
const out = html.replace(tag, '<script>\n' + engine + '\n</script>');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), out);
console.log('dist/index.html generato (' + Math.round(out.length / 1024) + ' KB, motore incorporato)');
