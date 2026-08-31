import os
import json
from flask import Flask, request, jsonify
import google.generativeai as genai
from PIL import Image

app = Flask(__name__)

# Configure API key safely from environment
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Using gemini-1.5-pro for superior reasoning capabilities as requested
generation_config = {
    "temperature": 0.1,
    "top_p": 0.95,
    "top_k": 64,
    "max_output_tokens": 1024,
    "response_mime_type": "application/json",
}
model = genai.GenerativeModel(
    model_name="gemini-1.5-pro",
    generation_config=generation_config
)

@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        # Load image directly into memory for Gemini
        img = Image.open(file.stream)
        
        prompt = """
        You are an expert geolocation AI. Analyze this image and meticulously determine where it was taken.
        Look for direct and indirect evidence:
        1. Text/OCR (street names, signs, shops, license plates, languages)
        2. Landmarks, buildings, and architectural styles
        3. Geography and Environment (roads, weather, vegetation, mountains, terrain)
        4. Cultural clues (language, driving side, brands, public transport)
        
        CRITICAL RULES:
        - If this is a selfie/portrait, DO NOT just say "person detected". Ignore the person and focus entirely on background clues.
        - If the image is a generic indoor room, a random unidentifiable forest, blurry, or lacks distinctive geographic clues, set "location_found" to false, give a low confidence score (< 40), and leave coordinates null. Do not guess wildly.
        - You MUST output ONLY valid JSON using the exact schema below.

        JSON SCHEMA:
        {
            "location_found": boolean,
            "place_name": "Name of specific place, landmark, or specific street",
            "city": "City name",
            "country": "Country name",
            "latitude": float (or null if location_found is false),
            "longitude": float (or null if location_found is false),
            "confidence": integer from 0 to 100,
            "reasoning": ["Detailed reason 1", "Detailed reason 2"],
            "visual_clues": ["clue 1", "clue 2"],
            "extracted_text": ["text 1", "text 2"],
            "alternative_locations": [{"place_name": "City/Place name", "confidence": integer}]
        }
        """

        response = model.generate_content([prompt, img])
        
        # Parse the JSON strictly
        result_text = response.text.strip()
        
        # Handle cases where model might inject markdown blocks despite JSON mime type
        if result_text.startswith("```json"):
            result_text = result_text[7:-3].strip()
        elif result_text.startswith("```"):
            result_text = result_text[3:-3].strip()

        data = json.loads(result_text)
        return jsonify(data), 200

    except json.JSONDecodeError:
        return jsonify({"error": "AI failed to return valid structured data. Please try again."}), 500
    except Exception as e:
        # Prevent leaking stack traces/internal errors to the client
        print(f"Internal error: {str(e)}") 
        return jsonify({"error": "Unable to analyze the image right now. Please try again."}), 500

# Vercel requires the app variable to be exposed
if __name__ == '__main__':
    app.run(debug=True)
