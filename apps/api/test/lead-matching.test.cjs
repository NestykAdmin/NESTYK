const { test }=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');require('reflect-metadata');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(require('node:fs').readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},fileName:filename}).outputText,filename);
const M=require('../src/agent/leads/lead-matching.ts');
const {LeadMatchingService}=require('../src/agent/leads/lead-matching.service.ts');const {LeadMatchingController}=require('../src/agent/leads/lead-matching.controller.ts');
const {AuthService}=require('../src/auth/auth.service.ts');const {Module}=require('@nestjs/common');const {NestFactory}=require('@nestjs/core');

const asok={rank:1,name:'BTS Asok',latitude:13.737,longitude:100.56};
const lead={budgetMax:15000,radiusKm:3,pins:[asok],leaseDurationMonths:12,desiredRoomTypeCode:'studio',moveInPlan:'2026-11-01'};
/** Room `km` north of Asok (1° latitude ≈ 111.19 km on the haversine sphere). */
const room=(id,km,extra={})=>({id,latitude:asok.latitude+km/111.195,longitude:asok.longitude,prices:[{termMonths:12,price:12000}],roomTypeCode:'studio',availableFromDate:'2026-11-01',...extra});

test('scoring keeps rooms within budget and twice the radius, best first',()=>{
 const rooms=[room(1,1),room(2,4.5),room(3,1,{prices:[{termMonths:12,price:16000}]}),room(4,6.5),room(5,1,{latitude:null}),room(6,1,{prices:[{termMonths:6,price:9000}],roomTypeCode:'1br',availableFromDate:'2026-11-16'})];
 const matches=M.matchLeadRooms(lead,rooms);
 assert.deepEqual(matches.map(m=>m.roomId),[1,2,6]);
 const [full,near,partial]=matches;
 assert.equal(full.score,100);assert.equal(full.comparison.location.status,'pass');assert.equal(full.price,12000);assert.equal(full.termMonths,12);
 assert.equal(near.comparison.location.status,'near');assert.equal(near.locationScore,50);assert.equal(near.score,90);
 // lease missing (0) + room type mismatch (0) + 15 days late (50) + budget/location 100 → 50
 assert.equal(partial.comparison.lease.status,'mismatch');assert.equal(partial.comparison.roomType.status,'mismatch');assert.equal(partial.comparison.moveIn.daysLate,15);
 assert.equal(partial.score,50);assert.equal(partial.price,9000);assert.equal(partial.termMonths,6);
 assert.deepEqual(M.matchLeadRooms({...lead,pins:[]},rooms),[]);
 assert.deepEqual(M.matchLeadRooms({...lead,budgetMax:null},rooms),[]);
});

test('lower-ranked pins weigh less and unfilled criteria leave the average',()=>{
 const second={...asok,rank:2,name:'Second'};
 const [m]=M.matchLeadRooms({...lead,pins:[second],leaseDurationMonths:null,desiredRoomTypeCode:null,moveInPlan:'next month'},[room(1,1)]);
 assert.equal(m.locationScore,85);assert.equal(m.comparison.moveIn.status,'notEvaluable');assert.equal(m.score,93);
 assert.equal(m.pinRank,2);
});

test('settings filter by score and cap results; invalid values are rejected',()=>{
 const matches=M.matchLeadRooms(lead,[room(1,1),room(2,4.5),room(6,1,{prices:[{termMonths:6,price:9000}],roomTypeCode:'1br',availableFromDate:'2026-11-16'})]);
 assert.deepEqual(M.applyMatchSettings(matches,{minScore:60,maxScore:100,maxResults:10}).map(m=>m.roomId),[1,2]);
 assert.deepEqual(M.applyMatchSettings(matches,{minScore:50,maxScore:100,maxResults:10}).map(m=>m.roomId),[1,2,6]);
 const scores=matches.map(m=>m.score);
 assert.deepEqual(M.applyMatchSettings(matches,{minScore:0,maxScore:Math.max(...scores)-5,maxResults:10}).map(m=>m.score),scores.filter(s=>s<=Math.max(...scores)-5),'rooms above maxScore are left out');
 assert.deepEqual(M.applyMatchSettings(Array.from({length:30},(_,i)=>({...matches[0],roomId:i})),{minScore:50,maxScore:100,maxResults:20}).length,20);
 assert.deepEqual(M.effectiveMatchSettings(null),{minScore:50,maxScore:100,maxResults:10});
 assert.deepEqual(M.effectiveMatchSettings({minScore:70,maxResults:7}),{minScore:70,maxScore:100,maxResults:10});
 assert.deepEqual(M.effectiveMatchSettings({minScore:63,maxResults:20}),{minScore:50,maxScore:100,maxResults:20});
 assert.deepEqual(M.effectiveMatchSettings({minScore:40,maxScore:80,maxResults:10}),{minScore:40,maxScore:80,maxResults:10});
 assert.deepEqual(M.effectiveMatchSettings({minScore:80,maxScore:80,maxResults:10}),{minScore:80,maxScore:100,maxResults:10},'a range narrower than the gap falls back');
 assert.deepEqual(M.effectiveMatchSettings({minScore:100,maxResults:10}),{minScore:50,maxScore:100,maxResults:10});
 for(const minScore of [0,35,55,65,95,100]) assert.deepEqual(M.validateMatchSettings({minScore}),{minScore});
 assert.deepEqual(M.validateMatchSettings({minScore:40,maxScore:80}),{minScore:40,maxScore:80});
 for(const body of [null,[],{minScore:-5},{minScore:63},{minScore:105},{minScore:62.5},{maxScore:101},{maxScore:'90'},{maxResults:0},{minScore:'60'}]) assert.throws(()=>M.validateMatchSettings(body),undefined,JSON.stringify(body));
 assert.doesNotThrow(()=>M.assertScoreRange({minScore:75,maxScore:80,maxResults:10}));
 for(const s of [{minScore:80,maxScore:80},{minScore:85,maxScore:80}]) assert.throws(()=>M.assertScoreRange({...s,maxResults:10}),undefined,JSON.stringify(s));
});

