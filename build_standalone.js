const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const css = fs.readFileSync(path.join(baseDir, 'css', 'style.css'), 'utf-8');

const jsFiles = [
    'js/audio.js',
    'js/particles.js',
    'js/car.js',
    'js/track.js',
    'js/physics.js',
    'js/ai.js',
    'js/ui.js',
    'js/game.js'
];

let combinedJs = '';
for (const file of jsFiles) {
    combinedJs += `\n/* ==================== ${file} ==================== */\n`;
    combinedJs += fs.readFileSync(path.join(baseDir, file), 'utf-8') + '\n';
}

let html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf-8');

// Replace stylesheet link with inline <style>
html = html.replace('<link rel="stylesheet" href="css/style.css">', `<style>\n${css}\n</style>`);

// Replace local script tags with inline <script>
const scriptTagsRegex = /<!-- Game Scripts -->[\s\S]*?<\/body>/;
const inlineScripts = `<!-- Inlined Game Scripts for Rosebud AI Single-File Support -->
<script>
${combinedJs}
</script>
</body>`;

html = html.replace(scriptTagsRegex, inlineScripts);

fs.writeFileSync(path.join(baseDir, 'standalone.html'), html, 'utf-8');
console.log('Successfully generated standalone.html');
