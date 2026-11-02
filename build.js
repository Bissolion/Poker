// Junta o motor (engine.js) e a interface (src.html) num único arquivo jogável.
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const engine = fs.readFileSync(path.join(dir, 'engine.js'), 'utf8');
const src = fs.readFileSync(path.join(dir, 'src.html'), 'utf8');
fs.writeFileSync(path.join(dir, 'mesa-de-treino.html'), src.replace('/*ENGINE*/', () => engine));
console.log('mesa-de-treino.html gerado');
