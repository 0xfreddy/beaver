import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  roundupRuleSchema,
  retentionActionSchema,
  everydayTargetSchema,
  retentionLessons,
} from '@roundups/types';
import type { CreatedInvite, PublicProfile } from '@roundups/types';
import { isInternalAccessEnabled, isSyntheticUserId } from './internal-access';
import type { Purchase } from './purchases';
import {
  MOCK_FIXTURE_VERSION,
  buildMockFixture,
  validateMockFixture,
  type MockAccountFixture,
} from './mock-fixture';

const STORAGE_PREFIX = `roundups.mock-data.${MOCK_FIXTURE_VERSION}:`;
let activeFixture: MockAccountFixture | null = null;

// A compact sample of both live issuer families. Live accounts receive the
// complete, Jupiter-verified catalogue from the backend.
const supportedMarketItems = [
  { symbol: 'AAPL', name: 'Apple xStock', issuer: 'xstocks' },
  { symbol: 'AMZN', name: 'Amazon xStock', issuer: 'xstocks' },
  { symbol: 'GOOGL', name: 'Alphabet xStock', issuer: 'xstocks' },
  { symbol: 'META', name: 'Meta xStock', issuer: 'xstocks' },
  { symbol: 'MSFT', name: 'Microsoft xStock', issuer: 'xstocks' },
  { symbol: 'NVDA', name: 'NVIDIA xStock', issuer: 'xstocks' },
  { symbol: 'TSLA', name: 'Tesla xStock', issuer: 'xstocks' },
  { symbol: 'ANDURIL', name: 'Anduril PreStocks', issuer: 'prestocks' },
  { symbol: 'ANTHROPIC', name: 'Anthropic PreStocks', issuer: 'prestocks' },
  { symbol: 'FIGUREAI', name: 'Figure AI PreStocks', issuer: 'prestocks' },
  { symbol: 'KALSHI', name: 'Kalshi PreStocks', issuer: 'prestocks' },
  { symbol: 'NEURALINK', name: 'Neuralink PreStocks', issuer: 'prestocks' },
  { symbol: 'OPENAI', name: 'OpenAI PreStocks', issuer: 'prestocks' },
  { symbol: 'POLYMARKET', name: 'Polymarket PreStocks', issuer: 'prestocks' },
  { symbol: 'XAI', name: 'xAI PreStocks', issuer: 'prestocks' },
] as const;

type MockResult = { handled: false } | { handled: true; data: unknown };

export function isMockDataEligible() {
  const extra = Constants.expoConfig?.extra as
    { environment?: unknown; mockDataEnabled?: unknown } | undefined;
  return isMockDataEnvironmentAllowed(extra?.environment, extra?.mockDataEnabled);
}

export function isMockDataEnvironmentAllowed(environment: unknown, enabled: unknown) {
  return enabled === true && (environment === 'development' || environment === 'staging');
}

/** Internal archives expose sample data only to their synthetic review/team identities. */
export function isMockDataEligibleForOwner(ownerId: string) {
  return isMockDataEligible() || (isInternalAccessEnabled() && isSyntheticUserId(ownerId));
}

export function isMockDataActive() {
  return activeFixture !== null && isMockDataEligibleForOwner(activeFixture.ownerId);
}

export function activeMockOwner() {
  return isMockDataActive() ? (activeFixture?.ownerId ?? null) : null;
}

