import {
  achievementDefinitions,
  retentionAchievements,
  retentionPeriod,
  retentionLessons,
  everydayCategories,
  everydayDefaults,
  weekMs,
  type RetentionSummary,
  type AchievementSummary,
  type CreatedInvite,
  type LeaderboardPage,
  type PublicProfile,
} from '@roundups/types';
import type { Balances, Capabilities, Holdings, InvestmentPolicy } from './live';
import type { Purchase } from './purchases';

export const MOCK_FIXTURE_VERSION = 'full-account-v3' as const;

/** A manual-mode receipt. Confirmed rows join to a purchase via transactionId. */
export type MockManualReceipt = {
  id: string;
  hasPhoto: boolean;
  transactionId: string | null;
  merchant: string | null;
  amountCents: number | null;
  currency: string | null;
  status: string | null;
  roundupCents: number | null;
  symbol: string | null;
  createdAt: string;
  /** Device-local draft photo; never leaves the fixture storage. */
  image: string | null;
};

export type MockBankConnection = {
  id: string;
  provider: 'mock_plaid';
  institutionName: string | null;
  institutionAvatar?: string | null;
  status: string;
  initialSyncComplete: boolean;
  disconnectRequested: boolean;
  lastSyncedAt: string | null;
};

export type MockBankAccount = {
  id: string;
  connectionId: string;
  name: string;
  type: 'checking' | 'credit_card' | 'savings';
  mask: string | null;
  currency: string;
  enabled: boolean;
};

export type MockOrder = {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  status: string;
  signature: string | null;
  errorCode: string | null;
  reservedCents: number;
  transactionIds: string[];
  createdAt: string;
};

export type MockScenario = {
  delayMs: number;
  unavailablePath: string | null;
  bankState: 'healthy' | 'syncing' | 'relink_required' | 'error' | 'disconnect_requested';
  cryptoPartialRead: boolean;
  unavailablePriceSymbol: string | null;
  expiredPaginationCursor: boolean;
};

export type MockAccountFixture = {
  version: typeof MOCK_FIXTURE_VERSION;
  ownerId: string;
  anchoredAt: string;
  profile: PublicProfile;
  capabilities: Capabilities;
  balances: Balances;
  policy: InvestmentPolicy;
  authorization: { address: string; signerId: string; policyId: string; authorized: boolean };
  notificationPreferences: {
    roundupSummary: boolean;
    ready: boolean;
    bankIssues: boolean;
    deposits: boolean;
    trades: boolean;
    riskAlerts: boolean;
  };
  cryptoCard: {
    id: string;
    provider: 'EtherFi';
    label: 'EtherFi Cash';
    address: string;
    mode: 'read-only sample';
    status: 'connected';
    lastScannedAt: string;
    networks: string[];
    months: { month: string; spendCents: number; transactions: number; roundupCents: number }[];
  };
  cryptoCards: {
    id: string;
    provider: 'etherfi' | 'tuyo';
    address: string;
    createdAt: string;
  }[];
  depositReceipts: {
    id: string;
    network: string;
    asset: 'USDC';
    amountRaw: string;
    status: 'finalized';
    signature: string;
    createdAt: string;
  }[];
  manualReceipts: MockManualReceipt[];
  connections: MockBankConnection[];
  accounts: MockBankAccount[];
  transactions: Purchase[];
  holdings: Holdings;
  orders: MockOrder[];
  invites: CreatedInvite[];
  achievements: AchievementSummary;
  retention: RetentionSummary;
  globalLeaderboard: LeaderboardPage;
  friendsLeaderboard: LeaderboardPage;
  scenario: MockScenario;
};

const markets = [
  ['SBUX', 'Starbucks'],
  ['AMZN', 'Amazon'],
  ['AAPL', 'Apple'],
  ['UBER', 'Uber'],
  ['NFLX', 'Netflix'],
  ['CMG', 'Chipotle'],
] as const;

