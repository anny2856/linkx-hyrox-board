import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('dist',{recursive:true});
const html=readFileSync('web/index.html','utf8').replace('/*LINKX_STYLE*/',readFileSync('web/linkx.css','utf8'));
writeFileSync('dist/index.html',html);
console.log('Vercel build complete: dist/index.html (no .openai files required)');