function storageKey(ownerId: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(ownerId)}`;
}

export async function restoreMockData(ownerId: string) {
  activeFixture = null;
  if (!isMockDataEligibleForOwner(ownerId)) return null;
  const raw = await AsyncStorage.getItem(storageKey(ownerId));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!validateMockFixture(value, ownerId)) {
      await AsyncStorage.removeItem(storageKey(ownerId));
      return null;
    }
    // Upgrade only the display code; preserve sample activity and redemption counts.
    const invite = value.invites[0];
    if (invite && invite.code?.length !== 4) {
      invite.code = 'GR8F';
      invite.token = 'GR8F';
      invite.link = 'roundups-development://invite?token=GR8F';
      await AsyncStorage.setItem(storageKey(ownerId), JSON.stringify(value));
    }
    activeFixture = value;
    return value;
  } catch {
    await AsyncStorage.removeItem(storageKey(ownerId));
    return null;
  }
}

export async function loadCanonicalMockData(ownerId: string, now = new Date()) {
  if (!isMockDataEligibleForOwner(ownerId))
    throw new Error('Sample accounts are unavailable in this build.');
  const fixture = buildMockFixture(ownerId, now);
  await AsyncStorage.setItem(storageKey(ownerId), JSON.stringify(fixture));
  activeFixture = fixture;
  return fixture;
}

export async function clearMockData(ownerId: string) {
  await AsyncStorage.removeItem(storageKey(ownerId));
  if (activeFixture?.ownerId === ownerId) activeFixture = null;
}

async function persist() {
  if (!activeFixture) return;
  await AsyncStorage.setItem(storageKey(activeFixture.ownerId), JSON.stringify(activeFixture));
}

function requestBody(options: RequestInit) {
  if (typeof options.body !== 'string' || options.body.length === 0) return {};
  try {
    return JSON.parse(options.body) as Record<string, unknown>;
  } catch {
    throw new Error('The sample-account request was invalid.');
  }
}

function overview(fixture: MockAccountFixture) {
  const grouped = new Map<
    string,
    { currency: string; symbol: string; status: string; amountCents: string; count: number }
  >();
  for (const transaction of fixture.transactions) {
    if (
      transaction.pending ||
      transaction.removedAt ||
      transaction.historicalPreview ||
      !transaction.symbol ||
      !transaction.roundupStatus ||
      transaction.roundupCents === null
    )
      continue;
    const key = `${transaction.symbol}:${transaction.roundupStatus}`;
    const current = grouped.get(key) ?? {
      currency: transaction.currency,
      symbol: transaction.symbol,
      status: transaction.roundupStatus,
      amountCents: '0',
      count: 0,
    };
    current.amountCents = String(Number(current.amountCents) + transaction.roundupCents);
    current.count += 1;
    grouped.set(key, current);
  }
  return { purchaseCount: fixture.transactions.length, buckets: [...grouped.values()] };
}

function activity(fixture: MockAccountFixture, url: URL) {
  const search = (url.searchParams.get('search') ?? '').trim().toLocaleLowerCase();
  const filter = url.searchParams.get('filter') ?? 'all';
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') ?? 30) || 30));
  const cursor = url.searchParams.get('cursor');
  const offset = cursor?.startsWith('mock_cursor_') ? Number(cursor.slice(12)) || 0 : 0;
  const matches = fixture.transactions.filter((transaction) => {
    if (
      filter === 'roundups' &&
      (transaction.roundupCents === null ||
        transaction.pending ||
        transaction.historicalPreview ||
        transaction.removedAt)
    )
      return false;
    if (filter === 'excluded' && transaction.roundupCents !== null) return false;
    if (!search) return true;
    return [transaction.merchant, transaction.symbol, transaction.currency]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(search));
  });
  const items = matches.slice(offset, offset + limit).map((item) => ({
    ...item,
    sourceName: 'Chase',
    sourceLogoUrl: null,
    cardLastFour: '1038',
  }));
  return {
    items,
    nextCursor: offset + limit < matches.length ? `mock_cursor_${offset + limit}` : null,
  };
}

/** Mirror of the backend's keyset pagination: 20 rows plus a next-page cursor. */
function manualReceiptPage(fixture: MockAccountFixture, url: URL) {
  const before = url.searchParams.get('before');
  const rows = [...fixture.manualReceipts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const start = before ? rows.findIndex((item) => item.id === before) + 1 : 0;
  const window = rows.slice(start, start + 21).map((item) => {
    const transaction = item.transactionId
      ? fixture.transactions.find((entry) => entry.id === item.transactionId)
      : undefined;
    return {
      id: item.id,
      hasPhoto: item.hasPhoto,
      createdAt: item.createdAt,
      transactionId: item.transactionId,
      merchant: transaction?.merchant ?? item.merchant,
      amountCents: transaction?.amountCents ?? item.amountCents,
      currency: transaction?.currency ?? item.currency,
      status: transaction?.roundupStatus ?? item.status,
      roundupCents: transaction?.roundupCents ?? item.roundupCents,
      symbol: transaction?.symbol ?? item.symbol,
    };
  });
  return {
    items: window.slice(0, 20),
    nextCursor: window.length > 20 ? window[19]!.id : null,
    scanEnabled: true,
    photosEnabled: true,
  };
}

function updateLeaderboardProfile(fixture: MockAccountFixture, profile: PublicProfile) {
  for (const board of [fixture.globalLeaderboard, fixture.friendsLeaderboard]) {
    board.rows = board.rows.map((row) => (row.isYou ? { ...row, profile } : row));
    board.own = { ...board.own, profile };
  }
}

async function mutate<T>(callback: (fixture: MockAccountFixture) => T) {
  if (!activeFixture) throw new Error('The sample account is not active.');
  const result = callback(activeFixture);
  await persist();
  return result;
}

/**
 * Complete account-level boundary for the device-local fixture. While active, an unknown route
 * fails closed instead of falling through to a provider-backed service.
 */
export async function mockApiRequest(path: string, options: RequestInit): Promise<MockResult> {
  const url = new URL(path, 'https://sample-account.invalid');
  const pathname = url.pathname;
  const method = (options.method ?? 'GET').toUpperCase();
  const body = requestBody(options);
  if (
    !isMockDataActive() &&
    isMockDataEligible() &&
    method === 'POST' &&
    pathname === '/v1/social/invites/accept' &&
    typeof body.token === 'string' &&
    /^[A-Za-z0-9]{4}$/.test(body.token)
  )
    return { handled: true, data: { status: 'already-friends' } };
  if (!isMockDataActive() || path === '/v1/session') return { handled: false };
  const fixture = activeFixture!;
  if (method === 'DELETE' && pathname === '/v1/account') {
    // A real account stays real even when its owner is previewing sample data.
    // Only synthetic review identities have no server account to delete.
    if (!isSyntheticUserId(fixture.ownerId)) return { handled: false };
    await clearMockData(fixture.ownerId);
    return { handled: true, data: { deleted: true } };
  }
  if (fixture.scenario.delayMs > 0)
    await new Promise((resolve) => setTimeout(resolve, fixture.scenario.delayMs));
  if (fixture.scenario.unavailablePath === pathname)
    throw new Error('This sample endpoint is unavailable in the selected test scenario.');

  if (method === 'GET' && pathname === '/v1/portfolio/performance')
    return {
      handled: true,
      data: {
        status: fixture.scenario.unavailablePriceSymbol ? 'unavailable' : 'available',
        gainCents: '625',
        percent: fixture.scenario.unavailablePriceSymbol ? null : 8.33,
        mode: 'paper',
        equivalent: { merchant: 'Starbucks', amountCents: 465 },
      },
    };
  if (method === 'GET' && pathname === '/v1/bank/sync-schedule')
    return {
      handled: true,
      data: {
        nextExpectedAt: new Date(Date.now() + 4 * 3600000).toISOString(),
        items: fixture.connections
          .filter((c) => c.status !== 'disconnected' && !c.disconnectRequested)
          .map((item) => ({
            ...item,
            // 20h elapsed of a 24h cycle → the ruler fills 20 white and 4 gray lines.
            lastSyncedAt: new Date(Date.now() - 20 * 3600000).toISOString(),
          })),
      },
    };
  if (method === 'GET' && /\/bank\/connections\/[^/]+\/unlink-impact$/.test(pathname))
    return {
      handled: true,
      data: {
        contributionSharePercent: 100,
        items: fixture.transactions
          .filter((t) => t.roundupCents != null)
          .slice(0, 5)
          .map((t) => ({
            merchant: t.merchant,
            purchaseCents: t.amountCents,
            roundupCents: t.roundupCents,
            currency: t.currency,
            symbol: t.symbol,
            status: t.roundupStatus,
            preview: t.historicalPreview,
          })),
      },
    };
  if (method === 'PATCH' && pathname === '/v1/investment-policy/fallback') {
    const policy = await mutate((current) => {
      current.policy.fallbackSymbol = typeof body.symbol === 'string' ? body.symbol : null;
      current.policy.fallbackConfigured = true;
      return current.policy;
    });
    return { handled: true, data: policy };
  }
  if (method === 'POST' && pathname === '/v1/manual/mode') {
    await mutate((current) => {
      current.policy.spendingMode = 'manual';
    });
    return { handled: true, data: { spendingMode: 'manual' } };
  }
  if (method === 'GET' && pathname === '/v1/manual/merchants') {
    const merchants = new Map<string, { name: string; symbol: string | null }>();
    for (const item of fixture.transactions)
      if (item.merchant && !merchants.has(item.merchant))
        merchants.set(item.merchant, { name: item.merchant, symbol: item.symbol });
    return { handled: true, data: { items: [...merchants.values()].slice(0, 500) } };
  }
  if (method === 'GET' && pathname === '/v1/manual/receipts')
    return { handled: true, data: manualReceiptPage(fixture, url) };
  if (method === 'POST' && pathname === '/v1/manual/receipts') {
    const image = typeof body.image === 'string' ? body.image : null;
    if (image && !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(image))
      throw new Error('That photo could not be read. Try a JPEG or PNG receipt.');
    if (image && image.length > 2_800_000)
      throw new Error('Crop closer to the receipt and try again. The photo is too large.');
    if (BigInt(fixture.balances.availableUsdcRaw) <= 0n)
      throw new Error('Add enough USDC to cover your roundup before adding a receipt.');
    // Mirrors the backend's image-hash idempotency for repeated draft saves.
    const duplicate = fixture.manualReceipts.find(
      (item) => !!image && !item.transactionId && item.image === image,
    );
    if (duplicate) return { handled: true, data: { id: duplicate.id, transactionId: null } };
    const receipt = await mutate((current) => {
      const draft: MockAccountFixture['manualReceipts'][number] = {
        id: `mock_manual_receipt_${Date.now().toString(36)}`,
        hasPhoto: !!image,
        transactionId: null,
        merchant: null,
        amountCents: null,
        currency: null,
        status: null,
        roundupCents: null,
        symbol: null,
        createdAt: new Date().toISOString(),
        image,
      };
      current.manualReceipts = [draft, ...current.manualReceipts];
      return draft;
    });
    return { handled: true, data: { id: receipt.id, transactionId: null } };
  }
  const receiptMatch = pathname.match(/^\/v1\/manual\/receipts\/([^/]+)(\/.*)?$/);
  if (receiptMatch) {
    const id = decodeURIComponent(receiptMatch[1]!);
    const action = receiptMatch[2];
    const receipt = fixture.manualReceipts.find((item) => item.id === id);
    if (!receipt) throw new Error('This sample receipt is unavailable.');
    if (method === 'GET' && action === '/image')
      return { handled: true, data: { dataUrl: receipt.image } };
    if (method === 'POST' && action === '/scan')
      return {
        handled: true,
        data: {
          merchant: 'Neighborhood Grocer',
          total: '23.17',
          date: new Date().toISOString().slice(0, 10),
          currency: 'USD',
          category: 'Groceries',
          paymentMethod: 'Card',
          subtotal: '21.95',
          tax: '1.22',
          items: [
            { name: 'Organic bananas', amount: '4.25' },
            { name: 'Whole milk', amount: '3.49' },
            { name: 'Sourdough loaf', amount: '5.99' },
            { name: 'Free-range eggs', amount: '5.79' },
            { name: 'Hand soap', amount: '2.43' },
          ],
        },
      };
    if (method === 'POST' && action === '/confirm') {
      if (receipt.transactionId) return { handled: true, data: { alreadyConfirmed: true } };
      const merchant = typeof body.merchant === 'string' ? body.merchant.trim() : '';
      const amountCents = typeof body.amountCents === 'number' ? Math.round(body.amountCents) : 0;
      const currency = typeof body.currency === 'string' && body.currency ? body.currency : 'USD';
      const date =
        typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
          ? body.date
          : new Date().toISOString().slice(0, 10);
      if (!merchant || amountCents <= 0)
        throw new Error(
          'This receipt is missing readable details. Retake the photo and try again.',
        );
      // Same policy math the review screen previews: fixed percentage or next whole dollar.
      const percentage = fixture.policy.roundupPercentage ?? 0;
      const calculated = percentage
        ? Math.floor((amountCents * percentage + 50) / 100)
        : (100 - (amountCents % 100)) % 100;
      const roundup = Math.min(calculated, fixture.policy.maxRoundupCents ?? 900);
      if (BigInt(fixture.balances.availableUsdcRaw) < BigInt(roundup) * 10_000n)
        throw new Error('Add enough USDC to cover your roundup before adding this receipt.');
      const pickedSymbol =
        typeof body.symbol === 'string' && /^[A-Z0-9.]{1,16}$/.test(body.symbol)
          ? body.symbol
          : null;
      const symbol =
        pickedSymbol ??
        fixture.policy.fallbackSymbol ??
        fixture.holdings.items[0]?.symbol ??
        'AAPL';
      const data = await mutate((current) => {
        const transaction: Purchase = {
          id: `mock_tx_manual_${Date.now().toString(36)}`,
          amountCents,
          currency,
          merchant,
          occurredAt: `${date}T12:00:00.000Z`,
          pending: false,
          removedAt: null,
          reason: null,
          historicalPreview: false,
          // An exact-dollar purchase rounds up zero cents and never invests.
          roundupCents: roundup || null,
          symbol,
          roundupStatus: roundup ? 'pending' : null,
          eligibilityStatus: 'eligible',
          confirmedSymbol: pickedSymbol,
          mappingMethod: 'user',
        };
        current.transactions = [transaction, ...current.transactions];
        const confirmed = current.manualReceipts.find((item) => item.id === id)!;
        confirmed.transactionId = transaction.id;
        confirmed.merchant = merchant;
        confirmed.amountCents = amountCents;
        confirmed.currency = currency;
        confirmed.status = transaction.roundupStatus;
        confirmed.roundupCents = transaction.roundupCents;
        confirmed.symbol = symbol;
        return { preview: false, alreadyConfirmed: false, transactionId: transaction.id };
      });
      return { handled: true, data };
    }
    throw new Error(`Sample account does not support ${method} ${pathname}.`);
  }

  if (method === 'GET' && (pathname === '/v1/overview' || pathname === '/v1/roundups'))
    return { handled: true, data: overview(fixture) };
  if (method === 'GET' && pathname === '/v1/trading/balances')
    return { handled: true, data: fixture.balances };
  if (method === 'GET' && pathname === '/v1/portfolio')
    return {
      handled: true,
      data: fixture.scenario.unavailablePriceSymbol
        ? {
            ...fixture.holdings,
            items: fixture.holdings.items.map((item) =>
              item.symbol === fixture.scenario.unavailablePriceSymbol
                ? { ...item, valueUsdCents: null }
                : item,
            ),
          }
        : fixture.holdings,
    };
  if (method === 'GET' && pathname === '/v1/capabilities')
    return { handled: true, data: fixture.capabilities };
  if (method === 'GET' && pathname === '/v1/investment-policy')
    return { handled: true, data: fixture.policy };
  if (method === 'GET' && pathname === '/v1/automation/authorization')
    return { handled: true, data: fixture.authorization };
  if (method === 'GET' && pathname === '/v1/bank/connections')
    return { handled: true, data: { items: fixture.connections } };
  if (method === 'GET' && pathname === '/v1/bank/accounts')
    return { handled: true, data: { items: fixture.accounts } };
  if (method === 'GET' && pathname === '/v1/trading/orders')
    return { handled: true, data: { items: fixture.orders } };
  if (method === 'GET' && pathname === '/v1/trading/markets')
    return { handled: true, data: { items: supportedMarketItems } };
  if (method === 'GET' && pathname === '/v1/funding')
    return {
      handled: true,
      data: {
        address: fixture.authorization.address,
        asset: 'USDC',
        mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        decimals: 6,
        chain: 'solana',
        network: 'devnet',
        acceptedAssets: [
          {
            asset: 'USDC',
            mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
            decimals: 6,
            creditSource: 'finalized_solana_receipt',
          },
          { asset: 'SOL', mint: null, decimals: 9, creditSource: 'finalized_solana_balance' },
        ],
      },
    };
  if (method === 'GET' && pathname === '/v1/funding/receipts')
    return { handled: true, data: { items: fixture.depositReceipts } };
  if (method === 'GET' && pathname === '/v1/transactions')
    if (fixture.scenario.expiredPaginationCursor && url.searchParams.has('cursor'))
      throw new Error('This sample activity page expired. Refresh to start again.');
  if (method === 'GET' && pathname === '/v1/transactions')
    return { handled: true, data: activity(fixture, url) };
  const transactionMatch = pathname.match(/^\/v1\/transactions\/([^/]+)$/);
  if (method === 'GET' && transactionMatch) {
    const id = decodeURIComponent(transactionMatch[1]!);
    // The real worker invests a confirmed manual roundup within seconds; the
    // sample mirrors that by landing it on the first detail poll, so the
    // confirmation screen gets its Solana transaction link.
    if (id.startsWith('mock_tx_manual_'))
      await mutate((current) => {
        const item = current.transactions.find((candidate) => candidate.id === id);
        if (item?.roundupStatus === 'pending' && item.mappingMethod === 'user') {
          item.roundupStatus = 'redeemed';
          item.signature = `mock_sig_buy_${id}`;
        }
        return item ?? null;
      });
    const transaction = fixture.transactions.find((item) => item.id === id);
    if (!transaction) throw new Error('This sample purchase is unavailable.');
    return { handled: true, data: transaction };
  }

  if (
    (method === 'GET' && pathname === '/v1/social/profile') ||
    (method === 'POST' && pathname === '/v1/social/profile/migrate')
  )
    return { handled: true, data: fixture.profile };
  if (method === 'GET' && pathname === '/v1/social/retention')
    return { handled: true, data: fixture.retention };
  if (method === 'POST' && pathname === '/v1/social/retention/actions') {
    const action = retentionActionSchema.parse(body);
    const data = await mutate((current) => {
      const r = current.retention;
      const award = (id: string) => {
        if (!current.achievements.awards.some((a) => a.definitionId === id))
          current.achievements.awards.push({
            definitionId: id,
            criterionVersion: 1,
            earnedAt: new Date().toISOString(),
          });
      };
      if (action.kind === 'recap') {
        if (action.sourceId !== r.recap.id) throw new Error('Refresh your weekly recap.');
        if (!r.recap.completed) {
          r.recap.completed = true;
          r.points += 40;
          r.weeklyPoints += 40;
          r.actions.find((a) => a.id === 'recap')!.completed = true;
          award('first-weekly-wrap');
        }
      } else if (action.kind === 'lesson') {
        const lesson = retentionLessons.find((l) => l.id === action.sourceId);
        if (!lesson || lesson.answer !== action.answer)
          throw new Error('Have another look at the explanation and try again.');
        r.lessons = r.lessons.filter((l) => l.id !== action.sourceId);
        if (action.sourceId === 'roundup-basics') award('know-your-beaver');
      } else if (action.kind === 'rules') award('your-rules');
      current.achievements.points = r.points;
      for (const board of [current.globalLeaderboard, current.friendsLeaderboard]) {
        board.own.points = r.points;
        const own = board.rows.find((row) => row.isYou);
        if (own) own.points = r.points;
        board.rows.sort((a, b) => b.points - a.points);
        board.rows.forEach((row) => {
          row.rank = board.rows.findIndex((r) => r.points === row.points) + 1;
        });
        board.own.rank = own?.rank ?? null;
      }
      return r;
    });
    return { handled: true, data };
  }
  if (method === 'PUT' && pathname === '/v1/social/retention/target') {
    const target = everydayTargetSchema.parse(body);
    const data = await mutate((current) => {
      const milestone = current.retention.milestones.find((m) => m.category === target.category)!;
      milestone.targetCents = target.targetCents;
      milestone.confirmed = true;
      if (milestone.contributedCents >= target.targetCents) {
        milestone.earned = true;
        const definitionId = target.category + '-sized';
        if (!current.achievements.awards.some((a) => a.definitionId === definitionId))
          current.achievements.awards.push({
            definitionId,
            criterionVersion: 1,
            earnedAt: new Date().toISOString(),
          });
      }
      return current.retention;
    });
    return { handled: true, data };
  }
  if (method === 'GET' && pathname === '/v1/social/achievements')
    return { handled: true, data: fixture.achievements };
  if (method === 'GET' && pathname === '/v1/social/leaderboard') {
    const scope = url.searchParams.get('scope') === 'friends' ? 'friends' : 'global';
    const board = scope === 'friends' ? fixture.friendsLeaderboard : fixture.globalLeaderboard;
    const rows =
      scope === 'global' && !fixture.profile.globalOptIn
        ? board.rows.filter((r) => !r.isYou)
        : board.rows;
    const ranked = rows.map((r) => ({
      ...r,
      rank: rows.findIndex((other) => other.points === r.points) + 1,
    }));
    return {
      handled: true,
      data: {
        ...board,
        rows: ranked,
        total: ranked.length,
        own: ranked.find((r) => r.isYou) ?? { ...board.own, rank: null },
      },
    };
  }
  if (method === 'GET' && pathname === '/v1/social/friends')
    return {
      handled: true,
      data: fixture.friendsLeaderboard.rows
        .filter((row) => !row.isYou)
        .map((row) => ({ profile: row.profile, acceptedAt: fixture.anchoredAt })),
    };
  if (method === 'GET' && pathname === '/v1/social/invites')
    return {
      handled: true,
      data: fixture.invites.map(({ id, expiresAt, revoked, code, redeemed }) => ({
        id,
        expiresAt,
        revoked,
        code,
        redeemed,
      })),
    };
  if (method === 'POST' && pathname === '/v1/social/invites') {
    const invite: CreatedInvite = fixture.invites[0]!;
    return { handled: true, data: invite };
  }
  if (method === 'POST' && pathname === '/v1/social/invites/resolve')
    return {
      handled: true,
      data: { status: 'available', inviter: fixture.profile, inviterName: fixture.profile.alias },
    };
  if (method === 'POST' && pathname === '/v1/social/invites/accept')
    return {
      handled: true,
      data: {
        status: 'already-friends',
        inviter: fixture.profile,
        inviterName: fixture.profile.alias,
      },
    };
  const inviteMatch = pathname.match(/^\/v1\/social\/invites\/([^/]+)$/);
  if (method === 'DELETE' && inviteMatch) {
    const invite = await mutate((current) => {
      const item = current.invites.find((candidate) => candidate.id === inviteMatch[1]);
      if (!item) throw new Error('This sample invitation is unavailable.');
      item.revoked = true;
      return item;
    });
    return { handled: true, data: invite };
  }
  if (method === 'POST' && pathname === '/v1/social/events')
    return { handled: true, data: fixture.achievements };
  if (method === 'POST' && pathname === '/v1/bank/onchain-preview') {
    const provider = body.provider === 'tuyo' ? 'tuyo' : 'etherfi';
    const address =
      Array.isArray(body.addresses) && typeof body.addresses[0] === 'string'
        ? body.addresses[0]
        : fixture.cryptoCard.address;
    const months = fixture.cryptoCard.months.map((month) => ({
      month: month.month,
      spentCents: month.spendCents,
      roundupCents: month.roundupCents,
      purchaseCount: month.transactions,
      roundupCount: month.transactions,
    }));
    return {
      handled: true,
      data: {
        mode: 'historical_preview',
        provider,
        roundingIncrementCents: 100,
        roundupPercentage: 0,
        addresses: [
          {
            address,
            provider,
            months,
            chains: fixture.cryptoCard.networks.map((label, index) => ({
              id: `mock_chain_${label.toLowerCase()}`,
              label,
              transactionCount: 19,
              error:
                fixture.scenario.cryptoPartialRead && index === 3
                  ? 'Sample partial-read warning'
                  : null,
            })),
          },
        ],
        transactions: [],
        months,
        averageMonthlySpentCents: 176_788,
        averageMonthlyRoundupCents: 11_878,
      },
    };
  }
  if (method === 'GET' && pathname === '/v1/bank/crypto-cards')
    return { handled: true, data: { items: fixture.cryptoCards } };
  if (method === 'POST' && pathname === '/v1/bank/crypto-cards') {
    const provider: 'etherfi' | 'tuyo' = body.provider === 'tuyo' ? 'tuyo' : 'etherfi';
    const address = typeof body.address === 'string' ? body.address.trim().toLowerCase() : '';
    if (!/^0x[0-9a-f]{40}$/.test(address))
      throw new Error('Enter a public EVM address in 0x format.');
    const card: MockAccountFixture['cryptoCards'][number] = await mutate((current) => {
      const existing = current.cryptoCards.find(
        (item) => item.provider === provider && item.address === address,
      );
      if (existing) return existing;
      const added: MockAccountFixture['cryptoCards'][number] = {
        id: `mock_crypto_card_${Date.now()}`,
        provider,
        address,
        createdAt: new Date().toISOString(),
      };
      current.cryptoCards = [...current.cryptoCards, added];
      return added;
    });
    return { handled: true, data: card };
  }
  const cryptoCardMatch = pathname.match(/^\/v1\/bank\/crypto-cards\/([^/]+)$/);
  if (method === 'DELETE' && cryptoCardMatch) {
    await mutate((current) => {
      const id = decodeURIComponent(cryptoCardMatch[1]!);
      if (!current.cryptoCards.some((item) => item.id === id))
        throw new Error('That crypto card address is no longer saved.');
      current.cryptoCards = current.cryptoCards.filter((item) => item.id !== id);
      return null;
    });
    return { handled: true, data: { removed: true } };
  }

  if (method === 'PATCH' && pathname === '/v1/social/profile') {
    const profile = await mutate((current) => {
      current.profile = {
        ...current.profile,
        ...(typeof body.alias === 'string' ? { alias: body.alias } : {}),
        ...(typeof body.avatarId === 'string' ? { avatarId: body.avatarId } : {}),
        ...(typeof body.globalOptIn === 'boolean' ? { globalOptIn: body.globalOptIn } : {}),
      };
      updateLeaderboardProfile(current, current.profile);
      return current.profile;
    });
    return { handled: true, data: profile };
  }
  if (method === 'PATCH' && pathname === '/v1/profile') {
    const capabilities = await mutate((current) => {
      if (typeof body.country === 'string') current.capabilities.country = body.country;
      return current.capabilities;
    });
    return { handled: true, data: capabilities };
  }
  if (method === 'PATCH' && pathname === '/v1/investment-policy/roundup-rule') {
    const { percentage } = roundupRuleSchema.parse(body);
    const policy = await mutate((current) => {
      current.policy.roundupPercentage = percentage;
      current.policy.roundingIncrementCents = 100;
      current.policy.roundupRuleConfigured = true;
      return current.policy;
    });
    return { handled: true, data: policy };
  }
  if (method === 'POST' && pathname === '/v1/activation') {
    const policy = await mutate((current) => {
      if (typeof body.enabled === 'boolean') current.policy.enabled = body.enabled;
      if (typeof body.dailyLimitCents === 'number')
        current.policy.dailyLimitCents = body.dailyLimitCents;
      if (typeof body.maxRoundupCents === 'number')
        current.policy.maxRoundupCents = body.maxRoundupCents;
      current.policy.acceptedAt = new Date().toISOString();
      return current.policy;
    });
    return { handled: true, data: policy };
  }
  if (method === 'POST' && pathname === '/v1/onboarding/complete')
    return { handled: true, data: { onboardingState: 'complete' } };
  if (method === 'GET' && pathname === '/v1/notification-preferences')
    return {
      handled: true,
      data: {
        roundupsSummary: true,
        readyToRedeem: true,
        bankIssues: true,
        deposits: true,
        trades: true,
        riskAlerts: true,
      },
    };
  if (method === 'PUT' && pathname === '/v1/notification-preferences')
    return { handled: true, data: body };
  const accountMatch = pathname.match(/^\/v1\/bank\/accounts\/([^/]+)$/);
  if (method === 'PATCH' && accountMatch) {
    const account = await mutate((current) => {
      const item = current.accounts.find((candidate) => candidate.id === accountMatch[1]);
      if (!item) throw new Error('This sample bank account is unavailable.');
      if (typeof body.enabled === 'boolean') item.enabled = body.enabled;
      return item;
    });
    return { handled: true, data: account };
  }
  const connectionMatch = pathname.match(/^\/v1\/bank\/connections\/([^/]+)$/);
  if (method === 'DELETE' && connectionMatch) {
    const connection = await mutate((current) => {
      const item = current.connections.find((candidate) => candidate.id === connectionMatch[1]);
      if (!item) throw new Error('This sample bank connection is unavailable.');
      item.status = 'disconnected';
      item.disconnectRequested = true;
      for (const account of current.accounts)
        if (account.connectionId === item.id) account.enabled = false;
      return item;
    });
    return { handled: true, data: connection };
  }
  if (method === 'POST' && pathname === '/v1/bank/sample-link') {
    const connection = await mutate((current) => {
      const id = `mock_bank_${Date.now()}_${current.connections.length}`;
      const item = {
        id,
        provider: 'mock_plaid' as const,
        institutionName: String(body.institutionName || 'Sample bank').slice(0, 100),
        institutionAvatar:
          typeof body.institutionAvatar === 'string' &&
          body.institutionAvatar.startsWith('https://')
            ? body.institutionAvatar
            : null,
        status: 'healthy',
        initialSyncComplete: true,
        disconnectRequested: false,
        lastSyncedAt: new Date().toISOString(),
      };
      current.connections.push(item);
      current.accounts.push({
        id: `${id}_checking`,
        connectionId: id,
        name: 'Sample checking',
        type: 'checking',
        mask: '0000',
        currency: 'USD',
        enabled: false,
      });
      return item;
    });
    return { handled: true, data: connection };
  }
  if (method === 'POST' && pathname === '/v1/bank/relink') {
    const connection = await mutate((current) => {
      const item =
        current.connections.find((entry) => entry.id === body.connectionId) ??
        current.connections[0];
      if (!item) throw new Error('This sample bank connection is unavailable.');
      item.status = 'healthy';
      item.initialSyncComplete = true;
      item.disconnectRequested = false;
      item.lastSyncedAt = new Date().toISOString();
      return item;
    });
    return { handled: true, data: connection };
  }
  const mappingMatch = pathname.match(/^\/v1\/transactions\/([^/]+)\/mapping$/);
  if (method === 'POST' && mappingMatch) {
    const transaction = await mutate((current) => {
      const item = current.transactions.find((candidate) => candidate.id === mappingMatch[1]);
      if (!item) throw new Error('This sample purchase is unavailable.');
      const symbol = typeof body.symbol === 'string' ? body.symbol : null;
      item.symbol = symbol;
      item.confirmedSymbol = symbol;
      item.mappingMethod = 'user';
      item.reason = null;
      item.roundupCents = (1_000 - (item.amountCents % 1_000)) % 1_000;
      item.roundupStatus = 'pending';
      item.eligibilityStatus = 'eligible';
      return item;
    });
    return { handled: true, data: transaction };
  }
  const cancelMatch = pathname.match(/^\/v1\/trading\/orders\/([^/]+)\/cancel$/);
  if (method === 'POST' && cancelMatch) {
    const order = await mutate((current) => {
      const item = current.orders.find((candidate) => candidate.id === cancelMatch[1]);
      if (!item) throw new Error('This sample order is unavailable.');
      if (item.signature) throw new Error('This order is already finalized.');
      item.status = 'cancelled';
      const released = item.reservedCents;
      item.reservedCents = 0;
      current.balances.reservedUsdcRaw = String(
        BigInt(current.balances.reservedUsdcRaw) - BigInt(released * 10_000),
      );
      current.balances.availableUsdcRaw = String(
        BigInt(current.balances.availableUsdcRaw) + BigInt(released * 10_000),
      );
      return item;
    });
    return { handled: true, data: order };
  }
  if (method === 'POST' && pathname === '/v1/withdrawals') {
    const destination = typeof body.destination === 'string' ? body.destination : '';
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(destination))
      throw new Error('Enter a valid Solana wallet address.');
    const cashRaw =
      typeof body.cashRaw === 'string' && BigInt(body.cashRaw) > 0n ? BigInt(body.cashRaw) : 0n;
    const assets = Array.isArray(body.assets)
      ? body.assets.filter(
          (entry): entry is { symbol: string; rawAmount: string } =>
            !!entry &&
            typeof entry === 'object' &&
            typeof (entry as { symbol?: unknown }).symbol === 'string' &&
            typeof (entry as { rawAmount?: unknown }).rawAmount === 'string',
        )
      : [];
    const receipt = await mutate((current) => {
      const symbols = new Set(assets.map((entry) => entry.symbol));
      const sold = current.holdings.items.filter((item) => symbols.has(item.symbol));
      const proceedsCents = sold.reduce(
        (total, item) => total + BigInt(item.valueUsdCents ?? '0'),
        0n,
      );
      const totalUsdcRaw = ((proceedsCents + cashRaw / 10_000n) * 10_000n).toString();
      current.holdings = {
        ...current.holdings,
        items: current.holdings.items.filter((item) => !symbols.has(item.symbol)),
        // holdings.cash mirrors the trading USDC balance; keep the portfolio
        // total consistent when withdrawn cash leaves the account.
        cash: {
          ...current.holdings.cash,
          rawAmount: String(BigInt(current.holdings.cash.rawAmount) - cashRaw),
        },
      };
      const deduct = (value: string) => String(BigInt(value) - cashRaw);
      current.balances.usdcRaw = deduct(current.balances.usdcRaw);
      current.balances.availableUsdcRaw = deduct(current.balances.availableUsdcRaw);
      if (current.balances.onchainUsdcRaw)
        current.balances.onchainUsdcRaw = deduct(current.balances.onchainUsdcRaw);
      const asOf = new Date().toISOString();
      current.balances.asOf = asOf;
      return {
        id: `mock_withdrawal_${Date.now().toString(36)}`,
        status: 'pending',
        network: 'solana' as const,
        totalUsdcRaw,
        asOf,
      };
    });
    return { handled: true, data: receipt };
  }
  if (method === 'POST' && pathname === '/v1/portfolio/sell') {
    const order = await mutate((current) => {
      const symbol = typeof body.symbol === 'string' ? body.symbol : '';
      const holding = current.holdings.items.find((item) => item.symbol === symbol);
      if (!holding || holding.sellableRawAmount === '0')
        throw new Error('This sample holding is unavailable.');
      const value = BigInt(holding.valueUsdCents ?? '0');
      holding.rawAmount = '0';
      holding.sellableRawAmount = '0';
      holding.valueUsdCents = '0';
      current.holdings.cash.rawAmount = String(
        BigInt(current.holdings.cash.rawAmount) + value * 10_000n,
      );
      current.balances.usdcRaw = String(BigInt(current.balances.usdcRaw) + value * 10_000n);
      current.balances.availableUsdcRaw = String(
        BigInt(current.balances.availableUsdcRaw) + value * 10_000n,
      );
      const created = {
        id: `mock_order_sell_${symbol.toLowerCase()}`,
        symbol,
        side: 'sell' as const,
        status: 'confirmed',
        signature: `mock_sig_sell_${symbol.toLowerCase()}`,
        errorCode: null,
        reservedCents: 0,
        transactionIds: [],
        createdAt: new Date().toISOString(),
      };
      current.orders.unshift(created);
      return created;
    });
    return { handled: true, data: order };
  }
  const socialPerson = pathname.match(/^\/v1\/social\/(friends|blocks)\/([^/]+)$/);
  if ((method === 'DELETE' || method === 'POST') && socialPerson) {
    await mutate((current) => {
      current.friendsLeaderboard.rows = current.friendsLeaderboard.rows.filter(
        (row) => row.profile.id !== socialPerson[2],
      );
      current.friendsLeaderboard.total = current.friendsLeaderboard.rows.length;
    });
    return { handled: true, data: { ok: true } };
  }

  throw new Error(`Sample account does not support ${method} ${pathname}.`);
}

export async function configureMockScenario(patch: Partial<MockAccountFixture['scenario']>) {
  return mutate((fixture) => {
    fixture.scenario = { ...fixture.scenario, ...patch };
    const connection = fixture.connections[0];
    if (connection && patch.bankState) {
      connection.status =
        patch.bankState === 'healthy' || patch.bankState === 'syncing'
          ? 'healthy'
          : patch.bankState;
      connection.initialSyncComplete = patch.bankState !== 'syncing';
      connection.disconnectRequested = patch.bankState === 'disconnect_requested';
    }
    return fixture.scenario;
  });
}
