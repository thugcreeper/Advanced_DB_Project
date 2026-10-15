import { showSnackbar } from '../../shared/snackbar.js';
import { request } from '../../shared/api.js';
import { createFacilityDetail } from '../district/facility-detail.js';
const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
const svg = $('graph');
let catalog=[], rows=[], expanded=new Set(), selected='', data=null, activeKey='', pendingKey='', selectedDepartment='';
let controller, generation=0, busy=false, failedMore=false, nodes=[], edges=[], view={x:0,y:0,w:1100,h:650}, drag, moved=false;
const MAX=36, BATCH=12;
const detail=createFacilityDetail({onClose(){},onLocate(){}});
// Graph exploration has no embedded map; the existing Google Maps action remains available.
$('detailLocate').hidden=true;
function el(tag, text, className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function shape(tag,attrs={},text){const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;return n;}
function criteria(){return new URLSearchParams({county:$('county').value,districtCode:$('district').value,type:$('facilityType').value,department:$('department').value}).toString();}
function feedback(state,title,text){
  if(['empty','error','cancelled'].includes(state))showSnackbar(title,{error:state==='error'});
  $('queryFeedback').dataset.state=state;$('feedbackTitle').textContent=title;$('feedbackText').textContent=text;
  $('showAllTypes').hidden=state!=='empty'||data?.type==='all';
  $('clearDepartment').hidden=state!=='empty'||!data?.department;$('feedbackRetry').hidden=state!=='error';$('feedbackCancel').hidden=state!=='loading';
}
function typeLabel(type){return {all:'院所',hospital:'醫院',clinic:'診所'}[type]||'院所';}
function emptyMessage(){const place=data.county+data.district,kind=typeLabel(data.type);return `目前資料中，${place}沒有符合${data.department?'「'+data.department+'」科別條件的':'條件的'}${kind}。`;}
function status(text,error=false){$('graphStatus').textContent=text;$('graphStatus').classList.toggle('is-error',error);}
function buttons(){
  busy=!!controller;$('graphViewport').setAttribute('aria-busy',String(busy));
  $('loadMore').hidden=!data||rows.length>=data.total||rows.length>=MAX||activeKey!==criteria();$('loadMore').disabled=busy;
  $('searchButton').disabled=!$('county').value||!$('district').value||busy;$('searchButton').textContent=busy?'查詢中…':'探索關係';$('cancelLoad').hidden=!busy;
  ['zoomIn','zoomOut','fitGraph','resetGraph','nodeSearch'].forEach(id=>$(id).disabled=!rows.length);
  $('clearSelection').disabled=!selected&&!$('nodeSearch').value;
}
function invalidate(){
  generation++;controller?.abort();controller=null;detail.close({restoreFocus:false});$('retrySearch').hidden=true;$('filterDepartment').hidden=true;buttons();
  if(data){status('條件已變更；按「探索關係」載入新結果。原圖保留供參考。');feedback('stale','條件已變更，尚未套用','下方仍是上一筆查詢結果，請按「探索關係」更新。');}
  else feedback('initial',$('district').value?'準備好探索了':'請選擇行政區',$('district').value?'按「探索關係」載入院所與科別。':'選擇縣市及行政區後再開始查詢。');
}
function districts(){const current=$('district').value,group=catalog.find(c=>c.name===$('county').value);$('district').replaceChildren(new Option('請選擇行政區',''),...(group?.districts||[]).map(d=>new Option(d.name,d.code)));$('district').value=group?.districts.some(d=>d.code===current)?current:'';$('district').disabled=!group;}
async function init(){
  $('retryCatalog').hidden=true;$('catalogStatus').textContent='載入查詢選項中…';
  const results=await Promise.allSettled([request('/api/districts'),request('/api/facilities/departments')]);
  let errors=[];
  if(results[0].status==='fulfilled'){
    const value=$('county').value;catalog=results[0].value;$('county').replaceChildren(new Option('請選擇縣市',''),...catalog.map(c=>new Option(c.name,c.name)));$('county').disabled=false;$('county').value=value;districts();
  }else errors.push('行政區選項載入失敗');
  if(results[1].status==='fulfilled'){
    const value=$('department').value;$('department').replaceChildren(new Option('不限科別',''),...results[1].value.map(d=>new Option(d,d)));$('department').value=value;$('department').disabled=false;
  }else errors.push('科別選項載入失敗，仍可查詢不限科別');
  $('catalogStatus').textContent=errors.join('；');if(errors.length)showSnackbar(errors.join('；'),{error:true});$('retryCatalog').hidden=!errors.length;buttons();
}
async function load(more=false){
  if(!$('graphForm').reportValidity())return;
  const key=criteria();if(more&&(key!==activeKey||rows.length>=MAX))return;
  controller?.abort();controller=new AbortController();const signal=controller.signal,token=++generation;pendingKey=key;failedMore=more;
  $('retrySearch').hidden=true;feedback('loading',more?'正在載入更多院所':'正在查詢關係',data?'查詢期間保留上一筆結果；完成後會自動更新。':'正在讀取院所與科別，請稍候。');if(!data){$('emptyTitle').textContent='正在載入關係資料';$('emptyText').textContent='查詢完成後會在這裡顯示結果。';}buttons();status(more?'正在載入更多院所，原圖保持顯示…':'正在查詢關係，原圖保持顯示…');
  try{
    const result=await request(`/api/graph/facilities?${key}&offset=${more?rows.length:0}&limit=${BATCH}`,{signal});
    if(token!==generation)return;
    if(!more){rows=[];expanded.clear();selected='';$('nodeSearch').value='';detail.close({restoreFocus:false});}
    const ids=new Set(rows.map(r=>r.sourceId));rows.push(...result.facilities.filter(r=>!ids.has(r.sourceId)));data=result;activeKey=key;
    if(!more){$('selectionTitle').textContent='選擇一間院所';$('selectionText').textContent='點選院所展開科別，或從文字清單開啟詳情。';$('filterDepartment').hidden=true;}
    render();if(!more)fit();if(result.total)showSnackbar(`已載入 ${rows.length} / ${result.total} 間符合院所。`);feedback(result.total?'ready':'empty',result.total?'查詢完成':emptyMessage(),result.total?`目前顯示 ${rows.length} / ${result.total} 間${typeLabel(result.type)}。點院所展開科別，或使用下方清單。`:(result.department?'可取消科別限制，或改查其他院所類型。':'可以改查全部院所、切換院所類型，或選擇其他行政區。'));status(result.total?`已顯示 ${rows.length} / ${result.total} 間符合院所${rows.length>=MAX&&result.total>MAX?'；已達圖形上限，請縮小篩選範圍':''}。`:'此條件沒有符合的院所。');
  }catch(error){if(error.name!=='AbortError'&&token===generation){status(error.message,true);feedback('error','資料載入失敗',`${error.message}。${data?'下方保留上一筆結果。':'目前尚未取得查詢結果。'}請使用圖下方的「重試查詢」。`);if(!data){$('emptyTitle').textContent='暫時無法載入資料';$('emptyText').textContent='這不是沒有院所；請稍後重試查詢。';}$('retrySearch').hidden=false;}}
  finally{if(token===generation){controller=null;buttons();}}
}
function setView(){svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);}
function fit(){const height=Math.max(560,...nodes.map(n=>n.y+65));const ratio=svg.clientWidth/Math.max(1,svg.clientHeight);view={x:-25,y:-30,w:1100,h:height+60};if(view.w/view.h<ratio){view.w=view.h*ratio;view.x=(1050-view.w)/2;}else view.h=view.w/ratio;setView();}
function zoom(factor){const w=Math.max(250,Math.min(6000,view.w*factor)),h=w*view.h/view.w;view={x:view.x+(view.w-w)/2,y:view.y+(view.h-h)/2,w,h};setView();}
function pick(node,trigger){
  selected=node.id;$('filterDepartment').hidden=true;
  if(node.kind==='facility'){
    expanded.add(node.row.sourceId);$('selectionTitle').textContent=node.label;$('selectionText').textContent=node.row.departments.length?`登錄 ${node.row.departments.length} 個科別；共用的科別會連到同一節點。`:'尚無科別資料，不代表未提供診療服務。';
    render();detail.open(node.row,trigger);
  }else if(node.kind==='department'){
    detail.close({restoreFocus:false});selectedDepartment=node.label;$('selectionTitle').textContent=node.label;
    const count=rows.filter(r=>r.departments.includes(node.label)).length;$('selectionText').textContent=`目前已載入的 ${rows.length} 間院所中，有 ${count} 間登錄此科別。此數量不是全區總數或官方統計。`;
    rows.filter(r=>r.departments.includes(node.label)).forEach(r=>expanded.add(r.sourceId));$('filterDepartment').hidden=false;render();
  }else{detail.close({restoreFocus:false});$('selectionTitle').textContent=node.label;$('selectionText').textContent=`此篩選共 ${data.total} 間院所，目前顯示 ${rows.length} 間。`;highlight();}
}
function drawLines(){for(const edge of edges){const a=nodes.find(n=>n.id===edge.from),b=nodes.find(n=>n.id===edge.to);edge.line.setAttribute('d',`M ${a.x+90} ${a.y} C ${a.x+190} ${a.y}, ${b.x-190} ${b.y}, ${b.x-90} ${b.y}`);}}
function highlight(){
  const neighbors=new Set([selected]);edges.filter(e=>e.from===selected||e.to===selected).forEach(e=>{neighbors.add(e.from);neighbors.add(e.to);});
  const term=$('nodeSearch').value.trim().toLocaleLowerCase();let matches=0;
  nodes.forEach(n=>{const match=!!term&&n.label.toLocaleLowerCase().includes(term);if(match)matches++;n.g.classList.toggle('search-match',match);n.g.classList.toggle('selected',n.id===selected);n.g.classList.toggle('dimmed',term?!match:!!selected&&!neighbors.has(n.id));});
  edges.forEach(e=>{const connected=e.from===selected||e.to===selected;e.line.classList.toggle('connected',connected);e.line.classList.toggle('dimmed',!!selected&&!connected);});
  $('nodeSearch').setAttribute('aria-label','尋找已載入節點');$('nodeSearchStatus').textContent=term?(matches?`已載入節點中有 ${matches} 個符合`:'已載入節點沒有符合名稱；可清除搜尋或載入更多院所。'):'';$('clearSelection').disabled=!selected&&!term;
}
function render(){
  svg.replaceChildren(shape('title',{},'行政區透過 HAS_FACILITY 連到院所；展開院所透過 HAS_DEPARTMENT 連到科別。'));nodes=[];edges=[];
  $('emptyGraph').hidden=rows.length>0;svg.toggleAttribute('hidden',!rows.length);$('listEmpty').hidden=!!rows.length;if(data){$('resultScope').textContent=`${data.county}${data.district} · ${typeLabel(data.type)}${data.department?' · '+data.department:''}`;}
  if(!data||!rows.length){$('facilityList').replaceChildren();$('listCount').textContent='0 間';if(data){$('emptyTitle').textContent=emptyMessage();$('emptyText').textContent='查詢已完成，沒有符合的院所，因此沒有關係圖可顯示。請調整上方條件。';$('listEmpty').textContent='沒有符合這次查詢條件的院所。';$('selectionTitle').textContent='沒有可選取的院所';$('selectionText').textContent='可改查全部院所、取消科別限制，或選擇其他行政區。';}$('nodeSearchStatus').textContent='';return;}
  const names=[...new Set(rows.filter(r=>expanded.has(r.sourceId)).flatMap(r=>r.departments))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
  const height=Math.max(rows.length*44,names.length*65,480);
  nodes.push({id:'district',label:data.county+data.district,kind:'district',x:110,y:height/2});
  rows.forEach((row,i)=>nodes.push({id:'f:'+row.sourceId,label:row.name,kind:'facility',row,x:515,y:55+i*44}));
  names.forEach((name,i)=>nodes.push({id:'d:'+name,label:name,kind:'department',x:980,y:55+i*65}));
  const defs=shape('defs'),marker=shape('marker',{id:'graphArrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto'});marker.append(shape('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#8da7bd'}));defs.append(marker);svg.append(defs);
  const addEdge=(from,to)=>{const line=shape('path',{class:'edge','marker-end':'url(#graphArrow)'});svg.append(line);edges.push({from,to,line});};
  rows.forEach(r=>{addEdge('district','f:'+r.sourceId);if(expanded.has(r.sourceId))r.departments.forEach(name=>addEdge('f:'+r.sourceId,'d:'+name));});
  svg.append(shape('text',{x:270,y:25,class:'edge-label'},'包含院所 · HAS_FACILITY'));
  if(names.length)svg.append(shape('text',{x:655,y:25,class:'edge-label'},'設有科別 · HAS_DEPARTMENT'));
  for(const n of nodes){
    n.g=shape('g',{class:`node ${n.kind}`,transform:`translate(${n.x} ${n.y})`,tabindex:'0',role:'button','aria-label':`${n.label}，${n.kind==='facility'?'展開科別及院所詳情':n.kind==='department'?'顯示相連院所':'顯示行政區摘要'}`,'data-node-id':n.id});
    n.g.append(shape('rect',{x:-90,y:n.kind==='facility'?-18:-23,width:180,height:n.kind==='facility'?36:46}),shape('title',{},n.label));
    const label=n.label.length>12?n.label.slice(0,11)+'…':n.label;n.g.append(shape('text',{'text-anchor':'middle',y:5},label));
    n.g.addEventListener('click',e=>{if(!moved)pick(n,e.currentTarget);});n.g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(n,e.currentTarget);}});svg.append(n.g);
  }
  drawLines();highlight();renderList();
}
function renderList(){
  $('listCount').textContent=`${rows.length} 間`;$('facilityList').replaceChildren(...rows.map(row=>{
    const li=el('li'),info=el('div'),open=el('button',row.name,'facility-title');open.type='button';open.addEventListener('click',()=>pick(nodes.find(n=>n.id==='f:'+row.sourceId),open));info.append(open,el('p',`${row.type} · ${row.departments.length} 個登錄科別`,'facility-meta'));
    const expand=el('button',!row.departments.length?'尚無科別資料':expanded.has(row.sourceId)?'收合科別':'展開科別','secondary facility-expand');expand.type='button';expand.setAttribute('aria-expanded',String(expanded.has(row.sourceId)));expand.disabled=!row.departments.length;
    expand.addEventListener('click',()=>{expanded.has(row.sourceId)?expanded.delete(row.sourceId):expanded.add(row.sourceId);selected='';render();fit();[...$('facilityList').children][rows.indexOf(row)]?.querySelector('.facility-expand')?.focus({preventScroll:true});});li.append(info,expand);return li;
  }));
}
function point(event){return new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());}
svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;const target=e.target.closest('[data-node-id]');drag={pointer:e.pointerId,node:nodes.find(n=>n.id===target?.dataset.nodeId),p:point(e),view:{...view},clientX:e.clientX,clientY:e.clientY};moved=false;(target||svg).setPointerCapture(e.pointerId);});
svg.addEventListener('pointermove',e=>{if(!drag||drag.pointer!==e.pointerId)return;if(Math.hypot(e.clientX-drag.clientX,e.clientY-drag.clientY)>4)moved=true;if(!moved)return;const p=point(e);if(drag.node){drag.node.x+=p.x-drag.p.x;drag.node.y+=p.y-drag.p.y;drag.p=p;drag.node.g.setAttribute('transform',`translate(${drag.node.x} ${drag.node.y})`);drawLines();}else{view.x=drag.view.x-(e.clientX-drag.clientX)*view.w/svg.clientWidth;view.y=drag.view.y-(e.clientY-drag.clientY)*view.h/svg.clientHeight;setView();}});
svg.addEventListener('pointerup',e=>{if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);drag=null;setTimeout(()=>{moved=false;},0);});svg.addEventListener('pointercancel',()=>{drag=null;moved=false;});
$('graphForm').addEventListener('submit',e=>{e.preventDefault();load();});$('county').addEventListener('change',()=>{districts();invalidate();});['district','facilityType','department'].forEach(id=>$(id).addEventListener('change',invalidate));
$('loadMore').addEventListener('click',()=>load(true));$('retrySearch').addEventListener('click',()=>{if(criteria()===pendingKey)load(failedMore);});$('retryCatalog').addEventListener('click',init);
$('zoomIn').addEventListener('click',()=>zoom(.8));$('zoomOut').addEventListener('click',()=>zoom(1.25));$('fitGraph').addEventListener('click',fit);$('resetGraph').addEventListener('click',()=>{expanded.clear();selected='';$('nodeSearch').value='';$('filterDepartment').hidden=true;$('selectionTitle').textContent='選擇一間院所';$('selectionText').textContent='已收合所有科別，可重新選擇院所展開。';render();fit();});$('nodeSearch').addEventListener('input',highlight);$('clearSelection').addEventListener('click',()=>{selected='';$('nodeSearch').value='';highlight();$('selectionTitle').textContent='選擇一間院所';$('selectionText').textContent='高亮已清除，可繼續探索其他院所或科別。';$('filterDepartment').hidden=true;});
$('filterDepartment').addEventListener('click',()=>{$('department').value=selectedDepartment;invalidate();load();});
const cancel=el('button','取消載入','secondary');cancel.id='cancelLoad';cancel.type='button';cancel.hidden=true;$('graphStatus').after(cancel);cancel.addEventListener('click',()=>{invalidate();status('已取消載入，保留原有關係圖。');feedback('cancelled','已取消這次載入',data?'原有查詢結果保持不變，可再次按「探索關係」。':'尚未載入結果，可再次按「探索關係」。');if(!data){$('emptyTitle').textContent='載入已取消';$('emptyText').textContent='按「探索關係」重新查詢。';}});
$('feedbackRetry').addEventListener('click',()=>{if(criteria()===pendingKey)load(failedMore);});$('feedbackCancel').addEventListener('click',()=>$('cancelLoad').click());
$('showAllTypes').addEventListener('click',()=>{$('facilityType').value='all';invalidate();load();});$('clearDepartment').addEventListener('click',()=>{$('department').value='';invalidate();load();});
$('aboutButton').addEventListener('click',()=>$('aboutDialog').showModal());['schemaButton','schemaInline'].forEach(id=>$(id).addEventListener('click',()=>$('schemaDialog').showModal()));
window.addEventListener('pagehide',()=>{generation++;controller?.abort();detail.close({restoreFocus:false});});buttons();init();
