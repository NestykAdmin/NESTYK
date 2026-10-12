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
function harness(rows) {
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
    'react-native':{View:'section',Text:'span',Pressable:'button',StyleSheet:{create:s=>s},ActivityIndicator:'progress',Modal:'aside',Linking:{},Alert:{}},
    'react-native-safe-area-context':{SafeAreaProvider:'section',SafeAreaView:'section'},
    '@nestyk/ui/native':{tokens:{colors:{brand:{500:'#ff0'},roles:{agent:'#ff0'},onBrand:'#000'},typography:{native:{}}},useMobileTheme:()=>({theme:{}}),MobileIcon:'i',MobileButton:'button',MobileInput:'input',MobileBottomSheet:'aside'},
    '@nestyk/i18n':i18nMock({agent:thai.th.agent}), '../lib/lead-format':leadFormat,
    '../lib/lease-term':term, '../lib/contract-renewal':renewalHelpers,
    '../lib/contract-signing':{bookingPaymentBlocksSigning:()=>false},
    './BookingInvoiceListCard':{bookingInvoicesForTenant:()=>[],BookingInvoiceListCard:()=>null},
    '../lib/agent-contracts-api':{
      listAgentContracts:()=>list,listStandaloneInvoices:async()=>[],listCommissionConfirmations:async()=>[],
      listAgreementTypes:async()=>[{code:'lease_renewal',formKind:'renewal'}],
      listAgreementTemplates:async()=>[{id:2,dataSchema:{type:'object'}}],
    },
    './ReservationLetterFields':{ReservationLetterFields:'reservation-fields',emptyReservationLetterForm:()=>({})},
    './BrokerAppointmentFields':{BrokerAppointmentFields:'broker-fields',emptyBrokerAppointmentForm:()=>({})},
    './LeaseAgreementFields':{LeaseAgreementFields:'lease-fields',emptyLeaseAgreementForm:()=>({})},
    './LeaseRenewalFields':{LeaseRenewalFields:'renewal-fields',emptyLeaseRenewalForm:blankRenewal},
    './ContractTypePicker':{ContractTypePicker:'type-picker'},
  };
  for (const name of ['FinancialDocumentForm','CommissionConfirmationForm','AgreementAttachments','ReservationPaymentCard','ContractDocumentPreview','ContractSignaturePad']) dependencies[`./${name}`]={[name]:()=>null};
  for (const name of ['expo-document-picker','expo-image-picker','expo-image']) dependencies[name]={};
  const screen=load('ContractsScreen.tsx',id=>{if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);return dependencies[id];});
  const props={startCreate:'renewal',onStartCreateHandled:()=>{handled++;}};
  const render=()=>{stateIndex=refIndex=effectIndex=0;const tree=screen.ContractsScreen(props);effects.splice(0).forEach(fn=>fn());return tree;};
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
