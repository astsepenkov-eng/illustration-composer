const { test } = require('node:test');
const assert = require('node:assert/strict');
const samplePalette = {
  name:'Тестовая палитра',
  canvas:'#FFFFFF',
  background:['#DDDDDD','#BBBBBB','#888888','#444444'],
  objects:['#FFEEAA','#FF9966','#993355','#551144']
};
const { findItemPosition,itemBounds,planItemPlacement } = require('./code.js');
const { indexLibrary, matchQuery, layout, validatePalette, recolor, schemes, bytesToText, repairSvgIds, freePosition, readLibraryPalettes } = require('./code.js');

function node(type,name,y,children=[],width=50,height=40) {
  return {
    type,name,children,width,height,visible:true,id:name,
    absoluteBoundingBox:{x:0,y,width,height},
    findOne(test) {
      for (const child of children) {
        if (test(child)) return child;
        const match=child.findOne(test);
        if (match) return match;
      }
    }
  };
}
function label(characters,y) {
  return {...node('TEXT',characters,y),characters};
}
function section(size) {
  return node('SECTION','Размер '+size,0,[
    label('Главные объекты',100),
    node('GROUP','Group 2136136335',120,[node('GROUP','Книга',120)]),
    node('GROUP','Телефон',120),
    label('Фоновые объекты',200),
    node('GROUP','Group 2136136341',220,[node('GROUP','Книга',220)]),
    node('GROUP','Телефон',220)
  ]);
}
test('catalogue links both roles and sizes and preserves outer wrappers',()=>{
  const page=node('PAGE','Библиотека компонентов',0,[section('L'),section('S')]);
  const {variants,issues}=indexLibrary(page);
  assert.equal(variants.size,8);
  assert.equal(variants.get('Книга|S|main').name,'Group 2136136335');
  assert.equal(variants.get('Книга|S|background').name,'Group 2136136341');
  assert.ok(issues.some(issue=>issue.includes('Лампа')));
});
test('direct names and an unseen title produce eligible objects',()=>{
  assert.deepEqual(matchQuery('Книга, телефон','names',['Книга','Телефон']),['Книга','Телефон']);
  assert.deepEqual(matchQuery('Идеи всегда на связи','meaning',['Лампа','Телефон','Книга']),['Телефон','Лампа']);
  assert.deepEqual(matchQuery('Библиотека в кармане','meaning',['Книга','Телефон']),['Книга','Телефон']);
  assert.deepEqual(matchQuery('смартфон','names',['Телефон']),['Телефон']);
  assert.deepEqual(matchQuery('новая группа','names',['Новая группа']),['Новая группа']);
  assert.throws(()=>matchQuery('океан','meaning',['Книга','Телефон']),/не найдены/);
});
test('related objects share a scale and overlap within each frame format',()=>{
  for (const [w,h] of [[1000,1000],[1200,630],[700,1050]]) {
    const items=[{width:1446,height:977},{width:797,height:462}];
    const result=layout(items,w,h,['main','main'],['Книга','Телефон']);
    assert.equal(result[0].factor,result[1].factor);
    assert.ok(result[1].x+items[1].width*result[1].factor/2>result[0].x+items[0].width*result[0].factor/2);
    assert.ok(result[1].y+items[1].height*result[1].factor/2<result[0].y+items[0].height*result[0].factor/2);
    assert.ok(result[1].x<result[0].x+items[0].width*result[0].factor);
    assert.ok(result[0].y<result[1].y+items[1].height*result[1].factor);
    const phone=result[1];
    const phoneRight=phone.x+items[1].width*phone.factor;
    const allowedTopCrop=w>h?items[1].height*phone.factor*.18:0;
    assert.ok(phone.x>=0 && phone.y>=-allowedTopCrop && phone.y+items[1].height*phone.factor<=h);
    if (h>w) assert.ok(phoneRight>w && phone.x<w);
    else assert.ok(phoneRight<=w+.001);
    const book=result[0];
    assert.ok(book.x<0 || book.y<0 || book.x+items[0].width*book.factor>w || book.y+items[0].height*book.factor>h);
  }
});
test('new frame clears existing objects and preserves a free position',()=>{
  const occupied=[{x:50,y:100,width:500,height:600},{x:750,y:0,width:200,height:300}];
  assert.deepEqual(freePosition({x:100,y:100},300,400,occupied),{x:1046,y:100});
  assert.deepEqual(freePosition({x:100,y:1000},300,400,occupied),{x:100,y:1000});
});
test('wide layout distributes an unfamiliar set across the frame',()=>{
  const items=[{width:270,height:150},{width:797,height:462},{width:620,height:830},{width:490,height:266}];
  const width=1200;
  const result=layout(items,width,630,['main','background','main','main'],
    ['Монета','Телефон','Растение','Ручка']);
  const left=Math.min(...result.map(position=>position.x));
  const right=Math.max(...result.map((position,i)=>position.x+items[i].width*position.factor));
  assert.ok(right-left>width*.85);
  assert.ok(Math.abs(left-(width-right))<width*.04);
  assert.ok(result.every(position=>position.factor===result[0].factor));
});
test('reference scenes distinguish surface overlap, foreground and adjacent subjects',()=>{
  const book={width:1446,height:977}, puzzle={width:500,height:340};
  const [page,pieces,pen]=layout([book,puzzle,{width:430,height:210}],700,1050,
    ['background','main','main'],['Книга','Пазлы','Ручка']);
  assert.ok(page.x+book.width*page.factor>700);
  assert.ok(pieces.y+puzzle.height*pieces.factor>page.y);
  assert.ok(pieces.x+puzzle.width*pieces.factor>page.x);
  const puzzleCenterY=pieces.y+puzzle.height*pieces.factor/2;
  assert.ok(Math.abs(puzzleCenterY-(page.y+book.height*page.factor/2))<book.height*page.factor*.05);
  assert.ok(pen.y>pieces.y+puzzle.height*pieces.factor);
  const [phone,nearby]=layout([{width:797,height:462},puzzle],1200,630,
    ['main','main'],['Телефон','Пазлы']);
  assert.ok(phone.x+797*phone.factor<nearby.x);
  const [headphones,plant]=layout([{width:1000,height:800},{width:430,height:680}],1000,1000,
    ['main','background'],['Наушники','Растение']);
  assert.ok(plant.x<headphones.x && plant.y<headphones.y);
  assert.ok(plant.y+680*plant.factor>headphones.y);
});
test('square with headphones frames the main object and lets secondary objects bleed',()=>{
  const phone={width:797,height:462}, headphones={width:1000,height:800}, plant={width:620,height:830};
  const [secondary,hero,backdrop]=layout([phone,headphones,plant],1000,1000,
    ['background','main','background'],['Телефон','Наушники','Растение']);
  assert.ok(headphones.width*hero.factor>=800);
  assert.ok(hero.x+headphones.width*hero.factor>1000);
  assert.ok(backdrop.y<0 && backdrop.y+plant.height*backdrop.factor>0);
  assert.ok(secondary.y<1000 && secondary.y+phone.height*secondary.factor>1000);
  assert.equal(hero.factor,secondary.factor);
  assert.equal(hero.factor,backdrop.factor);
});
test('added objects avoid rotated layers and report a full frame',()=>{
  const rotated=itemBounds({width:100,height:60,relativeTransform:[[0,-1,210],[1,0,90]]});
  assert.deepEqual(rotated,{x:150,y:90,width:60,height:100});
  const next=findItemPosition(360,280,60,40,[rotated]);
  assert.equal(next.x,74);
  assert.equal(next.y,120);
  assert.equal(findItemPosition(100,100,60,40,[{x:0,y:0,width:100,height:100}]),undefined);
});
test('a full frame grows downward and only widens for an oversized object',()=>{
  const occupied=[{x:0,y:0,width:700,height:1050}];
  assert.deepEqual(planItemPlacement(700,1050,180,100,occupied),{x:260,y:1074,frameWidth:700,frameHeight:1198});
  assert.deepEqual(planItemPlacement(700,1050,800,100,occupied),{x:24,y:1074,frameWidth:848,frameHeight:1198});
  assert.deepEqual(planItemPlacement(700,1050,180,100,[]),{x:260,y:475,frameWidth:700,frameHeight:1050});
});
test('reads exact swatches from separate background and object columns',()=>{
  const children=[];
  for (let col=0;col<6;col++) {
    const title=label(col%2?'Цвета объектов':'Цвета фона',20);
    title.absoluteBoundingBox.x=col*100;
    children.push(title);
    for (let row=0;row<4;row++) {
      const swatch=node('RECTANGLE','swatch',45+row*25,[],100,25);
      swatch.absoluteBoundingBox.x=col*100;
      swatch.fills=[{type:'SOLID',color:{r:col/255,g:row/255,b:0}}];
      children.push(swatch);
    }
  }
  const result=readLibraryPalettes(node('SECTION','Размер L',0,children),200);
  assert.equal(result.length,3);
  assert.deepEqual(result[1].background,['#020000','#020100','#020200','#020300']);
  assert.deepEqual(result[1].objects,['#030000','#030100','#030200','#030300']);
  assert.equal(result[2].canvas,'#040000');
});
test('background recolor maps all visible fills and strokes to background shades',()=>{
  const palette=validatePalette(samplePalette);
  const child={type:'VECTOR',fills:[{type:'SOLID',color:{r:1,g:0,b:0}}],strokes:[{type:'SOLID',color:{r:0,g:0,b:0}}]};
  recolor({type:'GROUP',children:[child]},'background',palette);
  const hex=c=>'#'+[c.r,c.g,c.b].map(n=>Math.round(n*255).toString(16).padStart(2,'0')).join('').toUpperCase();
  assert.ok([...child.fills,...child.strokes].every(p=>palette.background.includes(hex(p.color))));
  assert.throws(()=>validatePalette({...schemes[0],background:['red']}),/HEX/);
});
test('SVG text decoding preserves non-ASCII names',()=>{
  const raw='<svg><g id="Книга"/></svg>';
  assert.equal(bytesToText(Buffer.from(raw)),raw);
  assert.equal(repairSvgIds(Buffer.from(raw).toString('latin1')),raw);
  const escaped=Buffer.from(raw).toString('latin1').replace(/[\u0080-\u00ff]/g,char=>'&#'+char.charCodeAt(0)+';');
  assert.equal(repairSvgIds(escaped),raw);
  assert.equal(repairSvgIds(raw),raw);
  assert.equal(repairSvgIds('<g id="café"/>'),'<g id="café"/>');
});

