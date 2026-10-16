import { initializeMap } from '../../shared/leaflet-map.js';

export function hasLocation(row) {
  return !row.locationReviewRequired && Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
    && row.latitude>=-90 && row.latitude<=90 && row.longitude>=-180 && row.longitude<=180;
}

export function initializeFacilityMap(elements,onSelect) {
  const markers=new Map();let rows=[],leafletApi;
  function open(row){controller.map?.closePopup();onSelect?.(row,markers.get(row.sourceId)?.getElement());}
  function choose(row) {
    const map=controller.map;if(!map)return;
    const point=map.latLngToContainerPoint([row.latitude,row.longitude]);
    const nearby=rows.filter(item=>point.distanceTo(map.latLngToContainerPoint([item.latitude,item.longitude]))<=14);
    if(nearby.length<2){open(row);return;}
    const content=document.createElement('div'),title=document.createElement('p'),list=document.createElement('div');
    content.className='marker-choice';title.textContent=`附近有 ${nearby.length} 間院所，請選擇`;list.className='marker-choice-list';
    nearby.slice(0,60).forEach(item=>{const button=document.createElement('button'),name=document.createElement('strong'),address=document.createElement('span');button.type='button';button.dataset.facilityId=item.sourceId;name.textContent=item.name;address.textContent=item.address||'地址未提供';button.append(name,address);button.addEventListener('click',event=>{event.stopPropagation();open(item);});list.append(button);});
    content.append(title,list);
    if(nearby.length>60){const hint=document.createElement('p');hint.textContent='顯示前 60 間，可放大地圖或由左側清單選取其他院所。';content.append(hint);}
    leafletApi.DomEvent.disableClickPropagation(content);leafletApi.DomEvent.disableScrollPropagation(content);
    leafletApi.popup({maxWidth:300,maxHeight:260,autoPanPadding:[20,20]}).setLatLng([row.latitude,row.longitude]).setContent(content).openOn(map);
  }
  const controller=initializeMap({...elements,maxZoom:15,createMarker(row,leaflet){
    leafletApi=leaflet;
    const marker=leaflet.circleMarker([row.latitude,row.longitude],{radius:7,color:'#fff',weight:1.5,fillOpacity:.95,fillColor:row.type.includes('醫院')?'#bf3446':'#178779'});
    markers.set(row.sourceId,marker);marker.bindTooltip(row.name,{direction:'top',opacity:1});
    marker.on('click',()=>choose(row));
    marker.on('add',()=>{const path=marker.getElement();if(!path)return;
      path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',`查看院所詳情：${row.name}`);path.setAttribute('aria-pressed','false');path.dataset.sourceId=row.sourceId;
      path.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();open(row);}});
    });return marker;
  }});
  return {
    get available(){return !!controller.map;},
    update(values){rows=values;markers.clear();controller.map?.closePopup();controller.update(values);},
    focusById(id){const map=controller.map,marker=markers.get(id);if(!map||!marker)return;map.panTo(marker.getLatLng(),{animate:false});},
    ensureVisible(id){
      const map=controller.map,marker=markers.get(id);if(!map||!marker)return;
      const box=elements.container.getBoundingClientRect(),drawer=document.getElementById('facilityDetail');
      let left=Math.max(0,-box.left),top=Math.max(0,-box.top),right=Math.max(0,box.right-innerWidth),bottom=Math.max(0,box.bottom-innerHeight);
      if(drawer&&!drawer.hidden){const panel=drawer.getBoundingClientRect();
        if(panel.right>box.left&&panel.left<box.right&&panel.bottom>box.top&&panel.top<box.bottom){
          if(matchMedia('(max-width:1100px)').matches)bottom=Math.max(bottom,box.bottom-panel.top);
          else right=Math.max(right,box.right-panel.left);
        }
      }
      left=Math.max(52,left+18);top=Math.max(20,top+18);right+=18;bottom+=18;
      if(box.width-left-right<50||box.height-top-bottom<50)return;
      map.panInside(marker.getLatLng(),{paddingTopLeft:[left,top],paddingBottomRight:[right,bottom],animate:false});
    },
    select(id){for(const [key,marker]of markers){const selected=key===id;marker.setStyle({radius:selected?11:7,color:selected?'#124fa3':'#fff',weight:selected?3:1.5});const path=marker.getElement();path?.setAttribute('aria-pressed',String(selected));path?.classList.toggle('is-selected-marker',selected);if(selected)marker.bringToFront();}}
  };
}
