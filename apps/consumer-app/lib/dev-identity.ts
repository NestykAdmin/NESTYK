import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEV_AUTH_CONFIG } from './auth/dev-auth';

const DEV_IDENTITY_KEY = 'nestyk.dev.agent.identity.v1';

export type DevIdentity = {
  uuid: string;
  email: string;
};

function randomUuid(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const n = (Math.random() * 16) | 0;
    const v = ch === 'x' ? n : (n & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Dev builds only (EXPO_PUBLIC_USE_DEV_AUTH=true or EXPO_PUBLIC_APP_ENV=development). PDPA plan FE4: a production
 * build keeps no made-up identity in browser storage and sends no dev token (the production API refuses it anyway),
 * so a signed-out request simply has no Authorization header.
 */
export async function getOrCreateDevIdentity(enabled: boolean = DEV_AUTH_CONFIG.enabled): Promise<DevIdentity | null> {
  if (!enabled) return null;
  const raw = await AsyncStorage.getItem(DEV_IDENTITY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DevIdentity;
      if (parsed.uuid && parsed.email) return parsed;
    } catch {
      // recreate below
    }
  }

  const uuid = randomUuid();
  const identity: DevIdentity = {
    uuid,
    email: `agent-${uuid.slice(0, 8)}@nestyk.local`,
  };
  await AsyncStorage.setItem(DEV_IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export function toDevBearer(identity: DevIdentity): string {
  return `dev|${identity.uuid}|${identity.email}|Agent|Dev`;
}
