# Real Wood Theme Asset

Upload the actual generated wooden board image to this exact repository path:

`public/themes/real-wood/board.jpg`

Requirements:

- File name: `board.jpg`
- Format: JPEG
- Recommended dimensions: 1536 × 921 pixels
- Straight-on empty backgammon board
- No checkers, dice, labels, or interface elements

The application loads `board.jpg` first. If it is missing, the existing `board.svg` remains as a temporary fallback.

After uploading or replacing `board.jpg`, commit the change to the `main` branch. Render should then redeploy automatically.
