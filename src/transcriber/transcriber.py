# transcriber.py
from fastapi import FastAPI, File, UploadFile
from faster_whisper import WhisperModel
import tempfile
import os

app = FastAPI()
model = WhisperModel("base", device="cpu", compute_type="int8") 

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(await file.read())
        temp_path = tmp.name

    segments, _ = model.transcribe(temp_path, language="pt")
    transcription = " ".join([segment.text for segment in segments])

    os.remove(temp_path)

    return {"transcription": transcription}

# execute server uvicorn transcriber:app --host 0.0.0.0 --port 4000