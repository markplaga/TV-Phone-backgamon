# Backgammon TV + Phone

A working multiplayer starter app for a shared television screen and two phone controllers.

## Included

- 16:9 television board
- QR code and five-character room code
- Two phone players
- Server-authoritative dice and game state
- Standard checker movement
- Bar entry and hitting
- Bearing off
- Doubles
- Required-use move sequencing
- Undo before turn confirmation
- Gammon and backgammon scoring
- Match scoring
- 10 switchable visual themes

## Run locally

1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run:

```bash
npm install
npm start
```

4. Open `http://localhost:3000` on the TV computer.
5. Click **Open TV Game**.
6. Phones on the same network can scan the QR code if the TV page is opened using the computer's LAN address, for example `http://192.168.1.25:3000`.

## Deploy

This can be deployed to a Node-compatible host such as Netlify Functions with adaptation, Render, Railway, Fly.io, or a VPS. Because Socket.IO needs a persistent server, a conventional Node host is the easiest first deployment.

## Recommended next improvements

- Replace the phone's derived move list with legal moves sent directly by the server
- Add reconnect tokens so a player can recover after refreshing
- Add the doubling cube and Crawford rule
- Add animated checker movement
- Add theme-specific SVG artwork, sounds, and win animations
- Add a spectator mode
- Add automated tests for all difficult bearing-off and forced-dice cases

## Theme IDs

- classic-walnut
- egyptian
- zen
- medieval
- art-deco
- pirate
- scifi
- ocean
- steampunk
- viking
