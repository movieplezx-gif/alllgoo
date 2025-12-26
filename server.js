const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { Dropbox } = require('dropbox');

// Dropbox Config
const DBX_ACCESS_TOKEN = 'sl.u.AGOaQNBalcucHBVupTYCkNi7cbICDNGBX8tPgHOg397ojZGQ4cHmK84v4kIljRoWwrudhVahTEfRuFS1Qe3B20yPBE9rW9k05DQ4Awv91Mrw9cZAqk0-1bbJ6aI5hcJXaD5lH8Hq7XGRadqFmHK-gsxgWBADVJNksRbKSTMjY-S1rohvtP5xEkLgvNN6POe6MqXd3GBnH5vexHIzBs718m_6BmoYloO82HzxOt_6PZ9AXraCH42FPVvKWYfbOoJPGbht08xulmHS96QMPMSFCAcqT2ayK4PzLaba12F4SeZjFE3nWzkO_wuyBCCjA4z7yN99sXOkJesncwRDodleaRzxF3RcWJzhPT64d8hXgcdAsy4dAZUutCUTwwcWZfaj6PvYZd15jJLjJbc9TFvhouVgL4yfXRI6CIOOmR5MwpNb04y-gHDe9_0GFMIU30e-X5uo5O6vr0hysOtJVYycxwhiy-yMXGDefyxCG9jHP3q-qP4VNizyrmtYiaOhOK0AVqVbZJQ5uw6uopLjN3km345Yap9acARu8QA59gSf0gkWVnYi_951ed3Zk4SxS2HgV6Ev5Nk--rzZde9HM0fhjBTLqRUXff7CCpVRzd3FV7tLszYX81BfwE375gxQyY5h32-TdCHIXDnGSsZ0psP7fX6IY4VbIWVM5eLVwggzKR08TPvUxBymAit0_afr6WkB-1CeN7_pacVL8xAFbKbiJnvtx5n_dfuexXRI74v4m3_4F-LSfLEHqkzxVKC_DLTlUOvXA40kIQN9cVphJ7oVS5vt86gi8dXKgdWaEgwHMcHl__cEWZ4hnP68JL2zD6sF7ZNaAGgFf6HOpimOQz6c2hIEtWRovbG3KDv3mCOaorEZxpE8P7aAE6xSiuhTxcLnR8FjXqhIHF81pOWI4fX9yIN6vu_I-0udEfEFVG2OmIV-UYIdnXHqLQ0BftGJxy-7-9U5KslYiFE37orOCRnx3mN5W1dyXdJ5IZOajVP0PRyBP2if9YVvSUrnp_MoPq-shYE1pD2UTfCINcgvyaoKCvVplhU8ltjTaUwaQ-8w16WI98qNW4jb3KbAkYOr4Ru7VoFQXIAfNso3fFauPZ8MeVPjlv2ILs_v_0TfEwdVAHS5Pjn-VpYKaGwF--4ufs5vZVl4AAtYyUnjQacDdSu2sy7Y_19w0xZyblI_Mre8lKNXBJGcxS-XDa-eVb3ADmelddykQN-NrX1NgkzMoL9SEP0zRbSWXzXSpXzLde0geSOLKTiAwwowhlh7XwzhpmO8LMFXu4kPspAS7gRqrMRKERKH564l8d0_Fh1zH-my2ehVIM5sIi9p6hIr2hbWA-g6ARCrIwpEyBG8bBu1Uvceki1JFfP9-8XN4UtmHg5kIv9zwmtoHIA1JVFC_qkT7w1256INtywWT9nekgOPg8C6GDXb';


// Setup
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend static files if present
// Serve current directory for specific files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/app.js', (req, res) => res.sendFile(path.join(__dirname, 'app.js')));

// FFmpeg setup
ffmpeg.setFfmpegPath(ffmpegPath);

// Routes

