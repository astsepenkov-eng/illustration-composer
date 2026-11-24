const subjects = [
  ['Книга', 'книг учеб учёб учебник чтени чита образован знани библиотек литератур обуч курс book'],
  ['Телефон', 'телефон смартфон мобиль приложени звон связ экран сообщени чат онлайн карман phone'],
  ['Пазлы', 'пазл головоломк част собрат решени задач совмест команд puzzle'],
  ['Монета', 'монет деньг финансов бюджет оплат копейк накоп цен эконом инвест coin'],
  ['Папка', 'папк документ архив файл организац порядок folder'],
  ['Ручка', 'ручк писал письм заметк текст автор почерк pen'],
  ['Кошелек', 'кошел кошёл покупк сохран сбереж оплат бюджет wallet'],
  ['Лампа', 'ламп свет озар иде креатив придумыва вдохнов открыти творчеств lamp'],
  ['Наушники', 'наушник звук музык слуша аудио подкаст тишин headphone'],
  ['Растение', 'растени цветок цветы букет рост растё развива природ сад уход plant']
];
const schemes = [
  {name:'Сиреневая',canvas:'#D7CDF5',background:['#D7CDF5','#B3A2F0','#9884E7','#7864D7'],objects:['#F9ECB0','#FFE3E1','#F9A3AA','#E27687']},
  {name:'Персиковая',canvas:'#FFD9BD',background:['#FFD9BD','#FFC196','#EF9C62','#CD743C'],objects:['#D5F4F0','#B1E9E4','#72D5CD','#43AFA8']},
  {name:'Бирюзовая',canvas:'#BCEBE9',background:['#BCEBE9','#94DCD8','#69C7C1','#469F9A'],objects:['#FCE0EF','#F6BCE0','#929AF8','#636CED']}
];
const formats = {square:[1000,1000],wide:[1200,630],vertical:[700,1050]};
const slot = (name,size,role) => [name,size,role].join('|');
const normalize = value => String(value).toLowerCase().replace(/ё/g,'е');
const aliases = {'пазл':'Пазлы','головоломка':'Пазлы','цветы':'Растение','цветок':'Растение','букет':'Растение','смартфон':'Телефон','мобильник':'Телефон','светильник':'Лампа','копейка':'Монета'};
const subjectName = name => subjects.find(([label]) => normalize(label) === normalize(name))?.[0] || aliases[normalize(name)];
const sourceGroupNames = {
  'Group 2136136344':'Растение', 'Group 2136136347':'Растение',
  'Group 2136136345':'Растение', 'Group 2136136346':'Растение',
  'Group 2136136336':'Папка', 'Group 2136136342':'Папка',
  'Group 2136136337':'Ручка', 'Group 2136136343':'Ручка'
};
const rgb = hex => ({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255});
const solid = hex => [{type:'SOLID',color:rgb(hex)}];
const toHex = c => '#'+[c.r,c.g,c.b].map(n=>Math.round(n*255).toString(16).padStart(2,'0')).join('');
const lum = c => .2126*c.r+.7152*c.g+.0722*c.b;
const chroma = c => Math.max(c.r,c.g,c.b)-Math.min(c.r,c.g,c.b);
const distance = (a,b) => (a.r-b.r)**2+(a.g-b.g)**2+(a.b-b.b)**2;
const box = node => node.absoluteBoundingBox || {x:node.x,y:node.y,width:node.width,height:node.height};
const isContainer = node => ['GROUP','FRAME','COMPONENT','INSTANCE'].includes(node.type);
function walk(node, visit) {
  visit(node);
  if ('children' in node) for (const child of node.children) walk(child,visit);
}
function readLibraryPalettes(section, mainY) {
  const columns=[];
  const paints=[];
  walk(section,node=>{
    if (node.visible===false || node===section) return;
    const b=box(node);
    if (!(b.width>0 && b.height>0 && b.y<mainY)) return;
    if (node.type==='TEXT') {
      const label=normalize(node.characters.trim());
      if (label==='цвета фона' || label==='цвета объектов')
        columns.push({...b,role:label.endsWith('фона')?'background':'objects'});
      return;
    }
    if (!Array.isArray(node.fills)) return;
    const visible=node.fills.filter(p=>p.visible!==false);
    if (visible.length===1 && visible[0].type==='SOLID' && (visible[0].opacity??1)===1)
      paints.push({...b,color:toHex(visible[0].color).toUpperCase()});
  });
  columns.sort((a,b)=>a.x-b.x);
  if (columns.length!==6) return null;
  const results=[];
  for (let i=0;i<columns.length;i+=2) {
    const left=columns[i], right=columns[i+1];
    if (left.role!=='background' || right.role!=='objects') return null;
    const gap=right.x-left.x;
    function swatches(label) {
      const candidates=paints.filter(p=>p.y>=label.y && p.width/p.height>=1.5 &&
        p.width>gap*.45 && p.width<gap*1.5 && Math.abs(p.x-label.x)<gap*.4);
      for (const first of candidates.sort((a,b)=>a.y-b.y)) {
        const aligned=candidates.filter(p=>Math.abs(p.width-first.width)<gap*.1 && Math.abs(p.x-first.x)<gap*.1);
        const rows=aligned.filter((p,index)=>aligned.findIndex(other=>Math.abs(other.y-p.y)<1)===index);
        if (rows.length===4) return rows.map(p=>p.color);
      }
      return null;
    }
    const background=swatches(left), objects=swatches(right);
    if (!background || !objects) return null;
    results.push({name:schemes[i/2].name,canvas:background[0],background,objects});
  }
  return results;
}
function validatePalette(value) {
  const validHex = hex => typeof hex === 'string' && /^#[\da-f]{6}$/i.test(hex);
  if (!value || typeof value.name !== 'string' || !value.name.trim() || !validHex(value.canvas) ||
      !['background','objects'].every(key=>Array.isArray(value[key]) && value[key].length===4 && value[key].every(validHex))) {
    throw Error('Палитре нужны name, canvas и по четыре HEX-цвета в background и objects. Порядок от светлого к тёмному.');
  }
  return value;
}
function indexLibrary(page) {
  const variants = new Map();
  const issues = [];
  const sections = {};
  const names = new Set(subjects.map(([name])=>name));
  let palettes;
  for (const size of ['L','S']) {
    const section = page.findOne(node=>node.type==='SECTION' && normalize(node.name).trim()===normalize('Размер '+size));
    if (!section) { issues.push('Не найдена секция «Размер '+size+'».'); continue; }
    sections[size]=section;
    const mainLabel = section.findOne(n=>n.type==='TEXT' && /^главные объекты$/i.test(n.characters.trim()));
    const backLabel = section.findOne(n=>n.type==='TEXT' && /^фоновые объекты$/i.test(n.characters.trim()));
    if (!mainLabel || !backLabel) { issues.push(size+': отсутствуют подписи ролей.'); continue; }
    const mainY = box(mainLabel).y;
    palettes ||= readLibraryPalettes(section,mainY);
    const backgroundY = box(backLabel).y;
    const pending = [];
    for (const node of section.children) {
      const imported=node.getPluginData?.('catalogItem');
      if (imported) {
        const {name,role}=JSON.parse(imported);
        names.add(name);
        const key=slot(name,size,role);
        if (variants.has(key)) issues.push('Дубликат '+key+' ('+node.name+').');
        else variants.set(key,node);
        continue;
      }
      const bounds = box(node);
      if (!node.visible || !isContainer(node) || bounds.y < mainY || /^фон$/i.test(node.name)) continue;
      const role = bounds.y >= backgroundY ? 'background' : 'main';
      let name = subjectName(node.name) || sourceGroupNames[node.name];
      if (!name) {
        const names = new Set();
        walk(node, child => { const label = subjectName(child.name); if (label) names.add(label); });
        if (names.size === 1) name = [...names][0];
      }
      if (!name) { pending.push({node,role}); continue; }
      const key = slot(name,size,role);
      if (variants.has(key)) { issues.push('Дубликат '+key+' ('+node.name+').'); continue; }
      variants.set(key,node);
    }
    // Match renamed counterparts only when there is a single candidate of the same dimensions.
    for (const {node,role} of pending) {
      const other = role === 'main' ? 'background' : 'main';
      const bounds = box(node);
      const candidates = subjects.filter(([name])=>{
        const counterpart = variants.get(slot(name,size,other));
        if (!counterpart || variants.has(slot(name,size,role))) return false;
        const match = box(counterpart);
        return Math.abs(match.width-bounds.width)<1 && Math.abs(match.height-bounds.height)<1;
      });
      if (candidates.length===1) variants.set(slot(candidates[0][0],size,role),node);
      else issues.push(size+' · '+role+' · '+node.name+' ['+node.id+'] — неизвестный объект.');
    }
  }
  for (const [name] of subjects) {
    for (const size of ['L','S']) for (const role of ['main','background'])
      if (!variants.has(slot(name,size,role))) issues.push('Нет пары: '+slot(name,size,role));
  }
  return {variants,issues,palettes,sections,names:[...names]};
}
function resolveName(value,available) {
  const known=subjectName(value);
  return available.find(name=>normalize(name)===normalize(value))||available.find(name=>name===known);
}
function matchQuery(query, mode, available) {
  const value = normalize(query.trim());
  if (!value) throw Error('Введите названия предметов, заголовок или метафору.');
  if (mode==='names') {
    const names = value.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
    const unknown = names.filter(n=>!resolveName(n,available));
    if (unknown.length) throw Error('Недоступны в этом размере: '+unknown.join(', ')+'.');
    if (names.length>6) throw Error('В одном запросе можно указать до шести предметов.');
    return names.map(name=>resolveName(name,available));
  }
  const words = value.match(/[\p{L}\p{N}]+/gu) || [];
  const knownOrder=subjects.map(([name])=>name);
  const ordered=[...knownOrder.filter(name=>available.includes(name)),...available.filter(name=>!knownOrder.includes(name))];
  const ranking = ordered.map(name=>{
    const tags=subjects.find(([label])=>label===name)?.[1];
    const stems = tags?normalize(tags).split(' '):[];
    const score = words.reduce((sum,word)=>sum+(word===normalize(name)?3:stems.some(stem=>word.startsWith(stem))?1:0),0)
      +(normalize(name).includes(' ') && value.includes(normalize(name))?3:0);
    return {name,score};
  }).filter(item=>item.score).sort((a,b)=>b.score-a.score);
  if (!ranking.length) throw Error('Подходящие предметы не найдены. Добавьте смысловую подсказку или укажите названия.');
  return ranking.slice(0,3).map(item=>item.name);
}
function recolor(node, role, palette, source=schemes[0]) {
  if (!palette) return;
  const sourceColors = [...source.background,...source.objects].map(rgb);
  function remap(color) {
    if (role==='background') {
      const index = sourceColors.slice(0,4).reduce((best,c,i)=>distance(c,color)<distance(sourceColors[best],color)?i:best,0);
      return rgb(palette.background[index]);
    }
    if (chroma(color)<.04 && (lum(color)>.92 || lum(color)<.15)) return color;
    const nearest = sourceColors.reduce((best,c,i)=>distance(c,color)<distance(sourceColors[best],color)?i:best,0);
    return nearest<4 ? rgb(palette.background[nearest]) : rgb(palette.objects[nearest-4]);
  }
  function change(paint) {
    if (!paint.visible && paint.visible!==undefined) return paint;
    if (paint.type==='IMAGE') throw Error('Обнаружена растровая заливка. Нужен исходный вектор.');
    if (paint.type==='SOLID') {
      const {boundVariables,...editable} = paint;
      return {...editable,color:remap(paint.color)};
    }
    if (paint.type.startsWith('GRADIENT_')) {
      return {...paint,gradientStops:paint.gradientStops.map(({boundVariables,...stop})=>({...stop,color:{...remap(stop.color),a:stop.color.a}}))};
    }
    if (role==='background') throw Error('Фоновый элемент содержит неподдерживаемую заливку: '+paint.type);
    return paint;
  }
  walk(node,child=>{
    for (const key of ['fills','strokes']) if (Array.isArray(child[key]) && child[key].length && child.type!=='GROUP')
      child[key]=child[key].map(change);
    if (Array.isArray(child.effects) && child.effects.some(effect=>effect.color)) {
      child.effects=child.effects.map(effect=>effect.color?{...effect,color:{...remap(effect.color),a:effect.color.a}}:effect);
    }
  });
}
const sceneRelations = [
  ['Книга','Телефон',.41,-.16],
  ['Телефон','Пазлы',.48,-.35],
  ['Книга','Пазлы',.30,-.69],
  ['Папка','Кошелек',-.43,.37],
  ['Кошелек','Монета',.56,.39],
  ['Папка','Монета',.58,.88],
  ['Книга','Ручка',-.52,.91],
  ['Лампа','Книга',.65,.60],
  ['Лампа','Телефон',-.45,.52],
  ['Телефон','Ручка',.64,.42],
  ['Лампа','Ручка',.46,.79],
  ['Наушники','Растение',-.71,-.63]
];
// Offsets between subject centres in wide, square and portrait frames.
const referenceScenes = [
  {names:['Наушники','Растение','Пазлы','Монета'], offsets:[
    [[-.77,-.47],[.79,.26],[-.68,.60]],
    [[-.61,-.67],[.64,.40],[-.51,.72]],
    [[.25,-.81],[-.45,.71],[.53,.64]]
  ], edges:[null,null,null]},
  {names:['Наушники','Растение','Телефон'], offsets:[
    [[-.77,-.47],[.75,.48]],
    [[-.68,-.67],[.48,.88]],
    [[.25,-.81],[-.43,.82]]
  ], edges:[null,null,null], squareFocus:true},
  {names:['Книга','Телефон'], offsets:[[.55,-.34],[.38,-.19],[.57,-.14]], edges:['left','left','left']},
  {names:['Книга','Пазлы','Ручка'], offsets:[[[-.05,-.37],[-.70,.69]],[[-.14,-.40],[-.48,.85]],[[-.23,-.02],[-.43,.98]]], edges:['right','right','right']},
  {names:['Папка','Кошелек','Монета'], offsets:[[[-.79,.61],[-.36,.88]],[[-.75,.64],[-.24,.96]],[[-.56,.76],[-.02,1.07]]], edges:['top','right','right']},
  {names:['Наушники','Растение'], offsets:[[-.82,-.51],[-.61,-.67],[.25,-.81]], edges:['bottom','right','top']},
  {names:['Лампа','Кошелек','Монета'], offsets:[[[.42,.73],[.93,.46]],[[.26,.86],[.86,.50]],[[.17,1.02],[.76,.58]]], edges:['top','top','top']},
  {names:['Телефон','Пазлы'], offsets:[[1.05,-.38],[.56,-1.04],[.43,-1.03]], edges:[null,null,'left']}
];
function layout(items,width,height,roles=[],names=[]) {
  const entries=items.map(({width:w,height:h},i)=>({i,w:Math.max(w,1),h:Math.max(h,1)}));
  if (!entries.length) return [];
  const format=width>height?0:width===height?1:2;
  const wide=format===0;
  const reference=referenceScenes.find(scene=>scene.names.every(name=>names.includes(name)));
  const relations=sceneRelations.map(([first,second,x,y])=>({
    first:names.indexOf(first),second:names.indexOf(second),x,y
  })).filter(({first,second})=>first>=0 && second>=0);
  const area=item=>item.w*item.h;
  const bySize=[...entries].sort((a,b)=>area(b)-area(a));
  const anchor=reference?entries[names.indexOf(reference.names[0])]:
    relations.length?entries[relations[0].first]:bySize.find(item=>roles[item.i]!=='background')||bySize[0];
  const mainItems=entries.filter(item=>roles[item.i]==='main');
  const focus=mainItems.length===1?mainItems[0]:null;
  const placed=new Map([[anchor.i,{...anchor,x:-anchor.w/2,y:-anchor.h/2}]]);
  function beside(item,base,dx,dy) {
    return {...item,x:base.x+(base.w-item.w)/2+dx*(base.w+item.w)/2,
      y:base.y+(base.h-item.h)/2+dy*(base.h+item.h)/2};
  }
  function bounds(rectangles) {
    const x=Math.min(...rectangles.map(r=>r.x)),y=Math.min(...rectangles.map(r=>r.y));
    return {x,y,w:Math.max(...rectangles.map(r=>r.x+r.w))-x,h:Math.max(...rectangles.map(r=>r.y+r.h))-y};
  }
  function overlap(a,b) {
    return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*
      Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y))/Math.min(area(a),area(b));
  }
  if (reference) {
    const offsets=reference.offsets[format];
    const pairs=reference.names.length===2?[offsets]:offsets;
    reference.names.slice(1).forEach((name,i)=>{
      const index=names.indexOf(name);
      placed.set(index,beside(entries[index],placed.get(anchor.i),...pairs[i]));
    });
  }
  const directions=wide
    ?[[.84,.24],[-.84,-.24],[.84,-.30],[-.84,.30],[1,.12],[-1,-.12],
      [.48,.67],[-.48,-.67],[.48,-.67],[-.48,.67]]
    :height>width
      ?[[.44,.74],[-.44,-.75],[-.47,.76],[.48,-.77],[.72,.36],[-.73,-.36]]
      :[[.68,.57],[-.59,-.68],[-.65,.64],[.62,-.68],[.20,.77],[-.24,-.79]];
  while (placed.size<entries.length) {
    const existing=[...placed.values()];
    let linked;
    for (const {first,second,x,y} of relations) {
      if (placed.has(first)===placed.has(second)) continue;
      const reverse=placed.has(second);
      const base=placed.get(reverse?second:first);
      const direction=reverse?-1:1;
      const candidate=beside(entries[reverse?first:second],base,
        x*direction*(height>width?.84:1),y*direction);
      if (existing.every(other=>other===base||
          overlap(candidate,other)<(roles[other.i]==='background'&&roles[candidate.i]!=='background'?.62:.32))) {
        linked=candidate;
        break;
      }
    }
    if (linked) { placed.set(linked.i,linked); continue; }
    const item=bySize.find(entry=>!placed.has(entry.i));
    let best,bestScore=Infinity;
    for (const base of existing) for (const [dx,dy] of directions) {
      const candidate=beside(item,base,dx,dy);
      const extents=bounds([...existing,candidate]);
      const crowding=existing.reduce((sum,other)=>sum+Math.max(0,overlap(candidate,other)-(other===base?.30:.15)),0);
      const aspectPenalty=wide?Math.abs(Math.log((extents.w/extents.h)/(width/height))):0;
      const centerDrift=focus && placed.has(focus.i)
        ?Math.abs(placed.get(focus.i).x+focus.w/2-extents.x-extents.w/2)/extents.w:0;
      const score=Math.max(extents.w/width,extents.h/height)*(1+10*crowding+1.5*aspectPenalty+1.3*centerDrift);
      if (score<bestScore) {best=candidate;bestScore=score;}
    }
    placed.set(item.i,best);
  }
  const rectangles=[...placed.values()];
  let scene=bounds(rectangles);
  let cropEdge;
  if (reference && reference.names.length===rectangles.length) {
    cropEdge=reference.edges[format];
    const framingItem=placed.get(reference.names[0]==='Наушники' && format===2?
      names.indexOf('Растение'):anchor.i);
    const horizontal=cropEdge==='left'||cropEdge==='right';
    if (cropEdge) {
      const crop=horizontal?framingItem.w*.24:framingItem.h*.31;
      if (cropEdge==='left') scene.x+=crop;
      if (cropEdge==='top') scene.y+=crop;
      if (horizontal) scene.w-=crop;
      else scene.h-=crop;
    }
    if (reference.names[0]==='Книга' && reference.names[1]==='Телефон' &&
        format===2 && items[anchor.i].width>items[names.indexOf('Телефон')].width) {
      // Keep the page and the phone together in the narrow crop.
      const phone=placed.get(names.indexOf('Телефон'));
      scene.w=Math.min(scene.w,phone.x+phone.w*.87-scene.x);
    }
  } else if (rectangles.length>=2 && names.some(Boolean)) {
    const framingSubject=rectangles.find(item=>item.i===anchor.i);
    const others=bounds(rectangles.filter(item=>item!==framingSubject));
    const candidates=[
      {edge:'left',amount:Math.min(framingSubject.w*.22,others.x-scene.x),axis:width},
      {edge:'right',amount:Math.min(framingSubject.w*.22,scene.x+scene.w-others.x-others.w),axis:width},
      {edge:'top',amount:Math.min(framingSubject.h*.20,others.y-scene.y),axis:height},
      {edge:'bottom',amount:Math.min(framingSubject.h*.20,scene.y+scene.h-others.y-others.h),axis:height}
    ];
    const crop=candidates.sort((a,b)=>b.amount/b.axis-a.amount/a.axis)[0];
    // Wide scenes should only bleed sideways when their content reaches the opposite side.
    const canFillWidth=(scene.w-crop.amount)*height*.95>=width*scene.h;
    if (crop.amount>0 && (!focus || framingSubject.i!==focus.i) &&
        (!wide || crop.axis===height || canFillWidth)) {
      cropEdge=crop.edge;
      if (cropEdge==='left' || cropEdge==='right') {
        scene.w-=crop.amount;
        if (cropEdge==='left') scene.x+=crop.amount;
      } else {
        scene.h-=crop.amount;
        if (cropEdge==='top') scene.y+=crop.amount;
      }
    }
  }
  const fillWidth=cropEdge==='left'||cropEdge==='right';
  const fillHeight=cropEdge==='top'||cropEdge==='bottom';
  let factor=Math.min(width*(fillWidth?1:.96)/scene.w,height*(fillHeight?1:.95)/scene.h);
  const wideBook=reference?.names[0]==='Книга' && reference.names[1]==='Телефон' &&
    format===0 && rectangles.length===2;
  if (wideBook) factor=Math.max(factor,Math.min(width*.91/scene.w,height*1.19/scene.h));
  const freeX=width-scene.w*factor,freeY=height-scene.h*factor;
  let originX=cropEdge==='left'?0:cropEdge==='right'?freeX:freeX/2;
  let originY=cropEdge==='top'?0:cropEdge==='bottom'?freeY:freeY*(wideBook?.55:.5);
  if (format===1 && reference?.squareFocus && focus?.i===anchor.i && rectangles.length===reference.names.length) {
    // Frame the hero, allowing the surrounding background objects to bleed.
    factor=Math.min(width*.82/anchor.w,height*.72/anchor.h);
    const hero=placed.get(anchor.i);
    originX=width*.61-(hero.x-scene.x+hero.w/2)*factor;
    originY=height*.62-(hero.y-scene.y+hero.h/2)*factor;
  }
  return entries.map(({i})=>{
    const item=placed.get(i);
    return {factor,x:originX+(item.x-scene.x)*factor,y:originY+(item.y-scene.y)*factor};
  });
}
function freePosition(preferred,width,height,occupied) {
  const gap=96;
  let {x,y}=preferred;
  // Process left-to-right, so any obstruction we move past stays behind us.
  for (const rect of [...occupied].sort((a,b)=>a.x-b.x)) {
    if (rect.y<y+height+gap && rect.y+rect.height+gap>y &&
        rect.x<x+width+gap && rect.x+rect.width+gap>x) x=rect.x+rect.width+gap;
  }
  return {x,y};
}
function itemBounds(node) {
  const [[a,b,x],[c,d,y]]=node.relativeTransform;
  const xs=[x,x+a*node.width,x+b*node.height,x+a*node.width+b*node.height];
  const ys=[y,y+c*node.width,y+d*node.height,y+c*node.width+d*node.height];
  return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
}
function findItemPosition(frameWidth,frameHeight,width,height,occupied) {
  const gap=16;
  const maxX=frameWidth-width-gap,maxY=frameHeight-height-gap;
  const centerX=(frameWidth-width)/2,centerY=(frameHeight-height)/2;
  const xs=new Set([gap,centerX,maxX]),ys=new Set([gap,centerY,maxY]);
  for (const item of occupied) {
    xs.add(item.x-width-gap); xs.add(item.x+item.width+gap);
    ys.add(item.y-height-gap); ys.add(item.y+item.height+gap);
  }
  let best,bestDistance=Infinity;
  for (const x of xs) for (const y of ys) {
    if (x<gap || x>maxX || y<gap || y>maxY) continue;
    if (occupied.some(item=>x+width+gap>item.x && x<item.x+item.width+gap &&
      y+height+gap>item.y && y<item.y+item.height+gap)) continue;
    const distance=(x-centerX)**2+(y-centerY)**2;
    if (distance<bestDistance) {best={x,y};bestDistance=distance;}
  }
  return best;
}
function planItemPlacement(frameWidth,frameHeight,width,height,occupied) {
  const position=findItemPosition(frameWidth,frameHeight,width,height,occupied);
  if (position) return {...position,frameWidth,frameHeight};
  const padding=24;
  const nextWidth=Math.max(frameWidth,width+2*padding);
  const bottom=Math.max(frameHeight,...occupied.map(item=>item.y+item.height));
  const y=Math.ceil(bottom+padding);
  return {x:(nextWidth-width)/2,y,frameWidth:Math.ceil(nextWidth),frameHeight:Math.ceil(y+height+padding)};
}
function bytesToText(bytes) {
  let encoded='';
  for (const byte of bytes) encoded+='%'+byte.toString(16).padStart(2,'0');
  return decodeURIComponent(encoded);
}
function repairSvgIds(svg) {
  return svg.replace(/(\bid=")([^"]+)(")/g,(attribute,open,id,close)=>{
    // Some Figma versions encode UTF-8 IDs as Latin-1 before writing the SVG.
    const unpacked=id.replace(/&#(\d{1,3});/g,(entity,value)=>Number(value)<256?String.fromCharCode(Number(value)):entity);
    if (!/[\u0080-\u00ff]/.test(unpacked) || /[^\u0000-\u00ff]/.test(unpacked)) return attribute;
    try {
      const repaired=bytesToText(Array.from(unpacked,char=>char.charCodeAt(0)));
      return open+repaired+close;
    } catch {
      return attribute;
    }
  });
}
function register() {
  figma.showUI(__html__,{width:390,height:690,themeColors:true});
  let catalog;
  let busy=false;
  async function loadCustomPalettes() {
    const saved=await figma.clientStorage.getAsync('customPalettes');
    if (Array.isArray(saved)) return saved.map(validatePalette);
    const previous=await figma.clientStorage.getAsync('customPalette');
    return previous?[validatePalette(previous)]:[];
  }
  const post = (type,data) => figma.ui.postMessage({type,...data});
  const availableNames = size => (catalog?.names||[]).filter(name=>['main','background'].some(role=>catalog.variants.has(slot(name,size,role))));
  const availableRoles = (name,size) => ({
    name,main:catalog.variants.has(slot(name,size,'main')),background:catalog.variants.has(slot(name,size,'background'))
  });
  function postSelection() {
    let size;
    let canMove=false;
    try {
      const frame=selectedFrame();
      size=JSON.parse(frame.getPluginData('composition')).size;
      const selection=figma.currentPage.selection;
      const node=selection[0];
      canMove=selection.length===1&&node.parent===frame&&!node.locked&&Boolean(node.getPluginData('subject'));
    }
    catch { /* The current selection is outside a composition. */ }
    post('selection',{canMove,canExport:Boolean(size)&&figma.currentPage.selection.length===1,
      items:size?availableNames(size).map(name=>availableRoles(name,size)):[]});
  }
  async function importCatalogItem({name,size,role,svg}) {
    const label=String(name||'').trim().replace(/\s+/g,' ');
    if (!label || label.length>60 || /[|,;]/.test(label)) throw Error('Введите название без запятых, точек с запятой и вертикальных черт.');
    const section=catalog?.sections[size];
    if (!['L','S'].includes(size) || !section || !['main','background'].includes(role)) throw Error('Выберите детализацию и роль.');
    const canonical=resolveName(label,catalog.names)||label;
    if (catalog.variants.has(slot(canonical,size,role))) throw Error('Такой вариант уже есть. Выберите другую детализацию, роль или название.');
    if (typeof svg!=='string' || !svg || svg.length>2_000_000) throw Error('Выберите исходный SVG до 2 МБ.');
    const node=figma.createNodeFromSvg(svg);
    try {
      if (!node.findOne(child=>child.type==='VECTOR' || child.type==='BOOLEAN_OPERATION' ||
          ['RECTANGLE','ELLIPSE','LINE','POLYGON','STAR'].includes(child.type)))
        throw Error('В SVG не найдены векторные фигуры.');
      const padding=48;
      const y=section.height+padding;
      section.appendChild(node);
      node.name=canonical+' · '+size+' · '+(role==='background'?'фон':'главный');
      node.x=padding;
      node.y=y;
      node.setPluginData('catalogItem',JSON.stringify({name:canonical,role}));
      section.resizeWithoutConstraints(Math.max(section.width,node.x+node.width+padding),node.y+node.height+padding);
    } catch (error) {
      node.remove();
      throw error;
    }
    await scan();
    post('status',{scope:'catalog',text:'В каталог добавлен предмет: '+canonical+' · '+size+'.'});
  }
  async function scan() {
    const page=figma.root.children.find(n=>normalize(n.name.trim())==='библиотека компонентов');
    if (!page) throw Error('В этом файле нужна страница «Библиотека компонентов» с секциями «Размер L» и «Размер S».');
    await page.loadAsync();
    catalog=indexLibrary(page);
    if (!catalog.palettes) catalog.issues.push('Образцы палитр не распознаны. Показаны резервные схемы.');
    const namesBySize={L:availableNames('L'),S:availableNames('S')};
    const originalNames=new Set();
    const importedItems=[];
    let originalCount=0;
    for (const [key,node] of catalog.variants) {
      const [name,size,role]=key.split('|');
      if (node.getPluginData?.('catalogItem')) importedItems.push({name,size,role});
      else { originalNames.add(name); originalCount++; }
    }
    post('catalog',{count:catalog.variants.size,issues:catalog.issues,schemes:catalog.palettes||schemes,
      sourcePalettes:Boolean(catalog.palettes),namesBySize,originalCount,originalNames:[...originalNames],importedItems});
    postSelection();
  }
  function source(name,size,role) {
    const node=catalog?.variants.get(slot(name,size,role));
    if (!node || node.removed) throw Error('Нет исходного объекта: '+slot(name,size,role)+'. Обновите каталог.');
    return node;
  }
  function copy(name,size,role,palette,parent) {
    const node=source(name,size,role).clone();
    try {
      parent.appendChild(node);
      node.locked=false;
      recolor(node,role,palette,catalog.palettes?.[0]);
      node.name=name+' · '+size+' · '+(role==='background'?'фон':'главный');
      node.setPluginData('subject',JSON.stringify({name,size,role}));
      return node;
    } catch (error) {
      node.remove();
      throw error;
    }
  }
  function selectedFrame() {
    const node=figma.currentPage.selection[0];
    if (node?.type==='FRAME' && node.getPluginData('composition')) return node;
    const parent=node?.parent;
    if (parent?.type==='FRAME' && parent.getPluginData('composition')) return parent;
    throw Error('Выделите композицию, созданную плагином, или один из её предметов.');
  }
  function resolveSubjects({size,query,mode}) {
    if (!['L','S'].includes(size)) throw Error('Неизвестный размер.');
    const names=matchQuery(query,mode,availableNames(size));
    return names.map(name=>{
      const item=availableRoles(name,size);
      return {...item,defaultRole:item.main?'main':'background'};
    });
  }
  function build(message, announce=true) {
    const {size,format,query}=message;
    const palette=message.palette?validatePalette(message.palette):null;
    if (!formats[format]) throw Error('Неизвестный формат.');
    const subjects=resolveSubjects(message);
    const names=subjects.map(item=>item.name);
    if (!names.length) throw Error('Добавьте хотя бы один предмет.');
    const [width,height]=formats[format];
    const roles=subjects.map((item,i)=>{
      const requested=message.roles?.[i];
      return (requested==='main'||requested==='background') && item[requested]?requested:item.defaultRole;
    });
    const position=freePosition({
      x:figma.viewport.center.x-width/2+(message.offsetX||0),
      y:figma.viewport.center.y-height/2+(message.offsetY||0)
    },width,height,(figma.currentPage.children||[]).filter(n=>n.visible!==false).map(box));
    const frame=figma.createFrame();
    try {
      frame.name=query.trim().slice(0,70)+' · '+size+' · '+width+' × '+height;
      frame.resize(width,height);
      frame.x=position.x;
      frame.y=position.y;
      frame.fills=solid(palette?.canvas||(catalog.palettes||schemes)[0].canvas);
      frame.clipsContent=true;
      const items=names.map((name,i)=>copy(name,size,roles[i],palette,frame));
      const positions=layout(items,width,height,roles,names);
      frame.setPluginData('composition',JSON.stringify({size,palette,scale:positions[0].factor}));
      items.forEach((node,i)=>{
        const pos=positions[i];
        node.rescale(pos.factor);
        node.x=pos.x;
        node.y=pos.y;
      });
      const layers=items.map((node,i)=>({node,background:roles[i]==='background'}));
      layers.sort((a,b)=>Number(b.background)-Number(a.background) ||
        b.node.width*b.node.height-a.node.width*a.node.height);
      layers.forEach(({node},i)=>frame.insertChild(i,node));
      if (announce) {
        figma.currentPage.selection=[frame];
        figma.viewport.scrollAndZoomIntoView([frame]);
        post('status',{text:'Собрано: '+names.join(', ')+'.'});
      }
      return frame;
    } catch(error) { frame.remove(); throw error; }
  }
  function addSubject(message) {
    const frame=selectedFrame();
    const {size,palette,scale}=JSON.parse(frame.getPluginData('composition'));
    const name=resolveName(message.name,availableNames(size));
    if (!name) throw Error('Выберите предмет из каталога.');
    const role=message.role==='background'?'background':'main';
    const occupied=frame.children.filter(child=>child.visible).map(itemBounds);
    const original=source(name,size,role);
    const factor=scale||1;
    const position=planItemPlacement(frame.width,frame.height,original.width*factor,original.height*factor,occupied);
    const expanded=position.frameWidth!==frame.width || position.frameHeight!==frame.height;
    const node=copy(name,size,role,palette,frame);
    try {
      node.rescale(factor);
      node.x=position.x;
      node.y=position.y;
      if (role==='background') frame.insertChild(0,node);
      if (expanded) {
        frame.resizeWithoutConstraints(position.frameWidth,position.frameHeight);
        frame.name=frame.name.replace(/ · \d+ × \d+$/, ' · '+position.frameWidth+' × '+position.frameHeight);
      }
      figma.currentPage.selection=[node];
      post('status',{text:'Добавлен предмет: '+name+'.'+(expanded?' Фрейм расширен до '+position.frameWidth+' × '+position.frameHeight+'.':'')});
    } catch (error) {
      node.remove();
      throw error;
    }
  }
  function applyFormat(format) {
    const frame=selectedFrame();
    const dimensions=formats[format];
    if (!dimensions) throw Error('Неизвестный формат.');
    const [width,height]=dimensions;
    const children=[...frame.children];
    if (children.some(node=>typeof node.rescale!=='function' || !node.relativeTransform))
      throw Error('Во фрейме есть слой, который нельзя переразложить.');
    const metadata=children.map(node=>JSON.parse(node.getPluginData('subject')||'{}'));
    const positions=children.length?layout(children.map(itemBounds),width,height,
      metadata.map(item=>item.role),metadata.map(item=>item.name)):[];
    if (positions.some(position=>position.factor<.01)) throw Error('Для этого формата предметы пришлось бы уменьшить слишком сильно.');
    const position=freePosition({x:frame.x,y:frame.y},width,height,
      figma.currentPage.children.filter(node=>node!==frame&&node.visible!==false).map(box));
    frame.resizeWithoutConstraints(width,height);
    frame.x=position.x;
    frame.y=position.y;
    for (const [index,node] of children.entries()) {
      const target=positions[index];
      node.rescale(target.factor);
      const bounds=itemBounds(node);
      node.x+=target.x-bounds.x;
      node.y+=target.y-bounds.y;
    }
    const settings=JSON.parse(frame.getPluginData('composition'));
    frame.setPluginData('composition',JSON.stringify({...settings,scale:(settings.scale||1)*(positions[0]?.factor||1)}));
    frame.name=frame.name.replace(/ · \d+ × \d+$/, ' · '+width+' × '+height);
    figma.currentPage.selection=[frame];
    figma.viewport.scrollAndZoomIntoView([frame]);
    post('status',{text:'Формат изменён: '+width+' × '+height+'. Предметы переразложены.'});
  }
  function moveSubject(direction) {
    const frame=selectedFrame();
    const selection=figma.currentPage.selection;
    const node=selection[0];
    if (selection.length!==1 || node.parent!==frame || node.locked || !node.getPluginData('subject'))
      throw Error('Выделите один предмет внутри композиции.');
    const steps=new Map([['left',[-10,0]],['right',[10,0]],['up',[0,-10]],['down',[0,10]]]);
    const step=steps.get(direction);
    if (!step) throw Error('Выберите направление.');
    node.x+=step[0];
    node.y+=step[1];
    post('status',{text:'Предмет перемещён на 10 px.'});
  }
  function buildExamples(size) {
    if (!['L','S'].includes(size)) throw Error('Выберите детализацию L или S.');
    const palettes=catalog.palettes||schemes;
    const requests = [
      {query:'Книга, телефон',mode:'names',format:'wide',palette:palettes[0],offsetX:-850,roles:['main','main']},
      {query:'Наушники, растение',mode:'names',format:'square',palette:palettes[1],offsetX:350,roles:['main','background']},
      {query:'Книга, пазлы, ручка',mode:'names',format:'vertical',palette:palettes[2],offsetX:1370,roles:['background','main','main']}
    ];
    const frames=[];
    try {
      for (const request of requests) frames.push(build({roles:['main','background'],...request,size},false));
      figma.currentPage.selection=frames;
      figma.viewport.scrollAndZoomIntoView(frames);
      post('status',{text:'Собраны три примера в детализации '+size+'. Для скачивания выберите один фрейм.'});
    } catch (error) {
      for (const frame of frames) frame.remove();
      throw error;
    }
  }
  function update(message) {
    const frame=selectedFrame();
    const settings=JSON.parse(frame.getPluginData('composition'));
    const selection=figma.currentPage.selection;
    const roleChange=message.type==='role';
    if (roleChange && (selection.length!==1 || selection[0].parent!==frame || !selection[0].getPluginData('subject')))
      throw Error('Выделите один предмет внутри композиции.');
    const palette=roleChange?settings.palette:(message.palette?validatePalette(message.palette):null);
    const oldNodes=roleChange?selection:frame.children.filter(n=>n.getPluginData('subject'));
    const replacements=[];
    try {
      for (const old of oldNodes) {
        const {name,size,role}=JSON.parse(old.getPluginData('subject'));
        const nextRole=roleChange?(role==='main'?'background':'main'):role;
        const original=source(name,size,role);
        const node=copy(name,size,nextRole,palette,frame);
        replacements.push({old,node,nextRole});
        node.rescale(old.width/original.width);
        node.relativeTransform=old.relativeTransform;
        node.opacity=old.opacity;
        node.visible=old.visible;
      }
    } catch(error) {
      for (const {node} of replacements) node.remove();
      throw error;
    }
    for (const {old,node,nextRole} of replacements) {
      frame.insertChild(frame.children.indexOf(old),node);
      old.remove();
      if (roleChange) frame.insertChild(nextRole==='background'?0:frame.children.length-1,node);
    }
    frame.fills=solid(palette?.canvas||(catalog.palettes||schemes)[0].canvas);
    frame.setPluginData('composition',JSON.stringify({...settings,palette}));
    figma.currentPage.selection=roleChange?[replacements[0].node]:[frame];
    post('status',{text:roleChange?'Роль изменена.':'Палитра применена.'});
  }
  async function exportSvg() {
    if (figma.currentPage.selection.length!==1) throw Error('Для экспорта выберите одну композицию или один её предмет.');
    const frame=selectedFrame();
    const raw=repairSvgIds(bytesToText(await frame.exportAsync({format:'SVG',svgIdAttribute:true,svgOutlineText:true})));
    if (/<(?:\w+:)?image\b/i.test(raw)) throw Error('В SVG обнаружен растр. Проверьте заливки и эффекты перед экспортом.');
    post('svg',{raw,name:frame.name.replace(/[<>:"/\\|?*]/g,'_')+'.svg'});
  }
  figma.ui.onmessage=async message=>{
    if (message.type==='resizeWindow') {
      if (!Number.isFinite(message.width) || !Number.isFinite(message.height)) return;
      const width=Math.min(1100,Math.max(320,Math.round(message.width)));
      const height=Math.min(1000,Math.max(300,Math.round(message.height)));
      figma.ui.resize(width,height);
      if (message.remember) {
        try { await figma.clientStorage.setAsync('windowSize',{width,height}); }
        catch { /* Resizing still works for this session. */ }
      }
      return;
    }
    if (message.type==='preview') {
      try { post('preview',{id:message.id,items:resolveSubjects(message)}); }
      catch(error) { post('preview',{id:message.id,error:error.message}); }
      return;
    }
    if (busy) return;
    busy=true;
    try {
      if (message.type==='init') {
        const windowSize=await figma.clientStorage.getAsync('windowSize');
        if (windowSize && Number.isFinite(windowSize.width) && Number.isFinite(windowSize.height))
          post('windowSize',windowSize);
        await scan();
        post('customPalettes',{palettes:await loadCustomPalettes()});
      }
      if (message.type==='scan') await scan();
      if (message.type==='savePalette') {
        const palette=validatePalette(message.palette);
        const palettes=await loadCustomPalettes();
        const existing=palettes.findIndex(item=>normalize(item.name.trim())===normalize(palette.name.trim()));
        const index=existing<0?palettes.length:existing;
        palettes[index]=palette;
        await figma.clientStorage.setAsync('customPalettes',palettes);
        post('customPalettes',{palettes,importedIndex:index});
      }
      if (message.type==='importCatalog') await importCatalogItem(message);
      if (message.type==='build') build(message);
      if (message.type==='add') addSubject(message);
      if (message.type==='format') applyFormat(message.format);
      if (message.type==='moveSubject') moveSubject(message.direction);
      if (message.type==='examples') buildExamples(message.size);
      if (message.type==='role'||message.type==='palette') update(message);
      if (message.type==='export') await exportSvg();
    } catch(error) { post('status',{scope:message.type==='importCatalog'?'catalog':undefined,text:error.message,error:true}); }
    finally { busy=false; postSelection(); post('ready',{}); }
  };
  figma.on('selectionchange',postSelection);
}
if (typeof figma!=='undefined') register();
if (typeof module!=='undefined') module.exports={indexLibrary,matchQuery,layout,validatePalette,recolor,schemes,bytesToText,repairSvgIds,freePosition,readLibraryPalettes,findItemPosition,itemBounds,planItemPlacement};
