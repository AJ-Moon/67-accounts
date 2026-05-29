#!/bin/bash
echo "Starting 67 Café POS..."
cd "$(dirname "$0")"

# Open the browser immediately (it will wait/refresh when server starts)
open http://localhost:3000

# Start the Node/Next server
npm run dev
