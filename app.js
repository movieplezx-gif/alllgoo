// DOM Elements
const videoUrlInput = document.getElementById('videoUrl');
const videoFileInput = document.getElementById('videoFile');
// const dropboxTokenInput = document.getElementById('dropboxToken'); // Removed
const processBtn = document.getElementById('processBtn');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const progressBarContainer = document.querySelector('.progress-bar-container');
const resultArea = document.getElementById('resultArea');
const shareLinkInput = document.getElementById('shareLink');
const copyBtn = document.getElementById('copyBtn');
const sourceVideo = document.getElementById('sourceVideo');
const logoVideo = document.getElementById('logoVideo');

// Config
const DROPBOX_TOKEN = 'sl.u.AGPyD4FkqMfFB12xKMElVDQrMMVMPs31IJjFdzHDrwBYKpNfS0xXSjk8T7TUAik3svybvnXYgpmNWKZc44TiYk48tLzC4ik29xr0NzHE0rJ7mvVrtUtE7TjtTYuo_JAhChjdGRyWW1l2XRj4ueKY7zWGDuhIJOCNmt5TBv2rwElca3PmZi3hpB0QKU23uyqV_I-Szgex_tlKCOYn8keJxjSIjP2VuI14O5bikPoOoSzCm5t-YLvZKpbGxD-RUu5kte0yVD9VKrjU3oLw-Xcb0qs0NibdfNDY1GhDEC-b7S0fTtib0f3QByxDpioYcYwCCsG7pn163ONXcG9juUezAY88OO_uQCxKW9HYLJ0m6h6w4SGY-s_o5canTAP7mBl0-NuN3HlTMGSua7VHpJ6inatAL7wcJEAgDlqRFL-uWxFY7jbTs6EF0glf0MTK7RNJEv9hPeqo11wbxP_Kpoc-s2l3fZljZdSeY7VfXeeI-g7t1-k1wiAm2olMXz5JaZUNhLJQvh5o5msTpPyV7xMNBcevGkK1sgDsJwAFtBDeELIJRuPCES2EPrJS1zxGCwc2pEmAcPeeSjzFXlBFbxUgYzYk9Y_l-NLYOJ4BgEUhbrlO5yvudiGka97d-wsc0DRi6acJzFaJOULx9VxNgeEopCARUJBCoLt6m0kWnzM-mnAk9eu8hwYcTvH5E5GGDMtWFPGyAGSMfVHFYZdV30FAyPgrkQI_nYK_naP4sDb546d3ESlUodMB13Uv__ql7mqk9GEpX3sfIG9qGJfy4M8tehmgRGyO0ulut6FkECC6FKFf0bZvFxB01FwwmHfTo8y4idEw5xWqTzsvIfDSPy70E4NYfawB5sz5A6HD9xArqsJ0mBsCjGIbay97c4EM-I0ooxAaz3-eeJbaQWvyL_2qFwZYst9cyE64dwI0ChlSg-ym6s5_IFouXizhOmaoaRhhC-81WBppTZz56mE34B37ayMKvKUr2ZurT3TG_VNGo0ZW9x5lCPai-65h0rdhaeDMeEM8ITZIShgftObAu9NNgUK_JXE69iFiKmwVGAY4jkn2hVtby_c5GI93Loz4xQCTbTSq7MGJasfvVkWkeN3s_gRV7jvQ3Jfrmm2_FiiuFPN1KSRzHsh8lp7a3j3y_47lanh0xohMj7AqBQK1QKjfJpKTCokmqdS-KIhRroyHWnh7Xd7jv5k2_4hvPQVqncTtgIPIO2gTL9hK3q5ET7Vl4-32LOiHFnLOSWxbkgHBzGmEcPHuu_aqZhwGs_gYJJzqN1lSSj8p8cCsxpNsSHZjXNqUZHlsr-KUF5O6xOcJSzYKLmFyqio0qHvHbupU62BxbeiKKc9dwaU5xHghR4hW5A731HycK2uXeOhtRGlZ1aWOujcVtZgiFgoWsCuSc2xGTl4ByRg9fQOi2ra-l--r0-p1';

// State
let isProcessing = false;
let mediaRecorder;
let recordedChunks = [];

// Constants
const DESIRED_WIDTH = 1280; // Standard HD output
const DESIRED_HEIGHT = 720;

// Event Listeners
processBtn.addEventListener('click', startProcessing);
videoFileInput.addEventListener('change', handleFileUpload);
copyBtn.addEventListener('click', () => {
    shareLinkInput.select();
    document.execCommand('copy');
    copyBtn.innerText = 'Copied!';
    setTimeout(() => copyBtn.innerText = 'Copy', 2000);
});

// Webhook UI Removed
// const webhookBtn = document.getElementById('webhookBtn');
// webhookBtn.addEventListener('click', sendWebhook);

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        videoUrlInput.value = url; // Use the blob URL
    }
}

