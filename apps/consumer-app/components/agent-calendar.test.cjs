const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'../../..');
function load(file,mock){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(mock,m,m.exports);return m.exports}
function data(file){return load(file,name=>data(path.resolve(path.dirname(file),name+'.ts')))}
const {en}=data(root+'/packages/i18n/src/locales/en.ts');
const {tokens}=data(root+'/packages/ui/src/theme/tokens.ts');
const helpers=data(root+'/apps/consumer-app/lib/agent-calendar.ts');
const viewings=load(root+'/apps/consumer-app/lib/agent-calendar-viewings.ts',()=>helpers);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function hooks(){
 const states=[],refs=[],deps=[],cleanups=[],effects=[],effectFns=[];let si=0,ri=0,ei=0;
 return{react:{...React,useState(initial){const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]},useRef(initial){return refs[ri++]??={current:initial}},useMemo:f=>f(),useCallback:f=>f,useEffect(fn,next){const i=ei++,old=deps[i];effectFns[i]=fn;if(!old||next.some((v,j)=>v!==old[j])){effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()});deps[i]=next}}},render(fn,props){si=ri=ei=0;const html=renderToStaticMarkup(React.createElement(fn,props));effects.splice(0).forEach(f=>f());return html},replayEffects(){cleanups.forEach(f=>f?.());effectFns.forEach((fn,i)=>cleanups[i]=fn())},unmount(){cleanups.forEach(f=>f?.())}};
}
function screen(){
 const h=hooks(),buttons=new Map(),inputs=new Map(),saved=[],drafts=[],updates=[];let calendarProps,modalProps;
 const native=tag=>({children})=>React.createElement(tag,{},children);
 const {AgentCalendarScreen}=load(path.join(__dirname,'AgentCalendarScreen.tsx'),name=>{
  if(name==='react')return h.react;
  if(name==='react-native')return{Modal:p=>{modalProps=p;return p.visible?React.createElement('div',{role:'dialog'},p.children):null},View:native('div'),Text:native('span'),Pressable:p=>{buttons.set(p.accessibilityLabel,p);return React.createElement('button',{},p.children)},TextInput:p=>{inputs.set(p.accessibilityLabel,p);return React.createElement('input',{value:p.value,readOnly:true})},StyleSheet:{create:x=>x}};
  if(name==='react-native-calendars')return{Calendar:p=>{calendarProps=p;return p.customHeader()}};
  if(name==='@nestyk/i18n')return{useLocale:()=>({t:en,locale:'en'})};
  if(name==='@nestyk/ui/native')return{tokens,useMobileTheme:()=>({theme:{}}),MobileIcon:()=>null,MobileButton:p=>{buttons.set(p.children,p);return React.createElement('button',{disabled:p.disabled},p.children)}};
  if(name==='../lib/agent-calendar')return helpers;
  throw Error(name);
 });
 const request=deferred();const props={events:[],loading:false,failedSources:[],onRetry:()=>{},selectedDate:'2026-10-16',visibleMonth:'2026-10-01',onSelectDate:()=>{},onMonthChange:()=>{},draft:{title:'Meet May',location:'Lobby',time:'15:30'},onDraftChange:d=>{drafts.push(d);props.draft=d},onUpdate:(id,patch)=>{updates.push({id,patch});return request.promise},onAdd:event=>{saved.push(event);return request.promise}};
 const render=()=>{buttons.clear();inputs.clear();return h.render(AgentCalendarScreen,props)};
 const open=()=>{render();buttons.get('＋ '+en.agent.calendar.add).onPress();render()};
 return{...h,props,render,open,request,buttons,inputs,saved,drafts,updates,calendar:()=>calendarProps,modal:()=>modalProps};
}
test('calendar only asks for title, location and time; creating opens the form in a modal and a second prompt waits for API acknowledgement',async()=>{
 const h=screen();h.open();assert.equal(h.saved.length,0);assert.equal(h.modal().visible,true);assert.deepEqual([...h.inputs.keys()],[en.agent.calendar.title,en.agent.calendar.location,en.agent.calendar.time]);
 const opened=h.render();assert.match(opened,/role="dialog"/);assert.ok(opened.includes('Meet May'));assert.ok(opened.includes('15:30'));assert.ok(opened.includes('Lobby'));assert.ok(!opened.includes(en.agent.calendar.createDescription));
 h.modal().onRequestClose();h.render();assert.equal(h.modal().visible,false);assert.equal(h.saved.length,0);assert.equal(h.inputs.size,0);
 h.buttons.get('＋ '+en.agent.calendar.add).onPress();h.render();h.buttons.get(en.agent.calendar.confirmCreate).onPress();const prompted=h.render();assert.equal(h.saved.length,0);assert.equal(h.modal().visible,true);assert.ok(prompted.includes(en.agent.calendar.createDescription));
 h.modal().onRequestClose();h.render();assert.equal(h.saved.length,0);assert.equal(h.inputs.get(en.agent.calendar.title).value,'Meet May');assert.ok(!h.render().includes(en.agent.calendar.createDescription));
 h.buttons.get(en.agent.calendar.confirmCreate).onPress();h.render();const confirm=h.buttons.get(en.agent.calendar.confirmCreate).onPress;const first=confirm();confirm();assert.equal(h.saved.length,1);assert.equal(h.saved[0].title,'Meet May');assert.equal('kind' in h.saved[0],false);assert.deepEqual(h.drafts,[]);
 assert.doesNotMatch(h.render(),/Appointment saved/);assert.equal(h.buttons.get(en.agent.calendar.confirmCreate).disabled,true);assert.equal(h.buttons.get(en.agent.calendar.confirmCreate).isLoading,true);assert.equal(h.inputs.size,0);h.modal().onRequestClose();h.render();assert.equal(h.modal().visible,true);
 h.request.resolve();await first;const saved=h.render();assert.match(saved,/Appointment saved/);assert.equal(h.modal().visible,false);assert.equal(h.drafts.length,1);assert.equal(h.drafts[0].title,'');
});
test('failed saves retain the form and draft, show an error and do not claim success; title is required',async()=>{
 const h=screen();h.open();h.props.draft.title='  ';h.render();await h.buttons.get(en.agent.calendar.confirmCreate).onPress();assert.match(h.render(),/Enter an appointment title/);assert.equal(h.modal().visible,true);assert.equal(h.saved.length,0);assert.ok(!h.render().includes(en.agent.calendar.createDescription));
 h.props.draft.title='Document follow-up';h.render();h.buttons.get(en.agent.calendar.confirmCreate).onPress();h.render();assert.equal(h.saved.length,0);
 const pending=h.buttons.get(en.agent.calendar.confirmCreate).onPress();h.request.reject(Error('offline'));await pending;
 const html=h.render();assert.equal(h.modal().visible,true);assert.match(html,/Could not save the appointment/);assert.doesNotMatch(html,/Appointment saved/);assert.ok(html.includes('Document follow-up'));assert.deepEqual(h.drafts,[]);assert.equal(h.buttons.get(en.agent.calendar.confirmCreate).disabled,false);
 const retry=deferred();h.props.onAdd=event=>{h.saved.push(event);return retry.promise};h.render();const next=h.buttons.get(en.agent.calendar.confirmCreate).onPress();retry.resolve();await next;const done=h.render();assert.equal(h.modal().visible,false);assert.match(done,/Appointment saved/);
});
test('manual appointments show their title without a category, while Lead viewings keep their translated label',()=>{
 const h=screen();h.props.events=[{id:'event-1',source:'manual',date:'2026-10-16',time:'15:30',kind:'Legacy category',title:'Manual',location:'',status:'scheduled'},{id:'viewing-1',source:'lead',date:'2026-10-16',time:'16:00',title:'From Lead',location:'',status:'scheduled'}];
 const html=h.render();assert.match(html,/>Manual</);assert.doesNotMatch(html,/Legacy category/);assert.match(html,/>Viewing</);
 h.props.failedSources=['lead'];assert.match(h.render(),/Could not load Lead viewings/);assert.doesNotMatch(h.render(),/No appointments on this day/);
});

