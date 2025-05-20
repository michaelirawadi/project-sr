import React, { useState, useEffect, useRef } from "react";
import "./../styles/home-style.css";

type Message = { sender: string; text: string };

const Home: React.FC = () => {
  // State for chat messages (array of {sender, text})
  const [messages, setMessages] = useState<Message[]>([]);

  // Audio recording state
  const [canRecord, setCanRecord] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);

  const chatBoxRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // Setup audio recording on mount
  useEffect(() => {
    async function setupAudio() {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          setupStream(stream);
        } catch (err) {
          console.error("Error accessing mic:", err);
        }
      } else {
        console.log("Microphone not supported in this browser");
      }
    }

    function setupStream(stream) {
      try {
        const recorder = new MediaRecorder(stream, {
          mimeType: "audio/webm; codecs=opus",
        });

        recorder.ondataavailable = (e) => {
          console.log("Data available:", e.data.size);
          chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, {
            type: "audio/webm; codecs=opus",
          });
          audioBlobRef.current = audioBlob;
          chunksRef.current = [];

          if (playbackRef.current) {
            const audioUrl = window.URL.createObjectURL(audioBlob);
            playbackRef.current.src = audioUrl;
            playbackRef.current.load();
            playbackRef.current.oncanplaythrough = async () => {
              try {
                if (playbackRef.current) {
                  await playbackRef.current.play();
                }
              } catch (err) {
                console.log("Playback failed:", err);
              }
            };
          }

          // Upload audio blob to server for transcription
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");

          try {
            const response = await fetch("http://127.0.0.1:5000/convert", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              console.error("Server responded with error", response.status);
              return;
            }

            const data = await response.json();
            console.log("Transcription:", data.transcription);

            // Capitalize first letter of transcription
            const message =
              data.transcription.charAt(0).toUpperCase() +
              data.transcription.slice(1).toLowerCase();

            sendMessageAudio(message);
          } catch (err) {
            console.error("Fetch failed:", err);
          }
        };

        recorderRef.current = recorder;
        setCanRecord(true);
        console.log("Audio ready to record");
      } catch (e) {
        console.error("MediaRecorder creation failed:", e);
      }
    }

    setupAudio();
  }, []);

  // Handle toggling mic recording
  function toggleMic() {
    if (!canRecord) return;

    if (isRecording) {
      if (recorderRef.current) {
        recorderRef.current.requestData();
        recorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      chunksRef.current = [];
      if (recorderRef.current) {
        recorderRef.current.start();
      }
      setIsRecording(true);
    }
  }

  // Send user message (from input)
  async function sendMessage(text) {
    if (!text.trim()) return;

    // Add user message
    setMessages((msgs) => [...msgs, { sender: "user", text }]);

    // Simulate bot response
    setTimeout(async () => {
      const botReply = await getBotReply(text);
      setMessages((msgs) => [...msgs, { sender: "bot", text: botReply }]);
    }, 500);
  }

  // Send message from audio transcription
  function sendMessageAudio(text) {
    if (!text.trim()) return;

    setMessages((msgs) => [...msgs, { sender: "user", text }]);

    const loadingMessage = {
      sender: "bot",
      text: "Generating . . .",
      loading: true,
    };
    setMessages((msgs) => [...msgs, loadingMessage]);

    getBotReply(text)
      .then((botReply) => {
        setMessages((msgs) =>
          msgs.map((m) =>
            m === loadingMessage ? { sender: "bot", text: botReply } : m
          )
        );
      })
      .catch((err) => {
        setMessages((msgs) =>
          msgs.map((m) =>
            m === loadingMessage
              ? { sender: "bot", text: "Error fetching reply" }
              : m
          )
        );
        console.error("Error in getBotReply:", err);
      });

    // setTimeout(async () => {
    //   const botReply = await getBotReply(text);
    //   setMessages((msgs) => [...msgs, { sender: "bot", text: botReply }]);
    // }, 500);
  }

  // Fetch bot reply
  async function getBotReply(userInput) {
    try {
      const response = await fetch("http://localhost:5000/analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput }),
      });
      const data = await response.json();
      return `${data}`;
    } catch (error) {
      return "Error connecting to sentiment analysis server.";
    }
  }

  // For text input (optional if you want to re-add input UI)
  const [inputValue, setInputValue] = useState("");

  return (
    <div className="chat-container">
      <div
        className="chat-box"
        id="chat-box"
        style={{ textTransform: "capitalize" }}
        ref={chatBoxRef}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.sender}`}>
            {msg.text}
            {/* {msg.loading && <span className="dots"></span>} */}
          </div>
        ))}
      </div>

      <main>
        <button
          className={`mic-toggle ${isRecording ? "is-recording" : ""}`}
          id="mic"
          onClick={toggleMic}
        >
          <span className="material-icons">
            {/* <img src="./../assets/mic.png" alt="" /> */}
            mic
          </span>
        </button>

        <audio className="playback" ref={playbackRef} controls hidden />
      </main>
    </div>
  );
};

export default Home;
