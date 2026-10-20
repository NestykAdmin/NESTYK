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
    'react-native':{View:'section',Text:'span',Pressable:'button',StyleSheet:{create:s=>s},ActivityIndicator:'progress',Modal:'aside',Linking:{},Alert:{alert:(...args)=>options.alerts?.push(args)},Share:{dismissedAction:'dismissedAction',share:async message=>{options.shared?.push(message);if (options.shareResult instanceof Error) throw options.shareResult;return {action:options.shareResult ?? 'sharedAction'};}}},
    'react-native-safe-area-context':{SafeAreaProvider:'section',SafeAreaView:'section'},
    '@nestyk/ui/native':{tokens:{colors:{brand:{500:'#ff0'},roles:{agent:'#ff0'},onBrand:'#000'},typography:{native:{}}},useMobileTheme:()=>({theme:{}}),MobileThemeProvider:'light-theme',MobileIcon:'i',MobileButton:'button',MobileInput:'input',MobileBottomSheet:'aside'},
    '@nestyk/i18n':i18nMock({agent:thai.th.agent,common:thai.th.common,mobile:thai.th.mobile}), '../lib/lead-format':leadFormat,
    '../lib/lease-term':term, '../lib/contract-renewal':renewalHelpers,
    '../lib/contract-signing':{bookingPaymentBlocksSigning:()=>false},
    './BookingInvoiceListCard':{bookingInvoicesForTenant:()=>[],BookingInvoiceListCard:()=>null},
    '../lib/agent-contracts-api':{
      listAgentContracts:()=>list,listStandaloneInvoices:async()=>options.invoices ?? [],listCommissionConfirmations:async()=>options.commissions ?? [],
      getAgentContract:async id=>rows.find(row=>row.id===id),
      listAgreementTypes:async()=>[{code:'lease_renewal',formKind:'renewal'}],
      listAgreementTemplates:async()=>[{id:2,dataSchema:{type:'object'}}],
      createContractSignInvite:async(id,party)=>{options.invites?.push([id,party]);return {party,url:'https://nestyk.test/sign/abc',expiresAt:'2026-10-12T05:15:00Z'};},
      deliverAgentContract:async(id,party)=>{options.deliveries?.push([id,party]);return {party,deliveredAt:'2026-10-12T05:00:00Z'};},
    },
    './ReservationLetterFields':{ReservationLetterFields:'reservation-fields',emptyReservationLetterForm:()=>({})},
    './BrokerAppointmentFields':{BrokerAppointmentFields:'broker-fields',emptyBrokerAppointmentForm:()=>({})},
    './LeaseAgreementFields':{LeaseAgreementFields:'lease-fields',emptyLeaseAgreementForm:()=>({})},
    './LeaseRenewalFields':{LeaseRenewalFields:'renewal-fields',emptyLeaseRenewalForm:blankRenewal},
    './ContractTypePicker':{ContractTypePicker:'type-picker'},
    './AgentContractLibrary':{AgentContractLibrary:'contract-library'},
    '../lib/agent-contract-library':load('../lib/agent-contract-library.ts'),
    '../lib/contract-close':load('../lib/contract-close.ts', id=>id==='./lease-term'?term:require(id)),
    './ContractCloseCard':{ContractCloseCard:'close-card',closeResultNotice:()=>'closed'},
  };
  for (const name of ['FinancialDocumentForm','CommissionConfirmationForm','AgreementAttachments','ReservationPaymentCard','ContractDocumentPreview','ContractSignaturePad']) dependencies[`./${name}`]={[name]:()=>null};
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
  assert.equal(locked(await picker([booking({leadId:2})],{tenant})),true);
  assert.equal(locked(await picker([booking({leadId:1})],{tenant})),false);
});

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

test('sign link: the share button offers a web link next to sending to the app, and still offers it once delivered', async () => atBangkokOctober12(async()=>{
  const agent=thai.th.agent.contracts;
  const alerts=[],shared=[],invites=[],deliveries=[];
  const signing=row({id:5,formKind:'renewal',status:'awaiting_signatures',contractNo:'RN005',ownerSignedAt:null,tenantSignedAt:null,ownerDeliveredAt:'2026-10-11T03:00:00Z',tenantDeliveredAt:null});
  const h=harness([signing], {props:{startCreate:null,initialContract:signing},alerts,shared,invites,deliveries});
  h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
  const shareButtons=()=>nodes(h.render()).filter(n=>n.type==='button' && [agent.shareSign,agent.shareSignLink].includes(n.props.children));
  const [owner,tenant]=shareButtons();
  // The owner already has it in the app: the button now sends a link, and the row says it was delivered.
  assert.equal(owner.props.children,agent.shareSignLink);
  assert.equal(owner.props.disabled,false);
  assert.ok(nodes(h.render()).some(n=>n.type==='span' && n.props.children===agent.shareSignDelivered));
  owner.props.onPress();
  assert.deepEqual(alerts[0][2].map(b=>b.text),[thai.th.common.cancel,agent.shareSignLink]);
  tenant.props.onPress();
  assert.deepEqual(alerts[1][2].map(b=>b.text),[thai.th.common.cancel,agent.shareSignApp,agent.shareSignLink]);
  alerts[1][2][2].onPress(); await h.tick();
  assert.deepEqual(invites,[[5,'tenant']]);
  assert.equal(shared.length,1);
  assert.match(shared[0].message,/RN005/);
  assert.match(shared[0].message,/https:\/\/nestyk\.test\/sign\/abc/);
  assert.match(shared[0].message,/12:15/);
  const tree=nodes(h.render());
  assert.ok(tree.some(n=>n.type==='span' && n.props.children===agent.shareSignLinkReady.replace('{time}','12:15').replace('{party}',agent.tenant)));
  assert.equal(shareButtons()[1].props.disabled,false,'busy is cleared after sharing');
  assert.deepEqual(deliveries,[]);
  // "Send to app" still goes through the one-time delivery, not the link.
  alerts[1][2][1].onPress(); await h.tick();
  assert.deepEqual(deliveries,[[5,'tenant']]);
  assert.deepEqual(invites,[[5,'tenant']]);
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

test('sign link: a dismissed share sheet says the link was not sent, and a failed one shows the link to copy', async () => atBangkokOctober12(async()=>{
  const agent=thai.th.agent.contracts;
  for (const [shareResult,expected] of [
    ['dismissedAction',agent.shareSignLinkNotSent.replace('{party}',agent.tenant)],
    [new Error('no sheet'),agent.shareSignLinkCopy.replace('{party}',agent.tenant).replace('{time}','12:15').replace('{url}','https://nestyk.test/sign/abc')],
  ]) {
    const alerts=[];
    const signing=row({id:5,formKind:'renewal',status:'awaiting_signatures',templateId:2,ownerSignedAt:null,tenantSignedAt:null,ownerDeliveredAt:null,tenantDeliveredAt:null});
    const h=harness([signing], {props:{startCreate:null,initialContract:signing},alerts,shared:[],invites:[],shareResult});
    h.render(); h.resolve(); await h.tick(); h.render(); await h.tick();
    nodes(h.render()).filter(n=>n.type==='button' && n.props.children===agent.shareSign)[1].props.onPress();
    alerts[0][2].find(b=>b.text===agent.shareSignLink).onPress(); await h.tick();
    const texts=nodes(h.render()).filter(n=>n.type==='span').map(n=>n.props.children);
    assert.ok(texts.includes(expected),String(shareResult));
    assert.equal(texts.includes(agent.shareSignLinkReady.replace('{time}','12:15').replace('{party}',agent.tenant)),false);
  }
}));
