# GEMINI.md: Project Context

## Project Overview

This project is a real-time video conferencing application. It uses a modern web stack to enable multi-party video and audio communication directly in the browser.

**Core Technologies:**

*   **Framework:** Next.js (v15) using the App Router and TypeScript.
*   **Real-time Communication:** WebRTC for peer-to-peer media streams.
*   **Media Server:** Mediasoup (v3) is used as a Selective Forwarding Unit (SFU). This is a robust architecture where clients send their media stream to a central server, which then forwards it to other participants, optimizing bandwidth compared to a pure P2P mesh.
*   **Signaling:** A custom Node.js server integrated with Next.js handles signaling between clients using Socket.IO (v4).

**Architecture:**

The project utilizes a **custom Next.js server** (`server.js`). This approach is necessary because the application requires a long-running, stateful process for the Socket.IO signaling server and the Mediasoup worker. The custom server starts the Next.js application while also managing all real-time communication logic.

The client-side is a single-page application built with React (`src/app/page.tsx`) that connects to the server, handles local media (camera/microphone), and manages the creation and display of video streams from other participants.

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
*   **Structure:** The Next.js App Router paradigm is used, with pages located in `src/app`. Reusable React components are stored in `src/components`.
*   **Styling:** Global CSS is used for styling (`src/app/globals.css`), implementing a dark theme and a grid-based layout for video participants.
*   **State Management:** Client-side state is managed using standard React hooks (`useState`, `useEffect`).
*   **Configuration:** The `next.config.mjs` file is modified to include a Webpack fallback for the `fs` module, which is a necessary workaround to prevent build errors when bundling server-dependent libraries for the client.