test('input hash follows matching fields and settings only; search boxes cover the full reach',()=>{
 const settings={minScore:50,maxScore:100,maxResults:10};const base=M.matchInputHash(lead,settings);
 const {maxScore:_,...beforeMaxScore}=settings;
 assert.equal(M.matchInputHash(lead,beforeMaxScore),base,'runs saved before maxScore existed keep their fingerprint');
 assert.notEqual(M.matchInputHash(lead,{...settings,maxScore:90}),base);
 assert.equal(M.matchInputHash({...lead},settings),base);
 assert.notEqual(M.matchInputHash({...lead,budgetMax:16000},settings),base);
 assert.notEqual(M.matchInputHash({...lead,pins:[{...asok,latitude:13.8}]},settings),base);
 assert.notEqual(M.matchInputHash(lead,{...settings,minScore:60}),base);
 const [box]=M.pinSearchBoxes(lead);
 const edge=room(1,5.99);const east=asok.longitude+5.99/(111.195*Math.cos(asok.latitude*Math.PI/180));
 assert.ok(edge.latitude<box.maxLat&&edge.latitude>box.minLat);assert.ok(east<box.maxLng);
});

function fakeService(){
 const leadRow={id:5,created_by_user_id:7,status:'inprogress',budget_max:'15000.00',radius_km:3,lease_duration_months:12,move_in_plan:'2026-11-01',desired_room_type:{code:'studio'},match_settings:null,pins:[{rank:1,name:asok.name,latitude:asok.latitude,longitude:asok.longitude}]};
 const leads={findOne:async({where})=>where.id===leadRow.id&&where.created_by_user_id===leadRow.created_by_user_id?{...leadRow,pins:[...leadRow.pins]}:null,update:async(where,patch)=>Object.assign(leadRow,patch)};
 const runs=[];const results=[];let seq=0;
 const runRepo={create:b=>({...b}),save:async b=>{const r={...b,id:++seq,created_at:new Date(Date.now()+seq)};runs.push(r);return r;},
  find:async({where,take})=>runs.filter(r=>r.lead_id===where.lead_id).sort((a,b)=>b.id-a.id).slice(0,take),
  delete:async({lead_id,id})=>{const keep=id?id._value._value:[];for(let i=runs.length-1;i>=0;i--)if(runs[i].lead_id===lead_id&&!keep.includes(runs[i].id))runs.splice(i,1);
   for(let i=results.length-1;i>=0;i--)if(!runs.some(r=>r.id===results[i].run_id))results.splice(i,1);},
  findOne:async({where})=>runs.filter(r=>r.lead_id===where.lead_id).sort((a,b)=>b.id-a.id)[0]??null};
 const resultRepo={create:list=>list.map(r=>({...r})),save:async list=>{results.push(...list);return list;},find:async({where})=>results.filter(r=>r.run_id===where.run_id).sort((a,b)=>a.rank-b.rank)};
 leads.manager={transaction:async fn=>fn({getRepository:e=>e.name==='LeadEntity'?leads:e.name==='LeadMatchRunEntity'?runRepo:resultRepo})};
 let inventory=[room(11,1),room(12,4.5),room(13,1,{prices:[{termMonths:12,price:20000}]})];const filters=[];
 const listings={matchCandidates:async(agentId,filter)=>{filters.push({agentId,...filter});return inventory;},
  cardsByIds:async(agentId,ids)=>ids.filter(id=>inventory.some(r=>r.id===id)).map(id=>({id,listingTitle:`Room ${id}`,roomStatusCode:'available'}))};
 const service=new LeadMatchingService(leads,runRepo,resultRepo,listings);
 return {service,leadRow,runs,results,filters,setInventory:list=>{inventory=list;}};
}

