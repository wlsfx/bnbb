#!/bin/bash

# Script to run both Express and Rust backends in parallel

echo "Starting dual backend setup..."
echo "Express backend will run on port 5000"
echo "Rust backend will run on port 8000"

# Function to handle cleanup
cleanup() {
    echo "Shutting down backends..."
    kill $EXPRESS_PID $RUST_PID 2>/dev/null
    exit 0
}

# Trap signals to cleanup background processes
trap cleanup SIGINT SIGTERM

# Start Express backend
echo "Starting Express backend..."
npm run dev &
EXPRESS_PID=$!

# Wait a bit for Express to start
sleep 2

# Start Rust backend
echo "Starting Rust backend..."
cd simple_backend
cargo run &
RUST_PID=$!
cd ..

echo "Both backends are starting..."
echo "Express backend PID: $EXPRESS_PID"
echo "Rust backend PID: $RUST_PID"
echo "Press Ctrl+C to stop both backends"

# Wait for both processes
wait $EXPRESS_PID $RUST_PID