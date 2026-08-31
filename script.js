document.addEventListener('DOMContentLoaded', () => {
    const uploadBox = document.getElementById('upload-section');
    const imageInput = document.getElementById('image-input');
    const uploadContent = document.getElementById('upload-content');
    const imagePreview = document.getElementById('image-preview');
    const analyzeBtn = document.getElementById('analyze-btn');
    const errorMessage = document.getElementById('error-message');
    const loadingState = document.getElementById('loading-state');
    const loadingText = document.getElementById('loading-text');
    const resultSection = document.getElementById('result-section');
    const successResult = document.getElementById('success-result');
    const lowConfidenceResult = document.getElementById('low-confidence-result');
    const alternativesSection = document.getElementById('alternatives-section');
    const copyBtn = document.getElementById('btn-copy');

    let selectedFile = null;

    // --- Upload Handlers ---
    uploadBox.addEventListener('click', () => imageInput.click());

    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dragover');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    imageInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        hideError();
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showError("Please upload a JPG, PNG, JPEG or WEBP image.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showError("Please upload a smaller image (under 5MB).");
            return;
        }

        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.classList.remove('hidden');
            uploadContent.classList.add('hidden');
            analyzeBtn.classList.remove('hidden');
            resultSection.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    // --- Analyze API Call ---
    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            showError("Please upload an image first.");
            return;
        }

        const formData = new FormData();
        formData.append('image', selectedFile);

        // UI Updates
        analyzeBtn.classList.add('hidden');
        hideError();
        resultSection.classList.add('hidden');
        loadingState.classList.remove('hidden');

        // Simulate progress text
        const stages = [
            "Examining image...",
            "Reading visible text...",
            "Looking for landmarks...",
            "Analyzing background...",
            "Estimating location..."
        ];
        let stageIdx = 0;
        const stageInterval = setInterval(() => {
            stageIdx = (stageIdx + 1) % stages.length;
            loadingText.innerText = stages[stageIdx];
        }, 2000);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            clearInterval(stageInterval);
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Unable to analyze the image right now. Please try again.");
            }

            const data = await response.json();
            displayResults(data);
        } catch (error) {
            clearInterval(stageInterval);
            showError(error.message);
            analyzeBtn.classList.remove('hidden');
        } finally {
            loadingState.classList.add('hidden');
            loadingText.innerText = "Analyzing image...";
        }
    });

    // --- Display Results ---
    function displayResults(data) {
        resultSection.classList.remove('hidden');
        successResult.classList.add('hidden');
        lowConfidenceResult.classList.add('hidden');
        alternativesSection.classList.add('hidden');

        if (!data.location_found || data.confidence < 40) {
            lowConfidenceResult.classList.remove('hidden');
            document.getElementById('low-conf-val').innerText = `${data.confidence || 0}%`;
            analyzeBtn.classList.remove('hidden');
            return;
        }

        // High Confidence Setup
        successResult.classList.remove('hidden');
        document.getElementById('res-place').innerText = data.place_name || "Unknown Place";
        
        const locParts = [data.city, data.country].filter(Boolean);
        document.getElementById('res-city-country').innerText = locParts.join(', ');

        const lat = data.latitude?.toFixed(5);
        const lng = data.longitude?.toFixed(5);
        document.getElementById('res-coords').innerText = lat && lng ? `${lat}, ${lng}` : "N/A";
        document.getElementById('res-confidence').innerText = `${data.confidence}%`;

        // Reasoning
        const reasoningList = document.getElementById('res-reasoning');
        reasoningList.innerHTML = '';
        if (data.reasoning && data.reasoning.length > 0) {
            data.reasoning.forEach(r => {
                const li = document.createElement('li');
                li.innerText = r;
                reasoningList.appendChild(li);
            });
        }

        // Clues
        const cluesDiv = document.getElementById('res-clues');
        cluesDiv.innerHTML = '';
        const allClues = [...(data.visual_clues || []), ...(data.extracted_text || [])];
        allClues.forEach(clue => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.innerText = clue;
            cluesDiv.appendChild(span);
        });

        // Google Maps Button
        const mapsBtn = document.getElementById('btn-maps');
        if (lat && lng) {
            mapsBtn.href = `https://www.google.com/maps?q=${lat},${lng}`;
            mapsBtn.classList.remove('hidden');
        } else {
            mapsBtn.classList.add('hidden');
        }

        // Copy Coordinates Button
        copyBtn.onclick = () => {
            if (lat && lng) {
                navigator.clipboard.writeText(`${lat}, ${lng}`);
                const originalText = copyBtn.innerText;
                copyBtn.innerText = "Copied!";
                setTimeout(() => copyBtn.innerText = originalText, 2000);
            }
        };

        // Alternatives
        if (data.alternative_locations && data.alternative_locations.length > 0) {
            alternativesSection.classList.remove('hidden');
            const altList = document.getElementById('res-alternatives');
            altList.innerHTML = '';
            data.alternative_locations.forEach(alt => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${alt.place_name}</span> <span>${alt.confidence}% match</span>`;
                altList.appendChild(li);
            });
        }

        analyzeBtn.classList.remove('hidden');
        analyzeBtn.innerText = "Analyze Another Image";
    }

    function showError(msg) {
        errorMessage.innerText = msg;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
    }
});
