// -------------------------------------------------------------------------
// APP STATE & CONFIGURATION
// -------------------------------------------------------------------------
const state = {
    currentScreen: 'screen-dashboard',
    savedBooks: [],
    currentCameraStream: null,
    useFrontCamera: false,
    selectedImageBase64: null,
    ocrProgressInterval: null,
    searchCache: {},
    activeEditingBookId: null,
    aiModelInstance: null,
    lastDetectedWords: [],
    barcodeInterval: null,
    liveOcrWorker: null,
    liveOcrInterval: null
};

// -------------------------------------------------------------------------
// DOM ELEMENTS
// -------------------------------------------------------------------------
const screens = {
    dashboard: document.getElementById('screen-dashboard'),
    camera: document.getElementById('screen-camera'),
    ocr: document.getElementById('screen-ocr'),
    results: document.getElementById('screen-results'),
    detail: document.getElementById('screen-detail')
};

// Navigation
const navHome = document.getElementById('nav-home');
const navScan = document.getElementById('nav-scan');
const navAbout = document.getElementById('nav-about');

// Dashboard Elements
const btnOpenCamera = document.getElementById('btn-open-camera');
const inputFileUpload = document.getElementById('input-file-upload');
const savedBooksCount = document.getElementById('saved-books-count');
const emptyLibraryState = document.getElementById('empty-library-state');
const savedBooksGrid = document.getElementById('saved-books-grid');
const btnExportCsv = document.getElementById('btn-export-csv');

// Camera Elements
const cameraPreview = document.getElementById('camera-preview');
const cameraCanvas = document.getElementById('camera-canvas');
const btnShutter = document.getElementById('btn-shutter');
const btnCloseCamera = document.getElementById('btn-close-camera');
const btnSwitchCamera = document.getElementById('btn-switch-camera');

// OCR Elements
const btnBackToHome = document.getElementById('btn-back-to-home');
const ocrPreviewImg = document.getElementById('ocr-preview-img');
const ocrProgressOverlay = document.getElementById('ocr-progress-overlay');
const ocrProgressText = document.getElementById('ocr-progress-text');
const ocrProgressBar = document.getElementById('ocr-progress-bar');
const ocrRawText = document.getElementById('ocr-raw-text');
const btnSearchBooks = document.getElementById('btn-search-books');

// Search Results Elements
const btnBackToOcr = document.getElementById('btn-back-to-ocr');
const searchResultsList = document.getElementById('search-results-list');
const btnManualInput = document.getElementById('btn-manual-input');

// Book Detail Form Elements
const btnBackToResults = document.getElementById('btn-back-to-results');
const bookDetailForm = document.getElementById('book-detail-form');
const detailCoverImg = document.getElementById('detail-cover-img');
const formCoverUrl = document.getElementById('form-cover-url');
const formTitle = document.getElementById('form-title');
const formAuthor = document.getElementById('form-author');
const formPublisher = document.getElementById('form-publisher');
const formIsbn = document.getElementById('form-isbn');
const formYear = document.getElementById('form-year');
const formNotes = document.getElementById('form-notes');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

// System UI
const connectionStatus = document.getElementById('connection-status');
const aiStatus = document.getElementById('ai-status');
const btnAiAnalyze = document.getElementById('btn-ai-analyze');
const btnCloudOcr = document.getElementById('btn-cloud-ocr');
const modalAbout = document.getElementById('modal-about');
const modalClose = document.querySelector('.modal-close');
const toastContainer = document.getElementById('toast-container');

// AI Configuration Elements
const selectAiProvider = document.getElementById('select-ai-provider');
const inputAiKey = document.getElementById('input-ai-key');
const btnSaveAiConfig = document.getElementById('btn-save-ai-config');
const geminiAiCard = document.getElementById('gemini-ai-card');
const geminiChatHistory = document.getElementById('gemini-chat-history');
const inputGeminiChat = document.getElementById('input-gemini-chat');
const btnSendGeminiChat = document.getElementById('btn-send-gemini-chat');

// -------------------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------------------
// Bulletproof Initialization Lifecycle
function initializeApp() {
    console.log('PustakaScan: Starting application initialization...');
    try {
        loadSavedBooks();
        const storedProvider = localStorage.getItem('pustaka_scan_ai_provider') || 'gemini';
        let storedKey = localStorage.getItem('pustaka_scan_ai_key');
        
        // Auto-migrate old Gemini key if present
        if (!storedKey) {
            storedKey = localStorage.getItem('pustaka_scan_gemini_key');
            if (storedKey) {
                localStorage.setItem('pustaka_scan_ai_key', storedKey);
                localStorage.setItem('pustaka_scan_ai_provider', 'gemini');
            }
        }
        
        selectAiProvider.value = storedProvider;
        if (storedKey) {
            inputAiKey.value = storedKey;
            console.log(`PustakaScan: AI Configuration loaded (${storedProvider}).`);
        }
    } catch (e) {
        console.error('PustakaScan: Failed to load saved books or AI configuration:', e);
    }
    
    try {
        setupEventListeners();
        console.log('PustakaScan: Event listeners registered successfully.');
    } catch (e) {
        console.error('PustakaScan: Failed to setup event listeners:', e);
    }
    
    try {
        updateNetworkStatus();
    } catch (e) {
        console.error('PustakaScan: Failed to update network status:', e);
    }
    
    try {
        registerServiceWorker();
    } catch (e) {
        console.error('PustakaScan: Failed to register Service Worker:', e);
    }
    
    try {
        checkLocalAISupport();
    } catch (e) {
        console.error('PustakaScan: Failed to check AI support:', e);
    }
    
    // Listen to network status changes
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    // Resize handler to adjust Google Lens highlights
    window.addEventListener('resize', () => {
        if (state.lastDetectedWords && state.lastDetectedWords.length > 0) {
            renderLensHighlights(state.lastDetectedWords);
        }
    });
}

// Execute immediately if DOM is already parsed, otherwise wait for DOMContentLoaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeApp();
} else {
    document.addEventListener('DOMContentLoaded', initializeApp);
}

// -------------------------------------------------------------------------
// NETWORK & STATUS HANDLERS
// -------------------------------------------------------------------------
function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    if (isOnline) {
        connectionStatus.className = 'status-badge online';
        connectionStatus.innerHTML = '<span class="dot"></span> Online';
        showToast('Terhubung ke Internet', 'success');
    } else {
        connectionStatus.className = 'status-badge offline';
        connectionStatus.innerHTML = '<span class="dot"></span> Offline';
        showToast('Mode Offline Aktif. Pencarian buku dinonaktifkan.', 'info');
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered with scope:', reg.scope))
            .catch(err => console.error('Service Worker registration failed:', err));
    }
}

