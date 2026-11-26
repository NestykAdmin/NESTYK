// A self owner contract has no agent room (rent_room_id null). Party endpoints reach the attachments checklist and the
// reservation appointment check for it, so neither may throw; agent rows behave as before.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(require('node:fs').readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},fileName:filename}).outputText,filename);
const { AgreementAttachmentsService }=require('../src/agent/contracts/agreement-attachments.service.ts');
const { AgentContractsService }=require('../src/agent/contracts/agent-contracts.service.ts');
const { requireRentRoomId }=require('../src/agent/contracts/contract-room.ts');

const checklistOf = (calls, coBroke) => {
 const db={
  manager:{find:async()=>[]},
  getRepository:()=>({findOneBy:async()=>({form_kind:'reservation'}),find:async()=>[]}),
 };
 const service=new AgreementAttachmentsService(db,{});
 service.rows=async()=>[];
 return service;
};

test('checklist of a contract without an agent room does not throw and has no co-broke requirement',async()=>{
 const service=checklistOf();
 const out=await service.checklistForContract({id:5,template_id:1,lead_id:2,rent_room_id:null,self_owner_room_id:9,previous_agreement_id:null});
 assert.ok(!JSON.stringify(out).includes('co_broke'));
 assert.ok(!out.requirements.some((g)=>g.subject==='co_broke'||g.group_key==='co_broke'));
});
test('checklist of an agent contract still asks whether the offer needs a co-broke file',async()=>{
 const asked=[];
 const service=new AgreementAttachmentsService({
  manager:{find:async()=>[]},
  getRepository:(entity)=>{asked.push(entity.name);return {findOneBy:async()=>null,find:async()=>[],findOne:async()=>null};},
 },{});
 service.rows=async()=>[];
 await service.checklistForContract({id:5,template_id:1,lead_id:2,rent_room_id:7,previous_agreement_id:null});
 assert.ok(asked.length>0,'coBrokeRequired must still query the offer for an agent room');
});
test('a reservation of a self owner contract does not require a broker appointment',async()=>{
 const self={hasBrokerAppointment:()=>{throw new Error('must not be asked');}};
 await AgentContractsService.prototype.assertReservationAppointment.call(self,{template:{form_kind:'reservation'},rent_room_id:null,created_by_user_id:1,tenant_id:2});
 let asked=0;
 const agent={hasBrokerAppointment:async()=>{asked++;return false;}};
 await assert.rejects(()=>AgentContractsService.prototype.assertReservationAppointment.call(agent,{template:{form_kind:'reservation'},rent_room_id:7,created_by_user_id:1,tenant_id:2}),e=>e.getStatus()===400);
 assert.equal(asked,1);
});
test('requireRentRoomId returns the room id or throws the Thai message',()=>{
 assert.equal(requireRentRoomId({id:1,rent_room_id:7}),7);
 assert.throws(()=>requireRentRoomId({id:1,rent_room_id:null}),e=>e.getStatus()===500&&e.message==='สัญญานี้ไม่ใช่ห้องของนายหน้า');
});
