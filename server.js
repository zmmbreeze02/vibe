const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const socketIO = require('socket.io');
const mediasoup = require('mediasoup');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

let worker;
let router;
const clients = {};

const createMediasoupObjects = async () => {
  worker = await mediasoup.createWorker({ logLevel: 'warn' });
  worker.on('died', () => { console.error('mediasoup worker died'); process.exit(1); });
  router = await worker.createRouter({
    mediaCodecs: [
      { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
      { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: { 'x-google-start-bitrate': 1000 } },
    ],
  });
};

app.prepare().then(async () => {
  await createMediasoupObjects();
  const httpServer = createServer((req, res) => handle(req, res, parse(req.url, true)));
  const io = new socketIO.Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    console.log(`[INFO] User connected: ${socket.id}`);
    clients[socket.id] = { socket, consumers: new Map() };

    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      clients[socket.id].roomId = roomId;
      console.log(`[INFO] Socket ${socket.id} joined room ${roomId}`);

      const existingProducers = Object.values(clients)
        .filter(c => c.roomId === roomId && c.producer && c.socket.id !== socket.id)
        .map(c => ({ producerId: c.producer.id, socketId: c.socket.id, name: c.name }));
      
      console.log(`[DEBUG] Emitting existing-producers to ${socket.id}:`, existingProducers.map(p=>p.producerId));
      socket.emit('existing-producers', existingProducers);
    });

    socket.on('disconnect', () => {
      console.log(`[INFO] User disconnected: ${socket.id}`);
      const { roomId } = clients[socket.id] || {};
      if (roomId) {
        socket.to(roomId).emit('user-disconnected', { socketId: socket.id });
      }
      delete clients[socket.id];
    });

    socket.on('routerRtpCapabilities', (data, callback) => {
        callback(router.rtpCapabilities);
    });

    socket.on('create-transport', async ({ isSender }, callback) => {
      try {
        const transport = await router.createWebRtcTransport({ listenIps: [{ ip: '127.0.0.1' }], enableUdp: true });
        clients[socket.id][isSender ? 'sendTransport' : 'recvTransport'] = transport;
        callback({ id: transport.id, iceParameters: transport.iceParameters, iceCandidates: transport.iceCandidates, dtlsParameters: transport.dtlsParameters });
      } catch (e) { callback({ error: e.message }); }
    });

    socket.on('connect-transport', async ({ transportId, dtlsParameters }, callback) => {
      const client = clients[socket.id];
      const transport = client.sendTransport?.id === transportId ? client.sendTransport : client.recvTransport;
      if (!transport) return callback({ error: 'Transport not found' });
      try {
        await transport.connect({ dtlsParameters });
        callback({ connected: true });
      } catch (e) { callback({ error: e.message }); }
    });

    socket.on('produce', async ({ kind, rtpParameters, appData }, callback) => {
      const client = clients[socket.id];
      const transport = client.sendTransport;
      if (!transport) return callback({ error: 'Send transport not found' });
      try {
        console.log(`[DEBUG] Received produce request from ${socket.id} with name: ${appData?.name}`);
        const producer = await transport.produce({ kind, rtpParameters, appData: { ...appData, socketId: socket.id } });
        client.producer = producer;
        client.name = appData.name;
        console.log(`[INFO] Producer created for ${socket.id}, broadcasting new-producer`);
        socket.to(client.roomId).emit('new-producer', { producerId: producer.id, socketId: socket.id, name: client.name });
        callback({ id: producer.id });
      } catch (e) { callback({ error: e.message }); }
    });

    socket.on('mute-status-change', ({ muted }) => {
      const { roomId } = clients[socket.id] || {};
      if (roomId) {
        socket.to(roomId).emit('user-mute-status-changed', { socketId: socket.id, muted });
      }
    });

    socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
      try {
        if (!router.canConsume({ producerId, rtpCapabilities })) {
            console.error(`Cannot consume`);
            return callback({ error: 'Cannot consume' });
        }
        const transport = clients[socket.id].recvTransport;
        if (!transport) return callback({ error: 'Recv transport not found' });

        const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
        clients[socket.id].consumers.set(consumer.id, consumer);
        callback({ id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters });
      } catch (e) { 
          console.error('Consume error:', e);
          callback({ error: e.message }); 
        }
    });

    socket.on('resume-consumer', async ({ consumerId }, callback) => {
      const consumer = clients[socket.id]?.consumers.get(consumerId);
      if (consumer) {
        await consumer.resume();
      }
      callback();
    });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
