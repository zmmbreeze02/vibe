# 前后端信令接口文档

## 概述

本应用的客户端与服务器之间通过 Socket.IO 进行实时通信。这些通信主要用于协商 WebRTC 连接（由 Mediasoup 管理），以及同步房间内用户的状态。以下是所有信令事件的详细列表。

---

## 客户端 -> 服务器 (Client to Server)

这些是由客户端（浏览器）发起，发送给服务器的事件。

| 事件名称 | 载荷 (Payload) | 描述 |
| :--- | :--- | :--- |
| `join-room` | `roomId: string` | 客户端在连接成功后，立即调用此事件，告知服务器要加入哪个房间。 |
| `routerRtpCapabilities` | *(无)* | **[Ack]** 客户端请求获取服务器上 Mediasoup Router 的 RTP 能力参数（支持的编解码器等）。服务器通过 Ack 回调返回。 |
| `create-transport` | `{ isSender: boolean }` | **[Ack]** 客户端请求服务器创建一个新的 WebRTC Transport。`isSender` 用于区分是发送通道 (true) 还是接收通道 (false)。服务器通过 Ack 回调返回 Transport 的连接参数。 |
| `connect-transport` | `{ transportId: string, dtlsParameters: object }` | **[Ack]** 在客户端 Transport 触发 `connect` 事件后调用。用于将客户端的 DTLS 参数发送给服务器，以完成 DTLS 握手。 |
| `produce` | `{ kind: 'audio' \| 'video', rtpParameters: object }` | **[Ack]** 在客户端 Transport 触发 `produce` 事件后调用。用于告知服务器客户端将要发送一个媒体轨道，并提供相关的 RTP 参数。服务器创建 Producer 后，通过 Ack 回调返回其 ID。 |
| `consume` | `{ producerId: string, rtpCapabilities: object }` | **[Ack]** 客户端请求消费（接收）一个已存在的远程 Producer。需要提供客户端自身的 RTP 能力参数。服务器创建 Consumer 后，通过 Ack 回调返回其参数。 |
| `resume-consumer` | `{ consumerId: string }` | 告知服务器可以开始为指定的 Consumer 发送数据了（Consumer 默认以暂停状态创建）。 |
| `mute-status-change` | `{ muted: boolean }` | 当用户点击静音/取消静音时，通知服务器其麦克风状态已变更。 |

*注：**[Ack]** 表示这是一个通过 `socket.emitWithAck` 调用的事件，它会等待服务器通过回调函数返回结果。*

---

## 服务器 -> 客户端 (Server to Client)

这些是由服务器发起，发送给一个或多个客户端的事件。

| 事件名称 | 载荷 (Payload) | 描述 |
| :--- | :--- | :--- |
| `routerRtpCapabilities` | `rtpCapabilities: object` | **[废弃]** 旧版逻辑，在用户连接时主动推送。新版已改为由客户端通过 Ack 请求。 |
| `existing-producers` | `Array<{ producerId: string, socketId: string }>` | 当一个新用户加入房间时，服务器发送此事件，告知该用户房间内已经存在的所有生产者（即其他用户）。 |
| `new-producer` | `{ producerId: string, socketId: string }` | 当有任何一个用户成功创建了一个新的 Producer（即开始分享音视频）时，服务器向房间内**所有其他**用户广播此事件。 |
| `user-mute-status-changed` | `{ socketId: string, muted: boolean }` | 当一个用户的麦克风状态改变时，服务器向房间内**所有其他**用户广播此事件。 |
| `user-disconnected` | `{ socketId: string }` | 当一个用户断开连接时，服务器向房间内**所有其他**用户广播此事件，以便 UI 可以移除该用户的视频。 |
