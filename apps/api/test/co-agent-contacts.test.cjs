const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const { QueryFailedError } = require('typeorm');
const { AgentRoomsService } = require('../src/agent/rooms/agent-rooms.service.ts');


function fixture(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  db.exec(`
    CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL,
      email TEXT, line_id TEXT, facebook TEXT, note TEXT, created_by_user_id INTEGER,
      is_co_agent BOOLEAN NOT NULL DEFAULT FALSE, UNIQUE(created_by_user_id, phone));
    CREATE TABLE rent_rooms (id INTEGER PRIMARY KEY, created_by_user_id INTEGER, is_scout_room BOOLEAN, listing_source_id INTEGER);
    CREATE TABLE rent_room_contacts (rent_room_id INTEGER, contact_id INTEGER);
    CREATE TABLE master_listing_sources (id INTEGER PRIMARY KEY, code TEXT);
    INSERT INTO master_listing_sources VALUES (1,'owner'),(2,'co_agent');
    INSERT INTO contacts (id,name,phone,created_by_user_id,is_co_agent) VALUES
      (1,'Legacy partner','0801',7,FALSE),(2,'Owner','0802',7,FALSE),
      (3,'Other agent partner','0803',8,TRUE),(4,'Standalone partner','0804',7,TRUE),
      (5,'Foreign room link','0805',7,FALSE),(6,'Non scout link','0806',7,FALSE);
    INSERT INTO rent_rooms VALUES (11,7,TRUE,2),(12,7,TRUE,2),(13,7,TRUE,1),(14,8,TRUE,2),(15,7,FALSE,2);
    INSERT INTO rent_room_contacts VALUES (11,1),(12,1),(13,2),(14,5),(15,6),(11,3);
  `);
  const repo = {
    create: values => ({ ...values }),
    findOneBy: async where => db.prepare('SELECT * FROM contacts WHERE id=? AND created_by_user_id=?').get(where.id,where.created_by_user_id) || null,
    save: async values => {
      const keys = Object.keys(values);
      try {
        const result = db.prepare(`INSERT INTO contacts (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`)
          .run(...Object.values(values).map(v=>typeof v === 'boolean' ? Number(v) : v));
        return { ...values, id: Number(result.lastInsertRowid) };
      } catch (error) {
        if (error.message.includes('UNIQUE constraint')) throw new QueryFailedError('INSERT contacts', [], { code:'23505',constraint:'uq_contacts_agent_phone' });
        throw error;
      }
    },
    update: async (where,values) => ({ affected: db.prepare(`UPDATE contacts SET ${Object.keys(values).map(k=>`${k}=?`).join(',')} WHERE id=? AND created_by_user_id=?`)
      .run(...Object.values(values),where.id,where.created_by_user_id).changes }),
  };
  const service = new AgentRoomsService(null, {query:async(sql,params)=>db.prepare(sql).all({'1':params[0]})},null,null,repo);
  return {db, service};
}

test('Co-Agent list includes legacy room contacts and standalone additions, counts rooms once and isolates agents', async t => {
  const {service}=fixture(t);
  assert.deepEqual(await service.listCoAgentContacts(7), [
    {id:1,name:'Legacy partner',phone:'0801',roomCount:2},
    {id:4,name:'Standalone partner',phone:'0804',roomCount:0},
  ]);
  assert.deepEqual(await service.listCoAgentContacts(8), [{id:3,name:'Other agent partner',phone:'0803',roomCount:0}]);
  assert.deepEqual(await service.listCoAgentContacts(999), []);
});

test('create without a room persists membership; shared edit preserves ID and all links', async t => {
  const {service,db}=fixture(t);
  const created=await service.createCoAgentContact(7,{name:' New partner ',phone:' 0900 ',email:'new@example.com',lineId:' line ',facebook:'',note:' hello '});
  assert.deepEqual(created,{id:7,name:'New partner',phone:'0900',email:'new@example.com',lineId:'line',facebook:null,note:'hello'});
  assert.equal(db.prepare('SELECT is_co_agent FROM contacts WHERE id=7').get().is_co_agent,1);
  assert.equal((await service.listCoAgentContacts(7)).find(c=>c.id===7).roomCount,0);
  await service.updateContact(7,1,{name:'Updated partner',phone:'0901'});
  assert.deepEqual((await service.listCoAgentContacts(7))[2],{id:1,name:'Updated partner',phone:'0901',roomCount:2});
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rent_room_contacts WHERE contact_id=1').get().n,2);
  assert.equal((await service.getContact(7,1)).name,'Updated partner');
  await assert.rejects(service.getContact(8,7),e=>e.getStatus()===404);
  await assert.rejects(service.updateContact(8,7,{name:'Spoofed'}),e=>e.getStatus()===404);
});

test('duplicate creation rejects without overwriting an owner or partner; another agent can reuse a phone', async t => {
  const {service,db}=fixture(t);
  for(const phone of ['0801','0802','0804']) await assert.rejects(service.createCoAgentContact(7,{name:'Overwrite',phone}),e=>e.getStatus()===409);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contacts').get().n,6);
  assert.equal((await service.getContact(7,2)).name,'Owner');
  assert.equal(db.prepare('SELECT is_co_agent FROM contacts WHERE id=2').get().is_co_agent,0);
  assert.equal((await service.createCoAgentContact(7,{name:'Allowed',phone:'0803'})).name,'Allowed');
});

test('creation requires both fields and rejects spoofing, malformed and oversized input without writes', async t => {
  const {service,db}=fixture(t);
  for(const input of [null,{},[],{name:'Only name'},{phone:'0900'},{name:' ',phone:'0900'},
    {name:'New',phone:'0900',is_co_agent:true},{name:'New',phone:'0900',created_by_user_id:8},
    {name:'New',phone:'0900',id:1},{name:'New',phone:'0900',email:'bad'},
    {name:'New',phone:'0900',lineId:'x'.repeat(101)}]) {
    await assert.rejects(service.createCoAgentContact(7,input),e=>e.getStatus()===400);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contacts').get().n,6);
});

test('adding co-agent room contacts marks reused and newly created profiles for standalone membership', async t => {
  const {service}=fixture(t); const saved=[];
  const existing={id:1,created_by_user_id:7,phone:'0801',is_co_agent:false};
  const manager={findOne:async(_,options)=>options.where.id===1 || options.where.phone==='0801' ? existing : null,
    update:async(_,where,values)=>{assert.deepEqual(where,{id:1,created_by_user_id:7});saved.push({...values});return {affected:1}},
    create:(_,values)=>({...values,id:7}),save:async row=>{saved.push({...row});return row}};
  assert.deepEqual(await service.resolveContactIds(manager,7,{listingSourceCode:'co_agent',contactId:1}),[1]);
  assert.equal(saved[0].is_co_agent,true);
  await service.resolveContactIds(manager,7,{listingSourceCode:'co_agent',contacts:[{name:'Reused',phone:'0801'},{name:'New',phone:'0900'}]});
  assert.equal(saved[1].is_co_agent,true); assert.equal(saved[2].is_co_agent,true);
});
