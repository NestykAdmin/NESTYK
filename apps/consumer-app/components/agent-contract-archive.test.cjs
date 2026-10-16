const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const transpile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const locale={exports:{}};new Function('module','exports',transpile(path.join(__dirname,'../../..','packages/i18n/src/locales/contracts/en.ts')) .replace(/require\("\.\/th"\)/g,'({})'))(locale,locale.exports);
const contracts=locale.exports.contractsEn;
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const rows=(start,count,type='lease')=>Array.from({length:count},(_,i)=>({id:start+i,key:`contract:${start+i}`,kind:'contract',type,documentNo:`DOC-${start+i}`,person:'Demo Person',property:'Demo Condo',room:'A101',issueDate:'2026-10-01',status:'active',amount:15000}));
const page=(items,total,page=1)=>({items,total,page,limit:20});
function harness(type='lease') {
  const states=[],refs=[],deps=[],effects=[],cleanup=[],timers=[],requests=[],buttons=new Map(),cards=new Map(),settled=[],scrolls=[];
  let si=0,ri=0,ei=0,search,detail,component='list',detailComponent,props,modal;
  const native=tag=>({children})=>React.createElement(tag,{},children);
  const hooked={...React,
    createElement:(type,props,...children)=>{if(component==='list'&&typeof type==='function'&&type.name==='ArchiveDetail'){detail=props;detailComponent=type;return React.createElement('p',{},`Detail ${props.entry.id}`)}return React.createElement(type,props,...children)},
    useState(initial){const i=si++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}]},
    useRef(initial){return refs[ri++]??={current:initial}},useCallback:fn=>fn,
    useContext:()=>({scrollTo:value=>scrolls.push(value),scrollToView:()=>{}}),
    useEffect(fn,next){const i=ei++,old=deps[i];if(!old||next.some((v,j)=>v!==old[j])){effects.push(()=>{cleanup[i]?.();cleanup[i]=fn()});deps[i]=next}},
  };
  const mock=name=>{
    if(name==='react')return hooked;
    if(name==='react-native')return{Modal:props=>{modal=props;return props.visible?React.createElement('aside',{},props.children):null},View:native('div'),Text:native('span'),Pressable:props=>{cards.set(props.accessibilityLabel,props);return React.createElement('button',{},props.children)},Platform:{OS:'web'},StyleSheet:{create:x=>x}};
    if(name==='react-native-safe-area-context')return{SafeAreaProvider:native('div'),SafeAreaView:native('div'),initialWindowMetrics:null};
    if(name==='react-native-reanimated')return{__esModule:true,default:{View:native('section')},SlideInRight:{duration(){}}};
    if(name==='@nestyk/i18n')return{useLocale:()=>({locale:'en',t:{contracts,agent:{contracts:{previewTitle:'Preview {name}'},leads:{previous:'Previous',next:'Next'},tenants:{clearSearch:'Clear'}}}})};
    if(name==='@nestyk/ui/native')return{getCardElevation:()=>({}),ModePageScrollContext:{},tokens:{typography:{native:{}},colors:{brand:{700:'#D99A0D'},roles:{owner:'#0055DA',agent:'#FF0052'}}},useMobileTheme:()=>({theme:{}}),MobileIcon:()=>null,
      MobileBrandLoader:()=>React.createElement('span',{},'Loading'),MobileButton:props=>{buttons.set(props.children,props);return React.createElement('button',{},props.children)},MobileListSearchRow:props=>{search=props;return React.createElement('input',{value:props.value,readOnly:true})}};
    if(name==='../lib/contract-archive-api')return{ARCHIVE_PAGE_SIZE:20,listContractArchive:(type,query,page)=>{const r={...deferred(),type,query,page};requests.push(r);return r.promise},getContractArchiveDetail:(kind,id)=>{const r={...deferred(),kind,id};requests.push(r);return r.promise}};
    if(name==='./ContractDocumentPreview')return{ContractDocumentPreview:({url})=>React.createElement('p',{},`Preview ${url}`)};
    throw Error(name);
  };
  const loaded={exports:{}};new Function('require','module','exports','setTimeout','clearTimeout',transpile(path.join(__dirname,'AgentContractArchiveBody.tsx')))(mock,loaded,loaded.exports,fn=>{const t={fn,active:true};timers.push(t);return t},t=>t.active=false);
  props={type,reloadToken:0,onReloadSettled:token=>settled.push(token),onDetailStateChange:()=>{},detailBackRef:{current:null}};
  const render=()=>{si=ri=ei=0;buttons.clear();cards.clear();detail=null;const html=renderToStaticMarkup(React.createElement(component==='list'?loaded.exports.AgentContractArchiveBody:component==='chooser'?loaded.exports.AgentContractArchiveKindsBody:detailComponent,props));effects.splice(0).forEach(fn=>fn());return html};
  const flush=async()=>{timers.splice(0).forEach(t=>{if(t.active)t.fn()});await tick()};
  const resolve=async data=>{requests.at(-1).resolve(data);await tick();return render()};
  const load=async()=>{render();await flush();return resolve(page(rows(1,20,type),45))};
  const mountDetail=()=>{const entry=detail.entry;for(const fn of cleanup)fn?.();states.length=refs.length=deps.length=cleanup.length=0;component='detail';props={entry,reloadToken:0,onReloadSettled:token=>settled.push(token)};render();};
  return{render,flush,resolve,load,requests,buttons,cards,settled,props,modal:()=>modal,currentProps:()=>props,search:()=>search,detail:()=>detail,mountDetail,chooser:()=>{component='chooser';props={onSelect:()=>{}};return render()}};
}
test('chooser contains all eight document types',()=>{const h=harness();h.chooser();assert.equal(h.cards.size,8);for(const name of ['Booking invoice','Receipt','Commission confirmation'])assert.ok([...h.cards.keys()].some(label=>label.startsWith(name+', ')));});
for(const type of ['reservation','lease','renewal','broker_appointment','booking_invoice','invoice','receipt','agent_commission'])test(`${type}: 20 rows per page with stable back navigation`,async()=>{
  const h=harness(type);await h.load();assert.equal(h.cards.size,20);assert.equal(h.requests.at(-1).type,type);assert.equal(h.buttons.get('Previous').disabled,true);
  h.buttons.get('Next').onPress();h.render();await h.flush();assert.equal(h.requests.at(-1).page,2);await h.resolve(page(rows(21,20,type),45,2));
  h.cards.get('DOC-25').onPress();assert.match(h.render(),/Detail 25/);h.props.detailBackRef.current();assert.match(h.render(),/2.*\/.*3/);assert.equal(h.requests.length,2);
  h.buttons.get('Next').onPress();h.render();await h.flush();await h.resolve(page(rows(41,5,type),45,3));assert.equal(h.cards.size,5);assert.equal(h.buttons.get('Next').disabled,true);
});
test('search resets page, debounces and ignores an older response',async()=>{
  const h=harness();await h.load();h.buttons.get('Next').onPress();h.render();await h.flush();await h.resolve(page(rows(21,20),45,2));
  h.search().onChangeText('old');h.render();await h.flush();const old=h.requests.at(-1);assert.equal(old.page,1);
  h.search().onChangeText('new');h.render();await h.flush();await h.resolve(page([{...rows(1,1)[0],documentNo:'NEW'}],1));old.resolve(page(rows(90,1),1));await tick();
  assert.match(h.render(),/NEW/);assert.ok(!h.cards.has('DOC-90'));h.search().onClear();h.render();await h.flush();assert.equal(h.requests.at(-1).query,'');
});
test('refresh corrects an emptied final page and error retry settles refresh',async()=>{
  const h=harness();await h.load();h.buttons.get('Next').onPress();h.render();await h.flush();await h.resolve(page(rows(21,20),45,2));
  h.props.reloadToken=1;h.render();await h.flush();await h.resolve(page([],19,2));await h.flush();assert.equal(h.requests.at(-1).page,1);await h.resolve(page(rows(1,19),19));assert.equal(h.settled.at(-1),1);
  h.search().onChangeText('query');h.render();await h.flush();h.requests.at(-1).reject(new Error('offline'));await tick();assert.match(h.render(),/Could not load documents/);
  h.buttons.get(contracts.common.retry).onPress();h.render();await h.flush();await h.resolve(page([],0));assert.match(h.render(),/No documents match/);
});
test('detail refetches signed URL on refresh and does not show a stale document after failure',async()=>{
  const h=harness();await h.load();h.cards.get('DOC-1').onPress();h.render();h.mountDetail();assert.equal(h.requests.at(-1).kind,'contract');assert.equal(h.requests.at(-1).id,1);
  await h.resolve({...rows(1,1)[0],documentUrl:'https://example.invalid/first.pdf'});assert.doesNotMatch(h.render(),/Preview https/);
  h.buttons.get(contracts.party.viewContractDocument).onPress();assert.match(h.render(),/Preview https/);
  h.currentProps().reloadToken=2;assert.match(h.render(),/Preview/);assert.match(h.render(),/Loading/);
  h.requests.at(-1).reject(new Error('offline'));await tick();const html=h.render();assert.doesNotMatch(html,/first.pdf/);assert.match(html,/Could not load documents/);assert.equal(h.settled.at(-1),2);
  h.buttons.get(contracts.common.retry).onPress();h.render();await h.resolve({...rows(1,1)[0],documentUrl:null});assert.match(h.render(),/No document file/);
});

test('document is opened only by its view button; close and Android back return to the same details',async()=>{
  const h=harness();await h.load();h.cards.get('DOC-1').onPress();h.render();h.mountDetail();
  await h.resolve({...rows(1,1)[0],documentUrl:'https://example.invalid/contract.pdf'});
  assert.doesNotMatch(h.render(),/Preview https/);assert.equal(h.modal().visible,false);
  h.buttons.get(contracts.party.viewContractDocument).onPress();assert.match(h.render(),/Preview https/);
  h.cards.get(contracts.common.closeDocument).onPress();assert.doesNotMatch(h.render(),/Preview https/);
  h.buttons.get(contracts.party.viewContractDocument).onPress();h.render();h.modal().onRequestClose();
  const html=h.render();assert.doesNotMatch(html,/Preview https/);assert.match(html,/DOC-1/);assert.equal(h.requests.length,2);
});
