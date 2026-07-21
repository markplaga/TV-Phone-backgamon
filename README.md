# Backgammon TV + Phone

A multiplayer starter app for a shared television screen and two phone controllers.

## Deploy the live Node server

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fmarkplaga%2FTV-Phone-backgamon)

The Render deployment runs the Express and Socket.IO server required for live phone connections. After deployment, open the new `onrender.com` address on the TV, choose **Open TV Game**, and scan the QR code with each phone.

The repository includes `render.yaml`, so Render will use:

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health check: `/`
- Auto-deploys from the `main` branch

The free Render service is suitable for testing, but it can spin down after 15 minutes without traffic. The first opening after a quiet period can therefore take about a minute.

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

## Netlify preview

The Netlify site provides a static visual preview only. Netlify does not run the persistent Socket.IO process used by this version of the multiplayer game. Use the Render deployment address for live TV-and-phone play.

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