async function startProcessing() {
    if (isProcessing) return;

    const videoSrc = videoUrlInput.value.trim();

    if (!videoSrc) {
        alert('Please provide a video URL or upload a file.');
        return;
    }

    // Reset UI
    isProcessing = true;
    processBtn.disabled = true;
    processBtn.querySelector('.loader').classList.remove('hidden');
    processBtn.querySelector('.btn-text').innerText = 'Processing...';
    statusEl.innerText = 'Initializing...';
    resultArea.classList.add('hidden');

    progressBarContainer.classList.remove('hidden');
    progressBar.style.width = '0%';

    try {
        await prepareVideos(videoSrc);
        await processAndRecord(DROPBOX_TOKEN);
    } catch (err) {
        console.error(err);
        statusEl.innerText = `Error: ${err.message}`;
        isProcessing = false;
        processBtn.disabled = false;
        processBtn.querySelector('.loader').classList.add('hidden');
        processBtn.querySelector('.btn-text').innerText = 'Process & Upload';
    }
}

async function prepareVideos(src) {
    statusEl.innerText = 'Loading resources...';

    // Set video sources
    // Add timeout to prevent hanging forever
    const loadVideo = async (url) => {
        return new Promise((resolve, reject) => {
            sourceVideo.src = url;
            const cleanup = () => {
                sourceVideo.onloadedmetadata = null;
                sourceVideo.onerror = null;
            };
            sourceVideo.onloadedmetadata = () => {
                cleanup();
                resolve();
            };
            sourceVideo.onerror = (e) => {
                cleanup();
                const code = sourceVideo.error ? sourceVideo.error.code : 'Unknown';
                reject(new Error(`Failed to load. Code: ${code}`));
            };
        });
    };

    try {
        console.log('Attempting direct load...');
        await Promise.race([
            loadVideo(src),
            new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 10000))
        ]);
    } catch (err) {
        console.warn('Direct load failed. Trying public CORS proxy...', err);

        // If it's a blob URL, we shouldn't proxy, it's a codec or local issue.
        if (src.startsWith('blob:')) {
            throw new Error('Failed to load uploaded file. The video format might not be supported by your browser.');
        }

        // Use /api/cors-proxy which handles the streaming
        const isLiveServer = window.location.port === '5500' || window.location.port === '5501';
        const API_BASE = isLiveServer ? `http://${window.location.hostname}:3000` : '';
        const proxyUrl = `${API_BASE}/api/cors-proxy?url=${encodeURIComponent(src)}`;

        try {
            await Promise.race([
                loadVideo(proxyUrl),
                new Promise((_, r) => setTimeout(() => r(new Error('Proxy Timeout')), 20000))
            ]);
        } catch (proxyErr) {
            throw new Error(`Failed to load video. \n1. Link might be broken.\n2. Server blocks access.\n\nSOLUTION: Download the video to your computer and use the "Choose File" button.`);
        }
    }

    // Determine dimensions
    canvas.width = sourceVideo.videoWidth || DESIRED_WIDTH;
    canvas.height = sourceVideo.videoHeight || DESIRED_HEIGHT;

    // Load logo
    const logoPromise = new Promise((resolve, reject) => {
        if (logoVideo.readyState >= 2) {
            resolve();
            return;
        }
        logoVideo.onloadeddata = () => resolve();
        logoVideo.onerror = () => reject(new Error('Failed to load logo video.'));
    });

    // Force logo load
    logoVideo.load();
    await logoPromise;
}

async function processAndRecord(token) {
    statusEl.innerText = 'Rendering & Removing Background...';
    console.log('Starting processAndRecord...');

    // Prepare Audio
    const stream = canvas.captureStream(60); // Increase to 60 FPS for smoother playback

    // Fix: createMediaElementSource can only be called once per element.
    if (!window.audioContext) {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        window.videoSourceNode = window.audioContext.createMediaElementSource(sourceVideo);
        window.audioDestNode = window.audioContext.createMediaStreamDestination();

        window.videoSourceNode.connect(window.audioDestNode);
        // Connect to destination to hear it while processing (optional)
        window.videoSourceNode.connect(window.audioContext.destination);
    }

    // Resume context if suspended
    if (window.audioContext.state === 'suspended') {
        await window.audioContext.resume();
    }

    const mixedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...window.audioDestNode.stream.getAudioTracks()
    ]);

    // Try common mime types
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm'; // Fallback
        }
    }
    console.log(`Using mimeType: ${mimeType}`);

    // High bitrate for better quality and potentially faster encoding (less compression work)
    mediaRecorder = new MediaRecorder(mixedStream, {
        mimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps
    });

    recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.start();
    console.log('MediaRecorder started');

    try {
        await sourceVideo.play();
        await logoVideo.play();
    } catch (e) {
        throw new Error('Autoplay failed. Interaction needed? ' + e.message);
    }

    // Draw Loop
    const draw = () => {
        // Safe check if processing was stopped elsewhere
        if (!isProcessing) return;

        if (sourceVideo.paused || sourceVideo.ended) {
            console.log('Video ended or paused. Stopping recorder.');
            if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            return;
        }

        // Draw Source Video
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);

        // Draw Logo with Chroma Key
        drawLogoWithChromaKey();

        // Update progress
        if (sourceVideo.duration) {
            const progress = (sourceVideo.currentTime / sourceVideo.duration) * 100;
            progressBar.style.width = `${progress}%`;
        }

        if (!sourceVideo.ended) {
            requestAnimationFrame(draw);
        }
    };

    mediaRecorder.onstop = async () => {
        console.log('Recorder stopped. Uploading...');
        statusEl.innerText = 'Encoding complete. Uploading to Dropbox...';
        logoVideo.pause();
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        console.log(`Blob size: ${blob.size}`);
        if (blob.size === 0) {
            statusEl.innerText = 'Error: Output video is empty.';
            isProcessing = false;
            processBtn.disabled = false;
            processBtn.querySelector('.loader').classList.add('hidden');
            processBtn.querySelector('.btn-text').innerText = 'Process & Upload';
            return;
        }
        await uploadToDropbox(blob, token);
    };

    draw();
}