function checkLocalAISupport() {
    // Transformers.js runs client-side in WebAssembly/WebGPU. It is supported on all modern browsers!
    aiStatus.className = 'status-badge online';
    aiStatus.style.background = 'rgba(168, 85, 247, 0.15)';
    aiStatus.style.borderColor = 'rgba(168, 85, 247, 0.3)';
    aiStatus.style.color = '#d8b4fe';
    aiStatus.innerHTML = '✨ AI Ready';
}

async function analyzeTextWithTransformersJS() {
    const rawText = ocrRawText.value.trim();
    if (!rawText) {
        showToast('Tolong masukkan teks cover terlebih dahulu!', 'error');
        return;
    }

    ocrProgressOverlay.classList.add('active');
    ocrProgressText.textContent = 'Menghubungi AI Lokal (Transformers.js)...';
    ocrProgressBar.style.width = '5%';

    try {
        // Disable local model paths to ensure CDN download
        transformers.env.allowLocalModels = false;
        
        // Cache the pipeline in state.aiModelInstance so it loads instantly on next runs!
        if (!state.aiModelInstance) {
            ocrProgressText.textContent = 'Mengunduh Model AI Ringan (~140MB, Sekali saja)...';
            state.aiModelInstance = await transformers.pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-78M', {
                progress_callback: (data) => {
                    if (data.status === 'progress') {
                        const percentage = Math.round(data.progress);
                        ocrProgressBar.style.width = `${percentage}%`;
                        ocrProgressText.textContent = `Mengunduh Model AI Lokal... (${percentage}%)`;
                    } else if (data.status === 'ready') {
                        ocrProgressText.textContent = 'Mempersiapkan Model AI...';
                    }
                }
            });
        }

        ocrProgressText.textContent = 'AI sedang memproses teks cover...';
        ocrProgressBar.style.width = '80%';

        const prompt = `Task: Extract book details (title, author, publisher, isbn, year) from raw OCR text: "${rawText}"
Format the output strictly as a JSON object:
{
  "title": "Title of the book",
  "author": "Author name",
  "publisher": "Publisher name",
  "isbn": "ISBN number",
  "year": "Year of publication"
}
`;

        const output = await state.aiModelInstance(prompt, {
            max_new_tokens: 150,
            temperature: 0.1,
            repetition_penalty: 1.2
        });

        const result = output[0].generated_text;
        ocrProgressBar.style.width = '100%';
        ocrProgressOverlay.classList.remove('active');

        // Parse JSON output
        let parsedBook = {};
        try {
            const cleanResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedBook = JSON.parse(cleanResult);
        } catch (e) {
            console.warn('Failed parsing output directly as JSON, using regex extraction:', result);
            parsedBook = {
                title: extractFallbackPattern(result, 'title') || '',
                author: extractFallbackPattern(result, 'author') || '',
                publisher: extractFallbackPattern(result, 'publisher') || '',
                isbn: extractFallbackPattern(result, 'isbn') || '',
                year: extractFallbackPattern(result, 'year') || ''
            };
        }

        openDetailForm({
            title: parsedBook.title || '',
            author: parsedBook.author || '',
            publisher: parsedBook.publisher || '',
            isbn: parsedBook.isbn || '',
            year: parsedBook.year || '',
            coverUrl: ''
        });

        showToast('AI berhasil mengekstrak informasi buku!', 'success');

    } catch (err) {
        console.error('Transformers.js run error:', err);
        ocrProgressOverlay.classList.remove('active');
        showToast('Gagal memproses dengan AI lokal.', 'error');
    }
}

