/** Only the latest uninterrupted hold can confirm, once. */
export function createHoldConfirmation() {
  let generation = 0;
  let active: number | null = null;
  return {
    begin() {
      active = ++generation;
      return active;
    },
    cancel() {
      active = null;
    },
    complete(token: number, finished: boolean, allowed: boolean) {
      if (active !== token || !finished || !allowed) return false;
      active = null;
      return true;
    },
  };
}
