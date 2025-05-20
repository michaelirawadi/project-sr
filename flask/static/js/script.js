// MESSAGE

function sendMessage() {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (message === "") return;

  addMessage("user", message);
  input.value = "";

  // Simulate bot response
  setTimeout(async () => {
    const botReply = await getBotReply(message);
    addMessage("bot", botReply);
  }, 500);
}

function sendMessageAudio(message) {
  if (message === "") return;

  addMessage("user", message);
  // input.value = "";

  // Simulate bot response
  setTimeout(async () => {
    const botReply = await getBotReply(message);
    addMessage("bot", botReply);
  }, 500);
}

function addMessage(sender, text) {
  const chatBox = document.getElementById("chat-box");
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender);
  messageDiv.textContent = text;
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function getBotReply(userInput) {
  try {
    const response = await fetch("http://localhost:5000/analyzer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: userInput }),
    });

    const data = await response.json();
    // return `Sentiment: ${data.label} (Confidence: ${(data.score * 100).toFixed(
    //   2
    // )}%)`;
    return `${data}`;
  } catch (error) {
    return "Error connecting to sentiment analysis server.";
  }
}

// python -c "from transformers import pipeline; print(pipeline('sentiment-analysis')('hugging face is the best'))

// ==============================================================================

// AUDIO

const mic_btn = document.querySelector("#mic");
const playback = document.querySelector(".playback");

mic_btn.addEventListener("click", ToggleMic);

// Variables (State)
let can_record = false;
let is_recording = false;

// Variables (Library Objects)
let recorder = null;

// Variables (Audio)
let audioBlob = null;
let chunks = [];

// Check browser media support
function setupAudio() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(SetupStream)
      .catch(function (err) {
        console.log("Error: " + err);
      });
  } else {
    console.log("Microphone is not supported in this browser");
  }
}
setupAudio();

// Prepare audio record
function SetupStream(stream) {
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm; codecs=opus",
    });
  } catch (e) {
    console.error("MediaRecorder creation failed:", e);
    return;
  }

  // Add audio chunks
  recorder.ondataavailable = (e) => {
    console.log("Data chunk received:", e.data.size, "bytes");
    chunks.push(e.data);
  };

  // Stop recording
  recorder.onstop = async (e) => {
    audioBlob = new Blob(chunks, { type: "audio/webm; codecs=opus" });
    console.log("Recorded Blob size:", audioBlob.size, "bytes");
    chunks = [];
    const audioUrl = window.URL.createObjectURL(audioBlob);
    playback.src = audioUrl;
    playback.play().catch((err) => {
      console.log("Playback failed:", err);
    });
    // setTimeout(() => {
    //   const audioUrl = window.URL.createObjectURL(audioBlob);
    //   playback.src = audioUrl;
    //   playback.play().catch((err) => {
    //     console.log("Playback failed:", err);
    //   });
    // }, 100);

    // Prepare audio upload
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    // Fetch from backend (flask)
    try {
      const response = await fetch("/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        console.error("Server responded with error", response.status);
        return;
      }

      const data = await response.json();
      console.log("Transcription:", data.transcription);
      sendMessageAudio(
        data.transcription.charAt(0).toUpperCase() +
          data.transcription.substr(1).toLowerCase()
      );
    } catch (err) {
      console.error("Fetch failed:", err);
    }
  };

  can_record = true;
  console.log("Audio ready to record");
}

// Toggle on/off recording
async function ToggleMic() {
  if (!can_record) return;

  is_recording = !is_recording;

  if (is_recording) {
    mic_btn.classList.add("is-recording");
    chunks = [];
    recorder.start();
  } else {
    mic_btn.classList.remove("is-recording");
    recorder.stop();
  }
}
