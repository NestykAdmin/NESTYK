const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { i18nMock, leadFormat, contractsTh } = require('./test-i18n.cjs');
function load(file, requireFn = require) {
  const module = { exports: {} };
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,file),'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText)(requireFn,module,module.exports);
  return module.exports;
}
const term = load('../lib/lease-term.ts');
const thai = load('../../../packages/i18n/src/locales/th.ts', id => id === './contracts/th' ? { contractsTh } : { AMENITIES_FACILITY_GROUP_LABELS: { th: {} }, AMENITIES_FACILITY_LABELS: { th: {} } });
const renewalHelpers = load('../lib/contract-renewal.ts', id => id === './lease-term' ? term : require(id));
const blankRenewal = () => Object.fromEntries(['documentNo','issueDate','landlordName','tenantName','propertyLine','firstLeaseNo','firstLeaseDate','firstLeaseStart','firstLeaseEnd','originalLeaseNo','originalLeaseDate','originalExpiryDate','renewMonths','startDate','endDate','monthlyRent','dueDay','bankAccount','depositCarried','additionalChanges','landlordSignName','tenantSignName'].map(key=>[key,'']));
const row = (patch={}) => ({ id:1, tenantId:1, leadId:1, formKind:'lease', status:'active', contractNo:'LS202600001', agreementTypeName:'Lease', rootAgreementId:1, startDate:'2025-11-01', endDate:'2026-10-31', tenant:'Tenant A', property:'Project A', room:'101', monthlyRent:15000, deposit:30000, data:{ leaseAgreement:{ issueDate:'2025-10-20', landlordName:'Owner', tenantName:'Tenant A' } }, ...patch });
function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node,...nodes(node.props?.children)]; }
function harness(rows, options = {}) {
  const states=[],refs=[],effectDeps=[],effects=[]; let stateIndex=0,refIndex=0,effectIndex=0,resolveList,handled=0;
  const list = new Promise(resolve=>{resolveList=resolve;});
  const hookedReact={ ...React,
    useState: initial => { const i=stateIndex++; if (!(i in states)) states[i]=typeof initial==='function'?initial():initial; return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}]; },
    useRef: initial => refs[refIndex++] ??= {current:initial},
    useContext: () => null, useMemo: fn=>fn(),
    useEffect: (fn,deps) => {const i=effectIndex++,old=effectDeps[i]; if (!old||deps.some((v,j)=>v!==old[j])) {effectDeps[i]=deps;effects.push(fn);} },
  };
  const dependencies={
    react:hookedReact,
    'react-native':{View:'section',Text:'span',Pressable:'button',StyleSheet:{create:s=>s},ActivityIndicator:'progress',Modal:'aside',Linking:{},Alert:{alert:(...args)=>options.alerts?.push(args)},Share:{dismissedAction:'dismissedAction',share:async()=>assert.fail('Share is not used: there is no sign link to share')}},
    'react-native-safe-area-context':{SafeAreaProvider:'section',SafeAreaView:'section'},
    '@nestyk/ui/native':{tokens:{colors:{brand:{500:'#ff0'},roles:{agent:'#ff0'},onBrand:'#000'},typography:{native:{}}},useMobileTheme:()=>({theme:{}}),MobileThemeProvider:'light-theme',MobileIcon:'i',MobileButton:'button',MobileInput:'input',MobileBottomSheet:'aside'},
    '@nestyk/i18n':i18nMock({agent:thai.th.agent,common:thai.th.common,mobile:thai.th.mobile}), '../lib/lead-format':leadFormat,
    '../lib/lease-term':term, '../lib/contract-renewal':renewalHelpers,
    '../lib/contract-signing':{bookingPaymentBlocksSigning:()=>false},
    './BookingInvoiceListCard':{bookingInvoicesForTenant:()=>[],BookingInvoiceListCard:()=>null},
    '../lib/agent-contracts-api':{
      listAgentContracts:()=>options.listFails?Promise.reject(options.listFails):list,listStandaloneInvoices:async()=>options.invoices ?? [],listCommissionConfirmations:async()=>options.commissions ?? [],
      getAgentContract:async id=>rows.find(row=>row.id===id),
      listAgreementTypes:async()=>[{code:'lease_renewal',formKind:'renewal'}],
      listAgreementTemplates:async()=>[{id:2,dataSchema:{type:'object'}}],
      deliverAgentContract:async(id,party)=>{options.deliveries?.push([id,party]);return {party,deliveredAt:'2026-10-12T05:00:00Z'};},
      // D1: booked tenants for the type picker and the create form (an Error is thrown as a failed load).
      listContractCandidates:async()=>{options.candidateCalls?.push('called');const value=typeof options.candidates==='function'?options.candidates():options.candidates??[];options.candidateCalls?.push('returned');if (value instanceof Error) throw value;return value;},
      // D17: how each party signed (the detail view loads it).
      listAgentContractSignatures:async(id)=>{options.signatureLogCalls?.push(id);return options.signatureLog ?? [];},
      ...options.api,
    },
    './ReservationLetterFields':{ReservationLetterFields:'reservation-fields',emptyReservationLetterForm:()=>({}),reservationLetterFieldErrors:()=>({})},
    './BrokerAppointmentFields':{BrokerAppointmentFields:'broker-fields',emptyBrokerAppointmentForm:()=>({}),completeBrokerNames:form=>form},
    './LeaseAgreementFields':{LeaseAgreementFields:'lease-fields',emptyLeaseAgreementForm:()=>({}),completeLeaseNames:form=>form},
    './LeaseRenewalFields':{LeaseRenewalFields:'renewal-fields',emptyLeaseRenewalForm:blankRenewal},
    './ContractTypePicker':{ContractTypePicker:'type-picker'},
    './AgentContractLibrary':{AgentContractLibrary:'contract-library'},
    '../lib/agent-contract-library':load('../lib/agent-contract-library.ts'),
    '../lib/contract-close':load('../lib/contract-close.ts', id=>id==='./lease-term'?term:require(id)),
    '../lib/signature-log':load('../lib/signature-log.ts', id=>id==='@nestyk/i18n'?{fillTemplate:require('./test-i18n.cjs').fillTemplate}:require(id)),
    './ContractCloseCard':{ContractCloseCard:'close-card',closeResultNotice:()=>'closed'},
    './DepositPaymentCard':{DepositPaymentCard:'deposit-card'},
    // D2: the lead's offers, read to lock the numbers a confirmed offer fixes.
    '../lib/deal-offers-api':{listLeadDealOffers:async(leadId)=>{options.offerCalls?.push(leadId);return options.offers ?? [];}},
    '../lib/deal-offer':load('../lib/deal-offer.ts'),
    // D2 round 2: the deal's confirmed offer on the contract (tested in deal-offer-section.test.cjs).
    './DealOfferSection':{DealOfferSection:'deal-offer-section'},
    './HandoverCard':{HandoverCard:'handover-card'},
    './RejectedAttachmentsNotice':{RejectedAttachmentsNotice:'rejected-notice'},
  };
  for (const name of ['FinancialDocumentForm','CommissionConfirmationForm','AgreementAttachments','ContractDocumentPreview','ContractSignaturePad']) dependencies[`./${name}`]={[name]:()=>null};
  dependencies['./ReservationPaymentCard']={ReservationPaymentCard:'reservation-card'};
  // D13 + D3: the commission confirmation and the signing due day (tested in reservation-terms.test.cjs).
  dependencies['./ReservationTerms']={ReservationTerms:'reservation-terms'};
  // D4: the handover day control (tested in handover-due-control.test.cjs).
  dependencies['./HandoverDueControl']={HandoverDueControl:'handover-due'};
  // D5: the deal cancellation card (tested in deal-cancellation-card.test.cjs).
  dependencies['./DealCancellationCard']={DealCancellationCard:'deal-cancellation'};
  dependencies['../lib/deal-cancellation']={canCancelDeal:()=>false};
  for (const name of ['expo-document-picker','expo-image-picker','expo-image']) dependencies[name]={};
  const screen=load('ContractsScreen.tsx',id=>{if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);return dependencies[id];});
  const props={startCreate:'renewal',onStartCreateHandled:()=>{handled++;},...options.props};
  const render=()=>{stateIndex=refIndex=effectIndex=0;const wrapper=screen.ContractsScreen(props);assert.equal(wrapper.props.defaultMode,"light");const tree=wrapper.props.children.type(wrapper.props.children.props);effects.splice(0).forEach(fn=>fn());return tree;};
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  return {render,tick,resolve:()=>resolveList(rows),get handled(){return handled;}};
}
async function atBangkokOctober12(fn) {
  const RealDate=Date;
  global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-10-12T05:00:00Z']));}};
  try {await fn();} finally {global.Date=RealDate;}
}
test('opening renewal from the tenant workspace waits for contracts and uses the eligible source', async () => atBangkokOctober12(async()=>{
  const h=harness([row(),row({id:2,tenantId:2,rootAgreementId:2,endDate:'2027-06-30'})]);
  h.render();assert.equal(h.handled,0);
  h.resolve();await h.tick();h.render();await h.tick();
  const form=nodes(h.render()).find(node=>node.type==='renewal-fields');
  assert.equal(h.handled,1);
  assert.equal(form.props.value.originalLeaseNo,'LS202600001');
  assert.equal(form.props.value.startDate,'2026-11-01');
  assert.equal(form.props.value.endDate,'2027-10-31');
}));
test('global renewal flow lets the agent select between eligible tenants before opening a form', async () => atBangkokOctober12(async()=>{
  const b=row({id:2,tenantId:2,leadId:2,rootAgreementId:2,contractNo:'LS202600002',tenant:'Tenant B',property:'Project B',room:'202',endDate:'2026-10-20'});
  const h=harness([row(),b]);h.render();h.resolve();await h.tick();h.render();await h.tick();
  const picker=h.render();
  assert.equal(nodes(picker).some(node=>node.type==='renewal-fields'),false);
  const choices=nodes(picker).filter(node=>node.type==='button' && nodes(node).some(child=>child.type==='span' && String(child.props.children).includes(b.contractNo)));
  assert.equal(choices.length,1);
  choices[0].props.onPress();await h.tick();
  const form=nodes(h.render()).find(node=>node.type==='renewal-fields');
  assert.equal(form.props.value.originalLeaseNo,b.contractNo);
  assert.equal(form.props.value.startDate,'2026-10-21');
}));

