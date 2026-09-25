import { describe, expect, it } from 'vitest';
import { createHoldConfirmation } from './hold-confirmation';

describe('destructive hold confirmation', () => {
  it('confirms only once after a completed eligible hold', () => {
    const hold = createHoldConfirmation();
    const token = hold.begin();
    expect(hold.complete(token, false, true)).toBe(false);
    expect(hold.complete(token, true, true)).toBe(true);
    expect(hold.complete(token, true, true)).toBe(false);
  });
  it('cancels on release, navigation or backgrounding', () => {
    const hold = createHoldConfirmation();
    const token = hold.begin();
    hold.cancel();
    expect(hold.complete(token, true, true)).toBe(false);
  });
  it('rejects completion after the phrase changes or the button becomes busy', () => {
    const hold = createHoldConfirmation();
    const token = hold.begin();
    expect(hold.complete(token, true, false)).toBe(false);
  });
  it('cannot apply a stale completion to a new hold', () => {
    const hold = createHoldConfirmation();
    const old = hold.begin();
    hold.cancel();
    const current = hold.begin();
    expect(hold.complete(old, true, true)).toBe(false);
    expect(hold.complete(current, true, true)).toBe(true);
  });
});
