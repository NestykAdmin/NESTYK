const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const rows=(start,count)=>Array.from({length:count},(_,i)=>({id:start+i,name:`Person ${start+i}`,phone:`080${start+i}`,roomCount:0}));
const response=(items,total,page=1)=>({items,total,page,limit:20});

function harness(kind='owner') {
  const states=[],refs=[],effectDeps=[],effects=[],cleanups=[],timers=[],requests=[],buttons=new Map(),cards=new Map(),settled=[],scrolls=[];
  let stateIndex,refIndex,effectIndex,search,detail;
  const dashboard={coAgentContactsAdd:'Add Co-Agent'};
  for(const prefix of ['ownerContacts','landlordContacts','leadContacts','tenantContacts','coAgentContacts'])
    Object.assign(dashboard,{[prefix+'Hint']:'Contacts',[prefix+'Search']:'Search',[prefix+'Count']:'{count} people',[prefix+'Empty']:'No people',
      [prefix+'NoResults']:'No results',[prefix+'LoadError']:'Load failed',[prefix+'Rooms']:'{count} rooms'});
  const native=tag=>({children})=>React.createElement(tag,{},children);
  const hookedReact={...React,
    useState(initial){const i=stateIndex++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v}]},
    useRef(initial){return refs[refIndex++]??={current:initial}},
    useContext:()=>({scrollTo:options=>scrolls.push(options),scrollToView:()=>{}}),
    useCallback:fn=>fn,
    useEffect(fn,deps){const i=effectIndex++,old=effectDeps[i];if(!old||deps.some((v,j)=>v!==old[j])){effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()});effectDeps[i]=deps}},
  };
  const mock=name=>{
    if(name==='react')return hookedReact;
    if(name==='react-native')return{View:native('div'),Text:native('span'),Pressable:props=>{cards.set(props.accessibilityLabel,props);return React.createElement('button',{},props.children)},Platform:{OS:'web'},StyleSheet:{create:x=>x}};
    if(name==='react-native-reanimated')return{__esModule:true,default:{View:native('section')},SlideInRight:{duration(){}}};
    if(name==='@nestyk/i18n')return{useLocale:()=>({locale:'en',t:{agent:{dashboard,leads:{previous:'Previous',next:'Next'},tenants:{clearSearch:'Clear'},listings:{retry:'Retry'}}}})};
    if(name==='@nestyk/ui/native')return{ModePageScrollContext:{},tokens:{typography:{native:{}},colors:{roles:{owner:'blue',agent:'pink'},brand:{700:'yellow'}}},useMobileTheme:()=>({theme:{},isDark:false}),
      MobileIcon:()=>null,MobileBrandLoader:()=>React.createElement('span',{},'Loading'),MobileButton:props=>{buttons.set(props.children,props);return React.createElement('button',{},props.children)},MobileListSearchRow:props=>{search=props;return React.createElement('input',{value:props.value,readOnly:true})}};
    if(name==='../lib/agent-contacts-api')return{CONTACT_PAGE_SIZE:20,listDirectoryContacts:(kind,query,page)=>{const request={...deferred(),kind,query,page};requests.push(request);return request.promise}};
    if(name==='./AgentContactDetailBody')return{AgentContactDetailBody:props=>{detail=props;return React.createElement('p',{},`Detail ${props.contactId??'new'}`)}};
    throw Error(name);
  };
  const loaded={exports:{}};
  new Function('require','module','exports','setTimeout','clearTimeout',ts.transpileModule(fs.readFileSync(path.join(__dirname,'AgentContactsBody.tsx'),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true},
  }).outputText)(mock,loaded,loaded.exports,fn=>{const timer={fn,active:true};timers.push(timer);return timer},timer=>{timer.active=false});
  const props={kind,reloadToken:0,onReloadSettled:token=>settled.push(token),onContactSaved:()=>{},onDetailStateChange:()=>{},detailActionsRef:{current:null}};
  const render=()=>{stateIndex=refIndex=effectIndex=0;buttons.clear();cards.clear();detail=null;const html=renderToStaticMarkup(React.createElement(loaded.exports.AgentContactsBody,props));effects.splice(0).forEach(fn=>fn());return html};
  const flush=async()=>{timers.splice(0).forEach(timer=>{if(timer.active)timer.fn()});await tick()};
  const resolve=async result=>{requests.at(-1).resolve(result);await tick();return render()};
  const load=async(items=rows(1,20),total=45)=>{render();await flush();return resolve(response(items,total))};
  return{render,flush,resolve,load,requests,buttons,cards,props,settled,scrolls,search:()=>search,detail:()=>detail};
}

