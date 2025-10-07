# GEMINI.md: Project Context

## Project Overview

This project is a real-time, multi-room video conferencing application. It uses a modern web stack to enable multi-party video and audio communication directly in the browser.

**Core Technologies:**

*   **Framework:** Next.js (v15) using the App Router and TypeScript.
*   **Real-time Communication:** WebRTC for peer-to-peer media streams.
*   **Media Server:** Mediasoup (v3) is used as a Selective Forwarding Unit (SFU). This is a robust architecture where clients send their media stream to a central server, which then forwards it to other participants, optimizing bandwidth.
*   **Signaling:** A custom Node.js server (`server.js`) integrated with Next.js handles signaling between clients using Socket.IO (v4). The signaling logic is room-aware, ensuring broadcasts only go to clients in the same room.
*   **State Management:** A React Context (`src/context/MediaContext.tsx`) is used to share the local user's media stream and name between the lobby and the meeting room pages.

**Architecture:**

The application is split into two main user-facing pages:
1.  **Lobby (`/`):** The entry point of the application (`src/app/page.tsx`). It handles acquiring camera/microphone permissions, previewing the local video, and allowing the user to enter a room ID. Usernames are automatically generated and persisted in `localStorage`.
2.  **Room (`/room/[roomId]`):** A dynamic route (`src/app/room/[roomId]/page.tsx`) that represents a unique meeting room. It receives the local media stream and username from the `MediaContext` and then establishes the full WebRTC connection to send and receive media from other participants in the same room.

The backend uses a **custom Next.js server** (`server.js`). This is a critical architectural choice, allowing the stateful Socket.IO signaling server and Mediasoup processes to run alongside the Next.js application. The server manages user-to-room assignments and ensures all communication is properly isolated between rooms.

## Building and Running

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run the Development Server:**
    This command starts the custom server which runs both the Next.js frontend and the backend signaling logic.
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

3.  **Build for Production:**
    ```bash
    npm run build
    ```

4.  **Run in Production:**
    ```bash
    npm run start
    ```

## Development Conventions

*   **Language:** The project is written in TypeScript.
*   **Structure:** The Next.js App Router paradigm is used. The root page (`/`) serves as the lobby, and `/room/[roomId]` is the dynamic route for meeting rooms. Reusable React components are in `src/components`, and shared state logic is in `src/context`.
*   **Styling:** Global CSS is used for styling (`src/app/globals.css`), implementing a dark theme and responsive layouts.
*   **State Management:** Besides local component state (`useState`), React Context (`MediaContext`) is used to pass state (like `MediaStream`) between different pages on the client-side.
*   **Configuration:** `next.config.mjs` is modified to include a Webpack fallback for the `fs` module, a necessary workaround for bundling certain server-dependent libraries.