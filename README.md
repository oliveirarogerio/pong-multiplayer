# Multiplayer Pong Game

A modern implementation of the classic Pong game with multiplayer capabilities using WebRTC for peer-to-peer connections.

## Features

- Classic Pong gameplay with modern graphics
- Real-time multiplayer using WebRTC peer connections
- Session-based gameplay with shareable codes
- Visual effects with particles
- Sound effects
- Responsive design for various screen sizes
- Simple and intuitive controls

## Tech Stack

- **Frontend**: Vue 3 with TypeScript
- **Styling**: Tailwind CSS
- **Packaging**: Tauri (Rust-based desktop application framework)
- **Networking**: WebRTC with external signaling server
- **Build Tools**: Vite

## Prerequisites

- Node.js 16 or higher
- Rust and Cargo (for Tauri builds)
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm run dev
   ```

## Multiplayer Setup

The game uses WebRTC for peer-to-peer connections, which requires a signaling server to establish the initial connection. The signaling server is deployed on Railway, but you can run your own locally for development:

1. Navigate to the signaling server directory:
   ```
   cd signaling-server
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Start the signaling server:
   ```
   npm run dev
   ```
4. Update the signaling server URL in `src/services/RemoteSignalingService.ts` to use your local server:
   ```typescript
   constructor(signalingServerUrl: string = 'http://localhost:3000') {
     this.signalingServerUrl = signalingServerUrl;
   }
   ```

## How to Play

1. Launch the game
2. Choose to host a game or join an existing one
3. If hosting, share the session code with your opponent
4. If joining, enter the session code provided by the host
5. Use the arrow keys or W/S keys to move your paddle
6. First player to reach 11 points wins

## Building for Production

To build the desktop application:

```
npm run tauri build
```

This will create executables for your platform in the `src-tauri/target/release` directory.

## Deployment

### Frontend

The frontend can be deployed as a regular web application or packaged as a desktop application using Tauri.

### Signaling Server

The signaling server should be deployed to a platform like Railway, Heroku, or Vercel. Instructions for deploying to Railway are included in the `signaling-server/README.md` file.

## License

MIT
# pong-multiplayer
