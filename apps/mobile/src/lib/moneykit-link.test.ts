import { afterEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ present: vi.fn(), resume: vi.fn(), remove: vi.fn() }));
vi.mock('expo-linking', () => ({ addEventListener: vi.fn(() => ({ remove: sdk.remove })) }));
vi.mock('@moneykit/connect-react-native', () => ({
  presentLinkFlow: sdk.present,
  continueFlow: sdk.resume,
}));
import { openBankLink, continueBankLink } from './bank-link.native';
const uri = 'roundups-development://moneykit/callback';
afterEach(() => vi.resetAllMocks());
describe('MoneyKit native handoff', () => {
  it('extracts the nested exchangeable token and discards provider link IDs', async () => {
    sdk.present.mockImplementation(async (c) =>
      c.onSuccess({ token: { value: 'exchange' }, linkIdentifier: { value: 'secret' } }),
    );
    expect(await openBankLink('session', uri, 'connect')).toBe('exchange');
    expect(sdk.remove).toHaveBeenCalledOnce();
  });
  it('distinguishes reconnect success from cancellation', async () => {
    sdk.present.mockImplementationOnce(async (c) => c.onSuccess({ token: null }));
    expect(await openBankLink('session', uri, 'update')).toBe('');
    sdk.present.mockImplementationOnce(async (c) => c.onExit(null));
    expect(await openBankLink('session', uri, 'connect')).toBeNull();
  });
  it('requires a new-link token and never exposes provider errors', async () => {
    sdk.present.mockImplementationOnce(async (c) => c.onSuccess({ token: null }));
    await expect(openBankLink('session', uri, 'connect')).rejects.toThrow('connection token');
    sdk.present.mockImplementationOnce(async (c) =>
      c.onExit({ displayedMessage: 'secret payload' }),
    );
    await expect(openBankLink('session', uri, 'connect')).rejects.toThrow('could not be completed');
  });
  it('resumes only the configured callback once and blocks concurrent sessions', async () => {
    let finish: (v: unknown) => void = () => {};
    sdk.present.mockImplementation(async (c) => {
      finish = c.onSuccess;
    });
    const pending = openBankLink('session', uri, 'connect');
    await vi.waitFor(() => expect(sdk.present).toHaveBeenCalled());
    await expect(openBankLink('second', uri, 'connect')).rejects.toThrow('already in progress');
    expect(await continueBankLink('roundups://moneykit/callback?x=1')).toBe(false);
    expect(await continueBankLink(`${uri}?x=1`)).toBe(true);
    expect(await continueBankLink(`${uri}?x=1`)).toBe(true);
    expect(sdk.resume).toHaveBeenCalledOnce();
    finish({ token: { value: 'exchange' } });
    await pending;
    expect(await continueBankLink(`${uri}?x=1`)).toBe(false);
  });
});