const pendingAllocation = [
  ['SBUX', 'Long Merchant Name International Terminal Café', 5_425, 575, 'category'],
  ['AAPL', 'Apple Store', 18_465, 535, 'direct'],
  ['AMZN', 'Amazon Marketplace', 4_288, 712, 'direct'],
  ['UBER', 'Uber', 1_854, 146, 'direct'],
  ['NFLX', 'Netflix', 1_599, 401, 'direct'],
  ['CMG', "Joe's Pizza", 1_635, 365, 'category'],
  ['SBUX', 'Starbucks', 920, 80, 'direct'],
  ['AMZN', 'Corner Bookshop', 2_740, 260, 'user'],
  ['SBUX', 'Starbucks', 4_080, 920, 'direct'],
  ['SBUX', 'Starbucks', 9_740, 260, 'direct'],
  ['AMZN', 'Amazon', 9_552, 448, 'direct'],
  ['AAPL', 'Apple Music', 3_375, 625, 'direct'],
  ['UBER', 'Uber', 2_271, 729, 'direct'],
  ['NFLX', 'Netflix', 3_789, 211, 'direct'],
  ['CMG', 'Chipotle', 2_785, 215, 'direct'],
] as const;

function localDay(anchor: Date, offset: number, hour = 12, minute = 0) {
  const date = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() - offset,
    hour,
    minute,
  );
  return date.toISOString();
}

function activeTransactions(anchor: Date): Purchase[] {
  const pending = pendingAllocation.map(
    ([symbol, merchant, amountCents, roundup, mapping], index) =>
      ({
        id: `mock_tx_active_${String(index + 1).padStart(2, '0')}`,
        amountCents,
        currency: 'USD',
        merchant,
        occurredAt: localDay(anchor, Math.floor(index / 7), 20 - (index % 7)),
        pending: false,
        removedAt: null,
        reason: null,
        historicalPreview: false,
        roundupCents: roundup,
        symbol,
        roundupStatus: index % 3 === 0 ? 'below_market_minimum' : 'pending',
        eligibilityStatus: 'eligible',
        confirmedSymbol: mapping === 'user' ? symbol : null,
        mappingMethod: mapping,
        pendingTransactionId: index === 6 ? 'mock_tx_pending_01' : null,
      }) satisfies Purchase,
  );

  const merchants = [
    'Whole Foods',
    'Target',
    'Trader Joe’s',
    'Lyft',
    'Disney+',
    'DoorDash',
    'Walgreens',
    'IKEA',
    'Costco',
    'Airbnb',
    'Delta',
    'Adobe',
  ];
  const history = Array.from({ length: 33 }, (_, index) => {
    const market = markets[index % markets.length]!;
    const generatedAmount = 1_125 + ((index * 347) % 7_800);
    const amountCents =
      index === 0
        ? 3_870
        : index === 1
          ? 1
          : index === 2
            ? 999
            : index === 3
              ? 99_999
              : generatedAmount % 1_000 === 0
                ? generatedAmount + 1
                : generatedAmount;
    const roundupCents = (1_000 - (amountCents % 1_000)) % 1_000;
    const roundupStatus =
      index < 22
        ? 'redeemed'
        : index < 27
          ? 'redeeming'
          : index < 31
            ? 'execution_failed'
            : 'cancelled';
    return {
      id: `mock_tx_active_${String(index + 16).padStart(2, '0')}`,
      amountCents,
      currency: 'USD',
      merchant: index === 0 ? 'Neighborhood Florist' : merchants[index % merchants.length]!,
      occurredAt: localDay(anchor, 5 + index, 8 + (index % 10)),
      pending: false,
      removedAt: null,
      reason: index === 0 ? 'mapping_confirmation_required' : null,
      historicalPreview: false,
      roundupCents: index === 0 ? null : roundupCents,
      symbol: index === 0 ? null : market[0],
      roundupStatus: index === 0 ? null : roundupStatus,
      orderStatus: roundupStatus === 'redeemed' ? 'confirmed' : null,
      eligibilityStatus: index === 0 ? 'awaiting_mapping' : 'eligible',
      confirmedSymbol: null,
      mappingMethod: index === 0 ? null : index % 3 === 0 ? 'category' : 'direct',
    } satisfies Purchase;
  });
  return [...pending, ...history];
}

