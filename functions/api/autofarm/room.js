export async function onRequest(context) {
  const request = context.request;
  if (request.headers.get('Upgrade') !== 'websocket') {
    return Response.json({
      name: 'Cloudy Meadows AutoFarm multiplayer',
      status: 'ready',
      protocol: 1
    });
  }

  const url = new URL(request.url);
  const roomName = cleanToken(url.searchParams.get('room'), 'meadow-one', 48);
  const playerId = cleanToken(url.searchParams.get('player'), '', 64);
  if (!playerId) return new Response('Missing player id', { status: 400 });

  const id = context.env.AUTO_FARM_WORLD.idFromName(roomName);
  const room = context.env.AUTO_FARM_WORLD.get(id);
  const headers = new Headers(request.headers);
  headers.set('X-AutoFarm-Player', playerId);
  headers.set('X-AutoFarm-Room', roomName);
  return room.fetch(new Request(request, { headers }));
}

function cleanToken(value, fallback, maxLength) {
  const clean = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLength);
  return clean || fallback;
}