test('match HTTP API runs on demand, stores the run, and flags stale results',async(t)=>{
 process.env.ALLOW_DEV_AUTH='true';
 const f=fakeService();
 class TestModule{};Module({controllers:[LeadMatchingController],providers:[{provide:LeadMatchingService,useValue:f.service},{provide:AuthService,useValue:{findBySupabaseUserId:async id=>({id:Number(id)}),loadUserWithRoles:async id=>({id,roleNames:id===8?['guest']:['agent']})}}]})(TestModule);
 const app=await NestFactory.create(TestModule,{logger:false});t.after(()=>app.close());app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=(await app.getUrl())+'/api/v1/agent/leads/';
 const headers=id=>({'Content-Type':'application/json',Authorization:`Bearer dev|${id}|test@example.invalid`});
 const call=(path,{method='GET',user=7,body}={})=>fetch(base+path,{method,headers:headers(user),body:body==null?undefined:JSON.stringify(body)});

 assert.equal((await fetch(base+'5/match-runs/latest')).status,401);
 assert.equal((await call('5/match-runs',{method:'POST',user:8})).status,403);
 assert.equal((await call('5/match-runs',{method:'POST',user:9})).status,404);

 const empty=await call('5/match-runs/latest');assert.equal(empty.status,200);assert.deepEqual(await empty.json(),{run:null,items:[]});
 const settings=await (await call('5/match-settings')).json();
 assert.deepEqual(settings,{saved:null,effective:{minScore:50,maxScore:100,maxResults:10},defaults:{minScore:50,maxScore:100,maxResults:10}});

 assert.equal(f.leadRow.updated_at,undefined);
 const first=await call('5/match-runs',{method:'POST'});assert.equal(first.status,201);const ran=await first.json();
 assert.ok(f.leadRow.updated_at instanceof Date,'a run moves the lead updated_at');
 assert.deepEqual(ran.items.map(i=>i.room.id),[11,12]);
 assert.equal(ran.run.candidateCount,2);assert.equal(ran.run.resultCount,2);assert.equal(ran.run.topScore,100);assert.equal(ran.run.stale,false);
 assert.equal(ran.items[0].score,100);assert.equal(ran.items[0].comparison.budget.headroom,3000);assert.equal(ran.items[0].room.listingTitle,'Room 11');
 assert.equal(f.filters[0].agentId,7);assert.equal(f.filters[0].maxPrice,15000);assert.equal(f.filters[0].boxes.length,1);
 assert.deepEqual(f.results.map(r=>[r.rank,r.rent_room_id,r.price]),[[1,11,'12000'],[2,12,'12000']]);

 const latest=await (await call('5/match-runs/latest')).json();
 assert.equal(latest.run.runId,ran.run.runId);assert.deepEqual(latest.items.map(i=>[i.room.id,i.score,i.price]),[[11,100,12000],[12,90,12000]]);

 f.setInventory([room(12,4.5)]);
 const gone=await (await call('5/match-runs/latest')).json();assert.deepEqual(gone.items.map(i=>i.room.id),[12]);

 assert.equal((await call('5/match-settings',{method:'PATCH',body:{minScore:63}})).status,400);
 assert.equal((await call('5/match-settings',{method:'PATCH',body:{minScore:60,maxScore:60}})).status,400);
 assert.equal((await call('5/match-settings',{method:'PATCH',body:{maxScore:40}})).status,400,'checked against the saved minScore');
 const saved=await (await call('5/match-settings',{method:'PATCH',body:{minScore:80}})).json();
 assert.deepEqual(saved.effective,{minScore:80,maxScore:100,maxResults:10});assert.deepEqual(f.leadRow.match_settings,{minScore:80,maxScore:100,maxResults:10});
 assert.equal((await (await call('5/match-runs/latest')).json()).run.stale,true);

 f.setInventory([room(11,1),room(14,1,{prices:[{termMonths:6,price:9000}],roomTypeCode:'1br',availableFromDate:'2026-11-16'})]);
 const rerun=await (await call('5/match-runs',{method:'POST'})).json();
 assert.deepEqual(rerun.items.map(i=>i.room.id),[11]);assert.equal(rerun.run.candidateCount,2);assert.equal(rerun.run.stale,false);
 assert.deepEqual(rerun.run.settings,{minScore:80,maxScore:100,maxResults:10});

 for(let i=0;i<6;i++) await call('5/match-runs',{method:'POST'});
 assert.equal(f.runs.length,5);

 assert.equal((await fetch(base+'5/match-runs',{method:'DELETE'})).status,401);
 assert.equal((await call('5/match-runs',{method:'DELETE',user:9})).status,404);
 assert.equal(f.runs.length,5);
 const cleared=await call('5/match-runs',{method:'DELETE'});assert.equal(cleared.status,204);
 assert.equal(f.runs.length,0);assert.equal(f.results.length,0);
 assert.deepEqual(await (await call('5/match-runs/latest')).json(),{run:null,items:[]});
 assert.deepEqual(f.leadRow.match_settings,{minScore:80,maxScore:100,maxResults:10});

 f.leadRow.radius_km=null;
 const notReady=await call('5/match-runs',{method:'POST'});assert.equal(notReady.status,422);assert.equal((await notReady.json()).code,'LEAD_NOT_READY');
 f.leadRow.radius_km=3;f.leadRow.status='booked';
 assert.equal((await call('5/match-runs',{method:'POST'})).status,409);
});
