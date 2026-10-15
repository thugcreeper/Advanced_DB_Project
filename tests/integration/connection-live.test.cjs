// Real sockets, static frontend + stopped/restarted Spring Boot. No Aura writes.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');
test('real backend outage/recovery and database failure remain separate', {timeout:90000}, async()=>{
  const root=path.resolve(__dirname,'../..'), base='http://127.0.0.1:18090';
  let backend,browser;
  const server=http.createServer((req,res)=>{
    const relative=new URL(req.url,'http://localhost').pathname;
    const target=path.resolve(root,'.'+relative);
    if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    try{
      let body=fs.readFileSync(target);
      const ext=path.extname(target);
      if(ext==='.html')body=body.toString('utf8').replace('name="api-base" content=""','name="api-base" content="'+base+'"');
      res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.png':'image/png'})[ext]||'application/octet-stream');res.end(body);
    }catch{res.writeHead(404).end();}
  });
  const start=()=>{
    backend=spawn(process.env.JAVA_EXE||'C:/Program Files/Java/jdk-17/bin/java.exe',['-jar',path.join(root,'backend/target/medical-resource-backend-0.0.1-SNAPSHOT.jar')],{
      // Run outside the source tree; environment injection must be sufficient.
      cwd:path.dirname(__filename),windowsHide:true,stdio:'ignore',
      env:{...process.env,PORT:'18090',SERVER_ADDRESS:'127.0.0.1',CORS_ALLOWED_ORIGINS:'http://127.0.0.1:19190',
        NEO4J_URI:'neo4j+s://unavailable.invalid',NEO4J_USERNAME:'neo4j',NEO4J_PASSWORD:'test-only-dummy',NEO4J_DATABASE:'neo4j'}
    });
  };
  const stop=async()=>{if(backend&&backend.exitCode===null){const exited=once(backend,'exit');backend.kill();await exited;}};
  try{
    await new Promise(resolve=>server.listen(19190,'127.0.0.1',resolve));
    browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto('http://127.0.0.1:19190/pages/district/index.html');
    await page.locator('.api-connection[data-state=checking]').waitFor({timeout:15000});
    assert.match(await page.locator('[role=status]').last().textContent(),/可能/);
    assert.equal(await page.locator('#map').count(),1);
    fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'artifacts/connection-real-waiting-mobile.png'),fullPage:true});
    start();
    await page.waitForFunction(()=>!document.getElementById('county').disabled,{},{timeout:45000});
    assert.equal(await page.locator('.api-connection:visible').count(),0);
    assert.equal((await fetch(base+'/api/health').then(r=>r.json())).status,'UP');
    const db=await fetch(base+'/api/facilities/departments');assert.equal(db.status,503);
    assert.equal((await db.json()).code,'DATABASE_UNAVAILABLE');
    await page.selectOption('#county','新竹市');
    await page.selectOption('#district','1205');
    // Stop the real backend, then issue a safe request through the actual shared helper.
    await stop();
    await page.evaluate(()=>{window.recovered=false;import('/shared/api.js').then(api=>api.request('/api/districts')).then(()=>window.recovered=true);});
    await page.locator('.api-connection[data-state=checking]').waitFor({timeout:30000});
    start();
    await page.waitForFunction(()=>window.recovered,{},{timeout:45000});
    assert.equal(await page.locator('#county').inputValue(),'新竹市');
    assert.equal(await page.locator('#district').inputValue(),'1205');
    assert.equal(await page.locator('.api-connection:visible').count(),0);
    fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'artifacts/connection-real-mobile.png'),fullPage:true});
  }finally{await stop();await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
