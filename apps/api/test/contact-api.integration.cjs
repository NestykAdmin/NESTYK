// Opt-in: real HTTP, guards and PostgreSQL in a disposable schema containing synthetic data only.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require('reflect-metadata');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},fileName:filename}).outputText,filename);
require('dotenv').config({path:path.resolve(__dirname,'../../../.env.api'),quiet:true});
const {Client}=require('pg'),{DataSource,EntitySchema}=require('typeorm');
const {Module}=require('@nestjs/common'),{NestFactory}=require('@nestjs/core');
const {AgentRoomsService}=require('../src/agent/rooms/agent-rooms.service.ts');
const {AgentRoomsController}=require('../src/agent/rooms/agent-rooms.controller.ts');
const {RenterContactsService}=require('../src/agent/contacts/renter-contacts.service.ts');
const {RenterContactsController}=require('../src/agent/contacts/renter-contacts.controller.ts');
const {AuthGuard}=require('../src/auth/guards/auth.guard.ts');
const {RolesGuard}=require('../src/auth/guards/roles.guard.ts');
const {AuthService}=require('../src/auth/auth.service.ts');
const {RoomPhotoStorageService}=require('../src/agent/rooms/room-photo-storage.service.ts');
const {ListingPromoService}=require('../src/agent/rooms/listing-promo.service.ts');
const {ContactEntity:C}=require('../src/entities/contact.entity.ts');
const {LeadEntity:L}=require('../src/entities/lead.entity.ts');
const {TenantEntity:T}=require('../src/entities/tenant.entity.ts');
const id={type:Number,primary:true,generated:true};
const int={type:Number},text={type:String,nullable:true};
const profile={name:{type:String,length:255},phone:{type:String,length:50},email:{...text,length:255},created_by_user_id:int};
const entity=(target,tableName,columns,extra={})=>new EntitySchema({name:target.name,target,tableName,columns,...extra});
const schemas=()=>[
 entity(C,'contacts',{id,...profile,line_id:{...text,length:100},facebook:{...text,length:255},note:{...text,length:500},is_co_agent:{type:Boolean,default:false}},
   {uniques:[{name:'uq_contacts_agent_phone',columns:['created_by_user_id','phone']}]}),
 entity(L,'leads',{id,...profile,first_name:{type:String,default:''},last_name:{type:String,default:''},notes:{type:'text',nullable:true},other_contacts:{type:'jsonb',default:[]},tenant_id:{...int,nullable:true}}),
 entity(T,'tenants',{id,...profile,lead_id:int,first_name:{type:String,default:''},last_name:{type:String,default:''},note:{...text,length:500}},
   {uniques:[{name:'tenants_lead_id_key',columns:['lead_id']}]}),
];
const ids=rows=>rows.map(x=>x.id).sort((a,b)=>a-b);

