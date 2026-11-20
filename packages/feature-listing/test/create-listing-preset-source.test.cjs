// Self owner listing (20 Nov 2026, ClickUp z8rcteng6d): the agent listing wizard can start with a fixed listing source
// (self owner is always the owner) and then never shows the "who is listing" picker. Without the prop, agent is unchanged.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const code = fs.readFileSync(path.resolve(__dirname, '../src/components/MobileCreateListingWizardBody.tsx'), 'utf8');
const props = code.slice(code.indexOf('export interface MobileCreateListingWizardBodyProps'), code.indexOf('function nativeElevation'));
const backHandler = code.slice(code.indexOf('const handleWizardBack = useCallback'), code.indexOf('return false;', code.indexOf('const handleWizardBack = useCallback')));

test('prop is optional', () => {
  assert.match(props, /presetListingSource\?: ListingSourceCode;/);
});

test('initial source uses the preset after initialData', () => {
  const inits = code.match(/useState<ListingSourceCode \| null>\(\s*initialData\?\.listingSourceCode \?\? presetListingSource \?\? null,?\s*\)/g) ?? [];
  assert.equal(inits.length, 2, 'listingSourceCode and sourceDraft both start from the preset');
});

test('back from hub does not reopen the picker when preset', () => {
  assert.match(backHandler, /if \(listingSourceCode && editView === 'overview' && !initialData && !presetListingSource\) \{\s*setSourceDraft\(listingSourceCode\);\s*setListingSourceCode\(null\);/);
});

test('agent keeps the picker: no preset means the old start', () => {
  assert.match(code, /const pickingSource = !listingSourceCode;/);
});

// Web leave prompt (Jom 20 Nov 2026): Alert is a no-op on react-native-web, so a host can ask its own way.
test('confirmLeave is optional and replaces the alert when given', () => {
  assert.match(props, /confirmLeave\?: \(discard: \(\) => void\) => void;/);
  const dirty = code.slice(code.indexOf("if (listingSourceCode && editView === 'overview' && initialData && hubDirtyRef.current) {"));
  assert.match(dirty, /^[^]*?if \(confirmLeave\) \{\s*confirmLeave\(\(\) => onAbandonUnsaved\?\.\(\)\);\s*return true;\s*\}\s*Alert\.alert\(cr\.setupUnsavedLeaveTitle/);
});

// Self owner create form (Jom 20 Nov 2026): optional props to rename a few texts, let the room name be blank and use
// the owner's profile as the only contact. Without them the agent form is unchanged.
const step8 = code.slice(code.indexOf('{step === 8 && ('), code.indexOf('{errors.ownerPick ?', code.indexOf('{step === 8 && (')));

test('the three new props are optional', () => {
  assert.match(props, /copyOverrides\?: Partial<Record<'listingTitle' \| 'listingTitleHint' \| 'listingTitlePlaceholder' \| 'sourceSection' \| 'contactStepTitle' \| 'visibilityPrivateHint', string>>;/);
  assert.match(props, /listingTitleOptional\?: boolean;/);
  assert.match(props, /ownerContact\?: \{ name: string; phone: string \};/);
});

test('texts: the overrides sit on top of the agent copy, the agent gets its own copy object', () => {
  assert.match(code, /const cr = useMemo\(\(\) => \{\s*const base = t\.agent\.createRoom;\s*if \(!copyOverrides\) return base;\s*const \{ contactStepTitle, \.\.\.rest \} = copyOverrides;\s*return \{\s*\.\.\.base,\s*\.\.\.rest,\s*steps: contactStepTitle \? \{ \.\.\.base\.steps, ownerVisibility: contactStepTitle \} : base\.steps,\s*\};\s*\}, \[t, copyOverrides\]\);/);
});

test('room name: required unless listingTitleOptional', () => {
  assert.match(code, /if \(!listingTitleOptional && !listingTitle\.trim\(\)\) nextErrors\.listingTitle = cr\.required;/);
  const input = code.slice(code.indexOf('label={cr.listingTitle}'), code.indexOf('helperText={cr.listingTitleHint}'));
  assert.match(input, /required=\{!listingTitleOptional\}/);
});

test('owner contact: starts from the profile, no contact book hints, name and phone locked only when the profile has them', () => {
  assert.match(code, /const \[ownerName, setOwnerName\] = useState\(ownerContact\?\.name \?\? ''\);/);
  assert.match(code, /const \[ownerPhone, setOwnerPhone\] = useState\(ownerContact\?\.phone \?\? ''\);/);
  assert.match(step8, /\{!ownerContact \? <Text style=\{styles\.hint\}>\{cr\.roomContactsMaxHint\}<\/Text> : null\}/);
  assert.match(step8, /\{!roomContacts\.length && !ownerContact \? \(/);
  assert.match(step8, /label=\{cr\.ownerName\}[^]*?editable=\{!ownerContact\?\.name\.trim\(\)\}/);
  assert.match(step8, /label=\{cr\.ownerPhone\}[^]*?editable=\{!ownerContact\?\.phone\.trim\(\)\}/);
});

test('owner contact on edit: no contact cards; name / phone from the room, else the profile', () => {
  const effect = code.slice(code.indexOf('const seeded: {'), code.indexOf('appliedPlaceName.current = p.name;'));
  assert.match(effect, /if \(ownerContact\) \{\s*const saved = initialData\.contact \?\? initialData\.selectedContacts\?\.\[0\];\s*setRoomContacts\(\[\]\);\s*setOwnerMode\('create'\);\s*setOwnerName\(saved\?\.name \|\| ownerContact\.name\);\s*setOwnerPhone\(saved\?\.phone \|\| ownerContact\.phone\);/);
});

// Desktop look for the self owner web form (Jom 20 Nov 2026): pickers as centred dialogs, footer buttons not stretched.
const sheets = fs.readFileSync(path.resolve(__dirname, '../src/components/wizard-desktop.ts'), 'utf8');
const dateField = fs.readFileSync(path.resolve(__dirname, '../src/components/MoveInDateField.tsx'), 'utf8');

test('desktopLayout is optional and shared with the date field through a context', () => {
  assert.match(props, /desktopLayout\?: boolean;/);
  assert.match(code, /<WizardDesktopContext\.Provider value=\{!!desktopLayout\}>/);
  assert.match(sheets, /export const WizardDesktopContext = React\.createContext\(false\);/);
  assert.match(sheets, /export function useWizardSheetProps\(\)/);
  assert.match(dateField, /<MobileBottomSheet visible=\{open\} onClose=\{\(\) => setOpen\(false\)\} \{\.\.\.sheetProps\}>/);
});

test('every picker sheet of the form takes the desktop props', () => {
  const opened = (code.match(/<MobileBottomSheet\b/g) ?? []).length;
  const withProps = (code.match(/<MobileBottomSheet\b[^>]*\{\.\.\.sheetProps\}/g) ?? []).length;
  assert.ok(opened >= 5);
  assert.equal(withProps, opened);
});

test('without desktopLayout the sheets keep the phone look (no extra props), the footer buttons keep their style', () => {
  assert.match(sheets, /if \(!desktop\) return \{\};/);
  assert.match(sheets, /showHandle: false/);
  assert.match(code, /style=\{desktopLayout \? \[styles\.footerCta, styles\.footerCtaDesktop\] : styles\.footerCta\}/);
});

// Browser check (Jom 20 Nov 2026): opening /self-owner/rooms/new straight away mounts the form before the profile has
// loaded, so name / phone started empty and then locked. A late profile fills the fields that are still empty.
test('owner contact that arrives after the form opened fills the empty name / phone (never overwrites)', () => {
  assert.match(code, /useEffect\(\(\) => \{\s*if \(!ownerContact\) return;\s*setOwnerName\(\(current\) => \(current\.trim\(\) \? current : ownerContact\.name\)\);\s*setOwnerPhone\(\(current\) => \(current\.trim\(\) \? current : ownerContact\.phone\)\);\s*\/\/[^\n]*\n\s*\}, \[ownerContact\?\.name, ownerContact\?\.phone\]\);/);
});
