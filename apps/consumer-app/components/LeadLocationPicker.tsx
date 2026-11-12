import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import type { LeadLocationCatalog } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { MobileButton, MobileInput, roleOnDark, tokens, useMobileTheme } from '@nestyk/ui/native';
import { fetchLeadLocations } from '../lib/agent-leads-api';

export function LeadLocationPicker({ province, locations, onChange, filter = false, provinceOnly = false, disabled = false, markRequired = true, error }: {
  province: string; locations: string[]; onChange: (province: string, locations: string[]) => void;
  filter?: boolean; provinceOnly?: boolean; disabled?: boolean; markRequired?: boolean; error?: string;
}) {
  const { t, locale } = useLocale(); const c = t.agent.leads; const { theme, isDark } = useMobileTheme();
  const [catalog, setCatalog] = useState<LeadLocationCatalog>([]);
  const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false); const [retry, setRetry] = useState(0);
  const [panel, setPanel] = useState<'province' | 'areas' | null>(null); const [search, setSearch] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setFailed(false);
    fetchLeadLocations().then((rows) => { if (active) setCatalog(rows); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const open = (value: 'province' | 'areas') => { setSearch(''); setPanel(value); };
  const selectedProvince = catalog.find((p) => p.name === province);
  const provinceLabel = (p: LeadLocationCatalog[number]) => locale === 'th' ? p.name : p.nameEn;
  const items = panel === 'province'
    ? catalog.filter((p) => `${p.name} ${p.nameEn}`.toLowerCase().includes(search.trim().toLowerCase())).map((p) => ({ value: p.name, label: provinceLabel(p) }))
    : [...new Set([...(selectedProvince?.locations ?? []), ...locations])].filter((a) => a.toLowerCase().includes(search.trim().toLowerCase())).map((a) => ({ value: a, label: a }));
  const rowStyle = { borderColor: theme.border, backgroundColor: theme.surface };
  const picker = <Modal visible={panel !== null} animationType="slide" onRequestClose={() => setPanel(null)}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}><SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textHeading }]}>{panel === 'province' ? c.province : c.areas}</Text>
          <MobileButton variant="outline" onPress={() => setPanel(null)}>{c.back}</MobileButton>
        </View>
        <View style={{ paddingHorizontal: 20 }}><MobileInput placeholder={c.searchLocations} value={search} onChangeText={setSearch} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
          {loading ? <ActivityIndicator color={roleOnDark(tokens.colors.roles.agent, isDark)} /> : failed ? <View style={styles.group}><Text style={{ color: theme.textSecondary }}>{c.loadError}</Text><MobileButton onPress={() => setRetry((n) => n + 1)}>{c.retry}</MobileButton></View> : <>
            {(filter || panel === 'areas') && <MobileButton variant="outline" onPress={() => { onChange(panel === 'province' ? '' : province, []); if (panel === 'province') setPanel(null); }}>{panel === 'province' ? c.allProvinces : c.unspecifiedArea}</MobileButton>}
            {items.map((item) => {
              const checked = panel === 'province' ? province === item.value : locations.includes(item.value);
              return <Pressable key={item.value} accessibilityRole={panel === 'province' ? 'radio' : 'checkbox'} accessibilityState={{ checked }} onPress={() => {
                if (panel === 'province') { onChange(item.value, item.value === province ? locations : []); setPanel(null); }
                else onChange(province, checked ? locations.filter((a) => a !== item.value) : [...locations, item.value]);
              }} style={[styles.select, rowStyle, checked && { borderColor: roleOnDark(tokens.colors.roles.agent, isDark) }]}>
                <Text style={[styles.value, { color: theme.textHeading }]}>{item.label}</Text><Text style={{ color: tokens.colors.roles.agent }}>{checked ? '✓' : ''}</Text>
              </Pressable>;
            })}
            {!items.length && <Text style={{ color: theme.textSecondary }}>{panel === 'areas' && !search ? c.noAreas : c.noMatches}</Text>}
          </>}
        </ScrollView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>;
  return <View style={styles.group}>
    <Text style={[styles.label, { color: theme.textHeading }]}>{c.province}{filter || !markRequired ? '' : ' *'}</Text>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={() => open('province')} style={[styles.select, rowStyle]}>
      <Text style={[styles.value, { color: province ? theme.textHeading : theme.textSecondary }]}>{selectedProvince ? provinceLabel(selectedProvince) : province || (filter ? c.allProvinces : c.selectProvince)}</Text>
      <Text style={{ color: theme.textSecondary }}>⌄</Text>
    </Pressable>
    {error ? <Text style={{ color: '#DC2626' }}>{error}</Text> : null}
    {province && !provinceOnly ? <>
      <Text style={[styles.label, { color: theme.textHeading }]}>{c.areas}</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => open('areas')} style={[styles.select, rowStyle]}>
        <Text style={[styles.value, { color: locations.length ? theme.textHeading : theme.textSecondary }]}>{locations.length ? locations.join(' · ') : filter ? c.preferredLocation : c.unspecifiedArea}</Text>
        <Text style={{ color: theme.textSecondary }}>⌄</Text>
      </Pressable>
      {locations.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {locations.map((area) => <Pressable key={area} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${c.clearFilters}: ${area}`} onPress={() => onChange(province, locations.filter((a) => a !== area))} style={{ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' }}>
          <Text style={[styles.hint, { color: theme.textHeading }]}>{area} ×</Text>
        </Pressable>)}
      </View>}
      {!filter && <Text style={[styles.hint, { color: theme.textSecondary }]}>{c.areasHint}</Text>}
    </> : null}
    {picker}
  </View>;
}
const styles = StyleSheet.create({ group: { gap: 8 }, label: { fontFamily: tokens.typography.native.body, fontSize: 14 }, select: { minHeight: 48, padding: 14, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, value: { flex: 1, fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22 }, hint: { fontSize: 12, lineHeight: 20 }, header: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontFamily: tokens.typography.native.headingTh, fontSize: 18 }, list: { padding: 20, gap: 10, paddingBottom: 40 } });
