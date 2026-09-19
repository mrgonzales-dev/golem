#!/bin/bash

fuser -k 3000/tcp 2>/dev/null
sleep 1

npm run dev > /dev/null 2>&1 &
VITE_PID=$!

echo "Waiting for Vite..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:3000 > /dev/null 2>&1; then
    echo "Vite is ready."
    break
  fi
  sleep 1
done

npm start

kill $VITE_PID 2>/dev/null