test('known source wrappers resolve without renaming Figma layers',()=>{
  const source=section('S');
  source.children.push(node('GROUP','Group 2136136336',140),node('GROUP','Group 2136136343',240));
  const {variants}=indexLibrary(node('PAGE','Библиотека компонентов',0,[source]));
  assert.equal(variants.get('Папка|S|main').name,'Group 2136136336');
  assert.equal(variants.get('Ручка|S|background').name,'Group 2136136343');
});

test('plugin messages scan, assemble, recolor, change role and export',async()=>{
  const vm=require('node:vm');
  const fs=require('node:fs');
  const library=node('PAGE','Библиотека компонентов',0,[section('L'),section('S')]);
  library.loadAsync=async()=>{};
  for (const sectionNode of library.children) {
    sectionNode.appendChild=child=>sectionNode.children.push(child);
    sectionNode.resizeWithoutConstraints=(w,h)=>{sectionNode.width=w;sectionNode.height=h;};
  }
  const pageEvents=new Map();
  const workPage={selection:[],children:[],
    on(type,callback) { pageEvents.set(type,callback); },
    off(type,callback) { if (pageEvents.get(type)===callback) pageEvents.delete(type); }
  };
  const figmaEvents=new Map();
  const log=[];
  function editable(name,type,width=50,height=40) {
    const data=new Map();
    return {
      name,type,width,height,children:[],opacity:1,visible:true,relativeTransform:[[1,0,0],[0,1,0]],
      fills:[{type:'SOLID',color:{r:0.6,g:0.5,b:0.9}}],
      setPluginData(key,value) { data.set(key,value); },
      getPluginData(key) { return data.get(key)||''; },
      resize(w,h) { this.width=w; this.height=h; },
      resizeWithoutConstraints(w,h) { this.resize(w,h); },
      rescale(factor) { this.width*=factor; this.height*=factor; },
      appendChild(child) { this.insertChild(this.children.length,child); },
      insertChild(index,child) { child.remove(); this.children.splice(index,0,child); child.parent=this; },
      remove() {
        if (!this.parent) return;
        const items=this.parent.children;
        items.splice(items.indexOf(this),1);
        this.parent=null;
      },
      async exportAsync() { return Buffer.from('<svg><g id="book"/><g id="phone"/></svg>'); }
    };
  }
  for (const variant of indexLibrary(library).variants.values())
    variant.clone=()=>editable(variant.name,'GROUP');
  const figma={
    root:{children:[library]},currentPage:workPage,showUI(){},
    on(type,callback){ figmaEvents.set(type,callback); },
    clientStorage:{data:new Map(),async getAsync(key){return this.data.get(key);},async setAsync(key,value){this.data.set(key,value);}},
    viewport:{center:{x:0,y:0},scrollAndZoomIntoView(){}},
    ui:{postMessage(event){log.push(event);},resize(width,height){log.push({type:'resized',width,height});}},
    createFrame(){return editable('Frame','FRAME');},
    createNodeFromSvg(){
      const parsed=editable('SVG','FRAME');
      parsed.findOne=filter=>[{type:'VECTOR'}].find(filter);
      parsed.clone=()=>editable('SVG','FRAME');
      return parsed;
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('./code.js'),'utf8'),{figma,__html__:''});
  await figma.ui.onmessage({type:'resizeWindow',width:640,height:810,remember:true});
  assert.deepEqual(log.find(msg=>msg.type==='resized'),{type:'resized',width:640,height:810});
  const customPalette=samplePalette;
  await figma.clientStorage.setAsync('customPalette',customPalette);
  await figma.ui.onmessage({type:'savePalette',palette:{...customPalette,name:'Утро у моря'}});
  await figma.ui.onmessage({type:'init'});
  const restoredWindow=log.find(msg=>msg.type==='windowSize');
  assert.equal(restoredWindow.width,640);
  assert.equal(restoredWindow.height,810);
  assert.deepEqual(Array.from(log.findLast(msg=>msg.type==='customPalettes').palettes,palette=>palette.name),[customPalette.name,'Утро у моря']);
  assert.equal(log.findLast(msg=>msg.type==='customPalettes').importedIndex,undefined);
  await figma.ui.onmessage({type:'scan'});
  assert.equal(log.find(msg=>msg.type==='catalog').count,8);
  assert.equal(log.findLast(msg=>msg.type==='selection').canExport,false);
  const request={type:'build',query:'Книга, телефон',mode:'names',size:'S',format:'square'};
  await figma.ui.onmessage({...request,type:'preview',id:1});
  const preview=log.find(msg=>msg.type==='preview');
  assert.equal(preview.id,1);
  assert.equal(preview.items.map(item=>item.name+':'+item.background).join(','),'Книга:true,Телефон:true');
  assert.equal(preview.items.map(item=>item.defaultRole).join(','),'main,main');
  await figma.ui.onmessage(request);
  assert.equal(workPage.selection[0].children.filter(child=>child.name.endsWith('главный')).length,2);
  assert.equal(log.findLast(msg=>msg.type==='selection').canExport,true);
  await figma.ui.onmessage({...request,roles:['background','main']});
  const frame=workPage.selection[0];
  assert.equal(frame.children.length,2);
  assert.match(frame.children[0].name,/Книга.*фон/);
  assert.match(frame.children[1].name,/Телефон.*главный/);
  workPage.selection=[frame.children[0]];
  await figma.ui.onmessage({type:'role'});
  assert.match(workPage.selection[0].name,/Книга.*главный/);
  const lockedSubject=workPage.selection[0];
  lockedSubject.locked=true;
  await figma.ui.onmessage({type:'palette',palette:samplePalette});
  assert.equal(workPage.selection[0],frame);
  assert.equal(frame.children.length,2);
  assert.equal(frame.children.find(child=>child.name===lockedSubject.name).locked,true);
  await figma.ui.onmessage({type:'export'});
  assert.equal(log.find(msg=>msg.type==='svg').raw,'<svg><g id="book"/><g id="phone"/></svg>');
  pageEvents.get('nodechange')();
  assert.equal(log.at(-1).type,'invalidateExport');
  assert.equal(pageEvents.has('nodechange'),false);
  await figma.ui.onmessage({type:'export'});
  workPage.selection=[];
  figmaEvents.get('selectionchange')();
  assert.equal(log.at(-2).type,'invalidateExport');
  workPage.selection=[frame];
  const existing=frame.children[0];
  existing.width=frame.width;
  existing.height=frame.height;
  const previousHeight=frame.height;
  await figma.ui.onmessage({type:'add',name:'Телефон',role:'background'});
  assert.ok(frame.height>previousHeight);
  assert.equal(existing.height,previousHeight);
  assert.ok(workPage.selection[0].y>previousHeight);
  assert.match(workPage.selection[0].name,/Телефон.*фон/);
  const moved=workPage.selection[0];
  const oldX=moved.x,oldY=moved.y;
  await figma.ui.onmessage({type:'moveSubject',direction:'left'});
  assert.equal(moved.x,oldX-10);
  assert.equal(moved.y,oldY);
  await figma.ui.onmessage({type:'format',format:'vertical'});
  assert.equal(frame.width,700);
  assert.equal(frame.height,1050);
  assert.equal(frame.children.length,3);
  for (const sizeSection of library.children) {
    for (const name of ['Наушники','Пазлы','Лампа','Ручка','Растение','Папка','Монета','Кошелек']) {
      for (const y of [120,220]) {
        const variant=node('GROUP',name,y);
        variant.clone=()=>editable(name,'GROUP');
        sizeSection.children.push(variant);
      }
    }
  }
  await figma.ui.onmessage({type:'scan'});
  await figma.ui.onmessage({...request,type:'preview',id:2,query:'Пазлы, Растение, Монета, Наушники'});
  const recommendation=log.find(msg=>msg.type==='preview' && msg.id===2);
  assert.equal(recommendation.items.map(item=>item.defaultRole).join(','),'main,main,main,main');
  await figma.ui.onmessage({type:'examples',size:'S'});
  assert.deepEqual(Array.from(workPage.selection,frame=>[frame.width,frame.height]),[[1200,630],[1000,1000],[700,1050]]);
  assert.ok(workPage.selection.every(frame=>frame.name.includes(' · S · ')));
  assert.equal(log.findLast(msg=>msg.type==='selection').canExport,false);
  await figma.ui.onmessage({type:'importCatalog',name:'Новая группа',size:'S',role:'background',svg:'<svg/>'});
  assert.ok(log.findLast(msg=>msg.type==='catalog').namesBySize.S.includes('Новая группа'));
  const updatedCatalog=log.findLast(msg=>msg.type==='catalog');
  assert.equal(updatedCatalog.originalCount,updatedCatalog.count-1);
  assert.ok(!updatedCatalog.originalNames.includes('Новая группа'));
  assert.equal(updatedCatalog.importedItems[0].name,'Новая группа');
  await figma.ui.onmessage({...request,query:'Новая группа'});
  assert.match(workPage.selection[0].children[0].name,/Новая группа.*фон/);
  assert.equal(log.filter(msg=>msg.error).length,0);
});