function extractFallbackPattern(text, field) {
    try {
        const regex = new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`, 'i');
        const match = text.match(regex);
        return match ? match[1] : '';
    } catch(e) {
        return '';
    }
}

function renderLensHighlights(words) {
    const overlay = document.getElementById('lens-highlights-overlay');
    if (!overlay) return;
    
    overlay.innerHTML = ''; // Clear previous highlights
    
    const img = document.getElementById('ocr-preview-img');
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    
    const rect = img.getBoundingClientRect();
    
    // Aspect ratio calculation for object-fit: contain
    const imgRatio = naturalWidth / naturalHeight;
    const containerRatio = rect.width / rect.height;
    
    let renderedWidth, renderedHeight, leftOffset, topOffset;
    if (imgRatio > containerRatio) {
        renderedWidth = rect.width;
        renderedHeight = rect.width / imgRatio;
        leftOffset = 0;
        topOffset = (rect.height - renderedHeight) / 2;
    } else {
        renderedHeight = rect.height;
        renderedWidth = rect.height * imgRatio;
        leftOffset = (rect.width - renderedWidth) / 2;
        topOffset = 0;
    }
    
    const scaleX = renderedWidth / naturalWidth;
    const scaleY = renderedHeight / naturalHeight;

    words.forEach(word => {
        // Sanitize and only render words with good confidence or reasonable length
        const cleanedText = sanitizeOCRText(word.text);
        if (word.confidence < 45 || cleanedText.length < 2) return;

        const box = document.createElement('div');
        box.className = 'lens-box';
        
        const x = word.bbox.x0 * scaleX + leftOffset;
        const y = word.bbox.y0 * scaleY + topOffset;
        const w = (word.bbox.x1 - word.bbox.x0) * scaleX;
        const h = (word.bbox.y1 - word.bbox.y0) * scaleY;
        
        box.style.left = `${x}px`;
        box.style.top = `${y}px`;
        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
        box.title = `${word.text} (${Math.round(word.confidence)}%)`;
        
        // Google Lens interactive click to copy/fill
        box.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(word.text);
            showToast(`Menyalin "${word.text}" ke Clipboard`, 'success');
            
            // Add a visual flash
            box.style.borderColor = '#c084fc';
            box.style.background = 'rgba(168, 85, 247, 0.4)';
            setTimeout(() => {
                box.style.borderColor = 'rgba(129, 140, 248, 0.4)';
                box.style.background = 'rgba(129, 140, 248, 0.12)';
            }, 500);
        });

        overlay.appendChild(box);
    });
}

// -------------------------------------------------------------------------
// NAVIGATION & SCREEN SWAPPING
// -------------------------------------------------------------------------
function navigateTo(screenId) {
    // Hide all screens
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    
    // Show target screen
    screens[screenId].classList.add('active');
    state.currentScreen = screenId;
    
    // Stop camera if navigating away from camera screen
    if (screenId !== 'camera' && state.currentCameraStream) {
        stopCamera();
    }
    
    // Update footer navigation states
    if (screenId === 'dashboard') {
        navHome.classList.add('active');
    } else {
        navHome.classList.remove('active');
    }
}

// Setup all click handlers
function setupEventListeners() {
    // Bottom Bar Navigation
    navHome.addEventListener('click', () => navigateTo('dashboard'));
    navScan.addEventListener('click', () => triggerCameraOrUploadSelector());
    navAbout.addEventListener('click', () => modalAbout.classList.add('active'));
    modalClose.addEventListener('click', () => modalAbout.classList.remove('active'));
    modalAbout.addEventListener('click', (e) => {
        if (e.target === modalAbout) modalAbout.classList.remove('active');
    });

    // Dashboard Actions
    btnOpenCamera.addEventListener('click', () => startCamera());
    inputFileUpload.addEventListener('change', handleImageUpload);
    btnExportCsv.addEventListener('click', exportLibraryToCSV);

    // Camera Actions
    btnShutter.addEventListener('click', capturePhoto);
    btnCloseCamera.addEventListener('click', () => navigateTo('dashboard'));
    btnSwitchCamera.addEventListener('click', toggleCameraDirection);

    // OCR Workflow Actions
    btnBackToHome.addEventListener('click', () => navigateTo('dashboard'));
    btnSearchBooks.addEventListener('click', performBookSearch);
    btnAiAnalyze.addEventListener('click', analyzeTextWithTransformersJS);
    btnCloudOcr.addEventListener('click', runCloudOCR);

    // Results Actions
    btnBackToOcr.addEventListener('click', () => navigateTo('ocr'));
    btnManualInput.addEventListener('click', () => openManualInputForm());

    // Details Form Actions
    btnBackToResults.addEventListener('click', () => {
        if (state.activeEditingBookId) {
            navigateTo('dashboard');
        } else {
            navigateTo('results');
        }
    });
    btnCancelEdit.addEventListener('click', () => {
        if (state.activeEditingBookId) {
            navigateTo('dashboard');
        } else {
            navigateTo('results');
        }
    });
    bookDetailForm.addEventListener('submit', saveBookToCollection);

    // Save Multi-AI Configuration
    btnSaveAiConfig.addEventListener('click', () => {
        const provider = selectAiProvider.value;
        const key = inputAiKey.value.trim();
        if (key) {
            localStorage.setItem('pustaka_scan_ai_provider', provider);
            localStorage.setItem('pustaka_scan_ai_key', key);
            showToast(`AI ${provider === 'gemini' ? 'Gemini' : 'DeepSeek'} berhasil dikonfigurasi!`, 'success');
            modalAbout.classList.remove('active');
        } else {
            localStorage.removeItem('pustaka_scan_ai_provider');
            localStorage.removeItem('pustaka_scan_ai_key');
            showToast('Konfigurasi AI dikosongkan.', 'info');
        }
    });

    // Send chat message to Gemini
    btnSendGeminiChat.addEventListener('click', handleGeminiChatSend);
}

// Decide camera or file input based on screen and online capabilities
function triggerCameraOrUploadSelector() {
    // Premium flow: directly open a beautiful picker or go straight to camera
    // We will show a toast advising double option, or default to camera
    startCamera();
}

// -------------------------------------------------------------------------
// CAMERA OPERATION (Client-side native media stream API)
// -------------------------------------------------------------------------
async function startCamera() {
    navigateTo('camera');
    
    if (state.currentCameraStream) {
        stopCamera();
    }

    const constraints = {
        video: {
            facingMode: state.useFrontCamera ? 'user' : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        state.currentCameraStream = stream;
        cameraPreview.srcObject = stream;
        showToast('Kamera aktif', 'info');
        startBarcodeDetection(); // Start the real-time scanning loop!
        startLiveLensScanning(); // Start the live Google Lens scanner!
    } catch (error) {
        console.error('Camera access failed:', error);
        showToast('Gagal mengakses kamera. Menggunakan unggah file sebagai gantinya.', 'error');
        navigateTo('dashboard');
        inputFileUpload.click(); // Trigger file dialog automatically
    }
}

function stopCamera() {
    if (state.barcodeInterval) {
        clearInterval(state.barcodeInterval);
        state.barcodeInterval = null;
    }
    if (state.liveOcrInterval) {
        clearInterval(state.liveOcrInterval);
        state.liveOcrInterval = null;
    }
    const liveOverlay = document.getElementById('live-lens-overlay');
    if (liveOverlay) liveOverlay.innerHTML = '';
    
    if (state.currentCameraStream) {
        state.currentCameraStream.getTracks().forEach(track => track.stop());
        state.currentCameraStream = null;
    }
}

function toggleCameraDirection() {
    state.useFrontCamera = !state.useFrontCamera;
    startCamera();
}

function capturePhoto() {
    if (!state.currentCameraStream) return;

    // Draw current video frame to hidden canvas
    const width = cameraPreview.videoWidth;
    const height = cameraPreview.videoHeight;
    cameraCanvas.width = width;
    cameraCanvas.height = height;

    const ctx = cameraCanvas.getContext('2d');
    ctx.drawImage(cameraPreview, 0, 0, width, height);

    // Get base64 URL
    const dataUrl = cameraCanvas.toDataURL('image/jpeg', 0.85);
    state.selectedImageBase64 = dataUrl;
    
    stopCamera();
    
    // Go to OCR Preview Screen & launch OCR automatically
    ocrPreviewImg.src = dataUrl;
    navigateTo('ocr');
    runClientSideOCR(dataUrl);
}

// Start native real-time barcode scanning loop
async function startBarcodeDetection() {
    if (!('BarcodeDetector' in window)) {
        console.log('BarcodeDetector API not supported in this browser environment.');
        return;
    }
    
    try {
        // Supported EAN_13 format for book barcodes
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
        
        state.barcodeInterval = setInterval(async () => {
            if (!state.currentCameraStream) return;
            
            try {
                const barcodes = await detector.detect(cameraPreview);
                if (barcodes.length > 0) {
                    const isbn = barcodes[0].rawValue;
                    
                    // ISBNs always start with 978 or 979
                    if (isbn.startsWith('978') || isbn.startsWith('979')) {
                        clearInterval(state.barcodeInterval);
                        state.barcodeInterval = null;
                        
                        showToast(`Barcode ISBN Terdeteksi: ${isbn}`, 'success');
                        
                        // Stop camera & sound/vibrate
                        stopCamera();
                        if (navigator.vibrate) navigator.vibrate(200);
                        
                        // Direct lookup
                        performBarcodeDirectSearch(isbn);
                    }
                }
            } catch (err) {
                // Ignore frame-by-frame detector errors
            }
        }, 500); // Scan every 500ms
    } catch (e) {
        console.error('Barcode detection failed to initialize:', e);
    }
}

// Reusable live worker initializer
async function initLiveOcrWorker() {
    if (!state.liveOcrWorker) {
        state.liveOcrWorker = await Tesseract.createWorker('ind+eng');
    }
}

// Background OCR loops on active camera feed
async function startLiveLensScanning() {
    await initLiveOcrWorker();
    
    if (state.liveOcrInterval) clearInterval(state.liveOcrInterval);
    
    // Check frames every 1.5 seconds for background OCR
    state.liveOcrInterval = setInterval(async () => {
        if (!state.currentCameraStream || !state.liveOcrWorker) return;
        
        const width = cameraPreview.videoWidth;
        const height = cameraPreview.videoHeight;
        if (width === 0 || height === 0) return;
        
        // Scale down preview frame to 1/2 size for high performance / low latency scans
        cameraCanvas.width = width / 2;
        cameraCanvas.height = height / 2;
        
        const ctx = cameraCanvas.getContext('2d');
        ctx.drawImage(cameraPreview, 0, 0, width / 2, height / 2);
        
        try {
            const dataUrl = cameraCanvas.toDataURL('image/jpeg', 0.6);
            const ret = await state.liveOcrWorker.recognize(dataUrl);
            const words = ret.data.words || [];
            
            // Render these word boxes on live camera view!
            renderLiveLensHighlights(words, width / 2, height / 2);
        } catch (e) {
            // Suppress frames skipped during busy cycles
        }
    }, 1500);
}

// Render dynamic overlays directly on top of active video preview
function renderLiveLensHighlights(words, ocrWidth, ocrHeight) {
    const overlay = document.getElementById('live-lens-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    
    const rect = cameraPreview.getBoundingClientRect();
    
    // Scaling matches standard object-fit: cover mapping
    const scaleX = rect.width / ocrWidth;
    const scaleY = rect.height / ocrHeight;

    words.forEach(word => {
        // High confidence long terms only (and sanitize from HTML or typical OCR garbage like "br")
        const cleanedText = sanitizeOCRText(word.text);
        if (word.confidence < 50 || cleanedText.length < 3) return;

        const box = document.createElement('div');
        box.className = 'live-lens-box';
        
        const x = word.bbox.x0 * scaleX;
        const y = word.bbox.y0 * scaleY;
        const w = (word.bbox.x1 - word.bbox.x0) * scaleX;
        const h = (word.bbox.y1 - word.bbox.y0) * scaleY;
        
        box.style.left = `${x}px`;
        box.style.top = `${y}px`;
        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
        box.title = `Tap untuk mencari: "${word.text}"`;
        
        // Interactive live tap: copies word and triggers automatic search instantly
        box.addEventListener('click', (e) => {
            e.stopPropagation();
            stopCamera();
            
            ocrRawText.value = word.text;
            navigateTo('ocr');
            
            if (navigator.vibrate) navigator.vibrate(100);
            showToast(`Menyeleksi "${word.text}" dari kamera live!`, 'success');
            
            // Execute search
            performBookSearch();
        });
        
        overlay.appendChild(box);
    });
}

// Bypasses OCR screen to search and open book detail instantly
async function performBarcodeDirectSearch(isbn) {
    ocrProgressOverlay.classList.add('active');
    ocrProgressText.textContent = 'Mencari buku via ISBN...';
    ocrProgressBar.style.width = '50%';
    
    try {
        const cleanIsbn = isbn.replace(/\D/g, '');
        const books = await fetchBooksFromAPIs(cleanIsbn);
        ocrProgressOverlay.classList.remove('active');
        
        if (books.length > 0) {
            const book = books[0];
            openDetailForm({
                title: book.title || '',
                author: book.author || '',
                publisher: book.publisher || '',
                isbn: isbn,
                year: book.year || '',
                coverUrl: book.coverUrl || ''
            });
            showToast('Buku berhasil ditemukan via ISBN!', 'success');
        } else {
            const aiKey = localStorage.getItem('pustaka_scan_ai_key');
            if (aiKey) {
                try {
                    ocrProgressOverlay.classList.add('active');
                    ocrProgressText.textContent = 'Merekonstruksi data via Asisten AI...';
                    ocrProgressBar.style.width = '75%';
                    
                    const prompt = `Anda adalah asisten data perpustakaan pintar.
Cari informasi buku asli dengan nomor ISBN: "${cleanIsbn}".
Gunakan basis pengetahuan internal Anda untuk menemukan judul, penulis, penerbit, dan tahun terbit buku tersebut.
Kembalikan respon HANYA berupa objek JSON mentah berformat:
{
  "title": "Judul Buku Lengkap",
  "author": "Nama Penulis",
  "publisher": "Penerbit",
  "year": "Tahun Terbit (angka saja)"
}
Jangan menambahkan teks pembuka, penutup, backticks, atau markdown block. Langsung output string JSON.`;
                    
                    const resText = await callSelectedAI(prompt);
                    const cleanRes = resText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const b = JSON.parse(cleanRes);
                    
                    ocrProgressOverlay.classList.remove('active');
                    openDetailForm({
                        title: b.title || '',
                        author: b.author || '',
                        publisher: b.publisher || '',
                        isbn: isbn,
                        year: b.year || '',
                        coverUrl: ''
                    });
                    showToast('Buku ditemukan & direkonstruksi via AI!', 'success');
                    return;
                } catch (geminiErr) {
                    console.error('AI direct ISBN reconstruction failed:', geminiErr);
                }
            }

            // Pre-fill ISBN but open manual form
            openDetailForm({
                title: '',
                author: '',
                publisher: '',
                isbn: isbn,
                year: '',
                coverUrl: ''
            });
            showToast('Gagal menemukan data buku di internet! Silakan isi manual.', 'error');
        }
    } catch (e) {
        console.error('Barcode search error:', e);
        ocrProgressOverlay.classList.remove('active');
        openDetailForm({
            title: '',
            author: '',
            publisher: '',
            isbn: isbn,
            year: '',
            coverUrl: ''
        });
        showToast('Koneksi bermasalah atau pencarian gagal! Silakan isi manual.', 'error');
    }
}

// Cloud AI OCR (OCR.space API implementation with detailed coordinate mapping)
async function runCloudOCR() {
    if (!state.selectedImageBase64) {
        showToast('Tidak ada gambar cover untuk diproses!', 'error');
        return;
    }

    if (!navigator.onLine) {
        showToast('Koneksi internet diperlukan untuk Cloud AI OCR.', 'error');
        return;
    }

    ocrProgressOverlay.classList.add('active');
    ocrProgressText.textContent = 'Menghubungi Cloud AI OCR (Sangat Akurat)...';
    ocrProgressBar.style.width = '20%';

    try {
        // 1. Try static barcode detection first (Instant!)
        const detectedBarcode = await tryOfflineBarcodeFromImage(state.selectedImageBase64);
        if (detectedBarcode) {
            ocrProgressOverlay.classList.remove('active');
            ocrRawText.value = detectedBarcode;
            showToast(`Barcode ISBN Terdeteksi Instan!`, 'success');
            performBarcodeDirectSearch(detectedBarcode);
            return;
        }

        const rawBase64 = state.selectedImageBase64.split(',')[1];
        
        const formData = new FormData();
        formData.append('base64Image', `data:image/jpeg;base64,${rawBase64}`);
        formData.append('apikey', 'K88729379888957'); // Active public API key
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'true');

        ocrProgressBar.style.width = '50%';
        ocrProgressText.textContent = 'Menganalisis teks cover via Cloud AI...';

        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        ocrProgressBar.style.width = '90%';

        if (data.IsErroredOnProcessing) {
            throw new Error(data.ErrorMessage ? data.ErrorMessage[0] : 'Processing error');
        }

        const parsedResult = data.ParsedResults ? data.ParsedResults[0] : null;
        const text = parsedResult ? parsedResult.ParsedText : '';

        // Extract ISBN specifically
        const isbn = extractISBN(text);
        ocrRawText.value = isbn || sanitizeOCRText(text);
        
        // Map OCR.space overlay words to standard format for Google Lens highlights
        const ocrSpaceWords = [];
        if (parsedResult && parsedResult.TextOverlay) {
            const lines = parsedResult.TextOverlay.Lines || [];
            lines.forEach(line => {
                const words = line.Words || [];
                words.forEach(w => {
                    ocrSpaceWords.push({
                        text: w.WordText,
                        confidence: 90,
                        bbox: {
                            x0: w.Left,
                            y0: w.Top,
                            x1: w.Left + w.Width,
                            y1: w.Top + w.Height
                        }
                    });
                });
            });
        }

        ocrProgressBar.style.width = '100%';
        ocrProgressOverlay.classList.remove('active');
        
        state.lastDetectedWords = ocrSpaceWords;
        renderLensHighlights(ocrSpaceWords);

        if (isbn) {
            showToast(`Deteksi Cloud AI sukses! ISBN ditemukan: ${isbn}`, 'success');
            performBarcodeDirectSearch(isbn);
        } else {
            showToast('Deteksi Cloud AI sukses! Tidak ada ISBN terdeteksi.', 'info');
        }

    } catch (error) {
        console.error('Cloud OCR error:', error);
        ocrProgressOverlay.classList.remove('active');
        showToast('Cloud AI sibuk atau gagal. Gunakan OCR lokal.', 'error');
    }
}

// Handle local file uploaded from device gallery
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const dataUrl = event.target.result;
        state.selectedImageBase64 = dataUrl;
        
        ocrPreviewImg.src = dataUrl;
        navigateTo('ocr');
        runClientSideOCR(dataUrl);
    };
    reader.readAsDataURL(file);
}

// -------------------------------------------------------------------------
// OCR ENGINE (Client-side Tesseract.js - Runs fully local!)
// -------------------------------------------------------------------------
async function runClientSideOCR(imageSrc) {
    ocrProgressOverlay.classList.add('active');
    ocrProgressText.textContent = 'Memindai barcode dari gambar...';
    ocrProgressBar.style.width = '10%';
    ocrRawText.value = '';
    
    // Clear Google Lens highlights
    const overlay = document.getElementById('lens-highlights-overlay');
    if (overlay) overlay.innerHTML = '';
    state.lastDetectedWords = [];

    try {
        // 1. Try static barcode detection first (Instant!)
        const detectedBarcode = await tryOfflineBarcodeFromImage(imageSrc);
        if (detectedBarcode) {
            ocrProgressOverlay.classList.remove('active');
            ocrRawText.value = detectedBarcode;
            showToast(`Barcode ISBN Terdeteksi Instan!`, 'success');
            performBarcodeDirectSearch(detectedBarcode);
            return;
        }

        // 2. Fallback to standard OCR
        ocrProgressText.textContent = 'Membaca teks cover...';
        
        // Initialize Tesseract Worker
        const worker = await Tesseract.createWorker('ind+eng', 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const percentage = Math.round(m.progress * 100);
                    ocrProgressBar.style.width = `${percentage}%`;
                    ocrProgressText.textContent = `Menganalisa teks cover (${percentage}%)`;
                } else {
                    ocrProgressText.textContent = 'Mempersiapkan bahasa...';
                }
            }
        });

        // Run recognition
        const ret = await worker.recognize(imageSrc);
        const text = ret.data.text;
        const words = ret.data.words || [];
        
        await worker.terminate();

        // Extract clean ISBN
        const isbn = extractISBN(text);
        ocrRawText.value = isbn || sanitizeOCRText(text);
        ocrProgressOverlay.classList.remove('active');
        
        // Render Google Lens word bounding highlights
        state.lastDetectedWords = words;
        renderLensHighlights(words);
        
        if (isbn) {
            showToast(`Deteksi sukses! ISBN ditemukan: ${isbn}`, 'success');
            performBarcodeDirectSearch(isbn);
        } else {
            showToast('Teks ISBN tidak terdeteksi. Silakan ketik manual.', 'info');
        }
    } catch (error) {
        console.error('OCR Process error:', error);
        ocrProgressOverlay.classList.remove('active');
        showToast('Gagal memproses gambar. Masukkan teks cover manual.', 'error');
        ocrRawText.value = '';
    }
}

// -------------------------------------------------------------------------
// INTEGRATED MULTI-SOURCE SEARCH & HEURISTIC ENGINE (NO PAID TOKENS!)
// -------------------------------------------------------------------------
async function performBookSearch() {
    const rawText = ocrRawText.value.trim();
    if (!rawText) {
        showToast('Tolong masukkan teks cover terlebih dahulu!', 'error');
        return;
    }

    if (!navigator.onLine) {
        showToast('Anda sedang offline. Tidak dapat melakukan pencarian. Mengalihkan ke input manual.', 'info');
        openManualInputForm();
        return;
    }

    // Clean up input for better query
    // Split lines, remove short tokens, special symbols, make a combined query
    const cleanedQuery = cleanOCRTextForQuery(rawText);
    if (!cleanedQuery) {
        showToast('Teks terlalu pendek untuk pencarian. Coba tulis manual.', 'info');
        return;
    }

    // Show loading indicator inside results screen
    navigateTo('results');
    searchResultsList.innerHTML = `
        <div class="empty-state">
            <div class="spinner"></div>
            <p>Mencari info buku di berbagai sumber...</p>
            <p class="sub">Menghubungi Google Books & OpenLibrary...</p>
        </div>
    `;

    try {
        const books = await fetchBooksFromAPIs(cleanedQuery);
        
        if (books.length === 0) {
            searchResultsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p>Buku tidak ditemukan di internet.</p>
                    <p class="sub">Teks query: "${cleanedQuery}"</p>
                </div>
            `;
            return;
        }

        // Render matching cards
        renderSearchResults(books);

    } catch (error) {
        console.error('Multi-Search error:', error);
        searchResultsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>Terjadi kesalahan pencarian online.</p>
                <p class="sub">Silakan gunakan input manual untuk menyimpan.</p>
            </div>
        `;
    }
}

// Cleans OCR outputs by removing symbols, duplicates, and keeping rich terms
function cleanOCRTextForQuery(text) {
    // Replace newlines with spaces, remove excessive special chars
    let clean = text.replace(/[\n\r]+/g, ' ')
                     .replace(/[^\w\s\-\.\:\/]/gi, '')
                     .replace(/\s+/g, ' ')
                     .trim();

    // Standard filter for commonly misinterpreted words or generic stamps
    const filters = [
        'penerbit', 'isbn', 'pengarang', 'penulis', 'edisi', 'cetakan', 
        'novel', 'buku', 'cover', 'original', 'terlaris', 'best seller',
        'gramedia', 'republika', 'mizan', 'bentang', 'perpustakaan'
    ];
    
    let words = clean.split(' ');
    words = words.filter(word => {
        const wLower = word.toLowerCase();
        return wLower.length > 2 && !filters.includes(wLower);
    });

    // Limit query word count to prevent query bloating
    return words.slice(0, 7).join(' ');
}

// Advanced OCR sanitization to remove symbols, HTML tags (like <br>), and garbage words (like "br")
function sanitizeOCRText(text) {
    if (!text) return '';
    
    // 1. Remove HTML tags like <br> or </br>
    let clean = text.replace(/<[^>]*>/g, ' ');
    
    // 2. Remove common OCR noise words and strange isolated symbols
    // Keep standard alphanumeric, spaces, hyphens, dots, colons, slashes
    const noisePatterns = [
        /\b(br|Ib|lb|cl|co|rt|tl|vl|xi|xo|ox|lll|iii|ii|xx)\b/gi, // Common character segments misread by Tesseract
        /[^a-zA-Z0-9\s\-\.\:\/]/g, // Get rid of typical layout symbol noise like ©, ®, |, etc.
    ];
    
    noisePatterns.forEach(pattern => {
        clean = clean.replace(pattern, ' ');
    });
    
    // 3. Normalize spaces
    clean = clean.replace(/\s+/g, ' ').trim();
    
    // 4. Filter garbage fragments
    let words = clean.split(' ');
    words = words.filter(word => {
        // Keep potentially clean EAN / ISBN strings
        const isPotentialIsbn = /^[0-9\-]{9,17}$/.test(word);
        if (isPotentialIsbn) return true;
        
        // Remove ultra-short noise fragments unless alphanumeric
        return word.length >= 3 && /[a-zA-Z]/g.test(word);
    });
    
    return words.join(' ');
}

// Static image barcode detector helper (runs offline)
async function tryOfflineBarcodeFromImage(imageSrc) {
    if (!('BarcodeDetector' in window)) return null;
    try {
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
        
        const img = new Image();
        img.src = imageSrc;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        
        const barcodes = await detector.detect(img);
        if (barcodes.length > 0) {
            const rawVal = barcodes[0].rawValue;
            if (rawVal.startsWith('978') || rawVal.startsWith('979') || rawVal.length === 10) {
                return rawVal;
            }
        }
    } catch (e) {
        console.log('Static image barcode detect skip:', e);
    }
    return null;
}

// Specific regular-expression based ISBN extractor
function extractISBN(text) {
    if (!text) return '';
    
    const cleanText = text.replace(/[\r\n]+/g, ' ');
    
    // Look for standard EAN-13/ISBN-10 patterns
    const regex13 = /\b(?:97[89][-\s]?)?[0-9]{1,5}[-\s]?[0-9]+[-\s]?[0-9]+[-\s]?[0-9Xx]\b/g;
    const matches = cleanText.match(regex13) || [];
    
    for (let match of matches) {
        const cleanVal = match.replace(/[-\s]/g, '');
        if (cleanVal.length === 13 && (cleanVal.startsWith('978') || cleanVal.startsWith('979'))) {
            return cleanVal;
        }
        if (cleanVal.length === 10) {
            return cleanVal;
        }
    }
    
    // Simple sequence backup
    const digitsMatch = cleanText.match(/\b\d{9,14}\b/);
    return digitsMatch ? digitsMatch[0] : '';
}

// Query free APIs simultaneously
async function fetchBooksFromAPIs(query) {
    const promises = [];
    
    // 1. Google Books API (Totally Free public search)
    const googleURL = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`;
    promises.push(
        fetch(googleURL)
            .then(res => res.json())
            .then(data => {
                if (!data.items) return [];
                return data.items.map(item => {
                    const info = item.volumeInfo;
                    const isbnInfo = info.industryIdentifiers || [];
                    const isbn = isbnInfo.find(id => id.type.includes('ISBN'))?.identifier || '';
                    return {
                        title: info.title || '',
                        author: info.authors ? info.authors.join(', ') : '',
                        publisher: info.publisher || '',
                        year: info.publishedDate ? info.publishedDate.substring(0, 4) : '',
                        isbn: isbn,
                        coverUrl: info.imageLinks?.thumbnail || '',
                        source: 'Google Books'
                    };
                });
            })
            .catch(err => {
                console.error('Google Books failed:', err);
                return [];
            })
    );

    // 2. OpenLibrary API (Totally Free & Open)
    const openLibURL = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`;
    promises.push(
        fetch(openLibURL)
            .then(res => res.json())
            .then(data => {
                if (!data.docs) return [];
                return data.docs.map(doc => {
                    const isbn = doc.isbn ? doc.isbn[0] : '';
                    const coverId = doc.cover_i;
                    const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : '';
                    return {
                        title: doc.title || '',
                        author: doc.author_name ? doc.author_name.join(', ') : '',
                        publisher: doc.publisher ? doc.publisher[0] : '',
                        year: doc.first_publish_year ? String(doc.first_publish_year) : '',
                        isbn: isbn,
                        coverUrl: coverUrl,
                        source: 'Open Library'
                    };
                });
            })
            .catch(err => {
                console.error('Open Library failed:', err);
                return [];
            })
    );

    // Run searches in parallel
    const results = await Promise.all(promises);
    
    // Flatten, filter out empty titles, and deduplicate by title/author signature
    const merged = results.flat();
    const unique = [];
    const seenSignatures = new Set();

    merged.forEach(book => {
        if (!book.title) return;
        
        const signature = `${book.title.toLowerCase().trim()}|${book.author.toLowerCase().trim()}`;
        if (!seenSignatures.has(signature)) {
            seenSignatures.add(signature);
            unique.push(book);
        }
    });

    return unique;
}

// -------------------------------------------------------------------------
// RESULT RENDERING & SELECTION
// -------------------------------------------------------------------------
function renderSearchResults(books) {
    searchResultsList.innerHTML = '';
    
    books.forEach(book => {
        const card = document.createElement('div');
        card.className = 'result-card';
        
        const coverSrc = book.coverUrl || 'placeholder.svg';
        const displayIsbn = book.isbn ? `ISBN: ${book.isbn}` : 'ISBN tidak tersedia';
        const displayYear = book.year ? `Tahun: ${book.year}` : 'Tahun tidak terdaftar';
        
        card.innerHTML = `
            <img class="result-card-cover" src="${coverSrc}" onerror="this.src='placeholder.svg'" alt="Cover">
            <div class="result-card-info">
                <h4 class="result-title">${book.title}</h4>
                <p class="result-author">Oleh: ${book.author || 'Tidak Diketahui'}</p>
                <div class="result-meta">
                    <span>${displayIsbn}</span>
                    <span>${displayYear}</span>
                </div>
                <span class="result-source">${book.source}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            openDetailForm(book);
        });

        searchResultsList.appendChild(card);
    });
}

