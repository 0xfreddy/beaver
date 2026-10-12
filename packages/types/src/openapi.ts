import { z } from 'zod';
import {
  accountSelectionSchema,
  activationSchema,
  roundupRuleSchema,
  activityQuerySchema,
  bankExchangeSchema,
  bankLinkSchema,
  countrySchema,
  createCryptoCardSchema,
  mappingConfirmationSchema,
  notificationPreferencesSchema,
  notificationDeviceSchema,
  onchainSpendingPreviewSchema,
  withdrawalRequestSchema,
} from './backend';

const operations = [
  ['post', '/v1/session', 'Verify Privy session'],
  ['patch', '/v1/profile', 'Declare country'],
  ['get', '/v1/capabilities', 'Read jurisdiction and provider capabilities'],
  ['get', '/v1/investment-policy', 'Read automatic spot policy'],
  ['patch', '/v1/investment-policy/roundup-rule', 'Set future purchase roundup rule'],
  [
    'get',
    '/v1/automation/authorization',
    'Get additional signer and policy for wallet owner approval',
  ],
  ['post', '/v1/activation', 'Enable or pause automatic investments'],
  ['post', '/v1/onboarding/complete', 'Mark in-app onboarding as finished'],
  ['get', '/v1/notification-preferences', 'Read stored notification preferences'],
  ['put', '/v1/notification-preferences', 'Replace stored notification preferences'],
  [
    'put',
    '/v1/notification-devices',
    'Register native push token and permission for this installation',
  ],
  ['delete', '/v1/notification-devices/{id}', 'Disable this account’s device registration'],
  ['get', '/v1/notifications/in-app', 'Read pending foreground notification cards'],
  ['get', '/v1/notifications', 'Read notification history and dispatch status'],
  ['get', '/v1/notifications/{id}', 'Read a saved notification for this account'],
  ['post', '/v1/notifications/{id}/opened', 'Record a notification opening for this account'],
  ['delete', '/v1/account', 'Delete the account and all owned data'],
  ['get', '/v1/bank/institutions', 'Read public bank directory with logos'],
  ['get', '/v1/logos', 'Read public brand logo directory (stocks, crypto, banks)'],
  ['get', '/v1/bank/catalogue/countries', 'Read supported bank countries'],
  ['get', '/v1/bank/catalogue', 'Search available bank providers by country'],
  ['post', '/v1/bank/link', 'Create read-only MoneyKit Connect session'],
  ['post', '/v1/bank/exchange', 'Exchange MoneyKit exchangeable token'],
  ['post', '/v1/bank/recover', 'Recover an authorized bank connection'],
  ['post', '/v1/bank/relink', 'Complete MoneyKit reconnection'],
  ['get', '/v1/bank/connections', 'List bank connections'],
  ['get', '/v1/bank/accounts', 'List bank accounts'],
  ['post', '/v1/bank/onchain-preview', 'Preview monthly on-chain card spending and roundups'],
  ['get', '/v1/bank/crypto-cards', 'List saved crypto card addresses'],
  ['post', '/v1/bank/crypto-cards', 'Save a crypto card address'],
  ['delete', '/v1/bank/crypto-cards/{id}', 'Remove a saved crypto card address'],
  ['patch', '/v1/bank/accounts/{id}', 'Select account for future contributions'],
  ['delete', '/v1/bank/connections/{id}', 'Disconnect bank'],
  ['post', '/v1/bank/connections/{id}/refresh', 'Request asynchronous transaction refresh'],
  ['get', '/v1/transactions', 'Read bank activity with cursor pagination'],
  ['get', '/v1/transactions/{id}', 'Read transaction detail'],
  ['post', '/v1/transactions/{id}/mapping', 'Confirm product company'],
  ['get', '/v1/overview', 'Read live contribution totals by currency'],
  ['get', '/v1/roundups/monthly', 'Completed roundup investment by stock within a calendar month'],
  ['get', '/v1/roundups', 'Read live contribution totals'],
  ['get', '/v1/trading/markets', 'List available spot instruments'],
  ['get', '/v1/trading/balances', 'Read finalized balances and reservations'],
  ['get', '/v1/trading/orders', 'Read recent orders'],
  ['post', '/v1/trading/orders/{id}/cancel', 'Cancel unsigned order'],
  ['post', '/v1/transactions/{id}/roundup/cancel', 'Cancel unreserved roundup'],
  ['get', '/v1/portfolio', 'Read holdings and price metadata'],
  ['post', '/v1/portfolio/sell', 'Request spot sale'],
  [
    'post',
    '/v1/withdrawal-destinations/challenge',
    'Create a short-lived wallet ownership challenge',
  ],
  ['post', '/v1/withdrawal-destinations/verify', 'Verify a destination wallet signature'],
  ['post', '/v1/withdrawals', 'Request a USDC withdrawal to Solana'],
  ['get', '/v1/funding', 'Get supported Solana wallet deposit parameters'],
  ['get', '/v1/funding/receipts', 'Read finalized external USDC credits'],
] as const;

