import { completeBankConnection } from './bank-completion';
import { loadPendingSaltEdge, startedBankLinkInThisProcess } from './saltedge-pending';

// Automatic recovery only handles a previous process's marker. A live widget
// owns its own completion, including cancellation and retry UI.
export async function recoverPendingBank(
  userId: string,
  getAccessToken: () => Promise<string | null>,
) {
  const pending = await loadPendingSaltEdge();
  if (!pending || pending.userId !== userId || startedBankLinkInThisProcess(pending.linkSessionId))
    return false;
  await completeBankConnection({ ...pending, recovery: true }, getAccessToken);
  return true;
}