function historicalTransactions(anchor: Date): Purchase[] {
  return Array.from({ length: 8 }, (_, index) => {
    const market = markets[index % markets.length]!;
    const amountCents = 780 + index * 641;
    return {
      id: `mock_tx_historical_${String(index + 1).padStart(2, '0')}`,
      amountCents,
      currency: 'USD',
      merchant: ['CVS', 'Amazon', 'Starbucks', 'Uber', 'Apple', 'Netflix', 'Chipotle', 'Target'][
        index
      ]!,
      occurredAt: localDay(anchor, 42 + index, 10 + index),
      pending: false,
      removedAt: null,
      reason: null,
      historicalPreview: true,
      roundupCents: (1_000 - (amountCents % 1_000)) % 1_000 || 1_000,
      symbol: market[0],
      roundupStatus: 'preview',
      eligibilityStatus: 'historical',
      confirmedSymbol: null,
      mappingMethod: 'direct',
    } satisfies Purchase;
  });
}

/** Internal-testing manual-mode purchases. Roundups follow the manual whole-dollar rule,
 * not the ten-dollar increment the bank transactions use, so validation exempts this prefix. */
const MANUAL_TX_PREFIX = 'mock_tx_manual_';

function manualTransactions(anchor: Date): Purchase[] {
  const rows = [
    // [suffix, merchant, amountCents, symbol, roundupStatus, dayOffset, hour, minute]
    ['01', 'Blue Bottle Coffee', 1_240, 'AAPL', 'pending', 1, 13, 5],
    ['02', 'Trader Joe’s', 725, 'AMZN', 'redeemed', 3, 18, 40],
    ['03', 'IKEA', 3_110, 'SBUX', 'preview', 6, 11, 20],
  ] as const;
  return rows.map(([suffix, merchant, amountCents, symbol, roundupStatus, day, hour, minute]) => ({
    id: `${MANUAL_TX_PREFIX}${suffix}`,
    amountCents,
    currency: 'USD',
    merchant,
    occurredAt: localDay(anchor, day, hour, minute),
    pending: false,
    removedAt: null,
    reason: null,
    historicalPreview: false,
    roundupCents: (100 - (amountCents % 100)) % 100,
    symbol,
    roundupStatus,
    eligibilityStatus: 'eligible',
    confirmedSymbol: symbol,
    mappingMethod: 'user',
  }) satisfies Purchase);
}

// Tiny placeholder photo shared by the sample receipts (a drawn receipt outline).
const SAMPLE_RECEIPT_PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAACACAIAAAB7vvvtAAABe0lEQVR4nO3WwU1EMRAFQeIkMMIhLo5IXCyEoPd7vTLgqghGrXeYpxd+9LT7gN9OoCBQ+BTojQ8CBYGCQGFloOe/QKAgUBAoCBQECgKFnYH+JYGCQEGgMBPo9U8RaA2Bhocv6CgCBYGCQEGgIFAQKAgUZgLtfvQmCTTMtTgo0I0EGq5P545ARxEoCBQECgIFgYJAQaAwE2j303eBQGsINFjQcLXFskBHESgIFAQKAgWBgkBBoDATaPcDGARaQ6Dh4mj+daB7WiwLdBSBgkBBoCBQECgIFAQKM4F2P4OLCTRY0DDR4qxAN3pIoKMIFAQKAgWBgkBBoCBQmAm0+7lbQKDhylyODHQjgYaHL+goAgWBgkBBoCBQECgIFGYC7X70Jgk0zLU4KNCNBBquT+eOQEcRKAgUBAoCBYGCQEGgMBNo99N3gUBrCDRY0HC1xbJARxEoCBQECgIFgYJAQaAgUBAoCBQECgIFgYJAQaAgUBAofBuIrwQKAgWBwjtNX+r6hzCj3gAAAABJRU5ErkJggg==';

function manualReceipts(anchor: Date): MockManualReceipt[] {
  const confirmed = manualTransactions(anchor).map((transaction, index) => ({
    id: `mock_manual_receipt_${String(index + 1).padStart(2, '0')}`,
    hasPhoto: transaction.merchant !== 'Trader Joe’s',
    transactionId: transaction.id,
    merchant: transaction.merchant,
    amountCents: transaction.amountCents,
    currency: transaction.currency,
    status: transaction.roundupStatus,
    roundupCents: transaction.roundupCents,
    symbol: transaction.symbol,
    createdAt: transaction.occurredAt,
    image: transaction.merchant !== 'Trader Joe’s' ? SAMPLE_RECEIPT_PHOTO : null,
  }));
  return [
    // An open draft the tester can review and confirm end to end.
    {
      id: 'mock_manual_receipt_04',
      hasPhoto: true,
      transactionId: null,
      merchant: null,
      amountCents: null,
      currency: null,
      status: null,
      roundupCents: null,
      symbol: null,
      createdAt: localDay(anchor, 0, 9, 41),
      image: SAMPLE_RECEIPT_PHOTO,
    },
    ...confirmed,
  ];
}

