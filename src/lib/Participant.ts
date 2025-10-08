'use client';

import { types } from 'mediasoup-client';

type Producer = types.Producer;
type Consumer = types.Consumer;

/**
 * 代表一个参会者（本地或远程）。
 */
export class Participant {
  public id: string; // Corresponds to socketId
  public name: string;
  public stream: MediaStream;
  public isLocal: boolean;
  public producers: Map<string, Producer> = new Map();
  public consumers: Map<string, Consumer> = new Map();
  public isMuted: boolean = false;

  constructor(id: string, name: string, isLocal = false) {
    this.id = id;
    this.name = name;
    this.isLocal = isLocal;
    this.stream = new MediaStream();
  }

  /**
   * 向该参会者的媒体流中添加一个轨道。
   * @param {MediaStreamTrack} track - 要添加的媒体轨道。
   */
  addTrack(track: MediaStreamTrack) {
    this.stream.addTrack(track);
  }

  /**
   * 设置该参会者的静音状态。
   * @param {boolean} isMuted - 是否静音。
   */
  setMute(isMuted: boolean) {
    this.isMuted = isMuted;
  }
}
