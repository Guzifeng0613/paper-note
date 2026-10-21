const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const m=[...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)];
let ok=true;
m.forEach((s,i)=>{
  fs.writeFileSync('_verify/_inline_'+i+'.js',s[1]);
});
console.log('inline scripts:',m.length);
