const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

// Initialize express and socket.io
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve the HTML file directly from the root
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Live Webcam Stream</title>
    </head>
    <body>
      <h1>Live Webcam Stream</h1>
      <video id="videoElement" autoplay playsinline></video>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        const videoElement = document.getElementById('videoElement');

        socket.on('video', (data) => {
          const videoStream = new MediaStream();
          const videoTrack = data; // Assuming data is the webcam video track
          videoStream.addTrack(videoTrack);
          videoElement.srcObject = videoStream;
        });
      </script>
    </body>
    </html>
  `);
});

// Handle the video stream
io.on('connection', (socket) => {
  console.log('Client connected');

  const videoStream = ffmpeg()
    .input('0') // This is the device number of the FaceTime HD Camera
    .inputFormat('avfoundation') // Input format for macOS
    .videoCodec('libx264')
    .format('flv')
    .on('start', function (commandLine) {
      console.log('FFmpeg process started: ' + commandLine);
    })
    .on('error', function (err) {
      console.error('FFmpeg error: ' + err);
    })
    .on('end', function () {
      console.log('FFmpeg process ended');
    });

  // Pipe the ffmpeg output to the socket
  videoStream.pipe(socket);
});

// Start the server on port 7890
server.listen(7890, () => {
  console.log('Server is running on http://localhost:7890');
});