function openDetailForm(book) {
    state.activeEditingBookId = null; // New entry from search
    navigateTo('detail');

    // Fill form elements
    detailCoverImg.src = book.coverUrl || state.selectedImageBase64 || 'placeholder.svg';
    formCoverUrl.value = book.coverUrl || '';
    
    formTitle.value = book.title || '';
    formAuthor.value = book.author || '';
    formPublisher.value = book.publisher || '';
    formIsbn.value = book.isbn || '';
    formYear.value = book.year || '';
    formNotes.value = '';

    updateAICardVisibility();
}

function openManualInputForm() {
    openDetailForm({
        title: '',
        author: '',
        publisher: '',
        isbn: '',
        year: '',
        coverUrl: ''
    });
}

// -------------------------------------------------------------------------
// DATABASE & STORAGE LAYER (Persistent Offline Client-side DB via localStorage)
// -------------------------------------------------------------------------
function loadSavedBooks() {
    try {
        const raw = localStorage.getItem('pustaka_scan_library');
        state.savedBooks = raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Failed to parse localStorage:', e);
        state.savedBooks = [];
    }
    
    renderSavedLibrary();
}

function renderSavedLibrary() {
    const count = state.savedBooks.length;
    savedBooksCount.textContent = count;

    if (count === 0) {
        emptyLibraryState.style.display = 'flex';
        savedBooksGrid.style.display = 'none';
        return;
    }

    emptyLibraryState.style.display = 'none';
    savedBooksGrid.style.display = 'grid';
    savedBooksGrid.innerHTML = '';

    // Render items reverse-chronologically (newest first)
    [...state.savedBooks].reverse().forEach(book => {
        const item = document.createElement('div');
        item.className = 'book-card';
        
        const coverSrc = book.coverBase64 || book.coverUrl || 'placeholder.svg';
        
        item.innerHTML = `
            <img class="book-card-cover" src="${coverSrc}" onerror="this.src='placeholder.svg'" alt="Cover">
            <div class="book-card-info">
                <h4 class="book-title" title="${book.title}">${book.title}</h4>
                <p class="book-author" title="${book.author}">Oleh: ${book.author || 'Tidak Diketahui'}</p>
                <div class="book-meta-pills">
                    ${book.isbn ? `<span class="meta-pill isbn">${book.isbn}</span>` : ''}
                    ${book.year ? `<span class="meta-pill">${book.year}</span>` : ''}
                    ${book.publisher ? `<span class="meta-pill" title="${book.publisher}">${book.publisher}</span>` : ''}
                </div>
            </div>
            <div class="book-card-actions">
                <button class="btn-icon btn-edit-saved" title="Edit Buku">✏️</button>
                <button class="btn-icon btn-delete-saved" title="Hapus Buku">🗑️</button>
            </div>
        `;

        // Attach events
        item.querySelector('.btn-edit-saved').addEventListener('click', (e) => {
            e.stopPropagation();
            editSavedBook(book.id);
        });

        item.querySelector('.btn-delete-saved').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteBook(book.id);
        });

        // Clicking card shows details
        item.addEventListener('click', () => {
            editSavedBook(book.id);
        });

        savedBooksGrid.appendChild(item);
    });
}