// 1. CORS Proxy (Fixed relative path usage in app.js)
app.get('/api/cors-proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url param');

    try {
        console.log(`Proxying: ${url}`);
        const response = await axios.get(url, { responseType: 'stream' });

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Content-Type', response.headers['content-type']);
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).send(`Proxy Error: ${error.message}`);
    }
});

// 2. Video Process API
// 2. Video Process API (Async + Direct Webhook)
// Helper function for processing
async function processVideoJob(videoUrl, logoUrl) {
    const tempDir = os.tmpdir();
    const inputVideoPath = path.join(tempDir, `input_${Date.now()}.mp4`);
    const outputVideoPath = path.join(tempDir, `output_${Date.now()}.mp4`);
    const logoInputPath = path.join(tempDir, `logo_${Date.now()}.mp4`);

    try {
        console.log('Job: Starting download...');

        // Download Video
        const writer = fs.createWriteStream(inputVideoPath);
        const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Download Logo
        let finalLogoUrl = logoUrl;
        if (finalLogoUrl.includes('dropbox.com') && !finalLogoUrl.includes('dl=1')) {
            finalLogoUrl = finalLogoUrl.replace('dl=0', 'dl=1');
            if (!finalLogoUrl.includes('dl=1')) finalLogoUrl += '?dl=1';
        }

        const logoWriter = fs.createWriteStream(logoInputPath);
        const logoResponse = await axios({
            url: finalLogoUrl, method: 'GET', responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        logoResponse.data.pipe(logoWriter);

        await new Promise((resolve, reject) => {
            logoWriter.on('finish', resolve);
            logoWriter.on('error', reject);
        });

        console.log('Job: Downloads complete. Processing with FFMPEG...');

        console.log('Job: Processing with FFMPEG...');
        await new Promise((resolve, reject) => {
            ffmpeg(inputVideoPath)
                .input(logoInputPath)
                .inputOptions(['-stream_loop', '-1'])
                .complexFilter([
                    '[1:v][0:v]scale2ref=iw*0.75:-1[scaled_logo][video_ref]',
                    '[scaled_logo]colorkey=0x0000FF:0.3:0.2[transparent_logo]',
                    '[video_ref][transparent_logo]overlay=W-w-10:H-h-10:shortest=1[out]'
                ])
                .outputOptions([
                    '-map [out]', '-map 0:a?',
                    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p'
                ])
                .output(outputVideoPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        console.log('Job: Uploading to Dropbox...');
        const filename = `processed_render_${Date.now()}.mp4`;
        const dropboxPath = `/${filename}`;

        const dbx = new Dropbox({ accessToken: DBX_ACCESS_TOKEN });
        const fileContent = fs.readFileSync(outputVideoPath);

        await dbx.filesUpload({
            path: dropboxPath,
            contents: fileContent,
            mode: 'overwrite'
        });

        console.log('Job: Generating shared link...');
        const linkResponse = await dbx.sharingCreateSharedLinkWithSettings({
            path: dropboxPath
        });

        let sharedLink = linkResponse.result.url;
        sharedLink = sharedLink.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');

        // Cleanup
        try {
            fs.unlinkSync(inputVideoPath);
            fs.unlinkSync(outputVideoPath);
            if (fs.existsSync(logoInputPath)) fs.unlinkSync(logoInputPath);
        } catch (e) { }

        return {
            status: 'success',
            url: sharedLink,
            filename: filename,
            originalVideoUrl: videoUrl
        };

    } catch (error) {
        // Cleanup on error
        try {
            if (fs.existsSync(inputVideoPath)) fs.unlinkSync(inputVideoPath);
            if (fs.existsSync(outputVideoPath)) fs.unlinkSync(outputVideoPath);
            if (fs.existsSync(logoInputPath)) fs.unlinkSync(logoInputPath);
        } catch (e) { }

        throw error;
    }
}

// 2. Video Process API (Supports Sync & Async)
app.post('/api/process', async (req, res) => {
    console.log('Incoming Request Body:', req.body);
    const { videoUrl, logoUrl, webhookUrl, sync } = req.body;

    const TARGET_WEBHOOK = webhookUrl || 'https://hook.eu2.make.com/m3ysr965p26x7qrs9qaj1c2logiqbpn2';

    if (!videoUrl || !logoUrl) {
        return res.status(400).json({ status: 'error', message: 'Missing videoUrl or logoUrl' });
    }

    // --- SYNCHRONOUS MODE ---
    if (sync === true || sync === 'true') {
        console.log('Mode: SYNCHRONOUS. Waiting for job to complete...');
        // Keep connection open and wait
        try {
            const result = await processVideoJob(videoUrl, logoUrl);
            console.log('Sync Job Done. Sending response...');
            return res.json(result);
        } catch (error) {
            console.error('Sync Job Failed:', error.message);
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    // --- ASYNCHRONOUS MODE (Default) ---
    console.log('Mode: ASYNC. Responding immediately...');
    res.status(202).json({
        status: 'accepted',
        message: 'Processing started in background. Result will be sent to webhook.',
        webhookTarget: TARGET_WEBHOOK
    });

    // Run in background
    (async () => {
        try {
            const result = await processVideoJob(videoUrl, logoUrl);

            console.log(`Async Job Done. Sending webhook to ${TARGET_WEBHOOK}...`);
            await axios.post(TARGET_WEBHOOK, result);
            console.log('Webhook Sent Successfully!');

        } catch (error) {
            console.error('Async Job Failed:', error.message);
            try {
                await axios.post(TARGET_WEBHOOK, {
                    status: 'error',
                    message: error.message
                });
            } catch (e) { console.error('Failed to send error webhook'); }
        }
    })();
});

const multer = require('multer');
const upload = multer({ dest: os.tmpdir() });

const FormData = require('form-data');



// 3. File Upload API (Dropbox Upload)
app.post('/api/upload-file', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No file uploaded' });
        }

        const inputPath = req.file.path;
        const filename = `processed_video_${Date.now()}.webm`;
        const dropboxPath = `/${filename}`;

        console.log(`Processing file upload: ${filename}`);

        // Upload to Dropbox
        const dbx = new Dropbox({ accessToken: DBX_ACCESS_TOKEN });
        const fileContent = fs.readFileSync(inputPath);

        console.log('Uploading to Dropbox...');
        await dbx.filesUpload({
            path: dropboxPath,
            contents: fileContent,
            mode: 'overwrite'
        });

        console.log('Generating shared link...');
        const linkResponse = await dbx.sharingCreateSharedLinkWithSettings({
            path: dropboxPath
        });

        let sharedLink = linkResponse.result.url;
        // Convert to direct link
        sharedLink = sharedLink.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');

        console.log('Dropbox Link:', sharedLink);

        // Cleanup
        try { fs.unlinkSync(inputPath); } catch (e) { }

        // Return success with link
        res.json({
            status: 'success',
            message: 'Video uploaded to Dropbox!',
            url: sharedLink,
            filename: filename
        });

    } catch (error) {
        console.error('Upload Error:', error.message);
        // Cleanup on error
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
        }
        res.status(500).json({ status: 'error', message: 'Dropbox Upload Failed: ' + error.message });
    }
});


// 4. Webhook Trigger API
app.post('/api/send-webhook', async (req, res) => {
    const { videoUrl, originalName } = req.body;
    if (!videoUrl || !originalName) {
        return res.status(400).json({ status: 'error', message: 'Missing videoUrl or originalName' });
    }

    try {
        console.log('Sending webhook to Make.com...');
        await axios.post('https://hook.eu2.make.com/m3ysr965p26x7qrs9qaj1c2logiqbpn2', {
            videoUrl,
            originalName
        });
        console.log('Webhook sent successfully.');
        res.json({ status: 'success', message: 'Webhook triggered' });
    } catch (error) {
        console.error('Webhook failed:', error.message);
        // We return success to the client because the video is safe, but warn about webhook
        res.status(500).json({ status: 'error', message: 'Webhook failed: ' + error.message });
    }
});

// Global Error Handler to ensure JSON response
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ status: 'error', message: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

