'use client';

import io, { Socket } from 'socket.io-client';
import { Device, types } from 'mediasoup-client';

// 类型别名，方便使用
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

/**
 * VibeSDK 类，用于封装所有 WebRTC 和信令逻辑。
 */
export class VibeSDK extends EventEmitter {
  private socket: Socket | null = null;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();

  /**
   * 初始化 SDK 并建立 WebSocket 连接。
   */
  constructor() {
    super();
    this.init();
  }

  /**
   * 检查 WebSocket 当前是否已连接。
   * @returns {boolean} 如果已连接则返回 true，否则返回 false。
   */
  public get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * 初始化 socket 连接并设置基础的事件监听器。
   */
  private init() {
    this.socket = io('http://localhost:3000');
    this.socket.on('connect', () => {
      console.log('SDK: Socket connected');
      this.emit('connected');
    });
    this.socket.on('disconnect', () => {
      console.log('SDK: Socket disconnected');
      this.emit('disconnected');
    });

    this.listenForRemoteProducers();
  }

  /**
   * 加入一个房间，初始化 Mediasoup device，创建 transports，并开始生产媒体流。
   * @param {string} roomId - 要加入的房间 ID。
   * @param {MediaStream} localStream - 用户的本地媒体流。
   */
  async joinRoom(roomId: string, localStream: MediaStream) {
    if (!this.socket) return console.error('Socket not initialized');

    this.socket.emit('join-room', roomId);

    const routerRtpCapabilities = await this.socket.emitWithAck('routerRtpCapabilities');
    this.device = new Device();
    await this.device.load({ routerRtpCapabilities });
    console.log('SDK: Device loaded');

    await this.initTransports(localStream);
  }

  /**
   * 创建发送和接收 transport，并开始生产媒体流。
   * @param {MediaStream} localStream - 用户的本地媒体流。
   */
  private async initTransports(localStream: MediaStream) {
    if (!this.socket || !this.device) return;

    // 创建发送 transport
    const sendTransportParams = await this.socket.emitWithAck('create-transport', { isSender: true });
    this.sendTransport = this.device.createSendTransport(sendTransportParams);
    this.sendTransport.on('connect', ({ dtlsParameters }, cb) => this.socket?.emit('connect-transport', { transportId: this.sendTransport?.id, dtlsParameters }, () => cb()));
    this.sendTransport.on('produce', ({ kind, rtpParameters }, cb) => this.socket?.emit('produce', { kind, rtpParameters }, ({ id }: any) => cb({ id })));

    // 创建接收 transport
    const recvTransportParams = await this.socket.emitWithAck('create-transport', { isSender: false });
    this.recvTransport = this.device.createRecvTransport(recvTransportParams);
    this.recvTransport.on('connect', ({ dtlsParameters }, cb) => this.socket?.emit('connect-transport', { transportId: this.recvTransport?.id, dtlsParameters }, () => cb()));

    // 生产本地媒体
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      const videoProducer = await this.sendTransport.produce({ track: videoTrack });
      this.producers.set('video', videoProducer);
    }
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      const audioProducer = await this.sendTransport.produce({ track: audioTrack });
      this.producers.set('audio', audioProducer);
    }
  }

  /**
   * 设置监听器，用于处理房间中其他客户端的新生产者。
   */
  private listenForRemoteProducers() {
    this.socket?.on('new-producer', ({ producerId, socketId }) => this.consume(producerId, socketId));
    this.socket?.on('existing-producers', (producers) => {
      for (const { producerId, socketId } of producers) this.consume(producerId, socketId);
    });
    this.socket?.on('user-disconnected', ({ socketId }) => {
      console.log(`User ${socketId} disconnected`);
      this.emit('remote-user-disconnected', socketId);
    });
  }

  /**
   * 为一个远程生产者创建消费者，以接收其媒体流。
   * @param {string} producerId - 要消费的远程生产者 ID。
   * @param {string} socketId - 远程用户的 socket ID。
   */
  private async consume(producerId: string, socketId: string) {
    if (!this.device || !this.recvTransport || !this.socket) return;
    const { rtpCapabilities } = this.device;
    const params = await this.socket.emitWithAck('consume', { producerId, rtpCapabilities });
    if (params.error) return console.error('Cannot consume', params.error);
    const consumer = await this.recvTransport.consume(params);
    this.consumers.set(consumer.id, consumer);
    this.socket.emit('resume-consumer', { consumerId: consumer.id });
    const { track } = consumer;
    const stream = new MediaStream([track]);
    this.emit('new-remote-stream', { id: consumer.id, stream, name: `User ${socketId.substring(0, 4)}`, socketId });
  }

  /**
   * 切换本地用户的麦克风静音状态。
   * @param {boolean} isMuted - 期望的静音状态。
   */
  toggleMute(isMuted: boolean) {
    const audioProducer = this.producers.get('audio');
    if (audioProducer) {
      isMuted ? audioProducer.pause() : audioProducer.resume();
      this.socket?.emit('mute-status-change', { muted: isMuted });
    }
  }

  /**
   * 切换本地用户的摄像头开关状态。
   * @param {boolean} isCameraOff - 期望的摄像头关闭状态。
   */
  toggleCamera(isCameraOff: boolean) {
    const videoProducer = this.producers.get('video');
    if (videoProducer) {
      isCameraOff ? videoProducer.pause() : videoProducer.resume();
    }
  }

  /**
   * 清理当前房间所有与媒体相关的对象，但不会断开 socket 连接。
   */
  leaveRoom() {
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.producers.forEach(p => p.close());
    this.consumers.forEach(c => c.close());
    this.producers.clear();
    this.consumers.clear();
    this.sendTransport = null;
    this.recvTransport = null;
  }

  /**
   * 强制断开 WebSocket 连接。
   */
  disconnect() {
    this.socket?.disconnect();
  }
}
