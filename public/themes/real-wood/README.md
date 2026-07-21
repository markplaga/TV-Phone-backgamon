# Real Wood Theme Asset

Upload the actual generated wooden board image to this exact repository path:

`public/themes/real-wood/board.PNG`

Requirements:

- File name: `board.PNG`
- Format: PNG
- Recommended dimensions: 1536 × 921 pixels
- Straight-on empty backgammon board
- No checkers, dice, labels, or interface elements

The application loads `board.PNG` first. If it is missing, the existing `board.svg` remains as a temporary fallback.

After uploading or replacing `board.PNG`, commit the change to the `main` branch. Render should then redeploy automatically.
