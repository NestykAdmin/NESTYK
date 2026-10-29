const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require('reflect-metadata');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,filename);
const {closeLeaseContract,contractEndReasons,validateContractClosure}=require('../src/agent/contracts/contract-closure.ts');
const {LeaseContractEntity:Contract}=require('../src/entities/lease-contract.entity.ts');
const {LeadEntity:Lead}=require('../src/entities/lead.entity.ts');
const {RentRoomEntity:Room}=require('../src/entities/rent-room.entity.ts');
const {RoomTenancyEntity:Tenancy}=require('../src/entities/room-tenancy.entity.ts');
const {AgreementTemplateEntity:Template}=require('../src/entities/agreement-template.entity.ts');
const {MasterContractEndReasonEntity:Reason}=require('../src/entities/master-contract-end-reason.entity.ts');
const {ContractDepositTransferEntity:Transfer}=require('../src/entities/contract-deposit-transfer.entity.ts');
const {TenantBillEntity:Bill}=require('../src/entities/tenant-bill.entity.ts');
const {AgreementSignInviteEntity:Invite}=require('../src/entities/agreement-sign-invite.entity.ts');
const {AgentInvoiceEntity:Invoice}=require('../src/entities/agent-invoice.entity.ts');
const RealDate=Date;
global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-10-14T05:00:00Z']));}};
const request={endReasonCode:'tenant_requested',effectiveEndDate:'2026-10-12',note:'Tenant moving out'};
const base={id:20,created_by_user_id:7,template_id:1,lead_id:1,tenant_id:2,rent_room_id:3,room_tenancy_id:4,status:'active',start_date:'2026-01-01',end_date:'2026-10-31',formKind:'lease',data:{leaseAgreement:{monthlyRent:'15000'}},document_url:'signed.pdf'};
const reasons=[
 {id:1,code:'term_completed',applicable_status:'expired',requires_note:false,is_active:true},
 {id:2,code:'tenant_requested',applicable_status:'terminated',requires_note:true,is_active:true},
 {id:3,code:'before_start_cancelled',applicable_status:'cancelled',requires_note:true,is_active:true},
 {id:4,code:'draft_cancelled',applicable_status:'cancelled',requires_note:true,is_active:true},
];
function fixture(options={}){
 const state={contracts:[{...base,...options.contract},...(options.others??[])],lead:{id:1,created_by_user_id:7,rent_room_id:3,status:'booked',tenant_id:2,booking_released_at:null},tenancy:{id:4,status:'active',move_out_date:null,...options.tenancy},invoices:structuredClone(options.invoices??[]),bills:[{id:1,status:'pending',due_date:'2026-10-15',amount:'15000.00',payment_slip_path:'pending.jpg'},{id:2,status:'paid',due_date:'2026-09-15',amount:'15000.00',payment_slip_path:'paid.jpg'}]};
 // allUpdates keeps every update sent, also those a rollback undoes.
 const updates=[],allUpdates=[],locks=[];
 let inTransaction=false,transactions=0;
 const reasonRows=reasons.map(r=>({...r,...(r.code===request.endReasonCode?options.reason:{})}));
 // IsNull() in a where clause matches a missing value, like TypeORM. A plain null/undefined or another operator is refused:
 // TypeORM would drop that condition and match every row, which this fixture cannot copy.
 const matches=(row,where)=>row&&Object.entries(where).every(([k,v])=>{
  if(v==null||(typeof v==='object'&&!(v instanceof Date)&&v.type!=='isNull'))throw Error(`where.${k}: use IsNull() or a value`);
  return typeof v==='object'&&v.type==='isNull'?row[k]==null:row[k]===v;});
 function qb(entity){const params={},clauses=[];const q={};for(const name of ['select','addSelect','leftJoin','innerJoin','orderBy'])q[name]=()=>q;q.where=q.andWhere=(sql,args)=>{clauses.push(sql);Object.assign(params,args);return q;};
 q.getCount=async()=>{
  if(entity===Transfer)return options.allocated??0;
  if(clauses.some(c=>c.includes('previous_agreement_id')))return state.contracts.filter(c=>c.previous_agreement_id===params.id&&!['expired','terminated','cancelled'].includes(c.status)).length;
  return state.contracts.filter(c=>c.id!==params.id&&!['expired','terminated','cancelled'].includes(c.status)&&(params.tenancyId!=null?c.room_tenancy_id===params.tenancyId:c.lead_id===params.leadId&&c.rent_room_id===params.roomId&&['lease','renewal'].includes(c.formKind))).length;
 };
 q.getRawOne=async()=>({unpaidCount:String(state.bills.filter(b=>b.status==='pending').length),unpaidAmount:state.bills.filter(b=>b.status==='pending').reduce((a,b)=>a+Number(b.amount),0).toFixed(2),paidCount:String(state.bills.filter(b=>b.status==='paid').length),billsDueAfterEndCount:String(state.bills.filter(b=>b.due_date>params.end).length)});return q;}
 const manager={
  findOne:async(entity,{where,lock})=>{assert.equal(lock.mode,'pessimistic_write');locks.push(entity.name);const row=entity===Contract?state.contracts.find(c=>matches(c,where)):entity===Lead?state.lead:options.foreignRoom?null:{id:3,created_by_user_id:7};return row?structuredClone(row):null;},
  findOneBy:async(entity,where)=>entity===Template?{form_kind:state.contracts[0].formKind}:reasonRows.find(r=>matches(r,where)),
  getRepository:entity=>({createQueryBuilder:()=>qb(entity)}),
  update:async(entity,where,patch)=>{updates.push({entity,where,patch});allUpdates.push({entity,where,patch});if(options.failTenancy&&entity===Tenancy)throw Error('tenancy save failed');if(entity===Invoice){let affected=0;for(const row of state.invoices)if(matches(row,where)){Object.assign(row,patch);affected++;}return {affected};}const row=entity===Contract?state.contracts.find(c=>c.id===where.id):entity===Lead?state.lead:entity===Tenancy?state.tenancy:null;if(row){const clean={...patch};if(typeof clean.move_out_date==='function'){const date=clean.move_out_date().match(/'(\d{4}-\d{2}-\d{2})'/)[1];clean.move_out_date=[row.move_out_date??'',date].sort().at(-1);}Object.assign(row,clean);}return {affected:1};},
 };
 const db={getRepository:entity=>({findOneBy:async where=>entity===Contract?structuredClone(state.contracts.find(c=>matches(c,where))??null):null,find:async()=>reasonRows}),transaction:async fn=>{
  // One transaction per closure: a nested one would commit on its own connection in Postgres.
  if(inTransaction)throw Error('nested transaction');inTransaction=true;transactions++;
  const before=structuredClone(state);try{return await fn(manager);}catch(e){Object.assign(state,before);updates.length=0;throw e;}finally{inTransaction=false;}}};
 return {db,state,updates,allUpdates,locks,transactions:()=>transactions,close:(body=request)=>closeLeaseContract(db,7,20,body)};
}
test('validates closure input and rejects spoofed state, impossible dates and unknown fields',()=>{
 assert.deepEqual(validateContractClosure({...request,note:' note '}),{...request,note:'note'});
 for(const patch of [{effectiveEndDate:'2026-02-30'},{endReasonCode:'bad code'},{note:7},{note:'a'.repeat(1001)},{status:'expired'},{billPolicy:'delete'}])assert.throws(()=>validateContractClosure({...request,...patch}));
});
test('termination atomically records reason, releases booking and occupancy, and preserves signed terms and bills',async()=>{
 const f=fixture(),terms=structuredClone(f.state.contracts[0]),bills=structuredClone(f.state.bills);
 const summary=await f.close();const c=f.state.contracts[0];
 assert.equal(c.status,'terminated');assert.equal(c.end_reason_id,2);assert.equal(c.effective_end_date,'2026-10-12');assert.equal(c.end_recorded_by_user_id,7);assert.ok(c.terminated_at);assert.equal(c.end_date,terms.end_date);assert.equal(c.document_url,terms.document_url);assert.deepEqual(c.data,terms.data);assert.deepEqual(f.state.bills,bills);
 assert.ok(f.state.lead.booking_released_at);assert.equal(f.state.lead.rent_room_id,3);assert.equal(f.state.tenancy.status,'moved_out');assert.equal(f.state.tenancy.move_out_date,'2026-10-12');
 assert.deepEqual(f.locks,[Lead.name,Room.name,Contract.name]);assert.ok(f.updates.some(u=>u.entity===Invite));
 assert.deepEqual(summary,{policy:'retain_existing',unpaidCount:1,unpaidAmount:'15000.00',paidCount:1,billsDueAfterEndCount:1});
});
test('identical closure is idempotent; conflicting repeats cannot change historical closure',async()=>{
 const f=fixture();await f.close();const original=structuredClone(f.state.contracts[0]),count=f.updates.length;await f.close();assert.equal(f.updates.length,count);assert.equal(JSON.stringify(f.state.contracts[0]),JSON.stringify(original));await assert.rejects(()=>f.close({...request,note:'Other reason'}),e=>e.getStatus()===409);
});
test('natural expiry requires the exact end date and cannot close the last occupied day',async()=>{
 const f=fixture({contract:{end_date:'2026-10-13'}});await f.close({endReasonCode:'term_completed',effectiveEndDate:'2026-10-13'});assert.equal(f.state.contracts[0].status,'expired');
 for(const contract of [{end_date:'2026-10-14'},{end_date:null},{end_date:'2026-10-31'}])await assert.rejects(()=>fixture({contract}).close({endReasonCode:'term_completed',effectiveEndDate:contract.end_date??'2026-10-13'}),e=>e.getStatus()===400);
});
test('rejects drafts, non-lease documents, unknown/inactive reasons, missing notes and dates outside term',async()=>{
 for(const options of [{contract:{status:'draft'}},{contract:{formKind:'reservation'}},{reason:{is_active:false}}]){const f=fixture(options);await assert.rejects(()=>f.close(),e=>e.getStatus()===400);assert.equal(f.updates.length,0);}
 for(const patch of [{note:''},{endReasonCode:'missing'},{effectiveEndDate:'2025-12-31'},{effectiveEndDate:'2026-10-31'},{effectiveEndDate:'2026-10-15'},{endReasonCode:'draft_cancelled'}])await assert.rejects(()=>fixture().close({...request,...patch}),e=>e.getStatus()===400);
});
test('active future renewal may be cancelled before start; an occupied lease cannot use that reason',async()=>{
 const body={endReasonCode:'before_start_cancelled',effectiveEndDate:'2026-10-12',note:'Renewal cancelled'};
 const f=fixture({contract:{formKind:'renewal',start_date:'2026-11-01',end_date:'2027-10-31'}});await f.close(body);assert.equal(f.state.contracts[0].status,'cancelled');
 await assert.rejects(()=>fixture().close(body),e=>e.getStatus()===400);
});
// D5 + D8 (Aof, 27 Oct 2026, replacing D7 of 22 Oct): a lease not handed over yet is cancelled with its deal (who caused
// it, evidence, the money: deal-cancellation.ts), so closing it here is refused and changes nothing.
test('a lease waiting for its deposit or handover cannot be closed here: it is cancelled with its deal',async()=>{
 const invoices=()=>[{id:9,lease_contract_id:20,invoice_kind:'deposit',receipt_pdf_path:null,payment_slip_path:'7/payment-slips/sent.jpg',voided_at:null}];
 for(const status of ['awaiting_deposit','awaiting_handover']){
  for(const body of [{endReasonCode:'before_start_cancelled',effectiveEndDate:'2026-10-12',note:'Tenant withdrew'},undefined]){
   const f=fixture({contract:{status,start_date:'2026-11-01',end_date:'2027-10-31'},invoices:invoices()});
   await assert.rejects(()=>f.close(body),e=>e.getStatus()===400&&e.getResponse().code==='USE_DEAL_CANCELLATION',status);
   assert.equal(f.updates.length,0,status);
   assert.equal(f.state.contracts[0].status,status);
   assert.equal(f.state.invoices[0].voided_at,null,'the deposit invoice is left to the deal cancellation');
  }
 }
 for(const status of ['awaiting_signatures','awaiting_agent_review']){const f=fixture({contract:{status}});await assert.rejects(()=>f.close(),e=>e.getStatus()===400,status);assert.equal(f.updates.length,0);}
 // An active lease is still closed, and its deposit invoice (a real debt) is not touched.
 const g=fixture({contract:{status:'active'},invoices:invoices()});await g.close();
 assert.equal(g.state.contracts[0].status,'terminated');
 assert.equal(g.updates.filter(u=>u.entity===Invoice).length,0);
});
test('a live successor prevents early termination but preserves the booking and shared occupancy when predecessor expires',async()=>{
 const successor={...base,id:21,formKind:'renewal',previous_agreement_id:20,status:'draft',start_date:'2026-10-14',end_date:'2027-10-13'};
 await assert.rejects(()=>fixture({others:[successor]}).close(),e=>e.getStatus()===409);
 const f=fixture({contract:{end_date:'2026-10-13'},others:[successor]});await f.close({endReasonCode:'term_completed',effectiveEndDate:'2026-10-13'});assert.equal(f.state.lead.booking_released_at,null);assert.equal(f.state.tenancy.status,'active');
 const cancelled=fixture({others:[{...successor,status:'cancelled'}]});await cancelled.close();assert.ok(cancelled.state.lead.booking_released_at);
});
test('closure rolls back completely if occupancy update fails and blocks approved pending carries',async()=>{
 const f=fixture({failTenancy:true});await assert.rejects(()=>f.close(),/tenancy save/);assert.equal(f.state.contracts[0].status,'active');assert.equal(f.state.lead.booking_released_at,null);assert.equal(f.updates.length,0);
 const allocated=fixture({allocated:1});await assert.rejects(()=>allocated.close(),e=>e.getStatus()===409);assert.equal(allocated.updates.length,0);
});
test('closure does not backdate an already recorded later move-out',async()=>{
 const f=fixture({contract:{end_date:'2026-10-01'},tenancy:{status:'moved_out',move_out_date:'2026-10-12'}});await f.close({endReasonCode:'term_completed',effectiveEndDate:'2026-10-01'});assert.equal(f.state.tenancy.move_out_date,'2026-10-12');
});
test('ownership scope rejects a foreign contract or room without writes',async()=>{
 const f=fixture();await assert.rejects(()=>closeLeaseContract(f.db,8,20,request),e=>e.getStatus()===404);assert.equal(f.updates.length,0);await assert.rejects(()=>fixture({foreignRoom:true}).close(),e=>e.getStatus()===404);
});
test('end reason catalog excludes the draft cancellation workflow',async()=>{
 const list=await contractEndReasons(fixture().db);assert.ok(list.some(r=>r.code==='before_start_cancelled'));assert.ok(!list.some(r=>r.code==='draft_cancelled'));
});
test('HTTP closure and reason catalog require an agent; literal catalog route is not captured by :id',async t=>{
 const {AgentContractsController}=require('../src/agent/contracts/agent-contracts.controller.ts');const {AgentContractsService}=require('../src/agent/contracts/agent-contracts.service.ts');const {AuthService}=require('../src/auth/auth.service.ts');const {Module}=require('@nestjs/common');const {NestFactory}=require('@nestjs/core');
 const previous=process.env.ALLOW_DEV_AUTH;process.env.ALLOW_DEV_AUTH='true';t.after(()=>{if(previous===undefined)delete process.env.ALLOW_DEV_AUTH;else process.env.ALLOW_DEV_AUTH=previous;});
 const calls=[];class TestModule{};Module({controllers:[AgentContractsController],providers:[{provide:AgentContractsService,useValue:{close:async(agent,id,body)=>{calls.push({agent,id,body});return {contract:{id},billing:{policy:'retain_existing'}};},endReasons:async()=>[{code:'term_completed'}],view:async()=>({wrongRoute:true})}},{provide:AuthService,useValue:{findBySupabaseUserId:async id=>({id:Number(id)}),loadUserWithRoles:async id=>({id,roleNames:id===7?['agent']:['tenant']})}}]})(TestModule);
 const app=await NestFactory.create(TestModule,{logger:false});await app.listen(0,'127.0.0.1');t.after(()=>app.close());const baseUrl=await app.getUrl();
 const send=auth=>fetch(`${baseUrl}/agent/contracts/20/close`,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},body:JSON.stringify(request)});
 assert.equal((await send()).status,401);assert.equal((await send('dev|8|test@example.invalid')).status,403);assert.equal((await send('dev|7|test@example.invalid')).status,200);assert.deepEqual(calls,[{agent:7,id:20,body:request}]);
 assert.equal((await fetch(`${baseUrl}/agent/contracts/end-reasons`)).status,401);const catalog=await fetch(`${baseUrl}/agent/contracts/end-reasons`,{headers:{Authorization:'Bearer dev|7|test@example.invalid'}});assert.deepEqual(await catalog.json(),[{code:'term_completed'}]);
});