function body(){
 const h=hooks(),reads=[],creates=[],updates=[],settled=[];let child;
 const {AgentCalendarBody}=load(path.join(__dirname,'AgentCalendarBody.tsx'),name=>{
  if(name==='react')return h.react;
  if(name==='./AgentCalendarScreen')return{AgentCalendarScreen:p=>{child=p;return React.createElement('p',{},'Calendar')}};
  if(name==='../lib/agent-calendar')return helpers;
  if(name==='../lib/agent-calendar-viewings')return viewings;
  if(name==='../lib/agent-leads-api')return{listAgentViewings:()=>{const r=deferred();reads.push({type:'lead',...r});return r.promise}};
  if(name==='../lib/agent-calendar-api')return{listCalendarEvents:()=>{const r=deferred();reads.push({type:'manual',...r});return r.promise},createCalendarEvent:input=>{const r={input,...deferred()};creates.push(r);return r.promise},updateCalendarEvent:(id,patch)=>{const r={id,patch,...deferred()};updates.push(r);return r.promise}};
  throw Error(name);
 });
 const props={visibleMonth:'2026-10-01',reloadToken:0,onReloadSettled:token=>settled.push(token)};
 return{...h,props,reads,creates,updates,settled,child:()=>child,render:()=>h.render(AgentCalendarBody,props)};
}
const stored={id:'event-42',title:'Meet May',kind:'Key handover',location:'Lobby',status:'scheduled',startsAt:'2026-10-16T08:30:00Z'};
test('calendar reads persisted appointments on mount and refresh; ignores stale requests and unmounted accounts',async()=>{
 const h=body();h.render();assert.equal(h.reads.length,2);h.reads[0].resolve([]);h.reads[1].resolve([stored]);await tick();h.render();assert.equal(h.child().events[0].title,'Meet May');assert.deepEqual(h.settled,[0]);
 h.props.reloadToken=1;h.render();const older=h.reads.slice(-2);h.props.visibleMonth='2026-11-01';h.render();const newer=h.reads.slice(-2);newer.forEach(r=>r.resolve([]));await tick();older.forEach(r=>r.resolve([stored]));await tick();h.render();assert.deepEqual(h.child().events,[]);
 h.props.reloadToken=2;h.render();h.unmount();h.reads.slice(-2).forEach(r=>r.resolve([stored]));await tick();assert.equal(h.settled.at(-1),1);
 const fresh=body();fresh.render();fresh.reads[0].resolve([]);fresh.reads[1].resolve([stored]);await tick();fresh.render();assert.equal(fresh.child().events[0].id,'event-42');
});
test('calendar writes title and datetime without a category to API, then reloads; partial failures preserve successful appointments',async()=>{
 const h=body();h.render();h.reads.forEach(r=>r.resolve([]));await tick();h.render();
 const write=h.child().onAdd({date:'2026-10-16',time:'15:30',title:'Meet May',location:'Lobby'});assert.equal(h.creates[0].input.title,'Meet May');assert.equal('kind' in h.creates[0].input,false);assert.ok(h.creates[0].input.startsAt.endsWith('Z'));h.creates[0].resolve(stored);await write;h.render();assert.equal(h.reads.length,3);
 h.reads[2].reject(Error('offline'));await tick();h.render();assert.deepEqual(h.child().failedSources,['manual']);assert.equal(h.child().events[0].id,'event-42');assert.equal(h.child().loading,false);
});
test('month navigation carries the selected day and clamps month end before saving',async()=>{
 const h=screen();h.props.selectedDate='2026-01-31';h.props.visibleMonth='2026-01-01';h.props.onMonthChange=month=>h.props.visibleMonth=month;h.props.onSelectDate=date=>h.props.selectedDate=date;
 h.render();h.buttons.get(en.agent.calendar.nextMonth).onPress();assert.equal(h.props.selectedDate,'2026-02-28');assert.equal(h.props.visibleMonth,'2026-02-01');
 h.open();h.buttons.get(en.agent.calendar.confirmCreate).onPress();h.render();const write=h.buttons.get(en.agent.calendar.confirmCreate).onPress();h.request.resolve();await write;assert.equal(h.saved[0].date,'2026-02-28');
});
test('manual appointments edit the same record and require confirmation before cancelling without exposing statuses',async()=>{
 const h=screen();h.props.events=[{id:'event-1',source:'manual',date:'2026-10-16',time:'15:30',title:'Original',location:'Lobby',status:'scheduled'}];h.render();
 h.buttons.get(en.agent.calendar.edit).onPress();assert.equal(h.drafts.length,0);assert.equal(h.updates.length,0);assert.match(h.render(),/role="dialog"/);assert.equal(h.inputs.size,0);assert.equal(h.modal().visible,true);h.buttons.get(en.agent.calendar.confirmEdit).onPress();const form=h.render();assert.equal(h.modal().visible,true);assert.match(form,/role="dialog"/);assert.equal(h.inputs.size,3);assert.equal(h.inputs.get(en.agent.calendar.title).value,'Original');
 h.inputs.get(en.agent.calendar.title).onChangeText('Updated');h.render();const write=h.buttons.get(en.agent.calendar.save).onPress();assert.equal(h.saved.length,0);assert.equal(h.updates[0].id,'event-1');assert.equal(h.updates[0].patch.title,'Updated');assert.equal(h.updates[0].patch.startsAt,'2026-10-16T08:30:00.000Z');h.request.resolve();await write;
 const c=screen();c.props.events=h.props.events;c.render();c.buttons.get(en.agent.calendar.cancelAppointment).onPress();assert.equal(c.updates.length,0);assert.match(c.render(),/role="dialog"/);assert.equal(c.modal().visible,true);const cancelled=c.buttons.get(en.agent.calendar.confirmCancel).onPress();assert.deepEqual(c.updates[0],{id:'event-1',patch:{status:'cancelled'}});c.request.resolve();await cancelled;
 const d=screen();d.props.events=h.props.events;const html=d.render();assert.ok(!d.buttons.has('Mark completed'));assert.ok(!d.buttons.has('Mark scheduled'));assert.doesNotMatch(html,/>Scheduled<|>Completed<|>Confirmed<|>Pending contact</);
});
test('Lead viewing statuses are preserved and manual appointment conflicts warn without blocking save',async()=>{
 for(const status of ['scheduled','done','cancelled'])assert.equal(viewings.viewingToCalendarEvent({id:1,leadName:'May',roomTitle:'Condo',scheduledAt:'2026-10-16T08:30:00Z',status}).status,status);
 const h=screen();h.props.events=[{id:'event-99',source:'manual',date:'2026-10-16',time:'15:35',title:'Keys',location:'Lobby',status:'scheduled'}];h.open();assert.match(h.render(),/Another appointment is nearby: Keys at 15:35/);assert.equal(h.modal().visible,true);
 h.buttons.get(en.agent.calendar.confirmCreate).onPress();const warned=h.render();assert.match(warned,/Another appointment is nearby: Keys at 15:35/);assert.equal(h.saved.length,0);
 const write=h.buttons.get(en.agent.calendar.confirmCreate).onPress();assert.equal(h.saved.length,1);h.request.resolve();await write;
 assert.equal(helpers.nearbyCalendarEvent([{...h.props.events[0],source:'lead',status:'done'}],'2026-10-16','15:30'),undefined);
 assert.equal(helpers.nearbyCalendarEvent(h.props.events,'2026-10-16','15:30','event-99'),undefined);
});
test('partial loading retries only the failed source and retains the other source and cached appointments',async()=>{
 const h=body();h.render();h.reads[0].reject(Error('offline'));h.reads[1].resolve([stored]);await tick();h.render();assert.equal(h.child().events[0].id,stored.id);assert.deepEqual(h.child().failedSources,['lead']);
 h.child().onRetry('lead');h.render();assert.equal(h.reads.length,3);assert.equal(h.reads[2].type,'lead');h.reads[2].resolve([]);await tick();h.render();assert.deepEqual(h.child().failedSources,[]);assert.equal(h.child().events.length,1);
 h.props.reloadToken=3;h.render();h.reads.slice(-2).forEach(r=>r.reject(Error('offline')));await tick();h.render();assert.equal(h.child().events.length,1);assert.equal(h.child().failedSources.length,2);
});
test('Bangkok appointment instants, day boundaries and display are identical on devices in other timezones',()=>{
 const original=process.env.TZ;
 try {for(const tz of ['Asia/Bangkok','America/New_York','Pacific/Honolulu','Asia/Tokyo']){
  process.env.TZ=tz;
  const input=helpers.calendarEventInput({date:'2026-10-16',time:'00:30',title:'Midnight',location:''});assert.equal(input.startsAt,'2026-10-15T17:30:00.000Z');
  const output=helpers.calendarEventFromApi({...stored,startsAt:input.startsAt});assert.equal(output.date,'2026-10-16');assert.equal(output.time,'00:30');
  assert.deepEqual(helpers.calendarDayRange('2026-10-16'),{from:'2026-10-15T17:00:00.000Z',to:'2026-10-16T17:00:00.000Z'});
  assert.deepEqual(helpers.calendarMonthSelection('2028-01-31','2028-01-01',1),{month:'2028-02-01',date:'2028-02-29'});
 }} finally {if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});
test('delayed post-save Lead responses cannot replace another lead, another account, or an unmounted screen',async()=>{
 const h=hooks(),requests=[];let current={id:5,name:'May'},account='account-a',exposed;const changed=[];
 const {useLeadRoomViewing}=load(root+'/apps/consumer-app/lib/use-lead-room-viewing.ts',name=>{
  if(name==='react')return h.react;
  if(name==='./agent-leads-api')return{listLeadViewings:async()=>[],getAgentLead:()=>{const r=deferred();requests.push(r);return r.promise}};
  throw Error(name);
 });
 function Hook(){exposed=useLeadRoomViewing(current,11,lead=>changed.push(lead),account);return null}
 const saved={id:1,leadId:5,rentRoomId:11,status:'scheduled',scheduledAt:'2026-10-17T00:00:00Z'};
 h.render(Hook,{});await tick();h.render(Hook,{});exposed.onSaved(saved);current={id:9};h.render(Hook,{});requests[0].resolve({id:5});await tick();assert.deepEqual(changed,[]);
 current={id:5};h.render(Hook,{});exposed.onSaved(saved);account='account-b';h.render(Hook,{});requests[1].resolve({id:5});await tick();assert.deepEqual(changed,[]);
 exposed.onSaved(saved);h.unmount();requests[2].resolve({id:5});await tick();assert.deepEqual(changed,[]);
});
test('Lead booking warns about manual calendar appointments and still permits saving',async()=>{
 const h=hooks(),buttons=new Map(),read=deferred(),writes=[];const now=Date.now(),next=new Date(Math.ceil((now+1)/3600000)*3600000);const manual={...stored,startsAt:new Date(+next+15*60000).toISOString(),title:'Manual appointment'};
 const native=tag=>({children})=>React.createElement(tag,{},children);
 const {LeadViewingSheet}=load(root+'/apps/consumer-app/components/LeadViewingSheet.tsx',name=>{
  if(name==='react')return h.react;
  if(name==='react-native')return{View:native('div'),Text:native('span'),Pressable:native('button'),ScrollView:native('div'),Platform:{OS:'web'},StyleSheet:{create:x=>x,hairlineWidth:1}};
  if(name==='react-native-calendars')return{Calendar:()=>null};
  if(name==='@nestyk/i18n')return{useLocale:()=>({t:en,locale:'en'}),localizedError:(_,fallback)=>fallback};
  if(name==='@nestyk/ui/native')return{tokens,useMobileTheme:()=>({theme:{}}),MobileBottomSheet:native('div'),MobileIcon:()=>null,MobileInput:()=>null,MobileButton:p=>{buttons.set(p.children,p);return React.createElement('button',{},p.children)}};
  if(name==='../lib/agent-calendar')return helpers;
  if(name==='../lib/agent-calendar-viewings')return viewings;
  if(name==='../lib/agent-calendar-api')return{listCalendarEvents:()=>read.promise};
  if(name==='../lib/agent-leads-api')return{listAgentViewings:async()=>[],createLeadViewing:async(id,body)=>{writes.push({id,body});return{id:1,leadId:id,...body,status:'scheduled'}}};
  if(name==='../lib/lead-format')return{localeTag:()=> 'en-GB'};
  if(name==='./AgentLeadDetailBody')return{SheetHeader:()=>null};
  if(name==='./ViewingTimeField')return{timePickerInline:false};
  throw Error(name);
 });
 const props={visible:true,leadId:5,roomId:11,viewing:null,onClose:()=>{},onSaved:()=>{}};
 const render=()=>{buttons.clear();return h.render(LeadViewingSheet,props)};
 render();render();read.resolve([manual]);await tick();const html=render();assert.match(html,/Another appointment is nearby: Manual appointment/);
 await buttons.get(en.agent.leads.viewing.save).onPress();assert.equal(writes.length,1);assert.equal(writes[0].body.scheduledAt,next.toISOString());
});
test('conflict detection includes appointments across midnight and ignores cancelled appointments',()=>{
 const event={id:'event-1',source:'manual',date:'2026-10-17',time:'00:15',title:'Keys',location:'',status:'scheduled'};
 assert.equal(helpers.nearbyCalendarEvent([event],'2026-10-16','23:45').id,'event-1');
 assert.equal(helpers.nearbyCalendarEvent([{...event,status:'cancelled'}],'2026-10-16','23:45'),undefined);
 assert.equal(helpers.nearbyCalendarEvent([{...event,status:'done'}],'2026-10-16','23:45').id,'event-1');
 assert.equal(helpers.calendarEventFromApi({...stored,status:'done'}).status,'scheduled');
});
test('a failed manual source leaves completed Lead viewings visible and cancelling a manual event removes only that event',async()=>{
 const lead={id:7,leadName:'May',roomTitle:'Condo',scheduledAt:'2026-10-16T08:00:00Z',status:'done'};
 const h=body();h.render();h.reads[0].resolve([lead]);h.reads[1].reject(Error('offline'));await tick();h.render();assert.equal(h.child().events[0].status,'done');assert.deepEqual(h.child().failedSources,['manual']);
 h.child().onRetry('manual');h.render();h.reads[2].resolve([stored]);await tick();h.render();
 const mutation=h.child().onUpdate(stored.id,{status:'cancelled'});h.updates[0].resolve({...stored,status:'cancelled'});await mutation;h.render();assert.deepEqual(h.child().events.map(event=>event.id),['viewing-7']);assert.equal(h.reads.at(-1).type,'manual');h.reads.at(-1).resolve([]);await tick();
});
test('returning to the same Lead does not re-enable an old post-save response',async()=>{
 const h=hooks(),request=deferred(),changed=[];let lead={id:5},result;
 const {useLeadRoomViewing}=load(root+'/apps/consumer-app/lib/use-lead-room-viewing.ts',name=>{
  if(name==='react')return h.react;
  if(name==='./agent-leads-api')return{listLeadViewings:async()=>[],getAgentLead:()=>request.promise};throw Error(name);
 });
 function Hook(){result=useLeadRoomViewing(lead,11,value=>changed.push(value),'account-a');return null}
 h.render(Hook,{});result.onSaved({id:1,leadId:5,rentRoomId:11,status:'scheduled'});lead={id:9};h.render(Hook,{});lead={id:5};h.render(Hook,{});request.resolve({id:5,name:'Stale'});await tick();assert.deepEqual(changed,[]);
});
test('a fast source becomes visible while the other source is still loading',async()=>{
 const h=body();h.render();h.reads[1].resolve([stored]);await tick();h.render();assert.equal(h.child().events[0].id,stored.id);assert.equal(h.child().loading,true);
 h.reads[0].reject(Error('offline'));await tick();h.render();assert.equal(h.child().loading,false);assert.deepEqual(h.child().failedSources,['lead']);
});
test('development Strict Mode effect replay still loads both sources and ignores the abandoned requests',async()=>{
 const h=body();h.render();h.replayEffects();assert.deepEqual(h.reads.map(read=>read.type),['lead','manual','lead','manual']);
 h.reads[0].resolve([]);h.reads[1].resolve([]);h.reads[2].resolve([{id:7,leadName:'May',roomTitle:'Room',scheduledAt:stored.startsAt,status:'scheduled'}]);h.reads[3].resolve([stored]);await tick();h.render();assert.equal(h.child().events.length,2);assert.deepEqual(h.settled,[0]);
});
test('both appointment actions open a dismissible confirmation modal before changing the form or calling the API',()=>{
 const event={id:'event-1',source:'manual',date:'2026-10-16',time:'15:30',title:'Original appointment',location:'Lobby',status:'scheduled'};
 for(const action of [en.agent.calendar.edit,en.agent.calendar.cancelAppointment]){
  const h=screen();h.props.events=[event];h.render();h.buttons.get(action).onPress();const html=h.render();
  assert.equal(h.modal().visible,true);assert.match(html,/role="dialog"/);assert.ok(html.includes('Original appointment'));assert.ok(html.includes('15:30'));assert.ok(html.includes('Lobby'));assert.equal(h.drafts.length,0);assert.equal(h.updates.length,0);
  h.modal().onRequestClose();h.render();assert.equal(h.modal().visible,false);assert.equal(h.drafts.length,0);assert.equal(h.updates.length,0);
 }
});
test('cancel confirmation prevents repeated requests and closing while saving, then shows the correct success notice',async()=>{
 const h=screen();h.props.events=[{id:'event-1',source:'manual',date:'2026-10-16',time:'15:30',title:'Original',location:'Lobby',status:'scheduled'}];h.render();h.buttons.get(en.agent.calendar.cancelAppointment).onPress();h.render();
 const confirm=h.buttons.get(en.agent.calendar.confirmCancel).onPress;const pending=confirm();confirm();h.render();assert.equal(h.updates.length,1);assert.equal(h.buttons.get(en.agent.calendar.confirmCancel).isLoading,true);h.modal().onRequestClose();h.render();assert.equal(h.modal().visible,true);
 h.request.resolve();await pending;const html=h.render();assert.equal(h.modal().visible,false);assert.ok(html.includes(en.agent.calendar.cancelSuccess));assert.ok(!html.includes(en.agent.calendar.saved));
});
test('a failed cancellation stays in its confirmation modal with an error and can be retried',async()=>{
 const h=screen();h.props.events=[{id:'event-1',source:'manual',date:'2026-10-16',time:'15:30',title:'Original',location:'Lobby',status:'scheduled'}];h.render();h.buttons.get(en.agent.calendar.cancelAppointment).onPress();h.render();
 const request=h.buttons.get(en.agent.calendar.confirmCancel).onPress();h.request.reject(Error('offline'));await request;const html=h.render();assert.equal(h.modal().visible,true);assert.ok(html.includes(en.agent.calendar.saveFailed));assert.equal(h.buttons.get(en.agent.calendar.confirmCancel).disabled,false);
 const retry=deferred();h.props.onUpdate=()=>retry.promise;h.render();const next=h.buttons.get(en.agent.calendar.confirmCancel).onPress();retry.resolve();await next;h.render();assert.equal(h.modal().visible,false);
});
