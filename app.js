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
    aiModelInstance: null
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
const modalAbout = document.getElementById('modal-about');
const modalClose = document.querySelector('.modal-close');
const toastContainer = document.getElementById('toast-container');

// -------------------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadSavedBooks();
    setupEventListeners();
    updateNetworkStatus();
    registerServiceWorker();
    checkLocalAISupport();
    
    // Listen to network status changes
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
});

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
    } catch (error) {
        console.error('Camera access failed:', error);
        showToast('Gagal mengakses kamera. Menggunakan unggah file sebagai gantinya.', 'error');
        navigateTo('dashboard');
        inputFileUpload.click(); // Trigger file dialog automatically
    }
}

function stopCamera() {
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
    ocrProgressText.textContent = 'Membaca data cover...';
    ocrProgressBar.style.width = '10%';
    ocrRawText.value = '';

    try {
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
        
        await worker.terminate();

        // Output raw OCR text
        ocrRawText.value = text.trim();
        ocrProgressOverlay.classList.remove('active');
        showToast('Deteksi teks cover sukses!', 'success');
        
        if (!text.trim()) {
            showToast('Teks cover kurang jelas, ketik manual jika perlu.', 'info');
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
