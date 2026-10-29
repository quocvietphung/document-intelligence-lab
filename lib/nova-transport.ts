import {Agent} from 'undici';

// The upstream CPU model has a 360s deadline. Node's default 300s header
// deadline can otherwise lose a successfully persisted cold-start answer.
export const localChatTimeoutMs=380_000;
export function createLocalChatDispatcher(timeoutMs=localChatTimeoutMs){
  return new Agent({headersTimeout:timeoutMs,bodyTimeout:timeoutMs});
}
export const localChatDispatcher=createLocalChatDispatcher();