test('commission opens a visible library preview and closing it preserves folder filters', async () => {
  const h=harness([], {props:{startCreate:null},commissions:[{id:9,documentNo:'COM009',pdfUrl:'commission.pdf'}]});
  h.render(); h.resolve(); await h.tick();
  let tree=h.render();
  let library=nodes(tree).find(n=>n.type==='contract-library');
  const view={folder:'brokerage',type:'agent_commission',status:'active',query:'COM009'};
  library.props.onViewChange(view);
  tree=h.render(); library=nodes(tree).find(n=>n.type==='contract-library');
  library.props.onOpen({kind:'commission',value:library.props.commissions[0]});
  tree=h.render();
  const modal=nodes(tree).find(n=>n.type==='aside' && n.props.visible);
  assert.ok(modal); assert.ok(nodes(modal).some(n=>n.props?.url==='commission.pdf'));
  modal.props.onRequestClose(); tree=h.render();
  assert.deepEqual(nodes(tree).find(n=>n.type==='contract-library').props.view,view);
});

test('standalone receipt opens the source invoice preview and returning retains finance filters', async () => {
  const invoice={id:9,documentNo:'INV009',receiptDocumentNo:'REC009',receiptUrl:'receipt.pdf',invoiceUrl:'invoice.pdf',customerName:'Tenant',issueDate:'2026-10-14',total:1000};
  const h=harness([], {props:{startCreate:null},invoices:[invoice]});
  h.render(); h.resolve(); await h.tick();
  let library=nodes(h.render()).find(n=>n.type==='contract-library');
  const view={folder:'finance',type:'receipt',status:'all',query:'REC009'};
  library.props.onViewChange(view); library=nodes(h.render()).find(n=>n.type==='contract-library');
  library.props.onOpen({kind:'receipt',value:invoice});
  const tree=h.render();
  const modal=nodes(tree).find(n=>n.type==='aside' && n.props.visible);
  assert.ok(nodes(modal).some(n=>n.props?.url==='receipt.pdf'));
  const back=nodes(tree).find(n=>n.type==='button' && nodes(n).some(child=>child.type==='span' && child.props.children===contractsTh.common.back));
  assert.ok(back); back.props.onPress();
  assert.deepEqual(nodes(h.render()).find(n=>n.type==='contract-library').props.view,view);
});

test('type picker locks the lease until a reservation is issued and explains why', async () => {
  const leaseHint=thai.th.agent.contracts.notice.leaseRequiresReservation;
  const picker=async(rows,props={})=>{
    const h=harness(rows, {props:{startCreate:null,...props}});
    h.render(); h.resolve(); await h.tick();
    nodes(h.render()).find(n=>n.type==='contract-library').props.onCreate();
    return nodes(h.render()).find(n=>n.type==='type-picker').props;
  };
  const locked=props=>props.disabledKinds.includes('lease') && (props.disabledHint ?? '').split('\n').includes(leaseHint);
  const booking=patch=>row({id:3,formKind:'reservation',status:'active',reservationLetterStatus:'ready',endDate:null,...patch});
  assert.equal(locked(await picker([])),true);
  // A booking that is still being signed, or a ready one that was cancelled, does not unlock the lease.
  assert.equal(locked(await picker([booking({status:'awaiting_signatures',reservationLetterStatus:'awaiting_signatures'}),booking({id:4,status:'cancelled'})])),true);
  assert.equal(locked(await picker([booking()])),false);
  // Inside a tenant only that tenant's own booking counts.
  const tenant={id:1,leadId:1,name:'Tenant A',phone:'0812345678',email:null,identityNumber:null,nationality:null,fullAddress:null,contracts:[]};
  assert.equal(locked(await picker([booking({leadId:2})],{tenant:{...tenant,brokerAppointmentReady:true}})),true);
  assert.equal(locked(await picker([booking({leadId:1})],{tenant:{...tenant,brokerAppointmentReady:true}})),false);
});

