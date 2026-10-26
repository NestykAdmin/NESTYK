const {test} = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(require('node:fs').readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},fileName:filename}).outputText,filename);
const { attachmentChecklist, documentsEditable, validateAttachmentInput, AgreementAttachmentsService }=require('../src/agent/contracts/agreement-attachments.service.ts');
const { ContractDocumentStorageService }=require('../src/agent/contracts/contract-document-storage.service.ts');
const { AgreementAttachmentsController }=require('../src/agent/contracts/agreement-attachments.controller.ts');
const { AuthService }=require('../src/auth/auth.service.ts');
const { Module }=require('@nestjs/common');
const { NestFactory }=require('@nestjs/core');

test('document checklist accepts current files without review and excludes missing or superseded files',()=>{
 const requirements=[{group_key:'tenant_identity',label:'Tenant',subject:'tenant',document_type_code:'national_id'},{group_key:'tenant_identity',label:'Tenant',subject:'tenant',document_type_code:'passport'}];
 const d={id:1,subject:'tenant',document_type_code:'passport',review_status:'accepted'};
 for(const review_status of ['pending','accepted','rejected']) assert.equal(attachmentChecklist(requirements,[{...d,review_status}])[0].complete,true);
 for(const docs of [[],[{...d,subject:'owner'}],[d,{id:2,supersedes_document_id:1,review_status:'pending'}]])assert.equal(attachmentChecklist(requirements,docs)[0].complete,false);
});
test('assertReady blocks signing when required checklist documents are missing',async()=>{
 const rows=[];
 const service=new AgreementAttachmentsService({
  manager:{
   find:async()=>[{group_key:'id',subject:'tenant',document_type_code:'passport'}],
   findOne:async()=>null,
  },
 }, {});
 service.rows=async()=>rows;
 await assert.rejects(()=>service.assertReady({id:11,template_id:1}),e=>e.getStatus()===400);
 rows.push({id:1,subject:'tenant',document_type_code:'passport',removed_at:null});
 await service.assertReady({id:11,template_id:1});
});
test('a party can sign once their own documents are attached',async()=>{
 const service=new AgreementAttachmentsService({
  manager:{
   find:async()=>[
    {group_key:'tenant_identity',subject:'tenant',document_type_code:'passport'},
    {group_key:'owner_identity',subject:'owner',document_type_code:'national_id'},
    {group_key:'ownership',subject:'property',document_type_code:'ownership_proof'},
   ],
  },
 }, {});
 service.rows=async()=>[{id:1,subject:'owner',document_type_code:'national_id',removed_at:null}];
 await assert.rejects(()=>service.assertReadyForSubject({id:11,template_id:1},'tenant'),e=>e.getStatus()===400);
 await service.assertReadyForSubject({id:11,template_id:1},'owner');
 await assert.rejects(()=>service.assertReady({id:11,template_id:1}),e=>e.getStatus()===400);
});
test('attachments stay editable until the lease is generated (deposit, handover or active) or reservation letter is finalized',()=>{
 assert.equal(documentsEditable({status:'draft'}),true);
 assert.equal(documentsEditable({status:'awaiting_signatures',owner_signed_at:new Date()}),true);
 assert.equal(documentsEditable({status:'awaiting_agent_review',owner_signed_at:new Date(),tenant_signed_at:new Date(),agent_signed_at:new Date()}),true);
 // D7: a generated lease waiting for its deposit or handover is past signing, so its attachments are fixed too.
 for(const status of ['active','cancelled','expired','terminated','awaiting_deposit','awaiting_handover'])
  assert.equal(documentsEditable({status}),false);
 assert.equal(documentsEditable({
  status:'awaiting_agent_review',
  document_url:'7/11/generated/reservation_letter/letter-v1/letter.pdf',
 }),false);
});
test('multipart document metadata rejects invalid subjects, type codes and replacement IDs',()=>{
 const good={subject:'tenant',documentTypeCode:'passport'};
 assert.deepEqual(validateAttachmentInput({...good,supersedesDocumentId:'12'}),{...good,supersedesDocumentId:12});
 for(const input of [null,[],{...good,subject:['tenant']},{...good,subject:'other'},{...good,documentTypeCode:'../secret'},{...good,supersedesDocumentId:'1x'}])assert.throws(()=>validateAttachmentInput(input));
});
test('file uploader enforces content signature, size, private bucket and unique paths',async()=>{
 const storage=new ContractDocumentStorageService(); let isPublic=false;const writes=[];
 storage.storage=()=>({upload:async(path,buffer,options)=>{writes.push({path,options});return {error:null};}});
 storage.client={storage:{listBuckets:async()=>({data:[{name:'contract-documents',public:isPublic}],error:null})}};
 const pdf=Buffer.from('%PDF-1.4 test');
 await assert.rejects(()=>storage.uploadAttachment(1,2,{buffer:Buffer.from('<html>'),size:6}),e=>e.getStatus()===400);
 await assert.rejects(()=>storage.uploadAttachment(1,2,{buffer:Buffer.alloc(10485761),size:1}),e=>e.getStatus()===400);
 isPublic=true;
 await assert.rejects(()=>storage.uploadAttachment(1,2,{buffer:pdf,size:pdf.length}),e=>e.getStatus()===503);
 assert.equal(writes.length,0);
 isPublic=false;
 const first=await storage.uploadAttachment(1,2,{buffer:pdf,size:pdf.length});
 const second=await storage.uploadAttachment(1,2,{buffer:pdf,size:pdf.length});
 assert.match(first.path,/^1\/2\/attachments\/.+\.pdf$/);assert.notEqual(first.path,second.path);
 assert.equal(writes[0].options.upsert,false);assert.equal(writes[0].options.contentType,'application/pdf');
});
test('foreign agreement is rejected before any file storage access',async()=>{
 const service=new AgreementAttachmentsService({manager:{findOne:async()=>null}},{uploadAttachment:()=>assert.fail('must not upload')});
 await assert.rejects(()=>service.upload(7,11,{subject:'tenant',documentTypeCode:'passport'},{buffer:Buffer.from('%PDF-'),size:5}),e=>e.getStatus()===404);
});
test('attachment HTTP routes enforce authentication and agent role, and accept metadata with a file',async t=>{
 const previous=process.env.ALLOW_DEV_AUTH;process.env.ALLOW_DEV_AUTH='true';
 t.after(()=>{if(previous===undefined)delete process.env.ALLOW_DEV_AUTH;else process.env.ALLOW_DEV_AUTH=previous;});
 class TestModule {}
 Module({controllers:[AgreementAttachmentsController],providers:[
  {provide:AgreementAttachmentsService,useValue:{remove:async(agentId,id,documentId)=>({agentId,id,documentId}),list:async(agentId,id)=>({agentId,id}),upload:async(agentId,id,input,file)=>({agentId,id,input,size:file.size}),review:async(agentId,id,documentId,input)=>({agentId,id,documentId,input})}},
  {provide:AuthService,useValue:{findBySupabaseUserId:async id=>({id:Number(id)}),loadUserWithRoles:async id=>({id,roleNames:id===7?['agent']:['tenant']})}}
 ]})(TestModule);
 const app=await NestFactory.create(TestModule,{logger:false});await app.listen(0,'127.0.0.1');t.after(()=>app.close());
 const base=`${await app.getUrl()}/agent/contracts/11/attachments`;
 const headers=id=>({Authorization:`Bearer dev|${id}|test@example.invalid`});
 assert.equal((await fetch(base)).status,401);assert.equal((await fetch(base,{headers:headers(8)})).status,403);
 assert.deepEqual(await (await fetch(base,{headers:headers(7)})).json(),{agentId:7,id:11});
 assert.equal((await fetch(`${base}/2`,{method:'DELETE'})).status,401);
 assert.equal((await fetch(`${base}/2`,{method:'DELETE',headers:headers(8)})).status,403);
 assert.deepEqual(await (await fetch(`${base}/2`,{method:'DELETE',headers:headers(7)})).json(),{agentId:7,id:11,documentId:2});
 const form=new FormData();form.append('subject','tenant');form.append('documentTypeCode','passport');form.append('file',new Blob(['%PDF-1.4'],{type:'application/pdf'}),'passport.pdf');
 const result=await fetch(base,{method:'POST',headers:headers(7),body:form});assert.equal(result.status,201);
 const uploaded=await result.json();assert.equal(uploaded.input.subject,'tenant');assert.equal(uploaded.size,8);
 // D1: the broker appointment is made as its own contract now; the generator inside a reservation's attachments is gone.
 assert.equal((await fetch(`${base}/broker-appointment/defaults`,{headers:headers(7)})).status,404);
 assert.equal((await fetch(`${base}/broker-appointment`,{method:'POST',headers:{...headers(7),'Content-Type':'application/json'},body:'{}'})).status,404);
});


