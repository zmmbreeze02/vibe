'use client';

import io, { Socket } from 'socket.io-client';
import { Device, types } from 'mediasoup-client';
import { Participant } from './Participant';

// 类型别名
type Transport = types.Transport;
type Producer = types.Producer;
type Consumer = types.Consumer;

/**
 * 一个简单的 EventEmitter 类，让 SDK 可以派发事件。
 */
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  /**
   * 订阅一个事件。
   * @param {string} event - 事件名称。
   * @param {Function} listener - 回调函数。
   */
  on(event: string, listener: Function) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
  }

  /**
   * 派发一个事件。
   * @param {string} event - 事件名称。
   * @param {any[]} args - 传递给监听器的参数。
   */
  emit(event: string, ...args: any[]) {
    this.events[event]?.forEach(listener => listener(...args));
  }
}

export class VibeSDK extends EventEmitter {
  private socket: Socket | null = null;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private participants: Map<string, Participant> = new Map();
  private localParticipant: Participant | null = null;

  constructor() { super(); this.init(); }

  public get isConnected(): boolean { return this.socket?.connected || false; }

  private init() {
    this.socket = io('http://localhost:3000');
    this.socket.on('connect', () => this.emit('connected'));
    this.socket.on('disconnect', () => this.emit('disconnected'));
  }

  async joinRoom(roomId: string, name: string, localStream: MediaStream) {
    if (!this.socket) return;

    this.localParticipant = new Participant(this.socket.id!, name, true);
    this.participants.set(this.socket.id!, this.localParticipant);

    const joinLogic = async () => {
      this.socket!.emit('join-room', roomId);
      const routerRtpCapabilities = await this.socket!.emitWithAck('routerRtpCapabilities');
      this.device = new Device();
      await this.device.load({ routerRtpCapabilities });

      await this.initTransports(localStream);
      this.listenForRoomEvents();
    };

    if (this.socket.connected) joinLogic();
    else this.socket.once('connect', joinLogic);
  }

  private async initTransports(localStream: MediaStream) {
    if (!this.socket || !this.device || !this.localParticipant) return;

    const sendParams = await this.socket.emitWithAck('create-transport', { isSender: true });
    this.sendTransport = this.device.createSendTransport(sendParams);
    this.sendTransport.on('connect', ({ dtlsParameters }, cb) => this.socket?.emit('connect-transport', { transportId: this.sendTransport?.id, dtlsParameters }, () => cb()));
    this.sendTransport.on('produce', ({ kind, rtpParameters }, cb) => this.socket?.emit('produce', { kind, rtpParameters }, ({ id }: any) => cb({ id })));

    const recvParams = await this.socket.emitWithAck('create-transport', { isSender: false });
    this.recvTransport = this.device.createRecvTransport(recvParams);
    this.recvTransport.on('connect', ({ dtlsParameters }, cb) => this.socket?.emit('connect-transport', { transportId: this.recvTransport?.id, dtlsParameters }, () => cb()));

    for (const track of localStream.getTracks()) {
      const producer = await this.sendTransport.produce({ track });
      this.localParticipant.producers.set(track.kind, producer);
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

  private async consume({ producerId, socketId, name }: { producerId: string, socketId: string, name: string }) {
    if (!this.device || !this.recvTransport || !this.socket) return;

    const { rtpCapabilities } = this.device;
    const params = await this.socket.emitWithAck('consume', { producerId, rtpCapabilities });
    const consumer = await this.recvTransport.consume(params);
    this.socket.emit('resume-consumer', { consumerId: consumer.id });

    let participant = this.participants.get(socketId);
    if (!participant) {
      participant = new Participant(socketId, name);
      this.participants.set(socketId, participant);
      this.emit('participant-joined', participant);
    }
    participant.consumers.set(consumer.id, consumer);
    participant.addTrack(consumer.track);
  }

  toggleMute(isMuted: boolean) {
    this.localParticipant?.producers.get('audio')?.pause();
    if(isMuted) this.localParticipant?.producers.get('audio')?.pause();
    else this.localParticipant?.producers.get('audio')?.resume();
    this.socket?.emit('mute-status-change', { muted: isMuted });
    this.localParticipant?.setMute(isMuted);
  }

  toggleCamera(isCameraOff: boolean) {
    if(isCameraOff) this.localParticipant?.producers.get('video')?.pause();
    else this.localParticipant?.producers.get('video')?.resume();
  }

  leaveRoom() {
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.localParticipant = null;
    this.participants.clear();
  }

  disconnect() { this.socket?.disconnect(); }
}