test('D1: inside a tenant the reservation stays locked until the room has an active broker appointment', async () => {
  const brokerHint=thai.th.agent.contracts.reservationNeedsBroker;
  const open=async(ready)=>{
    const tenant={id:1,leadId:1,name:'Tenant A',phone:'0812345678',email:'a@b.co',identityNumber:null,nationality:null,fullAddress:null,contracts:[],brokerAppointmentReady:ready};
    const h=harness([], {props:{startCreate:null,tenant}});
    h.render(); h.resolve(); await h.tick();
    nodes(h.render()).find(n=>n.type==='contract-library').props.onCreate();
    return {h,picker:nodes(h.render()).find(n=>n.type==='type-picker').props};
  };
  const {h,picker}=await open(false);
  assert.ok(picker.disabledKinds.includes('reservation'));
  assert.ok(picker.disabledHint.split('\n').includes(brokerHint));
  assert.equal(picker.disabledKinds.includes('broker_appointment'),false);
  // Even if a reservation start is forced, the screen refuses before opening the form.
  picker.onSelect('reservation'); await h.tick();
  assert.equal(nodes(h.render()).find(n=>n.type==='type-picker').props.message,brokerHint);
  assert.equal(nodes(h.render()).some(n=>n.type==='reservation-fields'),false);
  const ready=(await open(true)).picker;
  assert.equal(ready.disabledKinds.includes('reservation'),false);
});

test('D1: on the contracts screen the reservation is locked before entering when no booked tenant has a valid broker appointment', async () => {
  const agent=thai.th.agent.contracts;
  const cand=(leadId,ready)=>({leadId,tenant:`Tenant ${leadId}`,property:'P',room:'1',brokerAppointmentReady:ready});
  const open=async(candidates,api)=>{
    const candidateCalls=[];
    const h=harness([], {props:{startCreate:null},candidates,candidateCalls,api});
    h.render(); h.resolve(); await h.tick();
    nodes(h.render()).find(n=>n.type==='contract-library').props.onCreate();
    h.render(); await h.tick();
    assert.deepEqual(candidateCalls,['called','returned'],'the picker asked for the tenant list once');
    return {h,picker:nodes(h.render()).find(n=>n.type==='type-picker').props};
  };
  const none=await open([cand(1,false)]);
  assert.ok(none.picker.disabledKinds.includes('reservation'));
  assert.ok(none.picker.disabledHint.split('\n').includes(agent.reservationNoReadyTenant));
  assert.equal(none.picker.disabledKinds.includes('broker_appointment'),false);
  // Even if a reservation start is forced, the screen refuses before opening the form.
  none.picker.onSelect('reservation'); await none.h.tick();
  assert.equal(nodes(none.h.render()).find(n=>n.type==='type-picker').props.message,agent.reservationNoReadyTenant);
  assert.equal(nodes(none.h.render()).some(n=>n.type==='reservation-fields'),false);
  assert.equal((await open([])).picker.disabledKinds.includes('reservation'),true,'no booked tenant at all');
  assert.equal((await open([cand(1,false),cand(2,true)])).picker.disabledKinds.includes('reservation'),false);
  // If the list cannot load, the button stays open and opens the form: the API still refuses on save, and the app shows why.
  const lists=[new Error('offline'),[cand(1,true)]];
  const failed=await open(()=>lists.shift(),{listAgreementTypes:async()=>[{code:'reservation',formKind:'reservation'}],getReservationDefaults:async()=>({})});
  assert.equal(failed.picker.disabledKinds.includes('reservation'),false);
  failed.picker.onSelect('reservation');
  for (let i=0;i<10&&!nodes(failed.h.render()).some(n=>n.type==='reservation-fields');i++) await failed.h.tick();
  assert.ok(nodes(failed.h.render()).some(n=>n.type==='reservation-fields'));
});

test('D1: the reservation form only offers tenants with a valid appointment, and stops one that lapsed at the next step', async () => atBangkokOctober12(async()=>{
  const agent=thai.th.agent.contracts;
  const cand=(leadId,ready)=>({leadId,tenant:`Tenant ${leadId}`,property:'P',room:'1',brokerAppointmentReady:ready});
  // 1st load: type picker; 2nd: the form; 3rd: "reload" after tenant 2's appointment lapsed.
  const lists=[[cand(1,false),cand(2,true)],[cand(1,false),cand(2,true)],[cand(1,false),cand(2,false)]];
  const h=harness([], {props:{startCreate:null},candidates:()=>lists.shift(),
    api:{listAgreementTypes:async()=>[{code:'reservation',formKind:'reservation'}],getReservationDefaults:async()=>({})}});
  h.render(); h.resolve(); await h.tick();
  nodes(h.render()).find(n=>n.type==='contract-library').props.onCreate();
  h.render(); await h.tick();
  h.render().props.onSelect('reservation');
  for (let i=0;i<10&&!nodes(h.render()).some(n=>n.type==='reservation-fields');i++) await h.tick();
  assert.equal(lists.length,1,'the picker and the form each loaded the list once');
  const label=n=>nodes(n).filter(x=>x.type==='span').flatMap(x=>[x.props.children].flat()).join('');
  let tree=nodes(h.render());
  assert.ok(tree.some(n=>n.type==='reservation-fields'),'the form opened');
  const radios=()=>nodes(h.render()).filter(n=>n.type==='button'&&n.props.accessibilityRole==='radio');
  assert.deepEqual(radios().map(r=>[r.props.disabled,r.props.accessibilityState.checked,r.props.accessibilityState.disabled]),
    [[true,false,true],[false,true,false]],'tenant 1 is locked and the form starts on tenant 2');
  assert.ok(label(radios()[0]).includes(agent.candidateNeedsBroker));
  assert.equal(label(radios()[1]).includes(agent.candidateNeedsBroker),false);
  tree.find(n=>n.type==='button'&&label(n)===contractsTh.screen.reloadTenants).props.onPress(); await h.tick();
  assert.equal(radios()[1].props.disabled,true);
  const next=nodes(h.render()).find(n=>n.type==='button'&&label(n).startsWith(contractsTh.screen.nextStep.split('{')[0]));
  const shown=()=>nodes(h.render()).filter(n=>n.type==='span').map(n=>n.props.children);
  assert.equal(shown().includes(agent.reservationNeedsBroker),false,'no reason is shown before pressing next');
  const raf=global.requestAnimationFrame; global.requestAnimationFrame=()=>0; // the step change scrolls the page
  try { next.props.onPress(); } finally { global.requestAnimationFrame=raf; }
  const texts=nodes(h.render()).filter(n=>n.type==='span').map(n=>n.props.children);
  assert.ok(texts.includes(agent.reservationNeedsBroker),'the next step explains the lapsed appointment');
}));

test('D1: only the reservation checks the appointment: the broker appointment form offers a tenant who has none', async () => atBangkokOctober12(async()=>{
  const agent=thai.th.agent.contracts;
  const h=harness([], {props:{startCreate:null},candidates:[{leadId:1,tenant:'Tenant 1',property:'P',room:'1',brokerAppointmentReady:false}],
    api:{listAgreementTypes:async()=>[{code:'broker_appointment',formKind:'broker_appointment'}],getBrokerAppointmentLeadDefaults:async()=>({})}});
  h.render(); h.resolve(); await h.tick();
  nodes(h.render()).find(n=>n.type==='contract-library').props.onCreate();
  h.render(); await h.tick();
  h.render().props.onSelect('broker_appointment');
  for (let i=0;i<10&&!nodes(h.render()).some(n=>n.type==='broker-fields');i++) await h.tick();
  const radio=nodes(h.render()).find(n=>n.type==='button'&&n.props.accessibilityRole==='radio');
  assert.equal(radio.props.disabled,false);
  assert.equal(radio.props.accessibilityState.checked,true);
  assert.equal(nodes(radio).some(n=>n.type==='span'&&n.props.children===agent.candidateNeedsBroker),false);
}));

