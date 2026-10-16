function displayValue(raw, key='') {
  if (raw==null || typeof raw==='object' || typeof raw==='boolean') return '未提供';
  if (typeof raw==='string') return ['undefined','null','[object Object]'].includes(raw)?'未提供':raw;
  if (!Number.isFinite(raw)) return '未提供';
  return new Intl.NumberFormat('zh-TW',{maximumFractionDigits:key==='area'?4:/Rate$/.test(key)?2:Number.isInteger(raw)?0:4}).format(raw);
}

// One lazy, top-level native dialog per result component. Opening it uses only
// the completed query snapshot; it never sends a request or changes filters.
function createDetailsDialog() {
  const id='statistics-'+crypto.randomUUID();
  const dialog=document.createElement('dialog');
  dialog.className='statistics-dialog'; dialog.setAttribute('role','dialog');
  dialog.setAttribute('aria-modal','true'); dialog.setAttribute('aria-labelledby',id+'-title');
  const header=document.createElement('div');header.className='statistics-dialog-header';
  const title=document.createElement('h2');title.id=id+'-title';
  const close=document.createElement('button');close.type='button';close.className='statistics-dialog-close';close.setAttribute('aria-label','關閉詳細資料');close.autofocus=true;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d','m6 6 12 12M6 18 18 6');svg.append(path);close.append(svg);header.append(title,close);
  const tabs=document.createElement('div');tabs.className='statistics-dialog-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','行政區詳細資料');
  const scroll=document.createElement('div');scroll.className='statistics-dialog-content';
  const tabButtons=[],panels=[];
  const definitions=[
    {key:'overview',label:'行政區概況',available:()=>true,render:renderOverview},
    {key:'departments',label:'科別統計',available:data=>data.departments.length>0,render:(panel,data)=>renderCounts(panel,data.departments,'科別',data.scope)},
    {key:'personnel',label:'醫事人員統計',available:data=>data.personnel.length>0,render:(panel,data)=>renderCounts(panel,data.personnel,'人員類別',data.scope)}
  ];
  function renderOverview(panel,data) {
    for(const group of data.overview){
      const section=document.createElement('section'),heading=document.createElement('h3'),list=document.createElement('dl');
      section.className='overview-group';heading.textContent=group.title;list.className='overview-items';
      for(const metric of group.items){const item=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd'),unit=document.createElement('dd');
        item.className='overview-item';item.dataset.metric=metric.key;label.textContent=metric.label;value.className='overview-value';value.textContent=displayValue(metric.value,metric.key);unit.className='overview-unit';unit.textContent=metric.unit;item.append(label,value,unit);list.append(item);}
      section.append(heading,list);panel.append(section);
    }
  }
  function renderCounts(panel,items,categoryLabel,scope){
    const note=document.createElement('p');note.className='statistics-dialog-note';note.textContent='統計範圍：'+({all:'醫院＋診所',hospital:'醫院',clinic:'診所'}[scope]||'醫院＋診所');panel.append(note);
    const table=document.createElement('table');table.className='category-statistics';const head=document.createElement('thead'),hr=document.createElement('tr'),body=document.createElement('tbody');
    for(const label of [categoryLabel,'醫院','診所','合計']){const th=document.createElement('th');th.scope='col';th.textContent=label;hr.append(th);}head.append(hr);
    for(const item of items){const tr=document.createElement('tr');for(const key of ['category','hospital','clinic','total']){const cell=document.createElement(key==='category'?'th':'td');if(key==='category')cell.scope='row';cell.textContent=displayValue(item[key]);tr.append(cell);}body.append(tr);}
    table.append(head,body);panel.append(table);
  }
  function buildTabs(data){
    tabs.replaceChildren();scroll.replaceChildren();tabButtons.length=0;panels.length=0;
    for(const definition of definitions.filter(def=>def.available(data))){
      const {key,label}=definition,button=document.createElement('button'),panel=document.createElement('section');
      button.type='button';button.id=id+'-'+key+'-tab';button.dataset.tab=key;button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls',id+'-'+key);
      panel.id=id+'-'+key;panel.dataset.panel=key;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;
      definition.render(panel,data);button.addEventListener('click',()=>select(key));tabButtons.push(button);panels.push(panel);tabs.append(button);scroll.append(panel);
    }
    select('overview');
  }
  function select(key, focus=false) {
    tabButtons.forEach((button,i)=>{const active=button.id===id+'-'+key+'-tab';button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;panels[i].hidden=!active;if(active&&focus)button.focus();});
    scroll.scrollTop=0;
  }
  tabs.addEventListener('keydown',event=>{
    const index=tabButtons.indexOf(document.activeElement);if(index<0)return;
    const count=tabButtons.length;
    const next=event.key==='Home'?0:event.key==='End'?count-1:event.key==='ArrowRight'?(index+1)%count:event.key==='ArrowLeft'?(index+count-1)%count:null;
    if(next==null)return;event.preventDefault();select(tabButtons[next].dataset.tab,true);
  });
  dialog.append(header,tabs,scroll);document.body.append(dialog);
  dialog.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]')]
      .filter(node=>node.tabIndex>=0&&node.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  let origin,previousStyles,backdropDown=false;
  close.addEventListener('click',()=>dialog.close());
  function outside(event){const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;}
  dialog.addEventListener('pointerdown',event=>{backdropDown=event.target===dialog&&outside(event);});
  dialog.addEventListener('click',event=>{if(backdropDown&&event.target===dialog&&outside(event))dialog.close();backdropDown=false;});
  dialog.addEventListener('close',()=>{
    if(previousStyles){document.documentElement.style.overflow=previousStyles.root;document.body.style.overflow=previousStyles.body;previousStyles=null;}
    origin?.isConnected&&origin.focus({preventScroll:true});
  });
  function open(data,trigger) {
    title.textContent=data.name; origin=trigger;
    buildTabs(data);
    previousStyles={root:document.documentElement.style.overflow,body:document.body.style.overflow};
    document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';
    try{dialog.showModal();close.focus();}catch(error){document.documentElement.style.overflow=previousStyles.root;document.body.style.overflow=previousStyles.body;previousStyles=null;throw error;}
  }
  return {open,close(){if(dialog.open)dialog.close();}};
}