test('Contacts API: all five directories, HTTP guards, shared updates, invalid input and concurrent writes',
 {skip:process.env.RUN_CONTACTS_DB_TEST!=='1',timeout:90000}, async t=>{
  assert.ok(process.env.DATABASE_URL,'DATABASE_URL is required');
  const scratch=`contact_api_test_${Date.now()}_${process.pid}`;
  const ssl=/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)?false:{rejectUnauthorized:false};
  const admin=new Client({connectionString:process.env.DATABASE_URL,ssl,connectionTimeoutMillis:10000});
  const db=new DataSource({type:'postgres',url:process.env.DATABASE_URL,ssl,schema:scratch,entities:schemas(),synchronize:false,
    extra:{options:`-c search_path=${scratch}`,connectionTimeoutMillis:10000,statement_timeout:10000,max:5}});
  let app;
  const previous=process.env.ALLOW_DEV_AUTH;
  await admin.connect();
  try {
    await admin.query(`CREATE SCHEMA "${scratch}"`);
    await db.initialize();
    assert.equal((await db.query('SELECT current_schema() AS name'))[0].name,scratch);
    assert.ok(db.entityMetadatas.every(m=>m.schema===scratch));
    await db.synchronize();
    await db.query(`
      CREATE TABLE master_listing_sources(id INTEGER PRIMARY KEY,code TEXT);
      CREATE TABLE rent_rooms(id INTEGER PRIMARY KEY,created_by_user_id INTEGER,is_scout_room BOOLEAN,listing_source_id INTEGER,
        properties_id INTEGER DEFAULT 1,room_status_id INTEGER DEFAULT 1,room_type_id INTEGER DEFAULT 1,
        room_id TEXT,listing_title TEXT,prices JSONB,owner_bank_account TEXT DEFAULT 'private-bank');
      CREATE TABLE properties(id INTEGER PRIMARY KEY,name TEXT,district TEXT,province TEXT);
      CREATE TABLE master_room_statuses(id INTEGER PRIMARY KEY,code TEXT);
      CREATE TABLE master_room_types(id INTEGER PRIMARY KEY,code TEXT,bedroom_count INTEGER);
      CREATE TABLE rent_room_prices(id SERIAL PRIMARY KEY,rent_room_id INTEGER,price NUMERIC(12,2));
      CREATE TABLE master_layouts(id INTEGER PRIMARY KEY,code TEXT);
      CREATE TABLE room_layout_values(rent_room_id INTEGER,layout_id INTEGER,value TEXT);
      INSERT INTO properties VALUES(1,'Demo Condo','District','Bangkok');
      INSERT INTO master_room_statuses VALUES(1,'available'),(2,'rented');
      INSERT INTO master_room_types VALUES(1,'two_bedroom',2);
      INSERT INTO master_layouts VALUES(1,'floor'),(2,'room_size'),(3,'bedroom');
      CREATE TABLE rent_room_contacts(id SERIAL PRIMARY KEY,rent_room_id INTEGER,contact_id INTEGER);
      CREATE TABLE room_tenancies(id SERIAL PRIMARY KEY,tenant_id INTEGER,rent_room_id INTEGER,created_by_user_id INTEGER,status TEXT,move_in_date DATE);
      CREATE TABLE agreement_templates(id INTEGER PRIMARY KEY,form_kind TEXT);
      CREATE TABLE lease_contracts(id SERIAL PRIMARY KEY,tenant_id INTEGER,rent_room_id INTEGER,created_by_user_id INTEGER,template_id INTEGER,
        status TEXT,owner_signed_at TIMESTAMPTZ,tenant_signed_at TIMESTAMPTZ,agent_signed_at TIMESTAMPTZ);
      INSERT INTO master_listing_sources VALUES(1,'owner'),(2,'co_agent');
      INSERT INTO agreement_templates VALUES(1,'lease'),(2,'reservation'),(3,'renewal');
      INSERT INTO contacts(id,name,phone,created_by_user_id) VALUES(1,'Vacant owner','0801',7),(2,'Landlord','0802',7),
        (3,'Room co-agent','0803',7),(4,'Foreign contact','0804',8),(5,'Owner foreign stay','0805',7);
      INSERT INTO rent_rooms(id,created_by_user_id,is_scout_room,listing_source_id) VALUES(11,7,TRUE,1),(12,7,TRUE,1),(13,7,TRUE,2),(14,8,TRUE,1),(15,7,TRUE,1);
      INSERT INTO rent_room_contacts(rent_room_id,contact_id) VALUES(11,1),(12,2),(13,3),(14,4),(15,5);
      INSERT INTO rent_rooms(id,created_by_user_id,is_scout_room,listing_source_id,room_id,prices)
        VALUES(16,7,TRUE,1,'A102','[{"contractTypeCode":"monthly_12","price":"15000"}]'),
          (17,7,FALSE,1,'Excluded-non-scout',NULL);
      INSERT INTO rent_room_contacts(rent_room_id,contact_id) VALUES(16,2),(14,2),(13,2),(17,2);
      UPDATE rent_rooms SET room_id='A101',listing_title='Quiet room',room_status_id=2 WHERE id=12;
      INSERT INTO rent_room_prices(rent_room_id,price) VALUES(12,18000),(12,13000);
      INSERT INTO room_layout_values VALUES(12,1,'18'),(12,2,'45.5'),(16,3,'0');
      SELECT setval(pg_get_serial_sequence('contacts','id'),5);
      INSERT INTO leads(id,name,phone,created_by_user_id) VALUES(101,'Seeker','08101',7),(102,'Current renter','08102',7),
        (103,'Former renter','08103',7),(104,'Foreign stay only','08104',7),(105,'Foreign lead','08105',8);
      INSERT INTO tenants(id,name,phone,created_by_user_id,lead_id) VALUES(501,'Current renter','08102',7,102),
        (502,'Former renter','08103',7,103),(503,'Foreign stay only','08104',7,104),(504,'Foreign tenant','08105',8,105);
      INSERT INTO room_tenancies(tenant_id,rent_room_id,created_by_user_id,status,move_in_date) VALUES(501,12,7,'active','2026-01-01'),
        (503,15,8,'active','2026-01-01'),(504,14,8,'active','2026-01-01');
      INSERT INTO lease_contracts(tenant_id,rent_room_id,created_by_user_id,template_id,status) VALUES(502,12,7,1,'expired');
    `);
    const rooms=new AgentRoomsService(null,db,null,null,db.getRepository(C));
    const renters=new RenterContactsService(db);
    const users={agent:{id:7,roleNames:['agent']},other:{id:8,roleNames:['agent']},tenant:{id:9,roleNames:['tenant']}};
    const auth={findBySupabaseUserId:async key=>users[key]||null,loadUserWithRoles:async id=>Object.values(users).find(x=>x.id===id)};
    class ContactTestModule {}
    Module({controllers:[AgentRoomsController,RenterContactsController],providers:[AuthGuard,RolesGuard,
      {provide:AuthService,useValue:auth},{provide:AgentRoomsService,useValue:rooms},{provide:RenterContactsService,useValue:renters},
      {provide:RoomPhotoStorageService,useValue:{}},{provide:ListingPromoService,useValue:{}}]})(ContactTestModule);
    process.env.ALLOW_DEV_AUTH='true';
    app=await NestFactory.create(ContactTestModule,{logger:false}); app.setGlobalPrefix('api/v1');
    await app.listen(0,'127.0.0.1');
    const base=`http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    const request=async(route,{actor='agent',method='GET',body}={})=>{
      const response=await fetch(base+route,{method,headers:{...(actor?{authorization:`Bearer dev|${actor}|fixture@example.invalid`}:{}),
        ...(body!==undefined?{'content-type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
      return {status:response.status,body:await response.json()};
    };
    const lists=['/agent/rooms/owner-contacts','/agent/rooms/landlord-contacts','/agent/contacts/lead','/agent/contacts/tenant','/agent/rooms/co-agent-contacts'];
    const details=['/agent/rooms/contacts/1','/agent/contacts/lead/101','/agent/contacts/tenant/501'];
    await t.test('every contact route requires a synced authenticated agent',async()=>{
      const routes=[{route:'/agent/rooms/contacts/2/rooms'},{route:'/agent/rooms/contacts'},...lists.map(route=>({route})),...details.flatMap(route=>[{route},{route,method:'PATCH',body:{name:'Denied'}}]),
        {route:'/agent/rooms/co-agent-contacts',method:'POST',body:{name:'Denied',phone:'0900'}}];
      for(const {route,...options} of routes) {
        for(const [actor,status] of [[null,401],['unsynced',401],['tenant',403]])
          assert.equal((await request(route,{...options,actor})).status,status,`${actor}: ${route}`);
      }
    });
    await t.test('all five lists use agent-local rental history, including former tenants',async()=>{
      const expected=[[1,5],[2],[101,104],[501,502],[2,3]];
      for(let i=0;i<lists.length;i++) {
        const response=await request(lists[i]); assert.equal(response.status,200);
        assert.deepEqual(ids(response.body),expected[i],lists[i]);
      }
      for(const route of lists) assert.equal((await request(route,{actor:'other'})).status,200);
      const picker=await request('/agent/rooms/contacts');assert.equal(picker.status,200);assert.deepEqual(ids(picker.body),[1,2,3,5]);
    });
    await t.test('foreign IDs are 404 and invalid identifiers or kinds are 400',async()=>{
      for(const route of ['/agent/rooms/contacts/4','/agent/contacts/lead/105','/agent/contacts/tenant/504']) {
        assert.equal((await request(route)).status,404);
        assert.equal((await request(route,{method:'PATCH',body:{name:'Denied'}})).status,404);
      }
      for(const prefix of ['/agent/rooms/contacts','/agent/contacts/lead','/agent/contacts/tenant'])
        for(const id of ['0','-1','1.5','2147483648','1e2','missing']) {
          assert.equal((await request(`${prefix}/${id}`)).status,400);
          assert.equal((await request(`${prefix}/${id}`,{method:'PATCH',body:{name:'Invalid'}})).status,400);
        }
      assert.equal((await request('/agent/contacts/owner')).status,400);
      assert.equal((await request('/agent/contacts/coAgent/1')).status,400);
    });
    await t.test('contact PATCH clears optional fields and updates the exact canonical room contact',async()=>{
      const response=await request('/agent/rooms/contacts/1',{method:'PATCH',body:{name:'Edited owner',phone:'09001',lineId:'line',note:''}});
      assert.equal(response.status,200); assert.equal(response.body.id,1); assert.equal(response.body.note,null);
      const rows=await db.query('SELECT c.name,c.phone,c.line_id FROM rent_room_contacts link JOIN contacts c ON c.id=link.contact_id WHERE link.rent_room_id=11');
      assert.deepEqual(rows,[{name:'Edited owner',phone:'09001',line_id:'line'}]);
      assert.equal((await request('/agent/rooms/owner-contacts')).body.find(c=>c.id===1).name,'Edited owner');
    });
    await t.test('Landlord and Co-Agent details save the shared ID and immediately update their lists',async()=>{
      for(const [id,route] of [[2,'/agent/rooms/landlord-contacts'],[3,'/agent/rooms/co-agent-contacts']]) {
        const detail=await request(`/agent/rooms/contacts/${id}`);assert.equal(detail.status,200);
        const updated=await request(`/agent/rooms/contacts/${id}`,{method:'PATCH',body:{name:`Updated contact ${id}`,email:'new@example.invalid',facebook:'new-fb'}});
        assert.equal(updated.status,200);assert.equal(updated.body.id,id);
        assert.equal((await request(route)).body.find(c=>c.id===id).name,`Updated contact ${id}`);
        assert.equal((await request(`/agent/rooms/contacts/${id}`)).body.facebook,'new-fb');
      }
    });
    await t.test('Landlord room information includes rented and vacant linked rooms and excludes foreign, non-scout and co-agent rooms',async()=>{
      const response=await request('/agent/rooms/contacts/2/rooms');assert.equal(response.status,200);
      assert.deepEqual(ids(response.body),[12,16]);
      const rented=response.body.find(r=>r.id===12),vacant=response.body.find(r=>r.id===16);
      assert.deepEqual(rented,{id:12,roomId:'A101',listingTitle:'Quiet room',propertyName:'Demo Condo',district:'District',province:'Bangkok',
        roomStatusCode:'rented',roomTypeCode:'two_bedroom',bedroomCount:'2',roomSizeSqm:'45.5',floor:'18',minRent:13000});
      assert.equal(vacant.roomStatusCode,'available');assert.equal(vacant.minRent,15000);assert.equal(vacant.bedroomCount,'0');
      assert.equal(rented.owner_bank_account,undefined);assert.equal(rented.legacyPrices,undefined);
      assert.equal((await request('/agent/rooms/contacts/4/rooms')).status,404);
      assert.equal((await request('/agent/rooms/contacts/999/rooms')).status,404);
      for(const id of ['0','invalid','2147483648'])assert.equal((await request(`/agent/rooms/contacts/${id}/rooms`)).status,400);
      const orphan=await request('/agent/rooms/co-agent-contacts',{method:'POST',body:{name:'No rooms',phone:'09998'}});
      assert.deepEqual((await request(`/agent/rooms/contacts/${orphan.body.id}/rooms`)).body,[]);
    });
    await t.test('LINE-only PATCH works with TypeORM; clearing all values cannot resurrect an older channel',async()=>{
      await db.getRepository(L).update(102,{other_contacts:[{channel:'line',value:'first'},{channel:'line',value:'second'},
        {channel:'facebook',value:'first-fb'},{channel:'facebook',value:'second-fb'},{channel:'whatsapp',value:'keep'}]});
      const response=await request('/agent/contacts/tenant/501',{method:'PATCH',body:{lineId:null,facebook:''}});
      assert.equal(response.status,200); assert.equal(response.body.lineId,null); assert.equal(response.body.facebook,null);
      assert.deepEqual((await db.getRepository(L).findOneBy({id:102})).other_contacts,[{channel:'whatsapp',value:'keep'}]);
    });
    await t.test('Lead/Tenant save shares identity fields in both directions and rolls back if a linked write fails',async()=>{
      for(const route of ['/agent/contacts/lead/102','/agent/contacts/tenant/501']) {
        const response=await request(route,{method:'PATCH',body:{name:'Updated Renter',phone:'+66 812 345 678',email:null,note:'Shared note'}});
        assert.equal(response.status,200);
        const lead=(await request('/agent/contacts/lead/102')).body,tenant=(await request('/agent/contacts/tenant/501')).body;
        assert.deepEqual({...lead,id:0},{...tenant,id:0});assert.equal(lead.phone,'+66812345678');
      }
      await db.query("ALTER TABLE tenants ADD CONSTRAINT test_reject_name CHECK(name <> 'Reject Both')");
      const response=await request('/agent/contacts/tenant/501',{method:'PATCH',body:{name:'Reject Both'}});
      assert.equal(response.status,500);
      assert.equal((await db.getRepository(L).findOneBy({id:102})).name,'Updated Renter');
      assert.equal((await db.getRepository(T).findOneBy({id:501})).name,'Updated Renter');
      await db.query('ALTER TABLE tenants DROP CONSTRAINT test_reject_name');
    });
    await t.test('invalid bodies and PostgreSQL-incompatible strings return 400 without changing the record',async()=>{
      for(const route of ['/agent/rooms/contacts/1','/agent/contacts/lead/101','/agent/contacts/tenant/501']) {
        for(const body of [null,[],{}, {id:4},{created_by_user_id:8},{name:' '},{phone:0},{email:'invalid'},
          {note:'x'.repeat(501)},{name:'bad\u0000name'},{note:'bad\u0000note'}])
          assert.equal((await request(route,{method:'PATCH',body})).status,400,`${route} ${JSON.stringify(body)}`);
      }
      for(const body of [{name:'Only'},{name:'New',phone:'0900',is_co_agent:false},{name:'bad\u0000name',phone:'0900'}])
        assert.equal((await request('/agent/rooms/co-agent-contacts',{method:'POST',body})).status,400);
    });
    await t.test('concurrent Co-Agent creation returns one 201 and one 409; it never overwrites an existing contact',async()=>{
      const responses=await Promise.all([1,2].map(i=>request('/agent/rooms/co-agent-contacts',{method:'POST',body:{name:`New partner ${i}`,phone:'09999'}})));
      assert.deepEqual(responses.map(x=>x.status).sort(),[201,409]);
      const created=responses.find(x=>x.status===201).body;
      assert.equal((await request('/agent/rooms/co-agent-contacts')).body.find(c=>c.id===created.id).roomCount,0);
      const duplicate=await request('/agent/rooms/contacts/1',{method:'PATCH',body:{name:'Overwrite',phone:'09999'}});
      assert.equal(duplicate.status,409);assert.equal((await request('/agent/rooms/contacts/1')).body.name,'Edited owner');
    });
    await t.test('marking a room contact as Co-Agent does not revert a concurrent contact edit',async()=>{
      await db.transaction(async manager=>{
        const proxy={
          findOne:async(...args)=>{const row=await manager.findOne(...args);await rooms.updateContact(7,1,{name:'Concurrent edit',phone:'09009'});return row},
          save:manager.save.bind(manager),update:manager.update.bind(manager),
        };
        await rooms.resolveContactIds(proxy,7,{listingSourceCode:'co_agent',contactId:1});
      });
      const contact=await rooms.getContact(7,1);
      assert.equal(contact.name,'Concurrent edit');assert.equal(contact.phone,'09009');
      assert.equal((await db.getRepository(C).findOneBy({id:1})).is_co_agent,true);
    });
    await t.test('reusing a room contact by phone preserves concurrently edited optional profile fields',async()=>{
      await db.transaction(async manager=>{
        const proxy={
          findOne:async(...args)=>{const row=await manager.findOne(...args);await rooms.updateContact(7,3,{email:'concurrent@example.invalid',lineId:'concurrent-line',facebook:'concurrent-fb',note:'Concurrent note'});return row},
          save:manager.save.bind(manager),update:manager.update.bind(manager),
        };
        await rooms.resolveContactIds(proxy,7,{listingSourceCode:'co_agent',contacts:[{name:'Explicit room contact',phone:'0803'}]});
      });
      const contact=await rooms.getContact(7,3);
      assert.equal(contact.name,'Explicit room contact');assert.equal(contact.email,'concurrent@example.invalid');
      assert.equal(contact.lineId,'concurrent-line');assert.equal(contact.facebook,'concurrent-fb');assert.equal(contact.note,'Concurrent note');
    });
    await t.test('all five directories paginate after agent scope and search, with stable pages and accurate empty-page totals',async()=>{
      const cases=[
        {kind:'owner',route:'/agent/rooms/owner-contacts',start:2000},
        {kind:'landlord',route:'/agent/rooms/landlord-contacts',start:3000},
        {kind:'coAgent',route:'/agent/rooms/co-agent-contacts',start:4000},
        {kind:'lead',route:'/agent/contacts/lead',start:5000},
        {kind:'tenant',route:'/agent/contacts/tenant',start:6000},
      ];
      for(const spec of cases) {
        for(let i=1;i<=45;i++) {
          const id=spec.start+i,name=`Page ${spec.kind} ${String(i).padStart(3,'0')}`,phone=`+66 (${spec.start/100}) 123-${String(i).padStart(4,'0')}`;
          if(spec.kind==='lead') await db.query('INSERT INTO leads(id,name,phone,created_by_user_id) VALUES($1,$2,$3,7)',[id,name,phone]);
          else if(spec.kind==='tenant') {
            await db.query('INSERT INTO leads(id,name,phone,created_by_user_id) VALUES($1,$2,$3,7)',[id,name,phone]);
            await db.query('INSERT INTO tenants(id,lead_id,name,phone,created_by_user_id) VALUES($1,$1,$2,$3,7)',[id,name,phone]);
            await db.query("INSERT INTO room_tenancies(tenant_id,rent_room_id,created_by_user_id,status,move_in_date) VALUES($1,12,7,'active','2026-01-01')",[id]);
          } else {
            await db.query('INSERT INTO contacts(id,name,phone,created_by_user_id,is_co_agent) VALUES($1,$2,$3,7,$4)',[id,name,phone,spec.kind==='coAgent']);
            if(spec.kind!=='coAgent') {
              await db.query('INSERT INTO rent_rooms(id,created_by_user_id,is_scout_room,listing_source_id) VALUES($1,7,TRUE,1)',[id]);
              await db.query('INSERT INTO rent_room_contacts(rent_room_id,contact_id) VALUES($1,$1)',[id]);
              if(spec.kind==='landlord')await db.query("INSERT INTO room_tenancies(rent_room_id,created_by_user_id,status,move_in_date) VALUES($1,7,'active','2026-01-01')",[id]);
            }
          }
        }
        const query=(page,q=`Page ${spec.kind}`)=>`${spec.route}?${new URLSearchParams({q,page:String(page),limit:'20'})}`;
        const first=await request(query(1)),second=await request(query(2)),third=await request(query(3));
        for(const [response,page,length] of [[first,1,20],[second,2,20],[third,3,5]]) {
          assert.equal(response.status,200,JSON.stringify(response.body));
          assert.equal(response.body.total,45,spec.kind);assert.equal(response.body.page,page);assert.equal(response.body.limit,20);
          assert.equal(response.body.items.length,length);
        }
        assert.deepEqual(ids([...first.body.items,...second.body.items,...third.body.items]),Array.from({length:45},(_,i)=>spec.start+i+1));
        const beyond=await request(query(99));assert.equal(beyond.body.total,45);assert.deepEqual(beyond.body.items,[]);
        const exact=await request(query(1,`page ${spec.kind} 045`));assert.equal(exact.body.total,1);assert.equal(exact.body.items[0].id,spec.start+45);
        const phone=await request(query(1,`+66${spec.start/100}1230045`));assert.equal(phone.body.total,1);assert.equal(phone.body.items[0].id,spec.start+45);
        const absent=await request(query(1,'No such synthetic person'));assert.equal(absent.body.total,0);assert.deepEqual(absent.body.items,[]);
        const other=await request(query(1),{actor:'other'});assert.equal(other.body.total,0);assert.deepEqual(other.body.items,[]);
        for(const suffix of ['page=0','page=-1','page=1.5','page=2147483648','page=x','limit=0','limit=51','q[]=x','page=1&page=2','q=a&q=b'])
          assert.equal((await request(`${spec.route}?${suffix}`)).status,400,`${spec.kind}: ${suffix}`);
      }
      await db.query('INSERT INTO contacts(id,name,phone,created_by_user_id,is_co_agent) VALUES(9000,$1,$2,7,TRUE)', ['Literal %_\\ value','09900']);
      const escaped=await request('/agent/rooms/co-agent-contacts?'+new URLSearchParams({q:'%_\\',page:'1'}));
      assert.equal(escaped.status,200);assert.equal(escaped.body.total,1);assert.equal(escaped.body.items[0].id,9000);
      const onlyPunctuation=await request('/agent/rooms/co-agent-contacts?'+new URLSearchParams({q:'()',page:'1'}));
      assert.equal(onlyPunctuation.body.total,0);
    });
  } finally {
    if(previous===undefined)delete process.env.ALLOW_DEV_AUTH;else process.env.ALLOW_DEV_AUTH=previous;
    if(app)await app.close();if(db.isInitialized)await db.destroy();
    await admin.query(`DROP SCHEMA IF EXISTS "${scratch}" CASCADE`);await admin.end();
  }
});