test('D1: an existing reservation draft can still be edited and moved on when the tenant has no valid appointment', async () => atBangkokOctober12(async()=>{
  const agent=thai.th.agent.contracts;
  const draft=row({id:7,formKind:'reservation',status:'draft',agreementTypeCode:'reservation',agreementTypeName:'Reservation',contractNo:'RS007',endDate:null,
    ownerSignedAt:null,tenantSignedAt:null,agentSignedAt:null,data:{reservationLetter:{}}});
  const tenant={id:1,leadId:1,name:'Tenant A',phone:'0812345678',email:'a@b.co',identityNumber:null,nationality:null,fullAddress:null,contracts:[],brokerAppointmentReady:false};
  const h=harness([draft], {props:{startCreate:null,tenant,initialContract:draft},api:{getAgentContractDraftTemplate:async()=>({id:2,dataSchema:{type:'object'}})}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const label=n=>nodes(n).filter(x=>x.type==='span').flatMap(x=>[x.props.children].flat()).join('');
  nodes(h.render()).find(n=>n.type==='button'&&label(n)===contractsTh.screen.editDraft).props.onPress();
  for (let i=0;i<10&&!nodes(h.render()).some(n=>n.type==='reservation-fields');i++) await h.tick();
  const radio=nodes(h.render()).find(n=>n.type==='button'&&n.props.accessibilityRole==='radio');
  assert.equal(radio.props.accessibilityState.checked,true);
  const raf=global.requestAnimationFrame; global.requestAnimationFrame=()=>0;
  try { nodes(h.render()).find(n=>n.type==='button'&&label(n).startsWith(contractsTh.screen.nextStep.split('{')[0])).props.onPress(); }
  finally { global.requestAnimationFrame=raf; }
  const texts=nodes(h.render()).filter(n=>n.type==='span').map(n=>n.props.children);
  assert.equal(texts.includes(agent.reservationNeedsBroker),false,'the draft is not stopped for the appointment');
  assert.ok(nodes(h.render()).some(n=>n.type==='button'&&label(n)===contractsTh.screen.previousStep),'the form moved on to the next step');
}));

test('header back steps out of the type picker and its menus before leaving the contracts section', async () => {
  const backRef={current:null};
  const h=harness([], {props:{startCreate:null,backRef}});
  h.render(); h.resolve(); await h.tick();
  let tree=h.render();
  assert.equal(backRef.current(),false);
  nodes(tree).find(n=>n.type==='contract-library').props.onCreate();
  tree=h.render();
  assert.equal(tree.type,'type-picker');
  assert.equal(backRef.current(),true);
  tree=h.render();
  assert.ok(nodes(tree).some(n=>n.type==='contract-library'));
  nodes(tree).find(n=>n.type==='contract-library').props.onCreate();
  for (const kind of ['invoice','agent_commission']) {
    h.render().props.onSelect(kind);
    tree=h.render();
    assert.notEqual(tree.type,'type-picker',kind);
    assert.equal(nodes(tree).some(n=>n.type==='contract-library'),false,kind);
    assert.equal(backRef.current(),true,kind);
    assert.equal(h.render().type,'type-picker',kind);
  }
});

test('header back leaves an open create form to the host, as before', async () => atBangkokOctober12(async()=>{
  const backRef={current:null};
  const h=harness([row()], {props:{backRef}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  assert.ok(nodes(h.render()).some(n=>n.type==='renewal-fields'));
  assert.equal(backRef.current(),false);
}));

test('D17: a signed party shows how it was signed', async () => atBangkokOctober12(async()=>{
  const agent=thai.th.agent.contracts;
  const signing=row({id:5,formKind:'renewal',status:'awaiting_signatures',contractNo:'RN005',ownerSignedAt:'2026-10-11T03:00:00Z',tenantSignedAt:null,ownerSignatureUrl:'https://x/o.png'});
  const signatureLogCalls=[];
  const signatureLog=[{party:'owner',channel:'link',signedAt:'2026-10-11T03:00:00.000Z',signedBy:null},{party:'tenant',channel:'on_site',signedAt:'2026-10-11T03:00:00.000Z',signedBy:'QA Agent'}];
  const h=harness([signing], {props:{startCreate:null,initialContract:signing},signatureLog,signatureLogCalls});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const texts=()=>nodes(h.render()).filter(n=>n.type==='span').map(n=>n.props.children);
  assert.ok(texts().includes(agent.signedVia.link),'the signed owner shows the channel');
  // The tenant has a log row but is not signed on the contract itself, so no channel line is shown for it.
  assert.equal(texts().some(t=>typeof t==='string' && t.startsWith(agent.signedVia.on_site)),false);
  assert.deepEqual(signatureLogCalls,[5],'loaded once for the open contract');
}));

test('D9: a lease asks for a witness before generating; the agent signs as witness or types the witness name', async () => atBangkokOctober12(async()=>{
  const agent=thai.th.agent.contracts;
  const lease=row({id:6,formKind:'lease',status:'awaiting_agent_review',contractNo:'LS006',ownerSignedAt:'2026-10-11T03:00:00Z',tenantSignedAt:'2026-10-11T03:00:00Z',leaseAgreementStatus:'ready_to_generate',ownerSignatureUrl:'https://x/o.png',tenantSignatureUrl:'https://x/t.png'});
  const witnessCalls=[],signatureLogCalls=[];
  const signed={...lease};
  const h=harness([lease], {props:{startCreate:null,initialContract:lease},signatureLog:[],signatureLogCalls,
    api:{signAgentContractWitness:async(id,input)=>{witnessCalls.push([id,input]);return signed;}}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const tree=()=>nodes(h.render());
  const texts=()=>tree().filter(n=>n.type==='span').map(n=>n.props.children);
  const button=(label)=>tree().find(n=>n.type==='button'&&n.props.children===label);
  assert.ok(texts().includes(agent.witness));
  assert.ok(texts().includes(agent.witnessRequired),'the generate step says the witness must sign first');
  // Someone else witnesses: the name is required before anything is sent.
  button(agent.witnessOther).props.onPress();
  const sheet=tree().find(n=>n.type==='aside'&&nodes(n).some(c=>typeof c.props?.onOK==='function'));
  assert.equal(sheet.props.visible,true,'the signing sheet opens');
  assert.ok(tree().some(n=>n.type==='input'&&n.props.label===agent.witnessName));
  const pad=()=>tree().find(n=>typeof n.props?.onOK==='function');
  await pad().props.onOK('data:image/png;base64,AAAA');
  assert.deepEqual(witnessCalls,[]);
  assert.ok(texts().includes(agent.witnessNameRequired));
  tree().find(n=>n.type==='input'&&n.props.label===agent.witnessName).props.onChangeText(' Witness C ');
  await pad().props.onOK('data:image/png;base64,AAAA');
  assert.deepEqual(witnessCalls,[[6,{signaturePng:'data:image/png;base64,AAAA',asAgent:false,signerName:'Witness C'}]]);
  assert.deepEqual(signatureLogCalls,[6,6],'the log is read again after the witness signs');
}));

test('D9: the agent signing as witness sends no name, and a signed witness shows instead of the buttons', async () => atBangkokOctober12(async()=>{
  const agent=thai.th.agent.contracts;
  const lease=row({id:6,formKind:'lease',status:'awaiting_agent_review',contractNo:'LS006',ownerSignedAt:'2026-10-11T03:00:00Z',tenantSignedAt:'2026-10-11T03:00:00Z',leaseAgreementStatus:'ready_to_generate'});
  const witnessCalls=[];
  const h=harness([lease], {props:{startCreate:null,initialContract:lease},signatureLog:[],
    api:{signAgentContractWitness:async(id,input)=>{witnessCalls.push([id,input]);return lease;}}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const tree=()=>nodes(h.render());
  tree().find(n=>n.type==='button'&&n.props.children===agent.witnessAsAgent).props.onPress();
  assert.equal(tree().some(n=>n.type==='input'&&n.props.label===agent.witnessName),false,'no name field when the agent is the witness');
  await tree().find(n=>typeof n.props?.onOK==='function').props.onOK('data:image/png;base64,AAAA');
  assert.deepEqual(witnessCalls,[[6,{signaturePng:'data:image/png;base64,AAAA',asAgent:true}]]);
  // With a witness in the log: no buttons, the witness line shows, and no "witness first" hint.
  const done=harness([lease], {props:{startCreate:null,initialContract:lease},
    signatureLog:[{party:'witness',channel:'on_site',signedAt:'2026-10-11T04:00:00.000Z',signedBy:'Witness C'}]});
  done.render(); done.resolve(); await done.tick(); done.render(); await done.tick();
  const doneTree=nodes(done.render());
  assert.equal(doneTree.some(n=>n.type==='button'&&[agent.witnessAsAgent,agent.witnessOther].includes(n.props.children)),false);
  const doneTexts=doneTree.filter(n=>n.type==='span').map(n=>n.props.children);
  assert.ok(doneTexts.includes(`${agent.signedVia.on_site} ${agent.signedBy.replace('{name}','Witness C')}`));
  assert.equal(doneTexts.includes(agent.witnessRequired),false);
}));

test('D9: the generate button waits for the witness, unless the log could not be read (the API still checks)', async () => atBangkokOctober12(async()=>{
  const agent=thai.th.agent.contracts;
  const lease=row({id:6,formKind:'lease',status:'awaiting_agent_review',contractNo:'LS006',ownerSignedAt:'2026-10-11T03:00:00Z',tenantSignedAt:'2026-10-11T03:00:00Z',leaseAgreementStatus:'ready_to_generate'});
  const open=async(options)=>{
    const h=harness([lease], {props:{startCreate:null,initialContract:lease},...options});
    h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
    // Attachments are complete, so only the witness can hold the button.
    nodes(h.render()).find(n=>typeof n.props?.onReadinessChange==='function').props.onReadinessChange({contractId:6,ready:true});
    const tree=nodes(h.render());
    return {h,tree,generate:tree.find(n=>n.type==='button'&&n.props.children===contractsTh.screen.confirmGenerate)};
  };
  const waiting=await open({signatureLog:[]});
  assert.equal(waiting.generate.props.disabled,true);
  const witnessed=await open({signatureLog:[{party:'witness',channel:'app',signedAt:'2026-10-11T04:00:00.000Z',signedBy:'QA Agent'}]});
  assert.equal(witnessed.generate.props.disabled,false);
  // The log could not be read: no witness buttons (nothing to decide on) and the button is not held.
  const failed=await open({api:{listAgentContractSignatures:async()=>{throw new Error('offline');}}});
  assert.equal(failed.generate.props.disabled,false);
  assert.equal(failed.tree.some(n=>n.type==='button'&&[agent.witnessAsAgent,agent.witnessOther].includes(n.props.children)),false);
  // If the API refuses for the missing witness, the app explains it in its own words.
  const refused=await open({signatureLog:[{party:'witness',channel:'app',signedAt:'2026-10-11T04:00:00.000Z',signedBy:'QA Agent'}],
    api:{generateAgentLeaseAgreement:async()=>{throw Object.assign(new Error('ต้องให้พยานลงนาม'),{code:'WITNESS_SIGNATURE_REQUIRED'});}}});
  refused.generate.props.onPress(); await refused.h.tick();
  assert.ok(nodes(refused.h.render()).filter(n=>n.type==='span').map(n=>n.props.children).includes(agent.witnessRequired));
}));

test('share: the contract goes to the party\'s app once, with no sign link (removed on 21 Oct 2026)', async () => atBangkokOctober12(async()=>{
  const agent=thai.th.agent.contracts;
  for (const k of ['shareSign','shareSignSend','shareSignSent','shareSignMessage','shareSignDelivered']) assert.ok(agent[k],k);
  const alerts=[],deliveries=[];
  const signing=row({id:5,formKind:'renewal',status:'awaiting_signatures',contractNo:'RN005',ownerSignedAt:null,tenantSignedAt:null,ownerDeliveredAt:'2026-10-11T03:00:00Z',tenantDeliveredAt:null});
  const h=harness([signing], {props:{startCreate:null,initialContract:signing},alerts,deliveries});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const tree=()=>nodes(h.render());
  assert.equal(tree().some(n=>n.type==='button' && n.props.children===agent.shareSignLink),false,'no sign link button');
  // The owner already has it: the button says so and cannot send again.
  const owner=tree().find(n=>n.type==='button' && n.props.children===agent.shareSignSent);
  assert.equal(owner.props.disabled,true);
  assert.ok(tree().some(n=>n.type==='span' && n.props.children===agent.shareSignDelivered),'the row says it is in their app');
  owner.props.onPress();
  assert.deepEqual(alerts,[],'nothing to choose once delivered');
  // The tenant: sending to the app is the only choice.
  const tenant=tree().find(n=>n.type==='button' && n.props.children===agent.shareSign);
  tenant.props.onPress();
  assert.deepEqual(alerts[0][2].map(b=>b.text),[thai.th.common.cancel,agent.shareSignSend]);
  assert.equal(alerts[0][1],agent.shareSignMessage.replace('{party}',agent.tenant));
  alerts[0][2][1].onPress(); await h.tick();
  assert.deepEqual(deliveries,[[5,'tenant']]);
  assert.equal(tree().filter(n=>n.type==='button' && n.props.children===agent.shareSignSent).length,2,'both parties now show as sent');
}));

test('close contract: only an active lease or renewal gets the close card, and closing updates the screen', async () => atBangkokOctober12(async()=>{
  let changed=0;
  const active=row({id:6,contractNo:'LS006',templateId:2});
  const h=harness([active], {props:{startCreate:null,initialContract:active,onChanged:()=>{changed++;}}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const card=nodes(h.render()).find(n=>n.type==='close-card');
  assert.ok(card);
  assert.equal(card.props.contract.id,6);
  card.props.onClosed({contract:{...active,status:'terminated'},billing:{policy:'retain_existing',unpaidCount:0,unpaidAmount:'0.00',paidCount:0,billsDueAfterEndCount:0}});
  const after=nodes(h.render());
  assert.equal(after.some(n=>n.type==='close-card'),false);
  assert.ok(after.some(n=>n.type==='span' && n.props.children==='closed'));
  assert.equal(changed,1);
  const draft=row({id:7,status:'awaiting_signatures',formKind:'renewal',templateId:2});
  const other=harness([draft], {props:{startCreate:null,initialContract:draft}});
  other.render(); other.resolve(); await other.tick(); other.render(); await other.tick();
  assert.equal(nodes(other.render()).some(n=>n.type==='close-card'),false);
}));

// The harness serves Thai only; this checks that the code, not the API's own text, decides the message.
// The list load and the draft save both turn errors into text with the same message() helper.
test('D1: an API refusal for a missing broker appointment shows the app\'s own reason, not a connection error', async () => {
  const err=Object.assign(new Error('ห้องนี้ยังไม่มีสัญญาแต่งตั้งนายหน้าที่มีผล'),{code:'BROKER_APPOINTMENT_REQUIRED'});
  const h=harness([], {props:{startCreate:null},listFails:err});
  h.render(); await h.tick(); await h.tick();
  const texts=nodes(h.render()).filter(n=>n.type==='span').map(n=>n.props.children);
  assert.ok(texts.includes(thai.th.agent.contracts.reservationNeedsBroker));
  assert.equal(texts.includes(thai.th.agent.contracts.notice.connectError),false);
});

test('D10: a generated lease shows the deposit card; the agent issues the invoice again, then the receipt from the tenant\'s slip', async () => atBangkokOctober12(async()=>{
  const deposit={status:'not_issued',total:30000,invoiceId:null,invoiceDocumentNo:null,dueDate:null,invoiceUrl:null,receiptDocumentNo:null,receiptUrl:null,paymentSlipUrl:null,submittedAt:null};
  const lease=row({id:7,contractNo:'LS007',leaseAgreementStatus:'ready',depositPayment:deposit});
  const issued={...lease,depositPayment:{...deposit,status:'submitted',invoiceId:100,invoiceDocumentNo:'DEP-LS007',dueDate:'2026-11-01',invoiceUrl:'dep.pdf',paymentSlipUrl:'slip.jpg',submittedAt:'2026-10-11T03:00:00Z'}};
  const paid={...issued,depositPayment:{...issued.depositPayment,status:'paid',receiptDocumentNo:'REC-DEP-LS007',receiptUrl:'rec.pdf'}};
  const issueCalls=[]; let current=lease;
  const h=harness([lease], {props:{startCreate:null,initialContract:lease},
    api:{issueAgentDepositInvoice:async(id)=>{issueCalls.push(id);current=issued;return issued;},getAgentContract:async()=>current}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const tree=()=>nodes(h.render());
  const card=()=>tree().find(n=>n.type==='deposit-card');
  assert.equal(card().props.contract.depositPayment.status,'not_issued');
  // D6: the lease also shows the handover card for this contract; it reloads when the deposit changes.
  const handover=()=>tree().find(n=>n.type==='handover-card').props;
  assert.deepEqual({id:handover().contractId,mode:handover().mode,date:handover().defaultDate},{id:7,mode:'agent',date:lease.startDate});
  const keyBefore=handover().refreshKey;
  card().props.onIssueInvoice(); await h.tick();
  assert.notEqual(handover().refreshKey,keyBefore,'the handover card is told the deposit changed');
  assert.deepEqual(issueCalls,[7]);
  assert.equal(card().props.contract.depositPayment.invoiceId,100,'the screen shows the issued invoice');
  assert.ok(tree().some(n=>n.type==='span'&&n.props.children===contractsTh.deposit.issued));
  // Opening the deposit documents previews the signed URLs from the contract.
  for (const [kind,url] of [['deposit-payment-slip','slip.jpg'],['deposit-invoice','dep.pdf']]) {
    card().props.onOpen(kind);
    assert.ok(tree().some(n=>n.props?.url===url),kind);
  }
  card().props.onIssueReceipt();
  const form=tree().find(n=>n.props?.fixedInvoiceId!=null);
  assert.deepEqual({kind:form.props.kind,invoice:form.props.fixedInvoiceId,slipOnFile:form.props.slipOnFile},{kind:'receipt',invoice:100,slipOnFile:true});
  current=paid;
  form.props.onStandaloneCreated({id:100}); await h.tick();
  assert.equal(tree().some(n=>n.props?.fixedInvoiceId!=null),false,'back on the contract');
  assert.equal(card().props.contract.depositPayment.status,'paid','the contract is loaded again after the receipt');
  assert.notEqual(handover().refreshKey,keyBefore);
  assert.match(handover().refreshKey,/:paid$/,'the receipt (which opens the handover) reloads the handover card');
  card().props.onOpen('deposit-receipt');
  assert.ok(tree().some(n=>n.props?.url==='rec.pdf'));
}));

test('D10: without a slip the tenant sent (none, or only one the agent attached) the agent attaches one; a reservation has no deposit card', async () => atBangkokOctober12(async()=>{
  for (const paymentSlipUrl of [null,'agent.jpg']) {
    const unpaid={status:'unpaid',total:30000,invoiceId:100,invoiceDocumentNo:'DEP-LS008',dueDate:'2026-11-01',invoiceUrl:'dep.pdf',receiptDocumentNo:null,receiptUrl:null,paymentSlipUrl,submittedAt:null};
    const lease=row({id:8,contractNo:'LS008',leaseAgreementStatus:'ready',depositPayment:unpaid});
    const h=harness([lease], {props:{startCreate:null,initialContract:lease}});
    h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
    nodes(h.render()).find(n=>n.type==='deposit-card').props.onIssueReceipt();
    assert.equal(nodes(h.render()).find(n=>n.props?.fixedInvoiceId!=null).props.slipOnFile,false,String(paymentSlipUrl));
  }
  const booking=row({id:9,formKind:'reservation',status:'active',contractNo:'RS009',endDate:null,reservationLetterStatus:'ready'});
  const r=harness([booking], {props:{startCreate:null,initialContract:booking}});
  r.render(); r.resolve(); await r.tick(); r.render(); await r.tick();
  assert.equal(nodes(r.render()).some(n=>n.type==='deposit-card'),false);
  assert.equal(nodes(r.render()).some(n=>n.type==='handover-card'),false,'a reservation has no handover');
}));

test('B3: the signing card tells whoever still signs which attached documents the agent rejected', async () => atBangkokOctober12(async()=>{
  const rejected=[{name:'สำเนาบัตรประชาชน',note:'ภาพไม่ชัด'}];
  const lease=row({id:10,formKind:'lease',status:'awaiting_signatures',contractNo:'LS010',leaseAgreementStatus:'awaiting_signatures',ownerSignedAt:null,tenantSignedAt:null});
  const h=harness([lease], {props:{startCreate:null,initialContract:lease}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const tree=()=>nodes(h.render());
  const attachments=tree().find(n=>typeof n.props?.onReadinessChange==='function');
  attachments.props.onReadinessChange({contractId:10,ready:true,rejected});
  assert.deepEqual(tree().find(n=>n.type==='rejected-notice').props.items,rejected);
  // Another contract's list is not shown here.
  attachments.props.onReadinessChange({contractId:99,ready:true,rejected});
  assert.equal(tree().some(n=>n.type==='rejected-notice'),false);
  // Everyone has signed: nothing left to warn about.
  const signed=row({id:11,formKind:'lease',status:'awaiting_agent_review',contractNo:'LS011',leaseAgreementStatus:'ready_to_generate',ownerSignedAt:'2026-10-11T03:00:00Z',tenantSignedAt:'2026-10-11T03:00:00Z',agentSignedAt:'2026-10-11T03:00:00Z'});
  const g=harness([signed], {props:{startCreate:null,initialContract:signed}});
  g.render(); g.resolve(); await g.tick(); g.render(); await g.tick();
  nodes(g.render()).find(n=>typeof n.props?.onReadinessChange==='function').props.onReadinessChange({contractId:11,ready:true,rejected});
  assert.equal(nodes(g.render()).some(n=>n.type==='rejected-notice'),false);
}));

test('D2: the letter and the lease lock the numbers of the offer the landlord confirmed for the chosen tenant\'s room', async () => atBangkokOctober12(async()=>{
  const offerKeys=load('../lib/deal-offer.ts');
  const cand={leadId:1,tenant:'Tenant 1',property:'P',room:'1',rentRoomId:3,brokerAppointmentReady:true};
  const open=async(formKind, offers)=>{
    const offerCalls=[];
    // A lease starts only after a reservation letter is issued.
    const issued=formKind==='lease'?[row({id:3,formKind:'reservation',status:'active',reservationLetterStatus:'ready',endDate:null})]:[];
    const h=harness(issued, {props:{startCreate:null},candidates:[cand],offers,offerCalls,
      api:{listAgreementTypes:async()=>[{code:formKind,formKind}],getReservationDefaults:async()=>({}),getLeaseDefaults:async()=>({})}});
    h.render(); h.resolve(); await h.tick();
    nodes(h.render()).find(n=>n.type==='contract-library').props.onCreate();
    h.render(); await h.tick();
    h.render().props.onSelect(formKind);
    const type=formKind==='reservation'?'reservation-fields':'lease-fields';
    for (let i=0;i<10&&!nodes(h.render()).some(n=>n.type===type);i++) await h.tick();
    h.render(); await h.tick();
    return {fields:nodes(h.render()).find(n=>n.type===type), offerCalls};
  };
  const confirmed={id:30,leadId:1,rentRoomId:3,status:'confirmed'};
  let r=await open('reservation',[confirmed]);
  assert.deepEqual(r.fields.props.lockedKeys,offerKeys.OFFER_RESERVATION_LOCKED_KEYS);
  assert.deepEqual(r.offerCalls,[1]);
  r=await open('lease',[confirmed]);
  assert.deepEqual(r.fields.props.lockedKeys,offerKeys.OFFER_LEASE_LOCKED_KEYS);
  // An offer for another room, one still waiting for the landlord, or none: nothing is locked.
  for (const offers of [[{...confirmed,rentRoomId:4}],[{...confirmed,status:'awaiting_landlord'}],[]]) {
    r=await open('reservation',offers);
    assert.equal(r.fields.props.lockedKeys,undefined,JSON.stringify(offers));
  }
  // A broker appointment has no offer numbers: the offers are not even read.
  const brokerCalls=[];
  const broker=harness([], {props:{startCreate:null},candidates:[cand],offers:[confirmed],offerCalls:brokerCalls,
    api:{listAgreementTypes:async()=>[{code:'broker_appointment',formKind:'broker_appointment'}],getBrokerAppointmentLeadDefaults:async()=>({})}});
  broker.render(); broker.resolve(); await broker.tick();
  nodes(broker.render()).find(n=>n.type==='contract-library').props.onCreate();
  broker.render(); await broker.tick();
  broker.render().props.onSelect('broker_appointment');
  for (let i=0;i<10&&!nodes(broker.render()).some(n=>n.type==='broker-fields');i++) await broker.tick();
  assert.ok(nodes(broker.render()).some(n=>n.type==='broker-fields'));
  assert.deepEqual(brokerCalls,[]);
}));

test('D2: inside a tenant (no room in the candidate), the lead\'s confirmed offer still locks the letter', async () => atBangkokOctober12(async()=>{
  const offerKeys=load('../lib/deal-offer.ts');
  const open=async(offers)=>{
    const tenant={id:1,leadId:1,name:'Tenant A',phone:'0812345678',email:'a@b.co',identityNumber:'A1234567',nationality:'British',fullAddress:null,contracts:[],brokerAppointmentReady:true};
    const h=harness([], {props:{startCreate:null,tenant},offers,offerCalls:[],
      api:{listAgreementTypes:async()=>[{code:'reservation',formKind:'reservation'}],getReservationDefaults:async()=>({})}});
    h.render(); h.resolve(); await h.tick();
    nodes(h.render()).find(n=>n.type==='contract-library').props.onCreate();
    h.render(); await h.tick();
    h.render().props.onSelect('reservation');
    for (let i=0;i<10&&!nodes(h.render()).some(n=>n.type==='reservation-fields');i++) await h.tick();
    h.render(); await h.tick();
    return nodes(h.render()).find(n=>n.type==='reservation-fields');
  };
  assert.deepEqual((await open([{id:30,leadId:1,rentRoomId:3,status:'confirmed'}])).props.lockedKeys,offerKeys.OFFER_RESERVATION_LOCKED_KEYS);
  assert.equal((await open([{id:30,leadId:1,rentRoomId:3,status:'awaiting_landlord'}])).props.lockedKeys,undefined);
}));

test('D2: an existing reservation draft (no room in its candidate) is locked by the lead\'s confirmed offer', async () => atBangkokOctober12(async()=>{
  const offerKeys=load('../lib/deal-offer.ts');
  const draft=row({id:7,formKind:'reservation',status:'draft',agreementTypeCode:'reservation',agreementTypeName:'Reservation',contractNo:'RS007',endDate:null,
    ownerSignedAt:null,tenantSignedAt:null,agentSignedAt:null,data:{reservationLetter:{}}});
  const tenant={id:1,leadId:1,name:'Tenant A',phone:'0812345678',email:'a@b.co',identityNumber:null,nationality:null,fullAddress:null,contracts:[],brokerAppointmentReady:true};
  const offerCalls=[];
  const h=harness([draft], {props:{startCreate:null,tenant,initialContract:draft},offers:[{id:30,leadId:1,rentRoomId:3,status:'confirmed'}],offerCalls,
    api:{getAgentContractDraftTemplate:async()=>({id:2,dataSchema:{type:'object'}})}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const label=n=>nodes(n).filter(x=>x.type==='span').flatMap(x=>[x.props.children].flat()).join('');
  nodes(h.render()).find(n=>n.type==='button'&&label(n)===contractsTh.screen.editDraft).props.onPress();
  for (let i=0;i<10&&!nodes(h.render()).some(n=>n.type==='reservation-fields');i++) await h.tick();
  h.render(); await h.tick();
  assert.deepEqual(nodes(h.render()).find(n=>n.type==='reservation-fields').props.lockedKeys,offerKeys.OFFER_RESERVATION_LOCKED_KEYS);
  assert.ok(offerCalls.includes(1));
}));

test('D14: when generating the reservation letter is refused for a missing co-broke file, the app shows its own reason', async () => atBangkokOctober12(async()=>{
  const reservation=row({id:8,formKind:'reservation',status:'awaiting_agent_review',agreementTypeCode:'reservation',agreementTypeName:'Reservation',contractNo:'RS008',endDate:null,
    reservationLetterStatus:'ready_to_generate',data:{reservationLetter:{}}});
  const generateCalls=[];
  const h=harness([reservation], {props:{startCreate:null,initialContract:reservation},
    api:{generateAgentReservation:async(id)=>{generateCalls.push(id);throw Object.assign(new Error('Thai-only server text'),{code:'CO_BROKE_REQUIRED'});}}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const label=n=>nodes(n).filter(x=>x.type==='span').flatMap(x=>[x.props.children].flat()).join('');
  const text=n=>[n.props.children].flat().filter(x=>typeof x==='string').join('')+label(n);
  nodes(h.render()).find(n=>n.type==='button'&&text(n)===contractsTh.screen.confirmGenerate).props.onPress();
  await h.tick(); await h.tick();
  assert.deepEqual(generateCalls,[8]);
  const texts=nodes(h.render()).filter(n=>n.type==='span').map(n=>n.props.children);
  assert.ok(texts.includes(contractsTh.offer.coBrokeRequired));
  assert.ok(!texts.includes('Thai-only server text'));
}));

test('D11: the agent returns a booking or deposit slip from the cards, and the receipt forms ask who received the money', async () => atBangkokOctober12(async()=>{
  const payment={invoiceDocumentNo:'INV-RS011',receiptDocumentNo:null,total:5000,status:'submitted',paymentSlipUrl:'slip.jpg',submittedAt:'2026-10-11T03:00:00Z'};
  const booking=row({id:11,formKind:'reservation',status:'draft',contractNo:'RS011',endDate:null,invoiceUrl:'inv.pdf',receiptUrl:null,reservationPayment:payment});
  const returned={...booking,reservationPayment:{...payment,status:'unpaid',paymentSlipUrl:null,slipReturnReason:'ยอดไม่ตรง'}};
  const calls=[]; let fail=false;
  const h=harness([booking], {props:{startCreate:null,initialContract:booking},
    api:{returnReservationSlip:async(id,reason,seen)=>{calls.push(['reservation',id,reason,seen]);if (fail) throw new Error('x');return returned;}}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const tree=()=>nodes(h.render());
  const card=()=>tree().find(n=>n.type==='reservation-card');
  assert.equal(await card().props.onReturnSlip('ยอดไม่ตรง'),true);
  assert.deepEqual(calls,[['reservation',11,'ยอดไม่ตรง','2026-10-11T03:00:00Z']],'sends the slip the agent looked at');
  assert.equal(card().props.contract.reservationPayment.slipReturnReason,'ยอดไม่ตรง','the screen shows the returned slip');
  assert.ok(tree().some(n=>n.type==='span'&&n.props.children===contractsTh.slipReturn.done));
  fail=true;
  assert.equal(await card().props.onReturnSlip('again'),false,'a failed return keeps the reason in the card');
  card().props.onIssueReceipt();
  assert.equal(tree().find(n=>n.props?.kind==='receipt'&&n.props?.contractId===11).props.landlordReceipt,'reservation');
  // The deposit card of a lease.
  const deposit={status:'submitted',total:30000,invoiceId:100,invoiceDocumentNo:'DEP-LS012',dueDate:'2026-11-01',invoiceUrl:'dep.pdf',receiptDocumentNo:null,receiptUrl:null,paymentSlipUrl:'slip.jpg',submittedAt:'2026-10-11T03:00:00Z'};
  const lease=row({id:12,contractNo:'LS012',leaseAgreementStatus:'ready',depositPayment:deposit});
  const leaseReturned={...lease,depositPayment:{...deposit,status:'unpaid',paymentSlipUrl:null,submittedAt:null,slipReturnReason:'สลิปซ้ำ'}};
  const l=harness([lease], {props:{startCreate:null,initialContract:lease},
    api:{returnDepositSlip:async(id,reason,seen)=>{calls.push(['deposit',id,reason,seen]);return leaseReturned;}}});
  l.render(); l.resolve(); await l.tick(); l.render(); await l.tick();
  const depositCard=()=>nodes(l.render()).find(n=>n.type==='deposit-card');
  assert.equal(await depositCard().props.onReturnSlip('สลิปซ้ำ'),true);
  assert.deepEqual(calls.at(-1),['deposit',12,'สลิปซ้ำ','2026-10-11T03:00:00Z']);
  assert.equal(depositCard().props.contract.depositPayment.slipReturnReason,'สลิปซ้ำ');
  depositCard().props.onIssueReceipt();
  assert.equal(nodes(l.render()).find(n=>n.props?.fixedInvoiceId===100).props.landlordReceipt,'deposit');
}));

test('D11: when the tenant sent a newer slip, the return is refused and the screen loads the newer slip', async () => atBangkokOctober12(async()=>{
  const payment={invoiceDocumentNo:'INV-RS013',receiptDocumentNo:null,total:5000,status:'submitted',paymentSlipUrl:'old.jpg',submittedAt:'2026-10-11T03:00:00Z'};
  const booking=row({id:13,formKind:'reservation',status:'draft',contractNo:'RS013',endDate:null,invoiceUrl:'inv.pdf',receiptUrl:null,reservationPayment:payment});
  const newer={...booking,reservationPayment:{...payment,paymentSlipUrl:'new.jpg',submittedAt:'2026-10-12T03:00:00Z'}};
  let latest=booking;
  const h=harness([booking], {props:{startCreate:null,initialContract:booking},
    api:{returnReservationSlip:async()=>{latest=newer;throw Object.assign(new Error('Thai-only server text'),{code:'SLIP_CHANGED'});},getAgentContract:async()=>latest}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const card=()=>nodes(h.render()).find(n=>n.type==='reservation-card');
  assert.equal(card().props.contract.reservationPayment.paymentSlipUrl,'old.jpg');
  assert.equal(await card().props.onReturnSlip('ยอดไม่ตรง'),false);
  await h.tick();
  assert.equal(card().props.contract.reservationPayment.paymentSlipUrl,'new.jpg','the newer slip is shown');
  const texts=nodes(h.render()).filter(n=>n.type==='span').map(n=>n.props.children);
  assert.ok(texts.includes(contractsTh.slipReturn.changed));
  assert.ok(!texts.includes('Thai-only server text'));
}));

test('D2 round 2: a reservation or lease shows the deal\'s offer to read and change; a change reads the contract again', async () => atBangkokOctober12(async()=>{
  const booking=row({id:21,formKind:'reservation',status:'draft',contractNo:'RS021',endDate:null,leadId:4,rentRoomId:9,reservationFee:15000});
  const refreshed={...booking,monthlyRent:14000,reservationFee:14000};
  const shows=(amount)=>nodes(h.render()).some(n=>[n.props?.children].flat().some(c=>typeof c==='string'&&c.includes(amount)));
  let reads=0, changed=0;
  const h=harness([booking], {props:{startCreate:null,initialContract:booking,onChanged:()=>{changed++;}},
    api:{getAgentContract:async()=>{reads++;return reads>1?refreshed:booking;}}});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const section=()=>nodes(h.render()).find(n=>n.type==='deal-offer-section');
  assert.deepEqual({mode:section().props.mode,lead:section().props.leadId,room:section().props.roomId},{mode:'deal',lead:4,room:9});
  assert.equal(shows('15,000'),true,'the booking amount before the change');
  const before=reads;
  section().props.onRevised({id:30});
  await h.tick(); await h.tick();
  assert.equal(reads,before+1,'the contract is read again (its unsigned documents may have changed)');
  assert.deepEqual([shows('14,000'),shows('15,000')],[true,false],'the contract shows the booking amount read again');
  assert.equal(section().key,'offer:4:9');
  assert.ok(changed>0,'the list is told too');
  // Not for a closed contract, a contract without a room, or other forms.
  for (const patch of [{status:'cancelled'},{status:'terminated'},{rentRoomId:null},{formKind:'broker_appointment'}]) {
    const c=row({id:22,formKind:'reservation',status:'draft',contractNo:'RS022',endDate:null,leadId:4,rentRoomId:9,...patch});
    const o=harness([c], {props:{startCreate:null,initialContract:c}});
    o.render(); o.resolve(); await o.tick(); o.render(); await o.tick();
    assert.equal(nodes(o.render()).some(n=>n.type==='deal-offer-section'),false,JSON.stringify(patch));
  }
  const lease=row({id:23,contractNo:'LS023',leadId:4,rentRoomId:9,leaseAgreementStatus:'awaiting_signatures',status:'awaiting_signatures'});
  const l=harness([lease], {props:{startCreate:null,initialContract:lease}});
  l.render(); l.resolve(); await l.tick(); l.render(); await l.tick();
  assert.ok(nodes(l.render()).some(n=>n.type==='deal-offer-section'),'a lease shows it too');
}));
