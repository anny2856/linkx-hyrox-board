import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
writeFileSync('dist/server/index.js',readFileSync('worker/app.js','utf8').replace("import {roster} from '../data/roster.js';",readFileSync('data/roster.js','utf8').replace('export const roster','const roster')).replace('/*HTML*/null',JSON.stringify(readFileSync('web/index.html','utf8').replace('/*LINKX_STYLE*/',readFileSync('web/linkx.css','utf8')))));
copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built dashboard Worker');