const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

function drawLogoWithChromaKey() {
    // 1. Calculate dimensions to maintain aspect ratio
    const logoAspect = logoVideo.videoWidth / logoVideo.videoHeight;
    // const canvasAspect = canvas.width / canvas.height;

    // Target width: 75% of the video WIDTH
    const targetWidth = canvas.width * 0.75;
    const targetHeight = targetWidth / logoAspect;

    // Position: Bottom Right (Reduced padding to 10px)
    const x = canvas.width - targetWidth - 10;
    const y = canvas.height - targetHeight - 10;

    // 2. Prepare Temp Canvas (sized to the logo patch, not full screen, for performance)
    // Actually, to keep it simple and safe with existing logic, let's resize temp canvas to the logo patch size
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;

    // Draw scaled logo to temp canvas
    tempCtx.drawImage(logoVideo, 0, 0, targetWidth, targetHeight);

    const frame = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
    const l = frame.data.length / 4;

    for (let i = 0; i < l; i++) {
        const r = frame.data[i * 4 + 0];
        const g = frame.data[i * 4 + 1];
        const b = frame.data[i * 4 + 2];

        // Simple Blue Chroma Key
        // If B is significantly larger than R and G
        if (b > 100 && b > (r + 40) && b > (g + 40)) {
            frame.data[i * 4 + 3] = 0; // Transparent
        }
    }

    tempCtx.putImageData(frame, 0, 0);

    // Draw processed logo onto main canvas at position
    ctx.drawImage(tempCanvas, x, y);
}

async function uploadToDropbox(blob, token) {
    statusEl.innerText = 'Uploading to Server & Dropbox...';

    // Create FormData to send the blob
    const formData = new FormData();
    formData.append('video', blob, `processed_video_${Date.now()}.webm`);

    // Determine API Base URL for local dev vs production
    const isLiveServer = window.location.port === '5500' || window.location.port === '5501';
    // Use the same hostname (localhost or 127.0.0.1) to avoid CORS/Network mismatches if server binds to all
    const API_BASE = isLiveServer ? `http://${window.location.hostname}:3000` : '';

    try {
        const response = await fetch(`${API_BASE}/api/upload-file`, {
            method: 'POST',
            body: formData
        });

        const responseText = await response.text();

        if (!response.ok) {
            let errorMessage = 'Server upload failed';
            try {
                const errData = JSON.parse(responseText);
                errorMessage = errData.message || errorMessage;
            } catch (jsonErr) {
                console.error('Non-JSON Error Response:', responseText);
                errorMessage = `Server Error (${response.status}): ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        const data = JSON.parse(responseText);

        if (data.status === 'success') {
            showSuccess(data.url, data.filename);
        } else {
            throw new Error(data.message || 'Unknown server error');
        }

    } catch (error) {
        console.error('Upload Error', error);
        statusEl.innerText = 'Upload failed: ' + error.message;
        alert('Upload Error: ' + error.message);

        isProcessing = false;
        processBtn.disabled = false;
        processBtn.querySelector('.loader').classList.add('hidden');
        processBtn.querySelector('.btn-text').innerText = 'Process & Upload';
    }
}

function showSuccess(link, filename) {
    isProcessing = false;
    processBtn.disabled = false;
    processBtn.querySelector('.loader').classList.add('hidden');
    processBtn.querySelector('.btn-text').innerText = 'Process & Upload';
    statusEl.innerText = 'Done!';

    shareLinkInput.value = link || 'Error: Server returned no link';
    // Store filename for webhook (if we bring it back later)
    window.lastProcessedFilename = filename;

    resultArea.classList.remove('hidden');
}
