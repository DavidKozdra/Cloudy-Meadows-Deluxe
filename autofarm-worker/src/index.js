import { DurableObject } from 'cloudflare:workers';

const MAX_WORLD_CHANGES = 20000;
const MAX_MESSAGE_BYTES = 4096;
const MAX_CHAT_LENGTH = 240;
const CHAT_COOLDOWN_MS = 350;

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
      return Response.json({
        name: 'Cloudy Meadows AutoFarm',
        status: 'ready',
        totalPlayers: this.state.getWebSockets().length,
        changes: Object.keys(this.changes).length
      });
    }

    const playerId = request.headers.get('X-AutoFarm-Player');
    if (!playerId) return new Response('Missing player id', { status: 400 });
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server, [`player:${playerId}`]);
    const room = request.headers.get('X-AutoFarm-Room') || 'meadow-one';
    server.serializeAttachment({ playerId, player: null, room, lastChatAt: 0 });

    server.send(JSON.stringify({
      type: 'snapshot',
      changes: this.changes,
      players: this.connectedPlayers(playerId),
      server: this.serverInfo(room)
    }));
    this.broadcast({ type: 'server', ...this.serverInfo(room) });
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
      this.broadcast({ type: 'server', ...this.serverInfo(attachment.room) });
      return;
    }

    if (message.type === 'chat' && attachment.player) {
      const now = Date.now();
      const chatText = cleanChat(message.text);
      if (!chatText || now - (attachment.lastChatAt || 0) < CHAT_COOLDOWN_MS) return;
      attachment.lastChatAt = now;
      socket.serializeAttachment(attachment);
      this.broadcast({
        type: 'chat',
        id: `${attachment.playerId}:${now}`,
        playerId: attachment.playerId,
        name: attachment.player.name,
        text: chatText,
        sentAt: now
      });
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
    if (attachment.playerId) {
      this.broadcast({ type: 'leave', id: attachment.playerId }, socket);
      this.broadcast({ type: 'server', ...this.serverInfo(attachment.room, socket) }, socket);
    }
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

  serverInfo(room = 'meadow-one', excludeSocket = null) {
    return {
      room,
      totalPlayers: this.state.getWebSockets().filter(socket => socket !== excludeSocket).length
    };
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
    Number.isInteger(player.facing) && player.facing >= 0 && player.facing <= 3 &&
    typeof player.name === 'string' && player.name.length > 0 && player.name === cleanPlayerName(player.name);
}

function cleanPlayerName(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, 20);
}

function cleanChat(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, MAX_CHAT_LENGTH);
}

function validPatch(message) {
  return typeof message.key === 'string' && /^\d+,\d+,\d+,\d+$/.test(message.key) && message.key.length <= 48 &&
    message.value && typeof message.value === 'object' &&
    typeof message.value.name === 'string' && typeof message.value.class === 'string';
}

export default {
  fetch() { return new Response('AutoFarm Durable Object worker', { status: 200 }); }
};
