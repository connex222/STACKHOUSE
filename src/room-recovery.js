/**
 * Only an authoritative invalid-seat response may remove a locally saved room token.
 * HTTP 5xx, network errors, temporary service warm-ups and timeouts are recoverable.
 */
export function classifyRoomRecovery(error) {
  return error?.status === 401 || error?.status === 404 ? 'invalid-seat' : 'retryable';
}
