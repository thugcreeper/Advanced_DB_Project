const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});});
after(async()=>{await browser?.close();});
for(const [file,kind] of [['api.js','facility'],['statistics-api.js','statistics'],['cypher-api.js','cypher']]){
  for(const [label,origin,configured] of [['normal same origin','http://127.0.0.1:18080',''],['8010 has no special fallback','http://127.0.0.1:8010',''],['explicit api-base','http://127.0.0.1:8010','http://127.0.0.1:19111']]){
    test(`${file}: ${label}`,async()=>{
      const page=await browser.newPage();const requests=[];
      try{
        await page.route('**/*',route=>{
          const request=route.request(),url=new URL(request.url());
          if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:`<meta name="api-base" content="${configured}">`});
          if(url.pathname==='/api-connection.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../../shared/api-connection.js'),'utf8')});
          if(url.pathname==='/api/health')return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"status":"UP"}'});
          if(url.pathname==='/module.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../../shared',file),'utf8')});
          if(request.resourceType()==='fetch'&&request.method()!=='OPTIONS')requests.push(request.url());
          return route.fulfill({status:200,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Content-Type, Accept'},body:JSON.stringify(kind==='cypher'?{columns:[],rows:[]}:{ok:true})});
        });
        await page.goto(origin);
        await page.evaluate(async kind=>{
          const api=await import('/module.js');
          if(kind==='facility')await api.request('/api/ping');
          else if(kind==='statistics')await api.statisticsRequest('/api/ping');
          else await api.queryCypher('RETURN 1');
        },kind);
        assert.deepEqual(requests,[`${configured||origin}${kind==='cypher'?'/api/cypher/query':'/api/ping'}`]);
      }finally{await page.close();}
    });
  }
}