export function initializeResults({body,count,empty,download,sortButtons=[],onSort=()=>{},head,numbered=true,columns=[
  {key:'name',label:'地區'},{key:'averageIncome',label:'平均所得（千元）'},
  {key:'hospitalCount',label:'醫院家數'},{key:'clinicCount',label:'診所家數'}
]}) {
  let rows=[],sortKey=null,ascending=true,detailsDialog;
  const value=(row,key)=>{const column=columns.find(c=>c.key===key);return column?.value?column.value(row):key==='name'?row.county+row.name:row[key];};
  function render() {
    body.replaceChildren();
    rows.forEach((row,index)=>{
      const tr=document.createElement('tr');tr.className='result-data-row';tr.classList.toggle('is-even',index%2===1);
      if(numbered){const cell=document.createElement('td');cell.textContent=index+1;tr.append(cell);}
      for(const column of columns) {
        const cell=document.createElement('td');
        if(column.details){const button=document.createElement('button');button.type='button';button.className='result-details-button';button.textContent='查看詳細資料';button.setAttribute('aria-label',row.county+row.name+'：查看詳細資料');button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',()=>{detailsDialog??=createDetailsDialog();detailsDialog.open(column.details(row),button);});cell.append(button);}
        else cell.textContent=displayValue(column.display?column.display(row):value(row,column.key),column.key);
        tr.append(cell);
      }
      body.append(tr);
    });
    count.textContent=rows.length;empty.hidden=rows.length!==0;download.disabled=rows.length===0;
  }
  function sort(){if(!sortKey)return;rows.sort((a,b)=>{const left=value(a,sortKey),right=value(b,sortKey);if(left==null)return right==null?0:1;if(right==null)return -1;return(typeof left==='number'?left-right:String(left).localeCompare(String(right),'zh-TW'))*(ascending?1:-1);});}
  function bindSort(buttons){buttons.forEach(button=>button.addEventListener('click',()=>{ascending=sortKey===button.dataset.sort?!ascending:true;sortKey=button.dataset.sort;(head?[...head.querySelectorAll('button')]:sortButtons).forEach(b=>b.parentElement.setAttribute('aria-sort',b===button?(ascending?'ascending':'descending'):'none'));sort();render();onSort(rows);}));}
  bindSort(sortButtons);
  function setColumns(next){detailsDialog?.close();columns=next;sortKey=null;if(head){const tr=document.createElement('tr');if(numbered){const th=document.createElement('th');th.textContent='#';tr.append(th);}for(const column of columns){const th=document.createElement('th');th.scope='col';if(column.details||column.sortable===false)th.textContent=column.label;else{const button=document.createElement('button');button.type='button';button.dataset.sort=column.key;button.textContent=column.label+' ↕';th.append(button);}tr.append(th);}head.replaceChildren(tr);bindSort([...head.querySelectorAll('button')]);}render();}
  download.addEventListener('click',()=>{
    if(!rows.length)return;
    const escape=raw=>{let text=raw==null||typeof raw==='object'||['undefined','null','[object Object]'].includes(raw)?'':String(raw);if(typeof raw==='string'&&/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
    const exported=columns.filter(c=>c.export!==false),lines=[exported.map(c=>c.label),...rows.map(row=>exported.map(c=>value(row,c.key)))];
    const blob=new Blob(['\uFEFF',lines.map(row=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='行政區統計查詢結果.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  return {setColumns,update(nextRows,{resetSort=false}={}){detailsDialog?.close();if(resetSort)sortKey=null;rows=[...nextRows];sort();render();return rows;}};
}
