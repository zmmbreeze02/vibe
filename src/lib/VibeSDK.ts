'use client';

import io, { Socket } from 'socket.io-client';
import { Device, types } from 'mediasoup-client';
import { Participant } from './Participant';

type Transport = types.Transport;
type Producer = types.Producer;
type Consumer = types.Consumer;

class EventEmitter {
  private events: { [key: string]: Function[] } = {};
  on(event: string, listener: Function) { if (!this.events[event]) this.events[event] = []; this.events[event].push(listener); }
  emit(event: string, ...args: any[]) { this.events[event]?.forEach(listener => listener(...args)); }
}

export class VibeSDK extends EventEmitter {
  private socket: Socket | null = null;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();
  private participants: Map<string, Participant> = new Map();
  private localParticipant: Participant | null = null;
  private cameraTrack: MediaStreamTrack | null = null;

  constructor() { super(); this.init(); }

  public get isConnected(): boolean { return this.socket?.connected || false; }

  private init() {
    this.socket = io('http://localhost:3000');
    this.socket.on('connect', () => this.emit('connected'));
    this.socket.on('disconnect', () => this.emit('disconnected'));
  }

  joinRoom(roomId: string, name: string, localStream: MediaStream) {
    if (!this.socket) return;

    const joinLogic = () => {
      this.localParticipant = new Participant(this.socket!.id, name, true);
      this.participants.set(this.socket!.id, this.localParticipant);
      this.cameraTrack = localStream.getVideoTracks()[0];

      this.socket!.emit('join-room', roomId);
      this.socket!.emit('routerRtpCapabilities', {}, async (routerRtpCapabilities: any) => {
        this.device = new Device();
        await this.device.load({ routerRtpCapabilities });
        await this.initTransports(localStream, name);
        this.listenForRoomEvents();
        this.emit('ready', this.localParticipant);
      });
    };

    if (this.socket.connected) joinLogic();
    else this.socket.once('connect', joinLogic);
  }

  private async initTransports(localStream: MediaStream, name: string) {
    if (!this.socket || !this.device) return;

    await new Promise<void>(resolve => {
        this.socket!.emit('create-transport', { isSender: true }, (params: any) => {
            this.sendTransport = this.device!.createSendTransport(params);
            this.sendTransport.on('connect', ({ dtlsParameters }, cb) => this.socket?.emit('connect-transport', { transportId: this.sendTransport?.id, dtlsParameters }, () => cb()));
            this.sendTransport.on('produce', ({ kind, rtpParameters }, cb) => {
        console.log(`[SDK-DEBUG] Emitting produce for ${kind} with name: ${name}`);
        this.socket?.emit('produce', { kind, rtpParameters, appData: { name } }, ({ id }: any) => cb({ id }));
      });
            resolve();
        });
    });

    await new Promise<void>(resolve => {
        this.socket!.emit('create-transport', { isSender: false }, (params: any) => {
            this.recvTransport = this.device!.createRecvTransport(params);
            this.recvTransport.on('connect', ({ dtlsParameters }, cb) => this.socket?.emit('connect-transport', { transportId: this.recvTransport?.id, dtlsParameters }, () => cb()));
            resolve();
        });
    });

    for (const track of localStream.getTracks()) {
        const producer = await this.sendTransport!.produce({ track });
        this.producers.set(track.kind, producer);
    }
  }

  private listenForRoomEvents() {
    this.socket?.on('existing-producers', (producers) => {
      for (const { producerId, socketId, name } of producers) this.consume({ producerId, socketId, name });
    });
    this.socket?.on('new-producer', ({ producerId, socketId, name }) => {
      this.consume({ producerId, socketId, name });
    });
    this.socket?.on('user-disconnected', ({ socketId }) => {
      const participant = this.participants.get(socketId);
      if (participant) {
        this.emit('participant-left', participant);
        this.participants.delete(socketId);
      }
    });
    this.socket?.on('user-mute-status-changed', ({ socketId, muted }) => {
        const participant = this.participants.get(socketId);
        if(participant) {
            participant.setMute(muted);
            this.emit('participant-updated', participant);
        }
    });
  }

  private consume({ producerId, socketId, name }: { producerId: string, socketId: string, name: string }) {
    console.log(`[SDK-DEBUG] Consume called for socketId ${socketId} with name: ${name}`);
    if (!this.device || !this.recvTransport || !this.socket) return;

    const { rtpCapabilities } = this.device;
    this.socket.emit('consume', { producerId, rtpCapabilities }, async (params: any) => {
      if (params.error) return console.error('Cannot consume', params.error);
      
      const consumer = await this.recvTransport!.consume(params);
      this.consumers.set(consumer.id, consumer);

      let participant = this.participants.get(socketId);
      if (!participant) {
        participant = new Participant(socketId, name);
        this.participants.set(socketId, participant);
        participant.addTrack(consumer.track);
        this.emit('participant-joined', participant);
      } else {
        participant.addTrack(consumer.track);
        this.emit('participant-updated', participant);
      }

      this.socket!.emit('resume-consumer', { consumerId: consumer.id }, () => {});
    });
  }

  async startScreenShare() {
    if (!this.sendTransport) return;
    const videoProducer = this.producers.get('video');
    if (!videoProducer) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      await videoProducer.replaceTrack({ track: screenTrack });
      screenTrack.onended = () => this.stopScreenShare();
    } catch (error) {
      console.error('Error starting screen share:', error);
    }
  }

  async stopScreenShare() {
    if (!this.cameraTrack) return;
    const videoProducer = this.producers.get('video');
    if (!videoProducer) return;
    await videoProducer.replaceTrack({ track: this.cameraTrack });
  }

  toggleMute(isMuted: boolean) {
    const producer = this.producers.get('audio');
    if (producer) { isMuted ? producer.pause() : producer.resume(); this.socket?.emit('mute-status-change', { muted: isMuted }); }
    this.localParticipant?.setMute(isMuted);
  }

  toggleCamera(isCameraOff: boolean) {
    const producer = this.producers.get('video');
    if (producer) { isCameraOff ? producer.pause() : producer.resume(); }
  }

  leaveRoom() {
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.producers.forEach(p => p.close());
    this.consumers.forEach(c => c.close());
    this.producers.clear();
    this.consumers.clear();
    this.sendTransport = null;
    this.recvTransport = null;
    this.localParticipant = null;
    this.participants.clear();
  }

  disconnect() { this.socket?.disconnect(); }
}
