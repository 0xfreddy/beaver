import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearBankExchangeToken } from './bank-exchange-token';

// A bank's OAuth may finish in the system browser while iOS relaunches the app
// cold: the in-flight link session (id + connect URL) is lost exactly when the
// vendor redirect comes back. Persisting the completion payload lets the
// callback screen finish through the existing exchange endpoint after relaunch.
const STORAGE_KEY = 'saltedge.pending.completion';
// A marker is not an authorization token. Only server-verified completion or
// explicit cancellation removes it; elapsed time must not lose a linked bank.
const startedHere = new Set<string>();
// Save/clear share a queue: secure-store cleanup can yield while a new link starts.
let writes = Promise.resolve();
function writeMarker(action: () => Promise<void>) {
  const next = writes.then(action, action);
  writes = next.catch(() => {});
  return next;
}
export function startedBankLinkInThisProcess(linkSessionId: string) {
  return startedHere.has(linkSessionId);
}

export type PendingBankProvider = 'saltedge' | 'moneykit';

export type PendingSaltEdgeCompletion = {
  // Records written before the field existed are Salt Edge; normalized on load.
  provider?: PendingBankProvider;
  userId: string;
  linkSessionId: string;
  mode: string;
  // Legacy records may contain a Salt Edge URL. New markers store no vendor
  // token here; both providers’ completion tokens use native secure storage.
  exchangeableToken: string;
  returnTo: string;
  savedAt: number;
};

export async function savePendingSaltEdge(
  value: Omit<PendingSaltEdgeCompletion, 'savedAt'>,
): Promise<PendingSaltEdgeCompletion> {
  const record: PendingSaltEdgeCompletion = { ...value, savedAt: Date.now() };
  startedHere.add(value.linkSessionId);
  try {
    await writeMarker(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record)));
  } catch {
    // Storage pressure must not break the live flow; only recovery degrades.
  }
  return record;
}

export async function clearPendingSaltEdge(linkSessionId?: string): Promise<void> {
  await writeMarker(async () => {
    try {
      const pending = await readPendingSaltEdge();
      if (linkSessionId) await clearBankExchangeToken(linkSessionId);
      if (linkSessionId && pending?.linkSessionId !== linkSessionId) return;
      if (pending && !linkSessionId) await clearBankExchangeToken(pending.linkSessionId);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // Preserve the live flow when local persistence is unavailable.
    }
  });
}

export async function loadPendingSaltEdge(): Promise<PendingSaltEdgeCompletion | null> {
  await writes;
  return readPendingSaltEdge();
}
async function readPendingSaltEdge(): Promise<PendingSaltEdgeCompletion | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as Partial<PendingSaltEdgeCompletion>;
    if (
      (record.provider === undefined ||
        record.provider === 'saltedge' ||
        record.provider === 'moneykit') &&
      typeof record.userId === 'string' &&
      typeof record.linkSessionId === 'string' &&
      typeof record.mode === 'string' &&
      typeof record.exchangeableToken === 'string' &&
      typeof record.returnTo === 'string' &&
      typeof record.savedAt === 'number' &&
      Number.isFinite(record.savedAt)
    )
      return { provider: 'saltedge', ...record } as PendingSaltEdgeCompletion;
  } catch {
    // Corrupt records are treated as absent.
  }
  return null;
}