for(const kind of ['owner','landlord','lead','tenant','coAgent'])test(`${kind}: pages show 20 rows, correct totals and the same Previous/Next controls as Leads`,async()=>{
  const h=harness(kind);let html=await h.load();assert.equal(h.cards.size,20);assert.match(html,/45 people/);assert.match(html,/1.*\/.*3/);
  assert.equal(h.buttons.get('Previous').disabled,true);assert.equal(h.buttons.get('Next').disabled,false);
  h.buttons.get('Next').onPress();h.render();await h.flush();assert.equal(h.requests.at(-1).page,2);
  html=await h.resolve(response(rows(21,20),45,2));assert.equal(h.cards.size,20);assert.ok(h.cards.has('Person 21'));assert.ok(!h.cards.has('Person 1'));
  h.buttons.get('Next').onPress();h.render();await h.flush();html=await h.resolve(response(rows(41,5),45,3));
  assert.equal(h.cards.size,5);assert.equal(h.buttons.get('Next').disabled,true);assert.equal(h.buttons.get('Previous').disabled,false);
  h.buttons.get('Previous').onPress();h.render();await h.flush();assert.equal(h.requests.at(-1).page,2);
});

test('search resets to page one, debounces typing and ignores older page responses',async()=>{
  const h=harness();await h.load();h.buttons.get('Next').onPress();h.render();await h.flush();await h.resolve(response(rows(21,20),45,2));
  h.search().onChangeText('Alice');h.render();h.search().onChangeText('Alice Smith');h.render();await h.flush();
  const alice=h.requests.at(-1);assert.equal(alice.page,1);assert.equal(alice.query,'Alice Smith');assert.equal(h.requests.length,3);
  h.search().onChangeText('Bob');h.render();await h.flush();await h.resolve(response([{...rows(90,1)[0],name:'Bob'}],1));
  alice.resolve(response([{...rows(80,1)[0],name:'Alice Smith'}],1));await tick();const html=h.render();
  assert.match(html,/Bob/);assert.doesNotMatch(html,/Alice Smith<\/button>/);assert.equal(h.cards.size,1);assert.equal(h.buttons.has('Next'),false);
  h.search().onClear();h.render();await h.flush();assert.equal(h.requests.at(-1).query,'');assert.equal(h.requests.at(-1).page,1);
});

test('opening a contact and returning retains the current page and search without another request',async()=>{
  const h=harness();await h.load();h.buttons.get('Next').onPress();h.render();await h.flush();await h.resolve(response(rows(21,20),45,2));
  h.cards.get('Person 25').onPress();assert.match(h.render(),/Detail 25/);assert.equal(h.detail().contactId,25);
  h.detail().onClose();const html=h.render();assert.match(html,/2.*\/.*3/);assert.ok(h.cards.has('Person 25'));assert.equal(h.requests.length,2);
});

test('a save reloads page membership and corrects an emptied final page before showing the list',async()=>{
  const h=harness();await h.load();h.buttons.get('Next').onPress();h.render();await h.flush();await h.resolve(response(rows(21,20),45,2));
  h.cards.get('Person 25').onPress();h.render();h.detail().onSaved({...rows(25,1)[0],name:'Renamed',email:null,lineId:null,facebook:null,note:null});
  h.render();await h.flush();assert.equal(h.requests.at(-1).page,2);await h.resolve(response([],19,2));await h.flush();
  assert.equal(h.requests.at(-1).page,1);await h.resolve(response(rows(1,19),19));h.detail().onClose();
  const html=h.render();assert.match(html,/19 people/);assert.equal(h.cards.size,19);assert.equal(h.buttons.has('Next'),false);
});

test('creating a Co-Agent returns a fresh first page without inserting a 21st local row',async()=>{
  const h=harness('coAgent');await h.load();h.buttons.get('Next').onPress();h.render();await h.flush();await h.resolve(response(rows(21,20),45,2));
  h.buttons.get('Add Co-Agent').onPress();h.render();assert.equal(h.detail().contactId,null);
  h.detail().onSaved({...rows(99,1)[0],email:null,lineId:null,facebook:null,note:null});h.render();await h.flush();
  assert.equal(h.requests.at(-1).page,1);assert.equal(h.requests.at(-1).query,'');await h.resolve(response(rows(1,20),46));h.detail().onClose();
  assert.match(h.render(),/46 people/);assert.equal(h.cards.size,20);
});

test('failed pages offer Retry, and an unchanged search cannot leave the list stuck loading',async()=>{
  const h=harness();await h.load();h.search().onChangeText('');assert.doesNotMatch(h.render(),/Loading/);
  h.buttons.get('Next').onPress();h.render();await h.flush();h.requests.at(-1).reject(Error('Network'));await tick();assert.match(h.render(),/Load failed/);
  h.buttons.get('Retry').onPress();h.render();await h.flush();assert.equal(h.requests.at(-1).page,2);await h.resolve(response(rows(21,20),45,2));assert.equal(h.cards.size,20);
});
