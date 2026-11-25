const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const dir=__dirname;const [,,out,...pages]=process.argv;
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.json':'application/json'};
const srv=http.createServer((q,s)=>{const p=decodeURIComponent(q.url.split('?')[0]);const f=path.join(dir,p==='/'?'mock.html':p);if(!fs.existsSync(f)){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);});
srv.listen(0,async()=>{const b=await chromium.launch();const errs=[];
for(const pgName of pages){const [name,scale]=pgName.split('@');const pg=await b.newPage({viewport:{width:1400,height:896},deviceScaleFactor:+(scale||1)});pg.on('pageerror',e=>errs.push(name+': '+e.message));
await pg.goto('http://127.0.0.1:'+srv.address().port+'/mock.html#'+name);await pg.waitForSelector('body[data-ready]',{timeout:15000}).catch(()=>errs.push(name+': not ready'));await pg.waitForTimeout(300);
await pg.screenshot({path:path.join(out,name+(scale>1?'@2x':'')+'.png')});await pg.close();}
console.log('ERR',errs);await b.close();srv.close();});
