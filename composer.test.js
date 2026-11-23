const { test } = require('node:test');
const assert = require('node:assert/strict');
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
  assert.throws(()=>matchQuery('океан','meaning',['Книга','Телефон']),/не найдены/);
});
test('layout shares a scale and follows the frame orientation',()=>{
  for (const [w,h] of [[1000,1000],[1200,630],[700,1050]]) {
    const items=[{width:1446,height:977},{width:797,height:462}];
    const result=layout(items,w,h);
    assert.equal(result[0].factor,result[1].factor);
    if (h>w) assert.ok(result[0].y+items[0].height*result[0].factor<result[1].y);
    if (w>h) assert.ok(result[0].x+items[0].width*result[0].factor<result[1].x);
    result.forEach((p,i)=>{
      assert.ok(p.x>=0 && p.y>=0);
      assert.ok(p.x+items[i].width*p.factor<w);
      assert.ok(p.y+items[i].height*p.factor<h);
    });
  }
});
test('new frame clears existing objects and preserves a free position',()=>{
  const occupied=[{x:50,y:100,width:500,height:600},{x:750,y:0,width:200,height:300}];
  assert.deepEqual(freePosition({x:100,y:100},300,400,occupied),{x:1046,y:100});
  assert.deepEqual(freePosition({x:100,y:1000},300,400,occupied),{x:100,y:1000});
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
  const palette=validatePalette(require('./palette-example.json'));
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
  const workPage={selection:[],children:[]};
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
    root:{children:[library]},currentPage:workPage,showUI(){},on(){},
    viewport:{center:{x:0,y:0},scrollAndZoomIntoView(){}},
    ui:{postMessage(event){log.push(event);}},
    createFrame(){return editable('Frame','FRAME');}
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('./code.js'),'utf8'),{figma,__html__:''});
  await figma.ui.onmessage({type:'scan'});
  assert.equal(log.find(msg=>msg.type==='catalog').count,8);
  const request={type:'build',query:'Книга, телефон',mode:'names',size:'S',format:'square'};
  await figma.ui.onmessage({...request,type:'preview',id:1});
  const preview=log.find(msg=>msg.type==='preview');
  assert.equal(preview.id,1);
  assert.equal(preview.items.map(item=>item.name+':'+item.background).join(','),'Книга:true,Телефон:true');
  await figma.ui.onmessage(request);
  assert.ok(workPage.selection[0].children.every(child=>child.name.endsWith('главный')));
  await figma.ui.onmessage({...request,roles:['background','main']});
  const frame=workPage.selection[0];
  assert.equal(frame.children.length,2);
  assert.match(frame.children[0].name,/Книга.*фон/);
  assert.match(frame.children[1].name,/Телефон.*главный/);
  workPage.selection=[frame.children[0]];
  await figma.ui.onmessage({type:'role'});
  assert.match(workPage.selection[0].name,/Книга.*главный/);
  await figma.ui.onmessage({type:'palette',palette:require('./palette-example.json')});
  assert.equal(workPage.selection[0],frame);
  assert.equal(frame.children.length,2);
  await figma.ui.onmessage({type:'export'});
  assert.equal(log.find(msg=>msg.type==='svg').raw,'<svg><g id="book"/><g id="phone"/></svg>');
  const existing=frame.children[0];
  existing.width=frame.width;
  existing.height=frame.height;
  const previousHeight=frame.height;
  await figma.ui.onmessage({type:'add',name:'Телефон',role:'background'});
  assert.ok(frame.height>previousHeight);
  assert.equal(existing.height,previousHeight);
  assert.ok(workPage.selection[0].y>previousHeight);
  assert.match(workPage.selection[0].name,/Телефон.*фон/);
  await figma.ui.onmessage({type:'format',format:'vertical'});
  assert.equal(frame.width,700);
  assert.equal(frame.height,1050);
  assert.equal(frame.children.length,3);
  for (const sizeSection of library.children) {
    for (const name of ['Наушники','Пазлы','Лампа','Ручка','Растение','Папка','Монета']) {
      for (const y of [120,220]) {
        const variant=node('GROUP',name,y);
        variant.clone=()=>editable(name,'GROUP');
        sizeSection.children.push(variant);
      }
    }
  }
  await figma.ui.onmessage({type:'scan'});
  await figma.ui.onmessage({type:'examples',size:'S'});
  assert.deepEqual(Array.from(workPage.selection,frame=>[frame.width,frame.height]),[[1200,630],[1000,1000],[700,1050]]);
  assert.ok(workPage.selection.every(frame=>frame.name.includes(' · S · ')));
  assert.equal(log.filter(msg=>msg.error).length,0);
});
