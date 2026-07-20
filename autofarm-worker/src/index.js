import { DurableObject } from 'cloudflare:workers';

const MAX_WORLD_CHANGES = 20000;
const MAX_MESSAGE_BYTES = 4096;

export class AutoFarmWorld extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.state = state;
    this.changes = {};
    this.ready = this.state.blockConcurrencyWhile(async () => {
      this.changes = (await this.state.storage.get('changes')) || {};
    });
  }

  async fetch(request) {
    await this.ready;
    if (request.headers.get('Upgrade') !== 'websocket') {
      return Response.json({ status: 'ready', changes: Object.keys(this.changes).length });
    }

    const playerId = request.headers.get('X-AutoFarm-Player');
    if (!playerId) return new Response('Missing player id', { status: 400 });
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server, [`player:${playerId}`]);
    server.serializeAttachment({ playerId, player: null });

    server.send(JSON.stringify({
      type: 'snapshot',
      changes: this.changes,
      players: this.connectedPlayers(playerId)
    }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, rawMessage) {
    const text = typeof rawMessage === 'string' ? rawMessage : new TextDecoder().decode(rawMessage);
    if (text.length > MAX_MESSAGE_BYTES) return socket.close(1009, 'Message too large');
    let message;
    try { message = JSON.parse(text); } catch (_) { return; }
    const attachment = socket.deserializeAttachment() || {};

    if (message.type === 'presence' && validPlayer(message.player, attachment.playerId)) {
      attachment.player = message.player;
      socket.serializeAttachment(attachment);
      this.broadcast({ type: 'presence', player: message.player }, socket);
      return;
    }

    if (message.type === 'patch' && validPatch(message)) {
      if (!(message.key in this.changes) && Object.keys(this.changes).length >= MAX_WORLD_CHANGES) {
        return socket.send(JSON.stringify({ type: 'error', message: 'World change limit reached' }));
      }
      this.changes[message.key] = message.value;
      await this.state.storage.put('changes', this.changes);
      this.broadcast({ type: 'patch', key: message.key, value: message.value, playerId: attachment.playerId }, socket);
    }
  }

  webSocketClose(socket) {
    const attachment = socket.deserializeAttachment() || {};
    if (attachment.playerId) this.broadcast({ type: 'leave', id: attachment.playerId }, socket);
  }

  webSocketError(socket) {
    this.webSocketClose(socket);
  }

  connectedPlayers(excludeId) {
    const players = {};
    for (const socket of this.state.getWebSockets()) {
      const attachment = socket.deserializeAttachment() || {};
      if (attachment.player && attachment.playerId !== excludeId) players[attachment.playerId] = attachment.player;
    }
    return players;
  }

  broadcast(message, except) {
    const encoded = JSON.stringify(message);
    for (const socket of this.state.getWebSockets()) {
      if (socket === except) continue;
      try { socket.send(encoded); } catch (_) { /* stale socket */ }
    }
  }
}

function validPlayer(player, playerId) {
  return player && player.id === playerId && Number.isInteger(player.x) && Number.isInteger(player.y) &&
    Math.abs(player.x) <= 1000000 && Math.abs(player.y) <= 1000000 &&
    Number.isInteger(player.facing) && player.facing >= 0 && player.facing <= 3;
}

function validPatch(message) {
  return typeof message.key === 'string' && /^-?\d+,-?\d+$/.test(message.key) && message.key.length <= 32 &&
    message.value && typeof message.value === 'object' &&
    ['grass', 'soil', 'crop', 'chest', 'robot'].includes(message.value.type);
}

export default {
  fetch() { return new Response('AutoFarm Durable Object worker', { status: 200 }); }
};
