# Library Imports
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from transformers import pipeline
from flask_cors import CORS
import subprocess
import traceback
import librosa
import os

app = Flask(__name__)
CORS(app)

# ==========================================================================

# PATH Variables
model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "speech", "model"))
UPLOAD_FOLDER = "./recordings"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ==========================================================================

# .webm to .wav converter (ffmpeg)
def convert_to_wav_ffmpeg(input_path, output_path):
    """Convert input (webm) to 16kHz mono wav using ffmpeg."""
    command = [
        "ffmpeg", "-y",             # Overwrite without asking
        "-i", input_path,           # Input file
        "-ar", "16000",             # Sample rate
        "-ac", "1",                 # Mono
        output_path                 # Output .wav
    ]
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        print(f"❌ Error converting file: {result.stderr.decode()}")
        raise RuntimeError(f"ffmpeg error: {result.stderr.decode()}")

# ==========================================================================

# Routes
# @app.route('/')
# def hello():
#     return render_template("index.html")

# @app.route('/test')
# def test_audio():
#     return render_template("test_audio.html")

@app.route('/convert', methods=['POST'])
def convert():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400

        audio_file = request.files["file"]
        filename = secure_filename(audio_file.filename)
        input_path = os.path.join(UPLOAD_FOLDER, filename)
        audio_file.save(input_path)
        print(f"✅ File saved to {input_path}")

        # Convert webm to wav
        wav_path = os.path.splitext(input_path)[0] + ".wav"
        convert_to_wav_ffmpeg(input_path, wav_path)
        print(f"✅ Converted to WAV: {wav_path}")

        # Load audio with librosa
        data, samplerate = librosa.load(wav_path, sr=16000)
        print(f"✅ Loaded audio shape: {data.shape}, samplerate: {samplerate}")

        # Use the ASR pipeline
        asr = pipeline(
            "automatic-speech-recognition",
            model=model_path,
            tokenizer=model_path,
        )

        # Perform ASR
        result = asr(data)

        # Return the result
        return jsonify({"transcription": result.get("text", "")})
        # response = internalAnalyze(result.get("text", ""))
        # return jsonify({"message":"✅ Successfully get response","transcription": response})

    except Exception as e:
        print("❌ Error:", str(e))
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

def internalAnalyze(input):

    # Load Facebook Blenderbot model
    chatbot = pipeline(model="facebook/blenderbot-400M-distill")

    try:
        # Generate response from chatbot
        result = chatbot(input)[0]["generated_text"]
        print("👤 User: ", input.capitalize())
        print("⚙️ Chatbot: ",result)
        return result
    except Exception:
        return "error!"
    
@app.route('/analyzer', methods=['POST'])
def analyze():
    data = request.get_json()
    user_input = data.get("message")
    chatbot = pipeline(model="facebook/blenderbot-400M-distill")
    # conversation = Conversation(user_input)
    try:
        result = chatbot(user_input)[0]["generated_text"]
        return jsonify(result)
    # result = pipeline('sentiment-analysis')(user_input)[0]
    # return jsonify(result)
    except Exception:
        return jsonify({"error": "An error occurred while processing the request."})

# ==========================================================================

if __name__ == "__main__":
    app.run(debug=True)