function providerPendingTransactions(anchor: Date): Purchase[] {  return ['Starbucks', 'Amazon', 'Uber', 'Apple', 'Whole Foods'].map(
    (merchant, index) =>
      ({
        id: `mock_tx_pending_${String(index + 1).padStart(2, '0')}`,
        amountCents: index === 0 ? 675 : 725 + index * 517,
        currency: 'USD',
        merchant,
        occurredAt:
          index === 0 ? localDay(anchor, 0, 17, 30) : localDay(anchor, 2 + index, 14 + index),
        pending: true,
        removedAt: null,
        reason: 'provider_pending',
        historicalPreview: false,
        roundupCents: null,
        symbol: null,
        roundupStatus: null,
        eligibilityStatus: 'pending',
        confirmedSymbol: null,
        mappingMethod: null,
        postedTransactionId: index === 0 ? 'mock_tx_active_07' : null,
      }) satisfies Purchase,
  );
}

function excludedTransactions(anchor: Date): Purchase[] {
  const rows = [
    ['Savings transfer', 20_000, 'transfer'],
    ['Amazon refund', -1_299, 'refund'],
    ['Whole Foods Market', 3_000, 'exact_increment'],
    ['ATM withdrawal', 20_000, 'cash_advance'],
    ['Credit card payment', 54_000, 'credit_card_payment'],
    ['Bank fee', 1_500, 'bank_fee'],
    ['Rent payment', 185_000, 'rent'],
    ['Crypto exchange', 12_000, 'crypto'],
    ['Reversed restaurant charge', -8_225, 'reversal'],
    [
      'International Terminal Café Receipt With A Very Long Description',
      123_456_789,
      'unsupported_currency',
    ],
    ['City Parking', 2_341, 'removed_by_provider'],
  ] as const;
  return rows.map(
    ([merchant, amountCents, reason], index) =>
      ({
        id: `mock_tx_excluded_${String(index + 1).padStart(2, '0')}`,
        amountCents,
        currency: reason === 'unsupported_currency' ? 'EUR' : 'USD',
        merchant,
        occurredAt: index === 0 ? localDay(anchor, 0, 16, 30) : localDay(anchor, 8 + index * 3, 11),
        pending: false,
        removedAt: reason === 'removed_by_provider' ? localDay(anchor, 4, 16) : null,
        reason,
        historicalPreview: false,
        roundupCents: reason === 'removed_by_provider' ? 659 : null,
        symbol: reason === 'removed_by_provider' ? 'UBER' : null,
        roundupStatus: reason === 'removed_by_provider' ? 'redeemed' : null,
        orderStatus: reason === 'removed_by_provider' ? 'confirmed' : null,
        eligibilityStatus: 'excluded',
        confirmedSymbol: null,
        mappingMethod: reason === 'removed_by_provider' ? 'category' : null,
      }) satisfies Purchase,
  );
}

function leaderboard(
  ownerId: string,
  profile: PublicProfile,
  anchor: Date,
  scope: 'global' | 'friends',
): LeaderboardPage {
  const people = [
    ['Maya', 'glass-01', 100],
    ['Noah', 'glass-02', 80],
    ['Ari', 'glass-04', 80],
    ['AlexandraTheInvestor', 'glass-05', 40],
    ['Freddy', 'glass-03', 40],
    ['Zoe', 'glass-06', 40],
    ['Leo', 'glass-07', 20],
    ['Nina', 'glass-08', 20],
    ['Omar', 'glass-09', 20],
    ['Ivy', 'glass-10', 20],
    ['Kai', 'glass-11', 20],
    ['Rue', 'glass-12', 20],
  ] as const;
  const source = scope === 'friends' ? people.slice(0, 6) : people;
  const rows = source.map(([alias, avatarId, points]) => ({
    profile:
      alias === 'Freddy'
        ? profile
        : {
            id: `mock_profile_${alias.toLowerCase()}`,
            alias,
            avatarId,
            avatarVersion: 1 as const,
            globalOptIn: true,
          },
    points,
    rank: source.findIndex((person) => person[2] === points) + 1,
    isYou: alias === 'Freddy',
  }));
  const own = rows.find((row) => row.isYou) ?? {
    profile,
    points: 40,
    rank: null,
    isYou: true,
  };
  return {
    scope,
    metric: 'season-points',
    version: 2,
    season: retentionPeriod(anchor),
    snapshot: `mock_snapshot_${scope}_${anchor.toISOString().slice(0, 10)}`,
    updatedAt: localDay(anchor, 0),
    rows,
    nextCursor: null,
    own,
    total: rows.length,
  };
}