function saveBookToCollection(e) {
    e.preventDefault();

    const titleVal = formTitle.value.trim();
    if (!titleVal) {
        showToast('Judul buku wajib diisi!', 'error');
        return;
    }

    // Determine the cover source
    // If it's a new photo, we embed the base64 taken by the camera.
    // If we're updating a book that already has an embedded base64 cover, preserve it.
    let targetBase64 = null;
    if (state.selectedImageBase64) {
        targetBase64 = state.selectedImageBase64;
    }

    if (state.activeEditingBookId) {
        // Edit existing book
        const bookIndex = state.savedBooks.findIndex(b => b.id === state.activeEditingBookId);
        if (bookIndex > -1) {
            const currentBook = state.savedBooks[bookIndex];
            state.savedBooks[bookIndex] = {
                ...currentBook,
                title: titleVal,
                author: formAuthor.value.trim(),
                publisher: formPublisher.value.trim(),
                isbn: formIsbn.value.trim(),
                year: formYear.value.trim(),
                notes: formNotes.value.trim(),
                // Keep existing base64 image if we didn't scan a new one
                coverBase64: targetBase64 || currentBook.coverBase64,
                coverUrl: formCoverUrl.value.trim()
            };
            showToast('Informasi buku diperbarui!', 'success');
        }
    } else {
        // Create new book entry
        const newBook = {
            id: 'book_' + Date.now(),
            title: titleVal,
            author: formAuthor.value.trim(),
            publisher: formPublisher.value.trim(),
            isbn: formIsbn.value.trim(),
            year: formYear.value.trim(),
            notes: formNotes.value.trim(),
            coverBase64: targetBase64,
            coverUrl: formCoverUrl.value.trim(),
            dateAdded: new Date().toISOString()
        };
        state.savedBooks.push(newBook);
        showToast('Buku berhasil disimpan ke koleksi!', 'success');
    }

    // Persist storage
    localStorage.setItem('pustaka_scan_library', JSON.stringify(state.savedBooks));
    
    // Reset selected capture
    state.selectedImageBase64 = null;
    state.activeEditingBookId = null;

    loadSavedBooks();
    navigateTo('dashboard');
}

