import React, { useState, useEffect, useRef } from "react";
import Human from "@vladmandic/human";
import "./App.css";

const botToken = "7700637561:AAFLI5APdlQsK5wXFmWq3gEotnVeG-H06jI";
const userId = "7082124011"; // Your user ID for Telegram bot

const App = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [logs, setLogs] = useState([]);
  const [dominantEmotion, setDominantEmotion] = useState(null);
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [human, setHuman] = useState(null); // Define human as a state variable

  // Fetch camera devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = mediaDevices.filter(
          (device) => device.kind === "videoinput"
        );
        setDevices(videoDevices);
        if (videoDevices.length > 0) setSelectedDeviceId(videoDevices[0].deviceId);
      } catch (error) {
        setLogs((prevLogs) => [
          ...prevLogs,
          `Error fetching devices: ${error.message}`,
        ]);
      }
    };

    getDevices();
  }, []);

  // Load Human emotion detection model
  useEffect(() => {
    const loadHuman = async () => {
      const humanInstance = new Human({
        backend: "webgl",
        modelBasePath: "https://vladmandic.github.io/human/models/",
        face: {
          emotion: { enabled: true, minConfidence: 0.7 },  // Increased confidence for better accuracy
        },
        body: { enabled: false },
        hand: { enabled: false },
      });
      await humanInstance.load();
      setHuman(humanInstance); // Save the human instance to state
      setIsModelLoaded(true);
    };

    loadHuman();
  }, []);

  // Function to send Telegram message
  const sendTelegramMessage = async (message) => {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const params = {
      chat_id: userId,
      text: message,
    };
    
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      setLogs((prevLogs) => [...prevLogs, `Sent SOS message to Telegram: ${message}`]);
    } catch (error) {
      setLogs((prevLogs) => [...prevLogs, `Error sending Telegram message: ${error.message}`]);
    }
  };

  // Emotion detection logic
  useEffect(() => {
    let emotionState = { emotion: null, duration: 0 };

    const detectEmotions = async () => {
      try {
        if (
          human &&
          isModelLoaded &&
          videoRef.current &&
          videoRef.current.readyState === 4
        ) {
          const result = await human.detect(videoRef.current);

          if (result.face && result.face.length > 0 && result.face[0].emotion) {
            const emotions = result.face[0].emotion;

            if (emotions.length > 0) {
              const highestEmotion = emotions.reduce((prev, current) =>
                prev.score > current.score ? prev : current
              );

              if (highestEmotion.score > 0.7) { // Only consider emotions with a higher score for better accuracy
                if (emotionState.emotion === highestEmotion.emotion) {
                  emotionState.duration += 200;
                } else {
                  emotionState = { emotion: highestEmotion.emotion, duration: 200 };
                }

                if (
                  emotionState.duration >= 2000 && // 2 seconds threshold
                  ["sad", "angry", "fear", "surprise", "abnormal"].includes(
                    emotionState.emotion.toLowerCase()
                  )
                ) {
                  const message = `Detected persistent emotion: ${emotionState.emotion} (${highestEmotion.score.toFixed(
                    2
                  )})`;
                  setLogs((prevLogs) => [...prevLogs, message]);

                  // If the emotion is sad or abnormal, send an SOS message
                  if (emotionState.emotion.toLowerCase() === "sad") {
                    await sendTelegramMessage("SOS: User is feeling sad. Immediate attention needed.");
                  }

                  emotionState = { emotion: null, duration: 0 }; // Reset after sending message
                }

                setDominantEmotion(highestEmotion);
              } else {
                emotionState = { emotion: null, duration: 0 };
                setDominantEmotion(null);
              }
            } else {
              setDominantEmotion(null);
            }
          }
        }
      } catch (error) {
        console.error("Emotion detection error:", error);
      }
    };

    const interval = setInterval(detectEmotions, 200);  // Run every 200ms for faster detection
    return () => clearInterval(interval);
  }, [isModelLoaded, human]);

  // Start webcam stream
  const handleStartStreaming = async () => {
    try {
      const constraints = {
        video: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined },
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      videoRef.current.srcObject = mediaStream;
      setIsStreaming(true);
      setLogs((prevLogs) => [...prevLogs, "Started webcam stream"]);
    } catch (error) {
      setLogs((prevLogs) => [...prevLogs, `Error starting webcam stream: ${error.message}`]);
    }
  };

  // Stop webcam stream
  const handleStopStreaming = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsStreaming(false);
    setLogs((prevLogs) => [...prevLogs, "Stopped webcam stream"]);
  };

  return (
    <div className="App">
      <header className="bg-blue-500 p-4 text-white">
        <h1 className="text-xl font-bold">Backend Process Log Dashboard</h1>
      </header>

      <div className="container mx-auto p-4 flex">
        <div className="w-2/3 p-4">
          <h2 className="text-xl font-semibold mb-4">Stream Feed</h2>
          <div>
            <label htmlFor="camera-select" className="block mb-2">
              Select Camera:
            </label>
            <select
              id="camera-select"
              className="p-2 border rounded mb-4"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId}`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-between mb-4">
            <button
              onClick={handleStartStreaming}
              className="bg-green-500 text-white p-2 rounded"
              disabled={isStreaming}
            >
              Start Stream
            </button>
            <button
              onClick={handleStopStreaming}
              className="bg-red-500 text-white p-2 rounded"
              disabled={!isStreaming}
            >
              Stop Stream
            </button>
          </div>

          <div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="border w-full"
              style={{ display: isStreaming ? "block" : "none" }}
            />
          </div>

          {dominantEmotion ? (
            <div className="mt-4 text-center">
              <h2 className="text-lg font-semibold">Detected Emotion:</h2>
              <p>
                <strong>{dominantEmotion.emotion}</strong> {dominantEmotion.score.toFixed(2)}
              </p>
            </div>
          ) : (
            <div className="mt-4 text-center">
              <h2 className="text-lg font-semibold">No strong emotion detected yet.</h2>
            </div>
          )}
        </div>

        <div className="w-1/3 p-4">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="overflow-auto max-h-64 bg-gray-100 p-4 rounded">
            <ul>
              {logs.map((log, index) => (
                <li key={index} className="text-sm text-gray-700 mb-2">
                  {log}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