export function buildMockFixture(ownerId: string, now = new Date()): MockAccountFixture {
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const profile: PublicProfile = {
    id: `mock_profile_${ownerId}`,
    alias: 'Freddy',
    avatarId: 'glass-03',
    avatarVersion: 1,
    globalOptIn: true,
  };
  const transactions = [
    ...activeTransactions(anchor),
    ...manualTransactions(anchor),
    ...historicalTransactions(anchor),
    ...providerPendingTransactions(anchor),
    ...excludedTransactions(anchor),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const holdingRows = [
    ['AAPL', 'Apple', '18640'],
    ['AMZN', 'Amazon', '13275'],
    ['SBUX', 'Starbucks', '9420'],
    ['UBER', 'Uber', '7310'],
    ['NFLX', 'Netflix', '5685'],
    ['CMG', 'Chipotle Mexican Grill', '4170'],
  ] as const;
  const holdings: Holdings = {
    items: holdingRows.map(([symbol, name, valueUsdCents], index) => ({
      symbol,
      name,
      rawAmount: String(100_000 + index * 25_000),
      sellableRawAmount: String(100_000 + index * 25_000),
      valueUsdCents,
      decimals: 6,
      priceUsdCents: String(2_500 + index * 8_750),
      productType: 'spot' as const,
      leverage: 1 as const,
    })),
    cash: { rawAmount: '250000000', decimals: 6 },
    asOf: localDay(anchor, 0),
  };
  const achievements: AchievementSummary = {
    metric: 'season-points',
    version: 2,
    points: 40,
    legacyPoints: 40,
    definitions: [
      ...retentionAchievements,
      ...achievementDefinitions.map((d) => ({ ...d, group: 'Earlier achievements' })),
    ],
    awards: achievementDefinitions.slice(0, 4).map((definition, index) => ({
      definitionId: definition.id,
      criterionVersion: 1,
      earnedAt: localDay(anchor, 8 - index),
    })),
    distinctFriends: 5,
  };
  const fixture: MockAccountFixture = {
    version: MOCK_FIXTURE_VERSION,
    ownerId,
    anchoredAt: anchor.toISOString(),
    profile,
    capabilities: {
      bankConnectionEnabled: true,
      bankCountries: ['AE', 'US'],
      fundingEnabled: true,
      executionEnabled: true,
      executionReason: null,
      country: 'AE',
      network: 'devnet',
      executionMode: 'paper',
    },
    balances: {
      onchainUsdcRaw: '250000000',
      usdcRaw: '250000000',
      availableUsdcRaw: '227500000',
      reservedUsdcRaw: '22500000',
      lamports: '28000000',
      asOf: localDay(anchor, 0),
    },
    policy: {
      acceptedAt: localDay(anchor, 30),
      enabled: true,
      dailyLimitCents: 5_000,
      maxRoundupCents: 900,
      roundupRuleConfigured: true,
      fallbackConfigured: true,
      fallbackSymbol: 'AAPL',
    },
    authorization: {
      address: 'mock_solana_wallet_full_account_v1',
      signerId: 'mock_signer_01',
      policyId: 'mock_policy_01',
      authorized: true,
    },
    notificationPreferences: {
      roundupSummary: true,
      ready: true,
      bankIssues: true,
      deposits: false,
      trades: true,
      riskAlerts: true,
    },
    cryptoCard: {
      id: 'mock_crypto_card_etherfi',
      provider: 'EtherFi',
      label: 'EtherFi Cash',
      address: '0x000000000000000000000000000000000000dEaD',
      mode: 'read-only sample',
      status: 'connected',
      lastScannedAt: new Date(anchor.getTime() - 18 * 60_000).toISOString(),
      networks: ['Ethereum', 'Arbitrum', 'Optimism', 'Scroll'],
      months: [
        { month: 'current', spendCents: 128_644, transactions: 18, roundupCents: 8_356 },
        { month: 'previous', spendCents: 217_430, transactions: 31, roundupCents: 14_570 },
        { month: 'two-months-ago', spendCents: 184_291, transactions: 27, roundupCents: 12_709 },
      ],
    },
    cryptoCards: [
      {
        id: 'mock_crypto_card_etherfi_primary',
        provider: 'etherfi',
        address: '0x000000000000000000000000000000000000dEaD',
        createdAt: new Date(anchor.getTime() - 26 * 24 * 60 * 60_000).toISOString(),
      },
      {
        id: 'mock_crypto_card_etherfi_secondary',
        provider: 'etherfi',
        address: '0x000000000000000000000000000000000000bEEF',
        createdAt: new Date(anchor.getTime() - 9 * 24 * 60 * 60_000).toISOString(),
      },
    ],
    depositReceipts: [
      ['01', 72, 'Solana', 500_000_000],
      ['02', 45, 'Base', 250_000_000],
      ['03', 21, 'Ethereum', 100_000_000],
      ['04', 3, 'Solana', 50_000_000],
    ].map(([id, days, network, amountRaw]) => ({
      id: `mock_deposit_receipt_${id}`,
      network: String(network),
      asset: 'USDC' as const,
      amountRaw: String(amountRaw),
      status: 'finalized' as const,
      signature: `mock_sig_deposit_${id}`,
      createdAt: localDay(anchor, Number(days)),
    })),
    manualReceipts: manualReceipts(anchor),
    connections: [
      {
        id: 'mock_bank_connection_chase',
        provider: 'mock_plaid',
        institutionName: 'Chase',
        status: 'healthy',
        initialSyncComplete: true,
        disconnectRequested: false,
        lastSyncedAt: new Date(anchor.getTime() - 12 * 60_000).toISOString(),
      },
    ],
    accounts: [
      {
        id: 'mock_bank_account_checking',
        connectionId: 'mock_bank_connection_chase',
        name: 'Everyday Checking',
        type: 'checking',
        mask: '4821',
        currency: 'USD',
        enabled: true,
      },
      {
        id: 'mock_bank_account_freedom',
        connectionId: 'mock_bank_connection_chase',
        name: 'Sapphire Card',
        type: 'credit_card',
        mask: '1038',
        currency: 'USD',
        enabled: true,
      },
      {
        id: 'mock_bank_account_savings',
        connectionId: 'mock_bank_connection_chase',
        name: 'Rainy Day Savings',
        type: 'savings',
        mask: '7754',
        currency: 'USD',
        enabled: false,
      },
    ],
    transactions,
    holdings,
    orders: (
      [
        ['01', 'SBUX', 'buy', 'pending', null, null, 1_250, ['mock_tx_active_01']],
        [
          '02',
          'AMZN',
          'buy',
          'blocked',
          null,
          'INSUFFICIENT_BALANCE',
          1_000,
          ['mock_tx_active_03'],
        ],
        ['03', 'AAPL', 'buy', 'confirmed', 'mock_sig_buy_03', null, 0, ['mock_tx_excluded_11']],
        ['04', 'UBER', 'buy', 'confirmed', 'mock_sig_buy_04', null, 0, ['mock_tx_active_18']],
        ['05', 'NFLX', 'buy', 'confirmed', 'mock_sig_buy_05', null, 0, ['mock_tx_active_19']],
        ['06', 'CMG', 'buy', 'confirmed', 'mock_sig_buy_06', null, 0, ['mock_tx_active_20']],
        ['07', 'SBUX', 'sell', 'confirmed', 'mock_sig_sell_07', null, 0, ['mock_tx_active_21']],
        ['08', 'AMZN', 'buy', 'submitted', 'mock_sig_buy_08', null, 0, ['mock_tx_active_22']],
        ['09', 'AAPL', 'buy', 'failed', null, 'QUOTE_EXPIRED', 0, ['mock_tx_active_23']],
        ['10', 'UBER', 'buy', 'cancelled', null, null, 0, ['mock_tx_active_24']],
      ] as const
    ).map(([id, symbol, side, status, signature, errorCode, reservedCents, transactionIds]) => ({
      id: `mock_order_${id}`,
      symbol,
      side,
      status,
      signature,
      errorCode,
      reservedCents,
      transactionIds: [...transactionIds],
      createdAt: localDay(anchor, Number(id) === 10 ? 59 : (Number(id) - 1) * 6),
    })),
    invites: [
      {
        id: 'mock_invite_active',
        token: 'GR8F',
        code: 'GR8F',
        link: 'roundups-development://invite?token=GR8F',
        linkMode: 'internal',
        redeemed: 1,
        redeemLimit: 5,
        expiresAt: localDay(anchor, -1),
        revoked: false,
      },
      {
        id: 'mock_invite_expired',
        token: 'mock_expired_account_invite_000000000000000',
        code: null,
        link: 'roundups-development://invite?token=mock_expired_account_invite_000000000000000',
        linkMode: 'internal',
        redeemed: 1,
        redeemLimit: 5,
        expiresAt: localDay(anchor, 1),
        revoked: false,
      },
    ],
    achievements,
    retention: mockRetention(anchor),
    globalLeaderboard: leaderboard(ownerId, profile, anchor, 'global'),
    friendsLeaderboard: leaderboard(ownerId, profile, anchor, 'friends'),
    scenario: {
      delayMs: 0,
      unavailablePath: null,
      bankState: 'healthy',
      cryptoPartialRead: false,
      unavailablePriceSymbol: null,
      expiredPaginationCursor: false,
    },
  };
  assertMockFixture(fixture, anchor, true);
  return fixture;
}

function assertMockFixture(fixture: MockAccountFixture, anchor: Date, canonical: boolean) {
  const fail = (message: string): never => {
    throw new Error(`Invalid ${MOCK_FIXTURE_VERSION} fixture: ${message}`);
  };
  if (fixture.transactions.length < 72) fail('transaction count');
  // Three seeded manual purchases; confirmed drafts may add more while sampling.
  if (canonical && fixture.transactions.length !== 75) fail('transaction count');
  const transactionIds = new Set(fixture.transactions.map((item) => item.id));
  const symbols = new Set(fixture.holdings.items.map((item) => item.symbol));
  for (const transaction of fixture.transactions) {
    if (!transaction.id.startsWith('mock_')) fail('transaction namespace');
    if (transaction.symbol && !symbols.has(transaction.symbol)) fail('unknown transaction symbol');
    if (transaction.roundupCents !== null) {
      if (transaction.roundupCents <= 0 || transaction.roundupCents >= 1_000) fail('roundup range');
      // Manual purchases round to the next whole dollar under the policy rule, not the
      // ten-dollar increment the bank sample uses.
      if (
        !transaction.id.startsWith(MANUAL_TX_PREFIX) &&
        transaction.amountCents > 0 &&
        transaction.roundupCents !== (1_000 - (transaction.amountCents % 1_000)) % 1_000
      )
        fail(`roundup math for ${transaction.id}`);
    }
  }
  if (canonical && mockPendingAllocationCents(fixture) !== 6_542) fail('pending allocation');
  for (const order of fixture.orders) {
    if (!order.id.startsWith('mock_')) fail('order namespace');
    if (!symbols.has(order.symbol)) fail('unknown order symbol');
    for (const transactionId of order.transactionIds) {
      const transaction = fixture.transactions.find((item) => item.id === transactionId);
      if (!transactionIds.has(transactionId) || transaction?.roundupCents === null)
        fail('order transaction reference');
    }
  }
  const reservedCents = fixture.orders.reduce((sum, order) => sum + order.reservedCents, 0);
  if (canonical && reservedCents !== 2_250) fail('order reserves');
  if (BigInt(fixture.balances.reservedUsdcRaw) !== BigInt(reservedCents * 10_000))
    fail('reserved balance');
  if (
    BigInt(fixture.balances.usdcRaw) !==
    BigInt(fixture.balances.availableUsdcRaw) + BigInt(fixture.balances.reservedUsdcRaw)
  )
    fail('cash balance');
  const holdingsCents = fixture.holdings.items.reduce(
    (sum, item) => sum + Number(item.valueUsdCents ?? 0),
    0,
  );
  if (canonical && holdingsCents !== 58_500) fail('holdings total');
  const cashCents = Number(BigInt(fixture.holdings.cash.rawAmount) / 10_000n);
  if (cashCents + holdingsCents !== 83_500) fail('portfolio total');
  if (
    fixture.achievements.legacyPoints !==
    fixture.achievements.awards.filter((a) =>
      achievementDefinitions.some((d) => d.id === a.definitionId),
    ).length *
      10
  )
    fail('achievement points');
  const endOfDay = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 23, 59, 59);
  // Receipts confirmed after anchoring post-date the anchor day by design.
  const anchored = fixture.transactions.filter((item) => !item.id.startsWith(MANUAL_TX_PREFIX));
  const dates = [
    ...anchored.map((item) => item.occurredAt),
    ...fixture.depositReceipts.map((item) => item.createdAt),
    ...fixture.orders.map((item) => item.createdAt),
    ...fixture.achievements.awards.map((item) => item.earnedAt),
  ];
  if (dates.some((value) => !Number.isFinite(Date.parse(value)) || new Date(value) > endOfDay))
    fail('date range');
  if (
    anchored.some(
      (item, index, items) => index > 0 && items[index - 1]!.occurredAt < item.occurredAt,
    )
  )
    fail('transaction ordering');
}