function editSavedBook(bookId) {
    const book = state.savedBooks.find(b => b.id === bookId);
    if (!book) return;

    state.activeEditingBookId = bookId;
    navigateTo('detail');

    // Fill form
    detailCoverImg.src = book.coverBase64 || book.coverUrl || 'placeholder.svg';
    formCoverUrl.value = book.coverUrl || '';
    formTitle.value = book.title || '';
    formAuthor.value = book.author || '';
    formPublisher.value = book.publisher || '';
    formIsbn.value = book.isbn || '';
    formYear.value = book.year || '';
    formNotes.value = book.notes || '';

    updateAICardVisibility();
}

function deleteBook(bookId) {
    if (confirm('Apakah Anda yakin ingin menghapus buku ini dari koleksi?')) {
        state.savedBooks = state.savedBooks.filter(b => b.id !== bookId);
        localStorage.setItem('pustaka_scan_library', JSON.stringify(state.savedBooks));
        showToast('Buku dihapus dari koleksi', 'info');
        loadSavedBooks();
    }
}

// -------------------------------------------------------------------------
// DATA EXPORT FUNCTION (Completely Client-Side CSV Generator)
// -------------------------------------------------------------------------
function exportLibraryToCSV() {
    if (state.savedBooks.length === 0) {
        showToast('Tidak ada data buku untuk diekspor.', 'error');
        return;
    }

    const headers = ['ID', 'Judul Buku', 'Pengarang', 'Penerbit', 'ISBN', 'Tahun Terbit', 'Catatan', 'Tanggal Ditambahkan'];
    
    const rows = state.savedBooks.map(book => [
        book.id,
        `"${book.title.replace(/"/g, '""')}"`,
        `"${(book.author || '').replace(/"/g, '""')}"`,
        `"${(book.publisher || '').replace(/"/g, '""')}"`,
        `"${(book.isbn || '').replace(/"/g, '""')}"`,
        `"${(book.year || '').replace(/"/g, '""')}"`,
        `"${(book.notes || '').replace(/"/g, '""')}"`,
        book.dateAdded || ''
    ]);

    const csvContent = "\ufeff" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Setup client-side download anchor
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `PustakaScan_Ekspor_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Berhasil mengekspor CSV!', 'success');
}

// -------------------------------------------------------------------------
// TOAST NOTIFICATION SYSTEM
// -------------------------------------------------------------------------
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `
        <span>${icon}</span>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Clean up
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// -------------------------------------------------------------------------
// MULTI-PROVIDER AI SERVICES (Google Gemini & DeepSeek Support)
// -------------------------------------------------------------------------
function updateAICardVisibility() {
    const aiKey = localStorage.getItem('pustaka_scan_ai_key');
    const aiProvider = localStorage.getItem('pustaka_scan_ai_provider') || 'gemini';
    
    if (aiKey) {
        geminiAiCard.style.display = 'block';
        const cardTitle = geminiAiCard.querySelector('h4');
        if (cardTitle) {
            cardTitle.innerHTML = `🤖 Asisten AI Buku (${aiProvider === 'gemini' ? 'Gemini 1.5 Flash' : 'DeepSeek V3'})`;
        }
        geminiChatHistory.innerHTML = '';
        geminiChatHistory.style.display = 'none';
        inputGeminiChat.value = '';
    } else {
        geminiAiCard.style.display = 'none';
    }
}

async function callSelectedAI(prompt) {
    const provider = localStorage.getItem('pustaka_scan_ai_provider') || 'gemini';
    const apiKey = localStorage.getItem('pustaka_scan_ai_key');
    
    if (!apiKey) {
        throw new Error('API Key belum diatur. Silakan isi di menu Tentang.');
    }
    
    if (provider === 'gemini') {
        return await callGeminiAPI(prompt, apiKey);
    } else {
        return await callDeepSeekAPI(prompt, apiKey);
    }
}

async function callGeminiAPI(prompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || response.statusText;
        throw new Error(`Gemini API Error: ${errMsg}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function callDeepSeekAPI(prompt, apiKey) {
    const url = 'https://api.deepseek.com/v1/chat/completions';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 250
        })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || response.statusText;
        throw new Error(`DeepSeek API Error: ${errMsg}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function handleGeminiChatSend() {
    const query = inputGeminiChat.value.trim();
    if (!query) return;

    const provider = localStorage.getItem('pustaka_scan_ai_provider') || 'gemini';
    const providerName = provider === 'gemini' ? 'Gemma AI' : 'DeepSeek AI';

    // Append user bubble to chat history
    appendChatBubble('user', query, 'Anda');
    inputGeminiChat.value = '';
    
    // Append a loading/typing indicator bubble
    const typingBubble = appendChatBubble('ai', 'Sedang memikirkan jawaban...', providerName);
    
    try {
        const bookTitle = formTitle.value || 'Buku Tidak Diketahui';
        const bookAuthor = formAuthor.value || 'Penulis Tidak Diketahui';
        const prompt = `Context: Anda adalah asisten cerdas khusus buku berbasis ${providerName}.
Buku saat ini: "${bookTitle}" oleh ${bookAuthor}.
Pertanyaan User: "${query}"
Berikan jawaban yang singkat, sangat informatif, dan ramah dalam Bahasa Indonesia (maksimal 3-4 kalimat).`;

        const reply = await callSelectedAI(prompt);
        typingBubble.textContent = reply;
    } catch (error) {
        console.error('AI Chat error:', error);
        typingBubble.textContent = `⚠️ Error: ${error.message}`;
        typingBubble.style.color = '#ef4444';
    }
    
    // Auto-scroll to bottom of chat
    geminiChatHistory.scrollTop = geminiChatHistory.scrollHeight;
}

function appendChatBubble(sender, text, customName = 'AI') {
    geminiChatHistory.style.display = 'flex';
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const displayName = sender === 'user' ? 'Anda' : customName;
    
    bubble.innerHTML = `
        <div style="font-weight: 700; font-size: 0.72rem; color: ${sender === 'user' ? '#38bdf8' : '#c084fc'}; margin-bottom: 2px;">
            ${displayName}
        </div>
        <div class="bubble-text" style="line-height: 1.4;">${text}</div>
        <div style="font-size: 0.6rem; color: rgba(255,255,255,0.4); text-align: right; margin-top: 4px;">${time}</div>
    `;
    
    // Quick CSS styles for bubbles
    bubble.style.padding = '8px 12px';
    bubble.style.borderRadius = '8px';
    bubble.style.maxWidth = '85%';
    bubble.style.fontSize = '0.78rem';
    bubble.style.color = '#fff';
    bubble.style.marginBottom = '8px';
    
    if (sender === 'user') {
        bubble.style.alignSelf = 'flex-end';
        bubble.style.background = 'rgba(59, 130, 246, 0.2)';
        bubble.style.border = '1px solid rgba(59, 130, 246, 0.3)';
    } else {
        bubble.style.alignSelf = 'flex-start';
        bubble.style.background = 'rgba(168, 85, 247, 0.15)';
        bubble.style.border = '1px solid rgba(168, 85, 247, 0.25)';
    }
    
    geminiChatHistory.appendChild(bubble);
    geminiChatHistory.scrollTop = geminiChatHistory.scrollHeight;
    return bubble.querySelector('.bubble-text');
}
