// PeerJS wrapper. The host screen owns a peer named after the room code;
// phones connect to it directly (WebRTC data channels, public PeerJS broker + TURN).
/* global Peer */
import { makeRoomCode } from './logic.js';

const PREFIX = 'serata-v1-';
const RETRY_MS = 2000;
const MAX_SAME_CODE_RETRIES = 3;

export function createHost({ preferredCode, onOpen, onMessage, onDisconnect, onStatus }) {
  let attempts = 0;
  let peer;

  const start = (code) => {
    peer = new Peer(PREFIX + code, { debug: 1 });
    peer.on('open', () => { attempts = 0; onStatus('online'); onOpen(code); });
    peer.on('connection', (conn) => {
      conn.on('data', (data) => onMessage(conn, data));
      conn.on('close', () => onDisconnect(conn));
      conn.on('error', () => onDisconnect(conn));
    });
    peer.on('disconnected', () => {
      onStatus('reconnecting');
      setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, RETRY_MS);
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        // Usually the same room still registered after a page reload: retry, then pick a new code.
        attempts += 1;
        peer.destroy();
        const next = attempts <= MAX_SAME_CODE_RETRIES ? code : makeRoomCode();
        setTimeout(() => start(next), RETRY_MS);
        return;
      }
      if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
        onStatus('reconnecting');
        return;
      }
      onStatus('error', err);
    });
  };

  start(preferredCode || makeRoomCode());
  return {
    send(conn, msg) {
      if (conn?.open) conn.send(msg);
    },
  };
}

export function joinRoom({ code, onOpen, onMessage, onStatus }) {
  let peer = null;
  let conn = null;
  let retryTimer = null;

  const scheduleRetry = () => {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, RETRY_MS);
  };

  const dial = () => {
    if (conn?.open) return;
    onStatus('connecting');
    const next = peer.connect(PREFIX + code, { reliable: true });
    conn = next;
    next.on('open', () => { onStatus('open'); onOpen(); });
    next.on('data', onMessage);
    next.on('close', () => { if (conn === next) { onStatus('lost'); scheduleRetry(); } });
    next.on('error', () => { if (conn === next) { onStatus('lost'); scheduleRetry(); } });
  };

  function connect() {
    if (conn?.open) return;
    if (!peer || peer.destroyed) {
      peer = new Peer({ debug: 1 });
      peer.on('open', dial);
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      peer.on('error', (err) => {
        onStatus(err.type === 'peer-unavailable' ? 'noroom' : 'lost');
        if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
          peer.destroy();
        }
        scheduleRetry();
      });
    } else if (peer.open) {
      dial();
    } else if (peer.disconnected) {
      peer.reconnect();
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !conn?.open) connect();
  });

  connect();
  return {
    send(msg) {
      if (!conn?.open) return false;
      conn.send(msg);
      return true;
    },
  };
}