const bodies: Record<string, z.ZodType> = {
  '/v1/profile': z.object({ country: countrySchema }),
  '/v1/activation': activationSchema,
  '/v1/notification-preferences': notificationPreferencesSchema,
  '/v1/notification-devices': notificationDeviceSchema,
  '/v1/investment-policy/roundup-rule': roundupRuleSchema,
  '/v1/bank/link': bankLinkSchema,
  '/v1/bank/exchange': bankExchangeSchema,
  '/v1/bank/recover': bankExchangeSchema.partial({ exchangeableToken: true }),
  '/v1/bank/relink': z.object({ linkSessionId: z.uuid() }),
  '/v1/bank/onchain-preview': onchainSpendingPreviewSchema,
  '/v1/bank/crypto-cards': createCryptoCardSchema,
  '/v1/bank/accounts/{id}': accountSelectionSchema,
  '/v1/transactions/{id}/mapping': mappingConfirmationSchema,
  '/v1/portfolio/sell': z.object({
    symbol: z.string().regex(/^[A-Z0-9.]{1,16}$/),
    rawAmount: z.string().regex(/^[1-9][0-9]{0,19}$/),
  }),
  '/v1/withdrawals': withdrawalRequestSchema,
  '/v1/withdrawal-destinations/challenge': z.object({ address: z.string().min(32).max(44) }),
  '/v1/withdrawal-destinations/verify': z.object({
    id: z.uuid(),
    signature: z.string().length(88),
  }),
};

function parameters(path: string) {
  const values: Record<string, unknown>[] = [];
  if (path.includes('{id}'))
    values.push({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    });
  if (path === '/v1/portfolio/sell' || path === '/v1/withdrawals')
    values.push({
      name: 'Idempotency-Key',
      in: 'header',
      required: true,
      schema: { type: 'string', minLength: 16, maxLength: 128 },
    });
  if (path === '/v1/transactions')
    for (const [name, schema] of Object.entries(
      z.toJSONSchema(activityQuerySchema).properties ?? {},
    ))
      values.push({ name, in: 'query', schema });
  if (path === '/v1/roundups/monthly')
    for (const name of ['start', 'end'])
      values.push({
        name,
        in: 'query',
        required: true,
        schema: { type: 'string', format: 'date-time' },
      });
  return values;
}

export function backendOpenApi() {
  const paths: Record<string, unknown> = {};
  for (const [method, path, summary] of operations) {
    const body = method === 'get' || method === 'delete' ? undefined : bodies[path];
    paths[path] = {
      ...(paths[path] as object),
      [method]: {
        summary,
        security: [{ privyBearer: [] }],
        parameters: parameters(path),
        ...(body
          ? {
              requestBody: {
                required: true,
                content: { 'application/json': { schema: z.toJSONSchema(body) } },
              },
            }
          : {}),
        responses: {
          '200': { description: 'Successful operation' },
          '201': { description: 'Resource created' },
          '202': { description: 'Accepted for processing' },
          '400': { description: 'Invalid request' },
          '401': { description: 'Invalid session' },
          '403': { description: 'Not eligible' },
          '404': { description: 'Not found' },
          '409': { description: 'State conflict' },
          '422': { description: 'Unsupported instrument or country' },
          '503': { description: 'Provider unavailable or not configured' },
        },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'Roundups backend', version: '1.0.0' },
    paths,
    components: {
      securitySchemes: {
        privyBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'Privy access token' },
      },
    },
  };
}
