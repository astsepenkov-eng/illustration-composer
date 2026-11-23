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
  let palettes;
  for (const size of ['L','S']) {
    const section = page.findOne(node=>node.type==='SECTION' && normalize(node.name).trim()===normalize('Размер '+size));
    if (!section) { issues.push('Не найдена секция «Размер '+size+'».'); continue; }
    const mainLabel = section.findOne(n=>n.type==='TEXT' && /^главные объекты$/i.test(n.characters.trim()));
    const backLabel = section.findOne(n=>n.type==='TEXT' && /^фоновые объекты$/i.test(n.characters.trim()));
    if (!mainLabel || !backLabel) { issues.push(size+': отсутствуют подписи ролей.'); continue; }
    const mainY = box(mainLabel).y;
    palettes ||= readLibraryPalettes(section,mainY);
    const backgroundY = box(backLabel).y;
    const pending = [];
    for (const node of section.children) {
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
  return {variants,issues,palettes};
}
function matchQuery(query, mode, available) {
  const value = normalize(query.trim());
  if (!value) throw Error('Введите названия предметов, заголовок или метафору.');
  if (mode==='names') {
    const names = value.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
    const unknown = names.filter(n=>!available.includes(subjectName(n)));
    if (unknown.length) throw Error('Недоступны в этом размере: '+unknown.join(', ')+'.');
    if (names.length>6) throw Error('В одном запросе можно указать до шести предметов.');
    return names.map(subjectName);
  }
  const words = value.match(/[\p{L}\p{N}]+/gu) || [];
  const ranking = subjects.filter(([name])=>available.includes(name)).map(([name,tags])=>{
    const stems = normalize(tags).split(' ');
    const score = words.reduce((sum,word)=>sum+(word===normalize(name)?3:stems.some(stem=>word.startsWith(stem))?1:0),0);
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
function layout(items,width,height,roles=[]) {
  const transpose=height>width;
  const horizontal=transpose?height:width;
  const vertical=transpose?width:height;
  const rowSize=horizontal/vertical>1.3?3:2;
  const order=items.map((item,i)=>({i,w:transpose?item.height:item.width,h:transpose?item.width:item.height}));
  const rows=[];
  if (width===height && items.length>=3) {
    const main=order.filter(item=>roles[item.i]!=='background');
    const anchor=(main.length?main:order).reduce((best,item)=>item.w*item.h>best.w*best.h?item:best);
    rows.push(order.splice(order.indexOf(anchor),1));
  }
  for (let i=0;i<order.length;i+=rowSize) rows.push(order.slice(i,i+rowSize));
  const gap=.075*horizontal;
  const rowGap=.075*vertical;
  const metrics=rows.map(row=>({w:row.reduce((sum,item)=>sum+item.w,0),h:Math.max(...row.map(item=>item.h))}));
  const factor=Math.min(
    ...metrics.map((row,i)=>(horizontal*.84-gap*(rows[i].length-1))/row.w),
    (vertical*.78-rowGap*(rows.length-1))/metrics.reduce((sum,row)=>sum+row.h,0)
  );
  const totalHeight=metrics.reduce((sum,row)=>sum+row.h*factor,0)+rowGap*(rows.length-1);
  const result=[];
  let y=(vertical-totalHeight)/2;
  rows.forEach((row,index)=>{
    const {w,h}=metrics[index];
    let x=(horizontal-w*factor-gap*(row.length-1))/2;
    row.forEach(item=>{
      const centeredY=y+(h-item.h)*factor/2;
      result[item.i]={factor,x:transpose?centeredY:x,y:transpose?x:centeredY};
      x+=item.w*factor+gap;
    });
    y+=h*factor+rowGap;
  });
  return result;
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
  const post = (type,data) => figma.ui.postMessage({type,...data});
  const availableNames = size => subjects.map(([name])=>name).filter(name=>catalog?.variants.has(slot(name,size,'main')));
  async function scan() {
    const page=figma.root.children.find(n=>normalize(n.name.trim())==='библиотека компонентов');
    if (!page) throw Error('В этом файле нужна страница «Библиотека компонентов» с секциями «Размер L» и «Размер S».');
    await page.loadAsync();
    catalog=indexLibrary(page);
    if (!catalog.palettes) catalog.issues.push('Образцы палитр не распознаны. Показаны резервные схемы.');
    const namesBySize={L:availableNames('L'),S:availableNames('S')};
    post('catalog',{count:catalog.variants.size,issues:catalog.issues,schemes:catalog.palettes||schemes,
      sourcePalettes:Boolean(catalog.palettes),namesBySize,names:[...new Set([...namesBySize.L,...namesBySize.S])]});
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
    return matchQuery(query,mode,availableNames(size)).map(name=>({
      name,background:catalog.variants.has(slot(name,size,'background'))
    }));
  }
  function build(message, announce=true) {
    const {size,format,query}=message;
    const palette=message.palette?validatePalette(message.palette):null;
    if (!formats[format]) throw Error('Неизвестный формат.');
    const subjects=resolveSubjects(message);
    const names=subjects.map(item=>item.name);
    if (!names.length) throw Error('Добавьте хотя бы один предмет.');
    const [width,height]=formats[format];
    const roles=subjects.map((item,i)=>item.background && message.roles?.[i]==='background'?'background':'main');
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
      const positions=layout(items,width,height,roles);
      frame.setPluginData('composition',JSON.stringify({size,palette,scale:positions[0].factor}));
      items.forEach((node,i)=>{
        const pos=positions[i];
        node.rescale(pos.factor);
        node.x=pos.x;
        node.y=pos.y;
      });
      const backgrounds=items.filter((_,i)=>roles[i]==='background');
      backgrounds.forEach((node,i)=>frame.insertChild(i,node));
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
    const name=subjectName(message.name);
    if (!name) throw Error('Выберите предмет из каталога.');
    const occupied=frame.children.filter(child=>child.visible).map(itemBounds);
    const original=source(name,size,'main');
    const factor=scale||1;
    const position=findItemPosition(frame.width,frame.height,original.width*factor,original.height*factor,occupied);
    if (!position) throw Error('В композиции нет свободного места для этого предмета. Освободите место или добавьте его в запрос и соберите новую композицию.');
    const node=copy(name,size,'main',palette,frame);
    try {
      node.rescale(factor);
      node.x=position.x;
      node.y=position.y;
      figma.currentPage.selection=[node];
      post('status',{text:'Добавлен предмет: '+name+'.'});
    } catch (error) {
      node.remove();
      throw error;
    }
  }
  function buildExamples() {
    const palettes=catalog.palettes||schemes;
    const requests = [
      {query:'Книга, наушники, пазлы',mode:'names',size:'L',format:'wide',palette:palettes[0],offsetX:-850},
      {query:'Идеи и заметки на связи',mode:'meaning',size:'S',format:'square',palette:palettes[1],offsetX:350},
      {query:'Растение, папка, монета',mode:'names',size:'L',format:'vertical',palette:palettes[2],offsetX:1370}
    ];
    const frames=[];
    try {
      for (const request of requests) frames.push(build({...request,roles:['main','background']},false));
      figma.currentPage.selection=frames;
      figma.viewport.scrollAndZoomIntoView(frames);
      post('status',{text:'Собраны три примера. Для скачивания выберите один фрейм.'});
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
    if (message.type==='preview') {
      try { post('preview',{id:message.id,items:resolveSubjects(message)}); }
      catch(error) { post('preview',{id:message.id,error:error.message}); }
      return;
    }
    if (busy) return;
    busy=true;
    try {
      if (message.type==='scan') await scan();
      if (message.type==='build') build(message);
      if (message.type==='add') addSubject(message);
      if (message.type==='examples') buildExamples();
      if (message.type==='role'||message.type==='palette') update(message);
      if (message.type==='export') await exportSvg();
    } catch(error) { post('status',{text:error.message,error:true}); }
    finally { busy=false; post('ready',{}); }
  };
}
if (typeof figma!=='undefined') register();
if (typeof module!=='undefined') module.exports={indexLibrary,matchQuery,layout,validatePalette,recolor,schemes,bytesToText,repairSvgIds,freePosition,readLibraryPalettes,findItemPosition,itemBounds};