export function validateMockFixture(value: unknown, ownerId?: string): value is MockAccountFixture {
  if (!value || typeof value !== 'object') return false;
  const fixture = value as Partial<MockAccountFixture>;
  const validShape =
    fixture.version === MOCK_FIXTURE_VERSION &&
    typeof fixture.ownerId === 'string' &&
    (!ownerId || fixture.ownerId === ownerId) &&
    Array.isArray(fixture.transactions) &&
    fixture.transactions.length >= 72 &&
    fixture.transactions.every((item) => item.id.startsWith('mock_')) &&
    Array.isArray(fixture.manualReceipts) &&
    fixture.manualReceipts.every((item) => item.id.startsWith('mock_')) &&
    Array.isArray(fixture.orders) &&
    fixture.orders.every((item) => item.id.startsWith('mock_')) &&
    Array.isArray(fixture.accounts) &&
    fixture.accounts.every((item) => item.id.startsWith('mock_')) &&
    Array.isArray(fixture.cryptoCards) &&
    fixture.cryptoCards.every((item) => item.id.startsWith('mock_')) &&
    fixture.invites?.every((item) => item.id.startsWith('mock_')) === true;
  if (!validShape) return false;
  try {
    assertMockFixture(
      fixture as MockAccountFixture,
      new Date((fixture as MockAccountFixture).anchoredAt),
      false,
    );
    return true;
  } catch {
    return false;
  }
}

