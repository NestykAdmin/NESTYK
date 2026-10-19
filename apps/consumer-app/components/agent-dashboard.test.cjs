const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'../../..');
const code=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
function load(file,mock){const m={exports:{}};new Function('require','module','exports',code(file))(mock,m,m.exports);return m.exports}
function dataModule(file){return load(file,name=>dataModule(path.resolve(path.dirname(file),name+'.ts')))}
const {en}=dataModule(root+'/packages/i18n/src/locales/en.ts');
const {tokens}=dataModule(root+'/packages/ui/src/theme/tokens.ts');
const utils=dataModule(root+'/packages/feature-listing/src/dashboard/types.ts');
const {createAgentDashboardDemoFixture}=load(root+'/packages/feature-listing/src/dashboard/demo-fixture.ts',()=>utils);
const fixture=()=>{const value=createAgentDashboardDemoFixture({greetingName:'Demo',localDateLabel:'Today',now:new Date('2026-10-16T03:00:00Z')});return {...value,computedAt:'2026-10-16T03:00:00Z',today:'2026-10-16',period:'2026-10',timezone:'Asia/Bangkok'}};
const native=tag=>({children})=>React.createElement(tag,{},children);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function harness(){
 const states=[],refs=[],deps=[],cleanup=[],effects=[],timers=[],requests=[],buttons=new Map(),settled=[];
 let si=0,ri=0,ei=0,overview,work,childType,mode='overview',props;
 const hooked={...React,
  createElement:(type,p,...children)=>{if(mode==='overview'&&type?.name==='DashboardWorkList'){work=p;childType=type;return React.createElement('p',{},'Work list')}return React.createElement(type,p,...children)},
  useState(initial){const i=si++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v}]},useRef(initial){return refs[ri++]??={current:initial}},
  useContext:()=>({scrollTo:()=>{}}),useCallback:fn=>fn,
  useEffect(fn,next){const i=ei++,old=deps[i];if(!old||next.some((v,j)=>old[j]!==v)){effects.push(()=>{cleanup[i]?.();cleanup[i]=fn()});deps[i]=next}},
 };
 const mock=name=>{
  if(name==='react')return hooked;
  if(name==='react-native')return{View:native('div'),Text:native('span'),Pressable:props=>React.createElement('button',{},props.children),StyleSheet:{create:x=>x}};
  if(name==='@nestyk/i18n')return{useLocale:()=>({t:en,locale:'en'})};
  if(name==='@nestyk/ui/native')return{tokens,useMobileTheme:()=>({theme:{}}),ModePageScrollContext:{},MobileIcon:()=>null,MobileBrandLoader:()=>React.createElement('p',{},'Loading'),
   MobileButton:p=>{buttons.set(p.children,p);return React.createElement('button',{},p.children)},MobileListSearchRow:p=>{buttons.set('Search',p);return null}};
  if(name==='@nestyk/feature-listing')return{MobileAgentDashboardBody:p=>{overview=p;return React.createElement('p',{},'Overview')}};
  if(name==='../lib/agent-dashboard-api')return{fetchAgentDashboard:()=>{const r=deferred();requests.push(r);return r.promise},fetchDashboardWork:(kind,period,q,page)=>{const r={...deferred(),kind,period,q,page};requests.push(r);return r.promise}};
  throw Error(name);
 };
 const m={exports:{}};new Function('require','module','exports','setTimeout','clearTimeout',code(path.join(__dirname,'AgentDashboardBody.tsx')))(mock,m,m.exports,fn=>{const t={fn,active:true};timers.push(t);return t},t=>t.active=false);
 props={greetingName:'Demo',initials:'D',reloadToken:0,onReloadSettled:token=>settled.push(token),onNavigate:()=>{},onDetailStateChange:()=>{},backRef:{current:null},memoryRef:{current:{account:'a',kind:null,query:'',page:1}},account:'a'};
 const render=()=>{si=ri=ei=0;buttons.clear();overview=work=null;const html=renderToStaticMarkup(React.createElement(mode==='overview'?m.exports.AgentDashboardBody:childType,props));effects.splice(0).forEach(fn=>fn());return html};
 const resolve=async(data=fixture())=>{requests.at(-1).resolve(data);await tick();return render()};
 const flush=async()=>{timers.splice(0).forEach(t=>{if(t.active)t.fn()});await tick()};
 const unmount=()=>cleanup.forEach(fn=>fn?.());
 return{render,resolve,flush,requests,buttons,settled,props,currentProps:()=>props,overview:()=>overview,work:()=>work,unmount,
  mountWork(){const value=work;unmount();states.length=refs.length=deps.length=cleanup.length=0;mode='work';props=value;render()}};
}
test('dashboard loads API data with no demo, refresh settles after the request, failures retry',async()=>{
 const h=harness();assert.match(h.render(),/Loading/);assert.deepEqual(h.settled,[]);await h.resolve();assert.equal(h.overview().snapshot.isDemoPreview,false);assert.deepEqual(h.settled,[0]);
 h.props.reloadToken=2;h.render();assert.equal(h.requests.length,2);assert.match(h.render(),/Loading/);assert.equal(h.settled.at(-1),0);
 h.requests.at(-1).reject(new Error('offline'));await tick();assert.match(h.render(),/Could not load the dashboard/);assert.equal(h.settled.at(-1),2);
 h.buttons.get(en.contracts.common.retry).onPress();h.render();await h.resolve();assert.equal(h.overview().snapshot.business.availableListings,20);
});
test('an unmounted account cannot publish a late response or settle another account’s refresh',async()=>{
 const h=harness();h.render();const old=h.requests[0];h.unmount();old.resolve(fixture());await tick();assert.deepEqual(h.settled,[]);
});
test('supported work and payments open the correct list, preserve navigation memory and close through shell back',async()=>{
 const h=harness();h.render();await h.resolve();h.overview().onNavigate({type:'tab',tab:'clients',filter:{kind:'work',work:'awaiting_signature'}});h.render();assert.equal(h.work().kind,'awaiting_signature');assert.equal(h.work().period,'2026-10');
 assert.equal(h.props.memoryRef.current.kind,'awaiting_signature');h.props.backRef.current();h.render();assert.equal(h.props.memoryRef.current.kind,null);
 h.overview().onNavigate({type:'action',id:'viewPayments'});h.render();assert.equal(h.work().kind,'rent');
});
test('upcoming expiry opens the tenants menu with its existing renewal work filter',async()=>{
 const h=harness(),links=[];h.props.onNavigate=link=>links.push(link);h.render();await h.resolve();
 const link={type:'tab',tab:'clients',filter:{kind:'work',work:'renewal'}};
 h.overview().onNavigate(link);h.render();
 assert.deepEqual(links,[link]);assert.equal(h.work(),null);assert.equal(h.props.memoryRef.current.kind,null);assert.equal(h.props.backRef.current,null);
});
test('work pagination uses server totals, searches globally, ignores stale results and remembers the page',async()=>{
 const h=harness();h.render();await h.resolve();h.overview().onNavigate({type:'tab',tab:'clients',filter:{kind:'work',work:'awaiting_signature'}});h.render();h.mountWork();await h.flush();
 await h.resolve({items:[],total:45,page:1,limit:20});h.buttons.get(en.agent.leads.next).onPress();h.render();await h.flush();assert.equal(h.requests.at(-1).page,2);
 await h.resolve({items:[],total:45,page:2,limit:20});assert.equal(h.currentProps().memoryRef.current.page,2);
 h.buttons.get('Search').onChangeText('old');h.render();await h.flush();const old=h.requests.at(-1);assert.equal(old.page,1);
 h.buttons.get('Search').onChangeText('new');h.render();await h.flush();await h.resolve({items:[],total:0,page:1,limit:20});old.resolve({items:[],total:99,page:1,limit:20});await tick();assert.match(h.render(),/0 results/);
});
test('empty live overview still labels follow-up and both commission amounts unsupported, with no money placeholders',()=>{
 const buttons=[];
 const module=load(root+'/packages/feature-listing/src/components/MobileAgentDashboardBody.tsx',name=>{
  if(name==='react')return React;
  if(name==='react-native')return{View:native('div'),Text:native('span'),Pressable:p=>{buttons.push(p);return React.createElement('button',{disabled:p.disabled},p.children)},StyleSheet:{create:x=>x,hairlineWidth:1}};
  if(name==='@nestyk/i18n')return{useLocale:()=>({t:en,locale:'en'})};
  if(name==='@nestyk/ui/native')return{tokens,useMobileTheme:()=>({theme:{}}),getCardElevation:()=>({}),MobileIcon:()=>null,MobileProfileAvatar:()=>null,MobileButton:native('button')};
  if(name==='../dashboard/types')return utils;
  throw Error(name);
 });
 const s=fixture();s.isDemoPreview=false;s.business.commissionPending=null;s.commission={...s.commission,status:'not_configured',total:null,received:null,pending:null};
 s.actionRequired.items=[{id:'follow',kind:'lead_follow_up',status:'not_configured',count:null,deepLink:{type:'tab',tab:'listingLead'}}];s.schedule.items=[];s.activity.items=[];s.inventory.preview=[];
 const html=renderToStaticMarkup(React.createElement(module.MobileAgentDashboardBody,{snapshot:s,onNavigate:()=>{}}));
 assert.equal((html.match(/Not supported yet/g)||[]).length,4);assert.match(html,/No urgent work/);assert.match(html,/No recent activity/);assert.doesNotMatch(html,/45,000|117,000|72,000/);assert.equal(buttons.filter(b=>b.disabled).length,2);
});
test('today schedule renders every appointment immediately, including past and completed items, in time order',()=>{
 const buttons=[],links=[];
 const module=load(root+'/packages/feature-listing/src/components/MobileAgentDashboardBody.tsx',name=>{
  if(name==='react')return React;
  if(name==='react-native')return{View:native('div'),Text:native('span'),Pressable:p=>{buttons.push(p);return React.createElement('button',{},p.children)},StyleSheet:{create:x=>x,hairlineWidth:1}};
  if(name==='@nestyk/i18n')return{useLocale:()=>({t:en,locale:'en'})};
  if(name==='@nestyk/ui/native')return{tokens,useMobileTheme:()=>({theme:{}}),getCardElevation:()=>({}),MobileIcon:()=>null,MobileProfileAvatar:()=>null,MobileButton:native('button')};
  if(name==='../dashboard/types')return utils;
  throw Error(name);
 });
 const s=fixture();s.isDemoPreview=false;
 s.schedule.items=[5,2,4,1,3].map(n=>({id:String(n),startsAt:`2026-10-16T0${n}:00:00Z`,title:`Appointment number ${n}`,contactName:'Lobby',kind:'custom',status:n===3?'done':'scheduled'}));s.schedule.total=5;
 const originalNow=Date.now;Date.now=()=>+new Date('2026-10-16T10:00:00Z');
 let html;try{html=renderToStaticMarkup(React.createElement(module.MobileAgentDashboardBody,{snapshot:s,onNavigate:link=>links.push(link)}));}finally{Date.now=originalNow;}
 const positions=[1,2,3,4,5].map(n=>html.indexOf(`Appointment number ${n}`));assert.ok(positions.every(n=>n>=0));assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
 assert.doesNotMatch(html.slice(html.indexOf('Today&#x27;s schedule'),html.indexOf('Listing inventory')),/>Scheduled<|>Completed<|>Confirmed<|>Pending</);assert.ok(!html.includes(en.agent.dashboard.noAppointments));assert.ok(!html.includes(en.agent.dashboard.showMoreSchedule));
 for(const button of buttons)button.onPress?.();assert.equal(links.filter(link=>link.id==='viewAppointment').length,5);
});
test('the next appointment at load time is highlighted until the schedule is replaced',()=>{
 const buttons=[];
 const module=load(root+'/packages/feature-listing/src/components/MobileAgentDashboardBody.tsx',name=>{
  if(name==='react')return React;
  if(name==='react-native')return{View:native('div'),Text:native('span'),Pressable:p=>{buttons.push(p);return React.createElement('button',{},p.children)},StyleSheet:{create:x=>x,hairlineWidth:1}};
  if(name==='@nestyk/i18n')return{useLocale:()=>({t:en,locale:'en'})};
  if(name==='@nestyk/ui/native')return{tokens,useMobileTheme:()=>({theme:{}}),getCardElevation:()=>({}),MobileIcon:()=>null,MobileProfileAvatar:()=>null,MobileButton:native('button')};
  if(name==='../dashboard/types')return utils;
  throw Error(name);
 });
 const paint=(items,now)=>{
  buttons.length=0;
  const s=fixture();s.isDemoPreview=false;s.schedule.items=items;s.schedule.total=items.length;
  const originalNow=Date.now;Date.now=()=>+new Date(now);
  try{renderToStaticMarkup(React.createElement(module.MobileAgentDashboardBody,{snapshot:s,onNavigate:()=>{}}));}
  finally{Date.now=originalNow;}
  return buttons.filter(button=>button.style?.({pressed:false})?.[1]?.backgroundColor===tokens.colors.brand[50]).map(button=>renderToStaticMarkup(React.createElement(React.Fragment,{},button.children)));
 };
 const items=[
  {id:'past',startsAt:'2026-10-16T03:00:00Z',title:'Ten',contactName:'Lobby',kind:'custom',status:'scheduled'},
  {id:'earlier',startsAt:'2026-10-16T04:00:00Z',title:'Eleven',contactName:'Lobby',kind:'custom',status:'scheduled'},
  {id:'next',startsAt:'2026-10-16T06:00:00Z',title:'One',contactName:'Lobby',kind:'custom',status:'scheduled'},
  {id:'later',startsAt:'2026-10-16T07:00:00Z',title:'Two',contactName:'Lobby',kind:'custom',status:'scheduled'},
 ];
 const highlighted=paint(items,'2026-10-16T04:30:00Z');
 assert.equal(highlighted.length,1);assert.match(highlighted[0],/One/);assert.doesNotMatch(highlighted[0],/Ten|Eleven|Two/);
 const moved=paint(items,'2026-10-16T06:30:00Z');
 assert.equal(moved.length,1);assert.match(moved[0],/Two/);
});