test('removed current files never satisfy a requirement or revive an old version',()=>{
 const requirements=[{group_key:'id',label:'ID',subject:'tenant',document_type_code:'passport'}];
 const old={id:1,subject:'tenant',document_type_code:'passport',review_status:'accepted'};
 assert.equal(attachmentChecklist(requirements,[{...old,removed_at:new Date()}])[0].complete,false);
 assert.equal(attachmentChecklist(requirements,[old,{...old,id:2,supersedes_document_id:1,removed_at:new Date()}])[0].complete,false);
});

test('removal scopes ownership, locks closed contracts, protects required files and removes just one extra',async()=>{
 const {LeaseContractEntity}=require('../src/entities/lease-contract.entity.ts');
 const {AgreementDocumentEntity,AgreementDocumentRequirementEntity}=require('../src/entities/agreement-document.entity.ts');
 const current={id:1,subject:'tenant',document_type_code:'passport'};
 const extra={id:2,subject:'tenant',document_type_code:'other'};
 let contract={id:11,template_id:1,status:'draft'}; let writes=[];
 const manager={
  findOne:async(_entity,options)=>options.where.created_by_user_id===7?contract:null,
  find:async(entity)=>entity===AgreementDocumentEntity?[current,extra]:[{group_key:'id',label:'ID',subject:'tenant',document_type_code:'passport'}],
  update:async(entity,where,values)=>writes.push({where,values}),
 };
 const service=new AgreementAttachmentsService({manager,transaction:async fn=>fn(manager)},{});
 service.list=async()=>({ok:true});
 await assert.rejects(()=>service.remove(8,11,2),e=>e.getStatus()===404);
 await assert.rejects(()=>service.remove(7,11,1),e=>e.getStatus()===400);
 await assert.rejects(()=>service.remove(7,11,99),e=>e.getStatus()===404);
 contract={...contract,tenant_signed_at:new Date(),status:'awaiting_signatures'};
 assert.deepEqual(await service.remove(7,11,2),{ok:true});
 assert.equal(writes.length,1);
 writes=[];
 contract={...contract,status:'active'};
 await assert.rejects(()=>service.remove(7,11,2),e=>e.getStatus()===400);
 assert.equal(writes.length,0);
 contract={...contract,status:'awaiting_agent_review',tenant_signed_at:null};
 assert.deepEqual(await service.remove(7,11,2),{ok:true});
 assert.equal(writes.length,1);assert.deepEqual(writes[0].where,{id:2,agreement_id:11});assert.ok(writes[0].values.removed_at instanceof Date);
});