export function mockPendingAllocationCents(fixture: MockAccountFixture) {
  return fixture.transactions.reduce(
    (total, item) =>
      ['pending', 'below_market_minimum'].includes(item.roundupStatus ?? '')
        ? total + (item.roundupCents ?? 0)
        : total,
    0,
  );
}

function mockRetention(now: Date): RetentionSummary {
  const season = retentionPeriod(now);
  return {
    season,
    points: 40,
    weeklyPoints: 40,
    referralCompleted: false,
    actions: [
      { id: 'core', title: 'A successful roundup this week', points: 40, completed: true },
      { id: 'recap', title: 'Review your weekly recap', points: 40, completed: false },
      { id: 'return', title: 'A meaningful review on another day', points: 20, completed: false },
    ],
    recap: {
      id: '00000000-0000-4000-8000-000000000001',
      startsAt: new Date(Date.parse(season.weekStartsAt) - weekMs).toISOString(),
      endsAt: season.weekStartsAt,
      roundupCount: 6,
      completed: false,
    },
    lessons: retentionLessons.map(({ answer: _answer, ...l }) => l),
    reviews: [],
    milestones: everydayCategories.map((category, i) => ({
      category,
      currency: 'USD',
      targetCents: everydayDefaults[category],
      contributedCents: [540, 820, 350, 0][i]!,
      confirmed: false,
      earned: false,
    })),
    history: [],
  };
}
