// Keep browser page zoom separate from the map's own pinch gestures.
const insideMap=target=>target instanceof Element&&!!target.closest('#map');
for(const type of ['gesturestart','gesturechange','gestureend'])document.addEventListener(type,event=>{if(!insideMap(event.target))event.preventDefault();},{passive:false});
for(const type of ['touchstart','touchmove'])document.addEventListener(type,event=>{if(event.touches.length>1&&!insideMap(event.target))event.preventDefault();},{passive:false});
document.addEventListener('wheel',event=>{if(event.ctrlKey&&!insideMap(event.target))event.preventDefault();},{passive:false});
