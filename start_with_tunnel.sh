#!/bin/bash
echo "=========================================================="
echo " Starting Nifty Dashboard and Exposing Public Tunnel...   "
echo "=========================================================="

# Check if port 8000 is already in use, kill it if so
PID=$(lsof -t -i:8000)
if [ ! -z "$PID" ]; then
    echo "Port 8000 in use by PID $PID. Terminating..."
    kill -9 $PID
    sleep 1
fi

# Start FastAPI server in background, log to server.log
echo "Starting FastAPI server..."
python3 app.py > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    echo "✓ Server started successfully (PID: $SERVER_PID)"
else
    echo "✗ Server failed to start. Check server.log"
    exit 1
fi

# Expose via localhost.run tunnel
echo ""
echo "----------------------------------------------------------"
echo "Creating public tunnel via localhost.run..."
echo "COPY AND OPEN THE HTTPS LINK SHOWN BELOW ON YOUR MOBILE:"
echo "----------------------------------------------------------"
ssh -R 80:127.0.0.1:8000 nokey@localhost.run

# Cleanup on exit
kill $SERVER_PID
