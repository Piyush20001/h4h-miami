"""Gemma 4 via the Gemini API (Hack for Humanity: Best Use of Gemma 4)."""
import os
import sys
import time

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types

load_dotenv()

# Gemma 4 models on the Gemini API: gemma-4-31b-it, gemma-4-26b-a4b-it
MODEL = os.getenv("GEMMA_MODEL", "gemma-4-31b-it")
FALLBACK_MODEL = "gemma-4-26b-a4b-it"  # used if the 31B endpoint errors

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def ask(prompt: str, image_path: str | None = None) -> str:
    """Send a text prompt, optionally with an image, to Gemma 4."""
    contents: list = [prompt]
    if image_path:
        mime = "image/png" if image_path.lower().endswith(".png") else "image/jpeg"
        with open(image_path, "rb") as f:
            contents.insert(0, types.Part.from_bytes(data=f.read(), mime_type=mime))
    for attempt in range(3):
        try:
            return client.models.generate_content(model=MODEL, contents=contents).text
        except errors.ServerError:
            time.sleep(attempt + 1)
    return client.models.generate_content(model=FALLBACK_MODEL, contents=contents).text


if __name__ == "__main__":
    # Usage: python gemma.py "your prompt" [path/to/image.jpg]
    prompt = sys.argv[1] if len(sys.argv) > 1 else "In one sentence, what is Miami's biggest climate risk?"
    image = sys.argv[2] if len(sys.argv) > 2 else None
    print(f"[{MODEL}]")
    print(ask(prompt, image))
