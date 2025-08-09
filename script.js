// 🚀 ScanzoQR Enhanced App - Production Ready v2.1.0
// Complete implementation with all modules inline

// 💾 Enhanced Storage Manager Class
class StorageManager {
    constructor() {
        this.dbName = 'ScanzoQR_DB';
        this.version = 1;
        this.db = null;
        this.storeName = 'qr_history';
        this.isIndexedDBAvailable = false;
        this.init();
    }

    async init() {
        try {
            this.isIndexedDBAvailable = await this.checkIndexedDBSupport();
            if (this.isIndexedDBAvailable) {
                await this.initIndexedDB();
                console.log('✅ IndexedDB initialized successfully');
            } else {
                console.warn('⚠️ IndexedDB not available, using localStorage only');
            }
        } catch (error) {
            console.warn('Storage initialization failed:', error);
            this.isIndexedDBAvailable = false;
        }
    }

    async checkIndexedDBSupport() {
        if (!('indexedDB' in window)) return false;
        
        try {
            const testDB = indexedDB.open('test-db', 1);
            return await new Promise((resolve) => {
                testDB.onsuccess = () => {
                    testDB.result.close();
                    indexedDB.deleteDatabase('test-db');
                    resolve(true);
                };
                testDB.onerror = () => resolve(false);
                testDB.onblocked = () => resolve(false);
            });
        } catch {
            return false;
        }
    }

    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { 
                        keyPath: 'id',
                        autoIncrement: false 
                    });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('mode', 'mode', { unique: false });
                }
            };
        });
    }

    async saveHistory(historyArray) {
        const savePromises = [];

        try {
            // Primary: localStorage (fast access)
            savePromises.push(this.saveToLocalStorage(historyArray));

            // Secondary: IndexedDB (larger capacity)
            if (this.isIndexedDBAvailable && this.db) {
                savePromises.push(this.saveToIndexedDB(historyArray));
            }

            await Promise.allSettled(savePromises);
            return true;
        } catch (error) {
            console.error('Failed to save history:', error);
            throw error;
        }
    }

    async saveToLocalStorage(historyArray) {
        try {
            const dataToStore = historyArray.map(item => ({
                ...item,
                qrData: item.qrData ? 'stored_in_indexeddb' : undefined
            }));

            localStorage.setItem('qrHistory', JSON.stringify(dataToStore));
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                const minimalData = historyArray.map(item => ({
                    id: item.id,
                    type: item.type,
                    mode: item.mode,
                    contentType: item.contentType,
                    preview: item.preview,
                    timestamp: item.timestamp,
                    size: item.size
                }));
                
                localStorage.setItem('qrHistory', JSON.stringify(minimalData));
                console.warn('Saved minimal history due to storage quota');
                return true;
            }
            throw error;
        }
    }

    async saveToIndexedDB(historyArray) {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);

            const clearRequest = store.clear();
            clearRequest.onsuccess = () => {
                historyArray.forEach(item => store.add(item));
            };
        });
    }

    async loadHistory() {
        try {
            const localData = await this.loadFromLocalStorage();
            
            if (this.isIndexedDBAvailable && this.db) {
                const indexedData = await this.loadFromIndexedDB();
                return this.mergeHistoryData(localData, indexedData)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            }
            
            return localData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('Failed to load history:', error);
            return [];
        }
    }

    async loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('qrHistory');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return [];
        }
    }

    async loadFromIndexedDB() {
        if (!this.db) return [];

        return new Promise((resolve) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => {
                console.error('IndexedDB load error:', request.error);
                resolve([]);
            };
        });
    }

    mergeHistoryData(localData, indexedData) {
        const merged = new Map();

        indexedData.forEach(item => merged.set(item.id, item));
        localData.forEach(item => {
            if (!merged.has(item.id)) merged.set(item.id, item);
        });

        return Array.from(merged.values());
    }

    async exportHistory(format = 'json') {
        try {
            const history = await this.loadHistory();
            
            return {
                version: '2.1.0',
                exported: new Date().toISOString(),
                totalItems: history.length,
                items: history
            };
        } catch (error) {
            console.error('Failed to export history:', error);
            throw error;
        }
    }
}

// 📷 Enhanced Camera Handler Class
class CameraHandler {
    constructor() {
        this.stream = null;
        this.video = null;
        this.devices = [];
        this.currentDeviceIndex = 0;
        this.facingMode = 'environment';
        this.isInitialized = false;
        this.constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 30, max: 30 }
            }
        };
        
        this.callbacks = {
            onStreamReady: null,
            onError: null,
            onDeviceChange: null
        };
    }

    async init(videoElement) {
        try {
            this.video = videoElement || document.getElementById('scanner-video');
            
            if (!this.video) {
                throw new Error('Video element not found');
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported on this device');
            }

            await this.enumerateDevices();
            this.setupEventListeners();
            this.isInitialized = true;
            
            return true;
        } catch (error) {
            console.error('Camera initialization failed:', error);
            this.triggerCallback('onError', error);
            throw error;
        }
    }

    async enumerateDevices() {
        try {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            this.devices = allDevices.filter(device => device.kind === 'videoinput');
            console.log('Available cameras:', this.devices.length);
            return this.devices;
        } catch (error) {
            console.error('Failed to enumerate devices:', error);
            this.devices = [];
            return [];
        }
    }

    setupEventListeners() {
        if (navigator.mediaDevices.addEventListener) {
            navigator.mediaDevices.addEventListener('devicechange', () => {
                this.handleDeviceChange();
            });
        }

        if (this.video) {
            this.video.addEventListener('loadedmetadata', () => {
                console.log('Video metadata loaded:', {
                    width: this.video.videoWidth,
                    height: this.video.videoHeight
                });
            });

            this.video.addEventListener('error', (e) => {
                console.error('Video error:', e);
                this.triggerCallback('onError', new Error('Video playback error'));
            });
        }
    }

    async startCamera(facingMode = 'environment', deviceId = null) {
        try {
            if (!this.isInitialized) {
                throw new Error('Camera handler not initialized');
            }

            await this.stopCamera();

            let videoConstraints = { ...this.constraints.video };
            
            if (deviceId) {
                videoConstraints.deviceId = { exact: deviceId };
                delete videoConstraints.facingMode;
            } else {
                videoConstraints.facingMode = facingMode;
            }

            const constraints = {
                video: videoConstraints,
                audio: false
            };

            console.log('Starting camera with constraints:', constraints);

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            await this.waitForVideoReady();
            this.constraints.video.facingMode = facingMode;
            
            this.triggerCallback('onStreamReady', {
                stream: this.stream,
                video: this.video,
                constraints: constraints
            });

            return {
                success: true,
                stream: this.stream,
                video: this.video
            };
        } catch (error) {
            console.error('Camera start failed:', error);
            const userFriendlyMessage = this.getErrorMessage(error);
            this.triggerCallback('onError', new Error(userFriendlyMessage));
            throw new Error(userFriendlyMessage);
        }
    }

    waitForVideoReady() {
        return new Promise((resolve, reject) => {
            if (this.video.readyState >= 2) {
                resolve();
                return;
            }

            const onLoadedData = () => {
                this.video.removeEventListener('loadeddata', onLoadedData);
                this.video.removeEventListener('error', onError);
                resolve();
            };

            const onError = (error) => {
                this.video.removeEventListener('loadeddata', onLoadedData);
                this.video.removeEventListener('error', onError);
                reject(error);
            };

            this.video.addEventListener('loadeddata', onLoadedData);
            this.video.addEventListener('error', onError);

            this.video.play().catch(reject);
        });
    }

    async stopCamera() {
        try {
            if (this.stream) {
                this.stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('Stopped camera track:', track.label);
                });
                this.stream = null;
            }

            if (this.video) {
                this.video.srcObject = null;
            }

            return true;
        } catch (error) {
            console.error('Camera stop failed:', error);
            return false;
        }
    }

    async switchFacingMode() {
        try {
            const currentFacing = this.constraints.video.facingMode;
            const newFacing = currentFacing === 'environment' ? 'user' : 'environment';
            
            await this.startCamera(newFacing);
            return newFacing;
        } catch (error) {
            console.error('Facing mode switch failed:', error);
            throw error;
        }
    }

    getErrorMessage(error) {
        const errorMessages = {
            'NotAllowedError': 'Camera permission denied. Please allow camera access.',
            'NotFoundError': 'No camera found on this device.',
            'NotSupportedError': 'Camera not supported on this device.',
            'OverconstrainedError': 'Camera settings not supported.',
            'SecurityError': 'Camera access blocked by security policy.',
            'AbortError': 'Camera access was interrupted.',
            'NotReadableError': 'Camera is already in use by another application.',
            'TypeError': 'Camera configuration error.'
        };

        return errorMessages[error.name] || `Camera error: ${error.message}`;
    }

    onStreamReady(callback) { this.callbacks.onStreamReady = callback; }
    onError(callback) { this.callbacks.onError = callback; }
    onDeviceChange(callback) { this.callbacks.onDeviceChange = callback; }

    triggerCallback(callbackName, data) {
        if (this.callbacks[callbackName]) {
            this.callbacks[callbackName](data);
        }
    }

    async handleDeviceChange() {
        const previousDeviceCount = this.devices.length;
        await this.enumerateDevices();
        
        if (this.devices.length !== previousDeviceCount) {
            this.triggerCallback('onDeviceChange', {
                devices: this.devices,
                currentIndex: this.currentDeviceIndex
            });
        }
    }

    destroy() {
        this.stopCamera();
        this.callbacks = {};
        this.devices = [];
        this.isInitialized = false;
    }
}

// 🎨 Enhanced QR Generator Class
class QRGeneratorModule {
    constructor() {
        this.canvas = null;
        this.defaultOptions = {
            width: 256,
            height: 256,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M'
        };
    }

    init() {
        this.canvas = document.getElementById('qr-canvas');
        if (!this.canvas) {
            console.error('QR canvas not found');
        }
    }

    async generate(content, customOptions = {}) {
        if (!this.canvas) {
            throw new Error('QR canvas not initialized');
        }

        if (!content || content.trim() === '') {
            throw new Error('Content cannot be empty');
        }

        try {
            const options = { ...this.defaultOptions, ...customOptions };
            
            // Validate content length
            const maxLength = this.getMaxLength(options.errorCorrectionLevel);
            if (content.length > maxLength) {
                throw new Error(`Content too long. Max ${maxLength} characters for ${options.errorCorrectionLevel} error correction.`);
            }

            await QRCode.toCanvas(this.canvas, content, options);
            this.addEnhancements();
            
            return {
                success: true,
                canvas: this.canvas,
                dataURL: this.canvas.toDataURL('image/png', 1.0),
                content: content,
                size: content.length
            };
        } catch (error) {
            console.error('QR generation failed:', error);
            throw new Error(`QR generation failed: ${error.message}`);
        }
    }

    getMaxLength(errorCorrectionLevel) {
        const limits = {
            'L': 2953, // Low
            'M': 2331, // Medium  
            'Q': 1663, // Quartile
            'H': 1273  // High
        };
        return limits[errorCorrectionLevel] || limits['M'];
    }

    addEnhancements() {
        if (!this.canvas) return;

        this.addShineEffect();
        this.addCanvasShadow();
    }

    addShineEffect() {
        const shine = document.querySelector('.qr-shine');
        if (shine) {
            shine.style.animation = 'none';
            shine.offsetHeight; // Force reflow
            shine.style.animation = 'shine 2s ease-in-out';
            
            setTimeout(() => {
                shine.style.animation = '';
            }, 2000);
        }
    }

    addCanvasShadow() {
        if (this.canvas) {
            this.canvas.style.filter = 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))';
            this.canvas.style.transition = 'filter 0.3s ease';
        }
    }

    async generateWithTheme(content, theme = 'auto') {
        const currentTheme = theme === 'auto' 
            ? document.body.getAttribute('data-theme') || 'dark'
            : theme;

        let colorOptions = {};
        
        if (currentTheme === 'dark') {
            colorOptions = {
                color: {
                    dark: '#FFFFFF',
                    light: '#0D1117'
                }
            };
        } else {
            colorOptions = {
                color: {
                    dark: '#1E293B', 
                    light: '#F8FAFC'
                }
            };
        }

        return await this.generate(content, colorOptions);
    }

    downloadQR(filename = null, format = 'png', quality = 1.0) {
        if (!this.canvas) {
            throw new Error('No QR code to download');
        }

        try {
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            link.download = filename || `scanzo-qr-${timestamp}.${format}`;
            
            if (format === 'jpg' || format === 'jpeg') {
                link.href = this.canvas.toDataURL('image/jpeg', quality);
            } else {
                link.href = this.canvas.toDataURL('image/png', quality);
            }
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            return {
                success: true,
                filename: link.download,
                format: format,
                size: link.href.length
            };
        } catch (error) {
            console.error('Download failed:', error);
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    async shareQR(title = 'ScanzoQR Code', text = 'Check out this QR code!') {
        if (!this.canvas) {
            throw new Error('No QR code to share');
        }

        try {
            if (navigator.share && navigator.canShare) {
                const blob = await this.getQRData('blob');
                const file = new File([blob], 'qr-code.png', { type: 'image/png' });

                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: title,
                        text: text,
                        files: [file]
                    });
                    return { success: true, method: 'native' };
                }
            }

            // Fallback to clipboard
            if (navigator.clipboard && navigator.clipboard.write) {
                const blob = await this.getQRData('blob');
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                return { success: true, method: 'clipboard' };
            }

            throw new Error('Sharing not supported');
        } catch (error) {
            console.error('Share failed:', error);
            throw error;
        }
    }

    async getQRData(format = 'dataURL') {
        if (!this.canvas) {
            throw new Error('No QR code generated');
        }

        try {
            switch (format) {
                case 'dataURL':
                    return this.canvas.toDataURL('image/png', 1.0);
                    
                case 'blob':
                    return new Promise(resolve => {
                        this.canvas.toBlob(resolve, 'image/png', 1.0);
                    });
                    
                case 'imageData':
                    const context = this.canvas.getContext('2d');
                    return context.getImageData(0, 0, this.canvas.width, this.canvas.height);
                    
                case 'base64':
                    const dataURL = this.canvas.toDataURL('image/png', 1.0);
                    return dataURL.split(',')[1];
                    
                default:
                    throw new Error('Unsupported format');
            }
        } catch (error) {
            console.error('Failed to get QR data:', error);
            throw error;
        }
    }

    clear() {
        if (this.canvas) {
            const context = this.canvas.getContext('2d');
            context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}

// 🎯 Enhanced QR Scanner Class
class QRScannerModule {
    constructor() {
        this.isScanning = false;
        this.scanCallback = null;
        this.statusCallback = null;
        this.stream = null;
        this.video = null;
        this.canvas = null;
    }

    onScanSuccess(callback) {
        this.scanCallback = callback;
    }

    onStatusChange(callback) {
        this.statusCallback = callback;
    }

    updateStatus(message, status) {
        if (this.statusCallback) {
            this.statusCallback(message, status);
        }
    }

    async startCamera() {
        try {
            this.video = document.getElementById('scanner-video');
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported on this device');
            }

            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            await new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play().then(resolve).catch(reject);
                };
                this.video.onerror = reject;
                setTimeout(() => reject(new Error('Video load timeout')), 10000);
            });

            this.isScanning = true;
            this.startDetection();
            this.updateStatus('Scanning for QR codes...', 'active');
            
            return true;
        } catch (error) {
            console.error('Camera start error:', error);
            
            let errorMessage = 'Camera access failed';
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Camera permission denied';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No camera found';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'Camera not supported';
            }
            
            this.updateStatus(errorMessage, 'error');
            throw new Error(errorMessage);
        }
    }

    stopCamera() {
        try {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            if (this.video) {
                this.video.srcObject = null;
            }

            this.isScanning = false;
            this.updateStatus('Camera stopped', 'ready');
        } catch (error) {
            console.error('Camera stop error:', error);
        }
    }

    async switchCamera() {
        if (!this.stream) {
            throw new Error('Camera not started');
        }

        this.stopCamera();
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.startCamera();
        
        return 'environment'; // Simplified for now
    }

    startDetection() {
        if (!this.isScanning || !this.stream || !this.video) return;

        this.canvas = this.canvas || this.createCanvas();
        const context = this.canvas.getContext('2d');

        const detectQR = () => {
            if (!this.isScanning || !this.video.videoWidth || !this.video.videoHeight) {
                if (this.isScanning) {
                    requestAnimationFrame(detectQR);
                }
                return;
            }

            try {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                context.drawImage(this.video, 0, 0);
                
                const imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
                
                if (window.jsQR) {
                    const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "dontInvert"
                    });
                    
                    if (qrCode) {
                        this.handleQRFound(qrCode);
                        return;
                    }
                }

                if (this.isScanning) {
                    requestAnimationFrame(detectQR);
                }
            } catch (error) {
                console.error('QR detection error:', error);
                if (this.isScanning) {
                    setTimeout(detectQR, 100);
                }
            }
        };

        detectQR();
    }

    createCanvas() {
        let canvas = document.getElementById('scanner-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'scanner-canvas';
            canvas.style.display = 'none';
            document.body.appendChild(canvas);
        }
        return canvas;
    }

    handleQRFound(qrCode) {
        this.isScanning = false;
        
        if (this.scanCallback) {
            this.scanCallback(qrCode.data);
        }
        
        this.updateStatus('QR code found!', 'success');
        this.showScanSuccess();
    }

    showScanSuccess() {
        const scanArea = document.querySelector('.scan-area');
        if (scanArea) {
            const currentTheme = document.body.getAttribute('data-theme');
            const successColor = currentTheme === 'dark' ? '#00E676' : '#4CAF50';
            
            scanArea.style.borderColor = successColor;
            scanArea.style.boxShadow = `0 0 20px ${successColor}50`;
            
            setTimeout(() => {
                scanArea.style.borderColor = '';
                scanArea.style.boxShadow = '';
            }, 1000);
        }
    }

    async scanFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('Invalid file type'));
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = () => {
                    try {
                        const tempCanvas = document.createElement('canvas');
                        const tempContext = tempCanvas.getContext('2d');
                        
                        tempCanvas.width = img.width;
                        tempCanvas.height = img.height;
                        tempContext.drawImage(img, 0, 0);
                        
                        const imageData = tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                        
                        if (window.jsQR) {
                            const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
                                inversionAttempts: "attemptBoth"
                            });
                            
                            if (qrCode) {
                                resolve(qrCode.data);
                            } else {
                                reject(new Error('No QR code found in image'));
                            }
                        } else {
                            reject(new Error('jsQR library not loaded'));
                        }
                    } catch (error) {
                        reject(new Error('Failed to process image'));
                    }
                };
                
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    destroy() {
        this.stopCamera();
        
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        this.scanCallback = null;
        this.statusCallback = null;
    }
}

// 🌟 Enhanced Theme Manager Class
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || this.getSystemTheme();
        this.init();
    }

    getSystemTheme() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    init() {
        this.apply();
        this.bindEvents();
        this.watchSystemTheme();
    }

    bindEvents() {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                this.toggle();
            });
        }
    }

    watchSystemTheme() {
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem('theme-manual')) {
                    this.theme = e.matches ? 'dark' : 'light';
                    this.apply();
                }
            });
        }
    }

    toggle() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme-manual', 'true');
        this.apply();
        this.animate();
        
        // Trigger custom event
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme: this.theme }
        }));
    }

    apply() {
        document.body.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        
        const toggle = document.getElementById('theme-toggle');
        const icon = toggle?.querySelector('i');
        
        if (this.theme === 'dark') {
            if (icon) icon.className = 'fas fa-sun';
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0D1117');
        } else {
            if (icon) icon.className = 'fas fa-moon';
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f8fafc');
        }
    }

    animate() {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.style.transform = 'scale(0.8) rotate(180deg)';
            setTimeout(() => {
                toggle.style.transform = '';
            }, 200);
        }
    }
}

// 🚀 Main ScanzoQR App Class
class ScanzoQRApp {
    constructor() {
        this.currentTab = 'home';
        this.currentMode = 'public';
        this.currentType = 'text';
        this.history = [];
        this.isScanning = false;
        this.lastScannedContent = null;
        this.encryptedContent = null;
        this.toastTimeout = null;
        this.deferredPrompt = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Initializing ScanzoQR App v2.1.0...');
            
            // Initialize modules
            this.themeManager = new ThemeManager();
            this.storageManager = new StorageManager();
            this.cameraHandler = new CameraHandler();
            this.qrGenerator = new QRGeneratorModule();
            this.qrScanner = new QRScannerModule();
            
            // Load history
            this.history = await this.storageManager.loadHistory();
            
            // Set up scanner callbacks
            this.qrScanner.onScanSuccess((data) => {
                this.processScanResult(data);
            });
            
            this.qrScanner.onStatusChange((message, status) => {
                this.updateScannerStatus(message, status);
            });
            
            // Wait for DOM ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
            
            console.log('✅ ScanzoQR App initialized successfully');
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.showError('App failed to initialize: ' + error.message);
        }
    }

    setup() {
        try {
            console.log('🔧 Setting up app components...');
            
            this.bindEvents();
            this.qrGenerator.init();
            this.loadHistory();
            this.updateStats();
            this.checkPermissions();
            this.initPWA();
            this.animate();
            
            this.toast('ScanzoQR loaded successfully! 🔥', 'success');
            console.log('✅ App setup completed');
        } catch (error) {
            console.error('❌ App setup failed:', error);
            this.showError('App setup failed: ' + error.message);
        }
    }

    bindEvents() {
        try {
            // Navigation
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.switchTab(e.target.closest('.nav-btn').dataset.tab);
                });
            });

            // Mode & Type
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.switchMode(e.target.closest('.mode-btn').dataset.mode);
                });
            });

            document.querySelectorAll('.type-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.switchType(e.target.closest('.type-btn').dataset.type);
                });
            });

            // File upload
            this.setupFileUpload();
            this.setupPasswordFeatures();
            this.setupTextInput();

            // Generate QR
            const generateBtn = document.getElementById('generate-btn');
            if (generateBtn) {
                generateBtn.addEventListener('click', () => this.generateQR());
            }

            // QR Actions
            const downloadBtn = document.getElementById('download-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => this.downloadQR());
            }

            const saveBtn = document.getElementById('save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => this.saveToHistory());
            }

            const shareBtn = document.getElementById('share-btn');
            if (shareBtn) {
                shareBtn.addEventListener('click', () => this.shareQR());
            }

            // Scanner controls
            const startScanBtn = document.getElementById('start-scan');
            if (startScanBtn) {
                startScanBtn.addEventListener('click', () => this.startCamera());
            }

            const stopScanBtn = document.getElementById('stop-scan');
            if (stopScanBtn) {
                stopScanBtn.addEventListener('click', () => this.stopCamera());
            }

            const uploadQrBtn = document.getElementById('upload-qr');
            if (uploadQrBtn) {
                uploadQrBtn.addEventListener('click', () => {
                    const fileInput = document.getElementById('qr-upload');
                    if (fileInput) fileInput.click();
                });
            }

            const switchCameraBtn = document.getElementById('switch-camera');
            if (switchCameraBtn) {
                switchCameraBtn.addEventListener('click', () => this.switchCamera());
            }

            // QR Upload
            const qrUpload = document.getElementById('qr-upload');
            if (qrUpload) {
                qrUpload.addEventListener('change', (e) => {
                    if (e.target.files[0]) this.scanFromFile(e.target.files[0]);
                });
            }

            // Unlock
            const unlockBtn = document.getElementById('unlock-btn');
            if (unlockBtn) {
                unlockBtn.addEventListener('click', () => this.unlockQR());
            }

            const unlockPassword = document.getElementById('unlock-password');
            if (unlockPassword) {
                unlockPassword.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.unlockQR();
                });
            }

            // Result actions
            const copyResultBtn = document.getElementById('copy-result');
            if (copyResultBtn) {
                copyResultBtn.addEventListener('click', () => this.copyResult());
            }

            const downloadResultBtn = document.getElementById('download-result');
            if (downloadResultBtn) {
                downloadResultBtn.addEventListener('click', () => this.downloadResult());
            }

            const saveResultBtn = document.getElementById('save-result');
            if (saveResultBtn) {
                saveResultBtn.addEventListener('click', () => this.saveResult());
            }

            // History
            const clearHistoryBtn = document.getElementById('clear-history');
            if (clearHistoryBtn) {
                clearHistoryBtn.addEventListener('click', () => this.clearHistory());
            }

            const exportHistoryBtn = document.getElementById('export-history');
            if (exportHistoryBtn) {
                exportHistoryBtn.addEventListener('click', () => this.exportHistory());
            }

            // Filter & Search
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.filterHistory(e.target.dataset.filter));
            });
            
            const historySearch = document.getElementById('history-search');
            if (historySearch) {
                historySearch.addEventListener('input', (e) => {
                    this.searchHistory(e.target.value);
                });
            }

            const clearSearchBtn = document.getElementById('clear-search');
            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => {
                    const searchInput = document.getElementById('history-search');
                    if (searchInput) {
                        searchInput.value = '';
                        this.searchHistory('');
                    }
                });
            }

            // Toast
            const toastClose = document.querySelector('.toast-close');
            if (toastClose) {
                toastClose.addEventListener('click', () => this.hideToast());
            }

            // Mobile events
            this.setupMobileEvents();
            
            console.log('✅ Events bound successfully');
        } catch (error) {
            console.error('❌ Event binding failed:', error);
        }
    }

    setupMobileEvents() {
        // Prevent zoom on double tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (this.isScanning) {
                    this.restartCamera();
                }
            }, 500);
        });

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isScanning) {
                this.pauseScanning();
            } else if (!document.hidden && this.qrScanner?.stream && !this.isScanning) {
                this.resumeScanning();
            }
        });

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    setupFileUpload() {
        const upload = document.getElementById('file-upload');
        const input = document.getElementById('image-file');
        
        if (upload && input) {
            upload.addEventListener('click', () => input.click());
            
            upload.addEventListener('dragover', (e) => {
                e.preventDefault();
                upload.style.background = 'rgba(255, 107, 53, 0.1)';
            });
            
            upload.addEventListener('dragleave', () => {
                upload.style.background = '';
            });
            
            upload.addEventListener('drop', (e) => {
                e.preventDefault();
                upload.style.background = '';
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    this.handleFile(file);
                } else {
                    this.toast('Please select a valid image file', 'error');
                }
            });
            
            input.addEventListener('change', (e) => {
                if (e.target.files[0]) this.handleFile(e.target.files[0]);
            });
        }
    }

    handleFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        if (!allowedTypes.includes(file.type)) {
            this.toast('Unsupported file type. Use JPG, PNG, GIF, or WebP', 'error');
            return;
        }
        
        if (file.size > maxSize) {
            this.toast('File too large (max 10MB)', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('image-preview');
            if (preview) {
                preview.innerHTML = `
                    <div style="position: relative; display: inline-block; max-width: 100%;">
                        <img src="${e.target.result}" 
                             style="max-width: 100%; max-height: 300px; border-radius: 12px; box-shadow: var(--shadow);"
                             alt="Image preview">
                        <button onclick="this.parentElement.parentElement.innerHTML=''; this.parentElement.parentElement.classList.remove('active');" 
                                style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px;"
                                aria-label="Remove image">
                            <i class="fas fa-times"></i>
                        </button>
                        <div style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                            ${this.formatFileSize(file.size)}
                        </div>
                    </div>
                `;
                preview.classList.add('active');
            }
            this.toast('Image loaded successfully! 📸', 'success');
        };
        
        reader.onerror = () => {
            this.toast('Failed to load image', 'error');
        };
        
        reader.readAsDataURL(file);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    setupPasswordFeatures() {
        const passwordToggle = document.querySelector('.password-toggle');
        const passwordInput = document.getElementById('qr-password');

        if (passwordToggle) {
            passwordToggle.addEventListener('click', () => this.togglePassword());
        }

        if (passwordInput) {
            passwordInput.addEventListener('input', () => this.checkPasswordStrength());
        }
    }

    setupTextInput() {
        const textInput = document.getElementById('text-content');
        
        if (textInput) {
            textInput.addEventListener('input', () => {
                this.updateCharCounter();
                this.autoResize(textInput);
            });

            textInput.addEventListener('paste', () => {
                setTimeout(() => this.autoResize(textInput), 10);
            });
        }
    }

    // Tab Management
    switchTab(tab) {
        if (!tab) return;

        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const tabContent = document.getElementById(tab);
        if (tabContent) tabContent.classList.add('active');

        this.currentTab = tab;

        if (tab === 'history') {
            this.loadHistory();
            this.updateStats();
        } else if (tab !== 'scan') {
            this.stopCamera();
        }

        // Update URL for sharing
        if (history.replaceState) {
            history.replaceState(null, null, `#${tab}`);
        }

        // Update live region for screen readers
        const liveRegion = document.getElementById('live-region');
        if (liveRegion) {
            liveRegion.textContent = `Switched to ${tab} tab`;
        }
    }

    switchMode(mode) {
        if (!mode) return;

        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-mode="${mode}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        const passwordSection = document.getElementById('password-section');
        if (passwordSection) {
            if (mode === 'private') {
                passwordSection.classList.add('active');
            } else {
                passwordSection.classList.remove('active');
            }
        }

        this.currentMode = mode;
        this.toast(`Switched to ${mode} mode 🔧`, 'success', 1500);
    }

    switchType(type) {
        if (!type) return;

        document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-type="${type}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        document.querySelectorAll('.input-container').forEach(container => container.classList.remove('active'));
        const inputContainer = document.getElementById(`${type}-input`);
        if (inputContainer) inputContainer.classList.add('active');

        this.currentType = type;
    }

    // Password Management
    togglePassword() {
        const input = document.getElementById('qr-password');
        const icon = document.querySelector('.password-toggle i');
        
        if (input && icon) {
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        }
    }

    checkPasswordStrength() {
        const password = document.getElementById('qr-password')?.value || '';
        const fill = document.querySelector('.strength-fill');
        const text = document.querySelector('.strength-text');
        
        if (!fill || !text) return;
        
        let strength = 0;
        if (password.length >= 6) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
        const colors = ['#EF4444', '#F59E0B', '#FF6B35', '#10B981', '#22C55E'];
        
        fill.style.width = `${(strength / 5) * 100}%`;
        fill.style.background = colors[Math.min(strength, 4)];
        text.textContent = levels[Math.min(strength, 4)];
    }

    updateCharCounter() {
        const input = document.getElementById('text-content');
        const counter = document.getElementById('char-count');
        
        if (input && counter) {
            const count = input.value.length;
            counter.textContent = count.toLocaleString();
            
            // Update progress bar if it exists
            const progressBar = document.querySelector('.char-progress');
            if (progressBar) {
                const maxLength = 2953;
                const percentage = (count / maxLength) * 100;
                progressBar.style.width = `${Math.min(percentage, 100)}%`;
            }
        }
    }

    autoResize(textarea) {
        if (!textarea) return;
        
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
    }

    // QR Generation
    async generateQR() {
        this.showLoading(true, 'Generating QR...');
        const generateBtn = document.getElementById('generate-btn');
        
        if (generateBtn) {
            generateBtn.disabled = true;
        }

        try {
            let content = '';
            
            if (this.currentType === 'text') {
                const textInput = document.getElementById('text-content');
                content = textInput ? textInput.value.trim() : '';
                if (!content) throw new Error('Please enter some text!');
            } else {
                const preview = document.getElementById('image-preview');
                if (!preview || !preview.classList.contains('active')) {
                    throw new Error('Please select an image!');
                }
                const img = preview.querySelector('img');
                content = img ? img.src : '';
                if (!content) throw new Error('Invalid image selected!');
            }

            if (this.currentMode === 'private') {
                const passwordInput = document.getElementById('qr-password');
                const password = passwordInput ? passwordInput.value : '';
                if (!password) throw new Error('Please set a password for private mode!');
                if (password.length < 4) throw new Error('Password must be at least 4 characters!');
                
                content = await this.encryptContent(content, password);
                content = `SCANZO_PRIVATE:${content}`;
            }

            await this.qrGenerator.generate(content);
            this.showQRResult();
            this.toast('QR code generated! 🔥', 'success');

        } catch (error) {
            console.error('QR generation error:', error);
            this.toast(error.message, 'error');
        } finally {
            this.showLoading(false);
            if (generateBtn) {
                generateBtn.disabled = false;
            }
        }
    }

    async encryptContent(content, password) {
        const data = {
            content,
            timestamp: Date.now(),
            salt: Math.random().toString(36).substring(2, 15)
        };
        
        const encrypted = btoa(JSON.stringify({
            data: btoa(JSON.stringify(data)),
            hash: await this.hashPassword(password + data.salt)
        }));
        
        return encrypted;
    }

    async hashPassword(input) {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    async decryptContent(encrypted, password) {
        try {
            const parsed = JSON.parse(atob(encrypted));
            const data = JSON.parse(atob(parsed.data));
            const expectedHash = await this.hashPassword(password + data.salt);
            
            if (parsed.hash !== expectedHash) {
                throw new Error('Invalid password');
            }
            
            return data.content;
        } catch {
            throw new Error('Failed to decrypt or invalid password');
        }
    }

    showQRResult() {
        const result = document.getElementById('qr-result');
        const title = document.getElementById('qr-title');
        const desc = document.getElementById('qr-description');
        const mode = document.getElementById('qr-mode');
        const type = document.getElementById('qr-type');

        if (title) {
            title.textContent = `${this.currentMode.charAt(0).toUpperCase() + this.currentMode.slice(1)} QR Code`;
        }

        if (desc) {
            desc.textContent = this.currentMode === 'private' 
                ? 'Password required to unlock' 
                : 'Ready to share instantly!';
        }
        
        if (mode) {
            mode.textContent = this.currentMode.charAt(0).toUpperCase() + this.currentMode.slice(1);
        }

        if (type) {
            type.textContent = this.currentType.charAt(0).toUpperCase() + this.currentType.slice(1);
        }

        if (result) {
            result.classList.add('active');
            result.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Enhanced Camera & Scanner
    async startCamera() {
        try {
            this.showLoading(true, 'Starting camera...');
            await this.qrScanner.startCamera();
            this.isScanning = true;
            this.toast('Camera started! 📷', 'success');
        } catch (error) {
            console.error('Camera start error:', error);
            this.toast('Unable to access camera. Please check permissions.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    stopCamera() {
        this.qrScanner.stopCamera();
        this.isScanning = false;
    }

    async switchCamera() {
        try {
            const newFacing = await this.qrScanner.switchCamera();
            this.toast(`Switched to camera`, 'success');
        } catch (error) {
            console.error('Camera switch error:', error);
            this.toast('Failed to switch camera', 'error');
        }
    }

    async restartCamera() {
        this.stopCamera();
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.startCamera();
    }

    pauseScanning() {
        this.isScanning = false;
        this.updateScannerStatus('Scanning paused', 'warning');
    }

    resumeScanning() {
        if (this.qrScanner?.stream) {
            this.isScanning = true;
            this.qrScanner.startDetection();
            this.updateScannerStatus('Scanning resumed...', 'active');
        }
    }

    updateScannerStatus(message, status) {
        const statusEl = document.getElementById('scanner-status');
        const icon = statusEl?.querySelector('i');
        const text = statusEl?.querySelector('span');
        
        if (text) text.textContent = message;
        if (statusEl) statusEl.className = `status-indicator ${status}`;
        
        const icons = {
            ready: 'fas fa-circle',
            active: 'fas fa-circle-notch fa-spin',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            success: 'fas fa-check-circle'
        };
        
        if (icon) icon.className = icons[status] || 'fas fa-circle';
    }

    async scanFromFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.toast('Please select a valid image file', 'error');
            return;
        }

        this.showLoading(true, 'Analyzing image...');

        try {
            const content = await this.qrScanner.scanFromFile(file);
            this.processScanResult(content);
        } catch (error) {
            console.error('File scan error:', error);
            this.toast('No QR code found in image', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    processScanResult(content) {
        const result = document.getElementById('scan-result');
        const typeEl = document.getElementById('result-type');
        const prompt = document.getElementById('password-prompt');
        const display = document.getElementById('content-display');

        this.stopCamera();

        if (content.startsWith('SCANZO_PRIVATE:')) {
            this.encryptedContent = content.substring(15);
            if (typeEl) {
                typeEl.innerHTML = '<i class="fas fa-lock"></i><span>Private</span>';
                typeEl.className = 'result-type private';
            }
            if (prompt) prompt.classList.add('active');
            if (display) display.style.display = 'none';
        } else {
            if (typeEl) {
                typeEl.innerHTML = '<i class="fas fa-globe"></i><span>Public</span>';
                typeEl.className = 'result-type public';
            }
            if (prompt) prompt.classList.remove('active');
            this.displayContent(content);
        }

        if (result) {
            result.classList.add('active');
            result.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        this.toast('QR code scanned! 🎯', 'success');
    }

    async unlockQR() {
        const passwordInput = document.getElementById('unlock-password');
        const errorEl = document.getElementById('password-error');
        const unlockBtn = document.getElementById('unlock-btn');
        
        const password = passwordInput ? passwordInput.value : '';

        if (!password) {
            this.showError(errorEl, 'Please enter the password');
            return;
        }

        if (unlockBtn) {
            unlockBtn.disabled = true;
            unlockBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Unlocking...';
        }

        try {
            const content = await this.decryptContent(this.encryptedContent, password);
            this.displayContent(content);
            
            const prompt = document.getElementById('password-prompt');
            if (prompt) prompt.classList.remove('active');
            
            this.hideError(errorEl);
            this.toast('Content unlocked! 🔓', 'success');
        } catch (error) {
            console.error('Unlock error:', error);
            this.showError(errorEl, 'Incorrect password. Please try again.');
            this.animateError(passwordInput);
        } finally {
            if (unlockBtn) {
                unlockBtn.disabled = false;
                unlockBtn.innerHTML = '<i class="fas fa-unlock"></i> Unlock';
            }
        }
    }

    showError(element, message) {
        if (element) {
            element.textContent = message;
            element.classList.add('active');
            element.style.color = '#EF4444';
        }
    }

    hideError(element) {
        if (element) {
            element.classList.remove('active');
        }
    }

    animateError(element) {
        if (element) {
            element.style.animation = 'shake 0.5s ease-in-out';
            setTimeout(() => {
                element.style.animation = '';
            }, 500);
        }
    }

    displayContent(content) {
        const display = document.getElementById('content-display');
        const textResult = document.getElementById('text-result');
        const imageResult = document.getElementById('image-result');

        if (content.startsWith('data:image/')) {
            if (imageResult) {
                imageResult.innerHTML = `
                    <div style="text-align: center;">
                        <img src="${content}" 
                             style="max-width: 100%; max-height: 400px; border-radius: 12px; box-shadow: var(--shadow);"
                             alt="Scanned image">
                    </div>
                `;
                imageResult.style.display = 'block';
            }
            if (textResult) textResult.style.display = 'none';
        } else {
            if (textResult) {
                textResult.innerHTML = `
                    <div style="background: var(--bg-surface); padding: 20px; border-radius: 12px; white-space: pre-wrap; word-break: break-word; line-height: 1.6;">
                        ${this.formatTextContent(content)}
                    </div>
                    <div style="margin-top: 12px; font-size: 14px; color: var(--text-muted); display: flex; gap: 16px;">
                        <span>${content.length.toLocaleString()} characters</span>
                        <span>${content.split(/\s+/).length.toLocaleString()} words</span>
                    </div>
                `;
                textResult.style.display = 'block';
            }
            if (imageResult) imageResult.style.display = 'none';
        }

        if (display) display.style.display = 'block';
        this.lastScannedContent = content;
    }

    formatTextContent(text) {
        return text
            .replace(/\n/g, '<br>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color: var(--primary-solid);">$1</a>')
            .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" style="color: var(--primary-solid);">$1</a>');
    }

    // QR Actions
    downloadQR() {
        try {
            const canvas = document.getElementById('qr-canvas');
            if (!canvas) {
                this.toast('No QR code to download', 'error');
                return;
            }

            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            link.download = `scanzo-qr-${this.currentMode}-${timestamp}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.toast('QR code downloaded! 📥', 'success');
        } catch (error) {
            console.error('Download error:', error);
            this.toast('Download failed', 'error');
        }
    }

    async shareQR() {
        try {
            const canvas = document.getElementById('qr-canvas');
            if (!canvas) {
                this.toast('No QR code to share', 'error');
                return;
            }
            
            if (navigator.share && navigator.canShare) {
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], 'scanzo-qr.png', { type: 'image/png' });
                    
                    try {
                        await navigator.share({
                            title: 'ScanzoQR Code',
                            text: `Check out this ${this.currentMode} QR code!`,
                            files: [file]
                        });
                        this.toast('Shared successfully! 📤', 'success');
                    } catch (shareError) {
                        if (shareError.name !== 'AbortError') {
                            this.fallbackShare();
                        }
                    }
                });
            } else {
                this.fallbackShare();
            }
        } catch (error) {
            console.error('Share error:', error);
            this.toast('Share failed', 'error');
        }
    }

    fallbackShare() {
        try {
            const canvas = document.getElementById('qr-canvas');
            if (!canvas) return;

            canvas.toBlob(async (blob) => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    this.toast('QR code copied to clipboard! 📋', 'success');
                } catch {
                    this.toast('Share not supported. Use download instead.', 'warning');
                }
            });
        } catch (error) {
            this.toast('Share not available', 'warning');
        }
    }

    async saveToHistory() {
        try {
            const canvas = document.getElementById('qr-canvas');
            if (!canvas) {
                this.toast('No QR code to save', 'error');
                return;
            }

            let content = '';
            if (this.currentType === 'text') {
                const textInput = document.getElementById('text-content');
                content = textInput ? textInput.value : '';
            } else {
                content = 'Image content';
            }

            const item = {
                id: Date.now(),
                type: 'generated',
                mode: this.currentMode,
                contentType: this.currentType,
                content,
                qrData: canvas.toDataURL(),
                timestamp: new Date().toISOString(),
                preview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
                size: content.length
            };

            this.history.unshift(item);
            await this.storageManager.saveHistory(this.history);
            this.updateStats();
            this.toast('Saved to history! 💾', 'success');
        } catch (error) {
            console.error('Save error:', error);
            this.toast('Save failed', 'error');
        }
    }

    // Result Actions
    async copyResult() {
        if (!this.lastScannedContent) {
            this.toast('No content to copy', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(this.lastScannedContent);
            this.toast('Content copied to clipboard! 📋', 'success');
        } catch (error) {
            console.error('Copy error:', error);
            this.toast('Failed to copy to clipboard', 'error');
        }
    }

    downloadResult() {
        if (!this.lastScannedContent) {
            this.toast('No content to download', 'warning');
            return;
        }

        try {
            const blob = new Blob([this.lastScannedContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            link.download = `scanned-content-${timestamp}.txt`;
            link.href = url;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            this.toast('Content downloaded! 📥', 'success');
        } catch (error) {
            console.error('Download result error:', error);
            this.toast('Download failed', 'error');
        }
    }

    async saveResult() {
        if (!this.lastScannedContent) {
            this.toast('No content to save', 'warning');
            return;
        }

        try {
            const item = {
                id: Date.now(),
                type: 'scanned',
                mode: 'public',
                contentType: this.lastScannedContent.startsWith('data:image/') ? 'image' : 'text',
                content: this.lastScannedContent,
                timestamp: new Date().toISOString(),
                preview: this.lastScannedContent.startsWith('data:image/') 
                    ? 'Image content' 
                    : this.lastScannedContent.substring(0, 100) + (this.lastScannedContent.length > 100 ? '...' : ''),
                size: this.lastScannedContent.length
            };

            this.history.unshift(item);
            await this.storageManager.saveHistory(this.history);
            this.updateStats();
            this.toast('Saved to history! 💾', 'success');
        } catch (error) {
            console.error('Save result error:', error);
            this.toast('Save failed', 'error');
        }
    }

    // History Management
    loadHistory() {
        const list = document.getElementById('history-list');
        const empty = document.getElementById('history-empty');

        if (this.history.length === 0) {
            if (list) list.style.display = 'none';
            if (empty) empty.style.display = 'block';
            return;
        }

        if (list) list.style.display = 'block';
        if (empty) empty.style.display = 'none';

        if (list) {
            list.innerHTML = this.history.map((item, index) => `
                <div class="history-item" data-id="${item.id}" style="animation-delay: ${index * 0.05}s">
                    <div class="history-item-header">
                        <div class="history-item-info">
                            <h4>
                                <i class="fas fa-${this.getHistoryIcon(item)}" aria-hidden="true"></i>
                                ${item.contentType} - ${item.mode}
                            </h4>
                            <p>
                                ${item.type === 'generated' ? 'Generated' : 'Scanned'} • 
                                ${new Date(item.timestamp).toLocaleDateString()} •
                                ${item.size ? this.formatFileSize(item.size) : ''}
                            </p>
                        </div>
                        <div class="history-item-meta">
                            <div>${new Date(item.timestamp).toLocaleTimeString()}</div>
                        </div>
                    </div>
                    <div class="history-item-preview">${item.preview}</div>
                    <div class="history-item-actions">
                        <button class="btn btn-sm btn-secondary" onclick="app.copyHistoryItem(${item.id})" title="Copy" aria-label="Copy content">
                            <i class="fas fa-copy" aria-hidden="true"></i>
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="app.downloadHistoryItem(${item.id})" title="Download" aria-label="Download content">
                            <i class="fas fa-download" aria-hidden="true"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteHistoryItem(${item.id})" title="Delete" aria-label="Delete item">
                            <i class="fas fa-trash" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    getHistoryIcon(item) {
        const icons = {
            text: item.type === 'generated' ? 'file-text' : 'file-alt',
            image: item.type === 'generated' ? 'image' : 'images'
        };
        return icons[item.contentType] || 'qrcode';
    }

    updateStats() {
        const totalEl = document.getElementById('total-qrs');
        const generatedEl = document.getElementById('generated-qrs');
        const scannedEl = document.getElementById('scanned-qrs');

        const generated = this.history.filter(item => item.type === 'generated').length;
        const scanned = this.history.filter(item => item.type === 'scanned').length;

        if (totalEl) totalEl.textContent = this.history.length;
        if (generatedEl) generatedEl.textContent = generated;
        if (scannedEl) scannedEl.textContent = scanned;
    }

    filterHistory(filter) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-filter="${filter}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        let filtered = this.history;
        if (filter !== 'all') {
            filtered = this.history.filter(item => {
                switch (filter) {
                    case 'generated': return item.type === 'generated';
                    case 'scanned': return item.type === 'scanned';
                    case 'public': return item.mode === 'public';
                    case 'private': return item.mode === 'private';
                    default: return true;
                }
            });
        }

        this.displayFilteredHistory(filtered);
    }

    searchHistory(query) {
        const clearBtn = document.getElementById('clear-search');
        if (clearBtn) {
            clearBtn.style.display = query ? 'block' : 'none';
        }

        if (!query.trim()) {
            this.loadHistory();
            return;
        }

        const filtered = this.history.filter(item =>
            item.content.toLowerCase().includes(query.toLowerCase()) ||
            item.contentType.toLowerCase().includes(query.toLowerCase()) ||
            item.mode.toLowerCase().includes(query.toLowerCase()) ||
            item.type.toLowerCase().includes(query.toLowerCase())
        );

        this.displayFilteredHistory(filtered);
    }

    displayFilteredHistory(items) {
        const list = document.getElementById('history-list');
        const empty = document.getElementById('history-empty');

        if (items.length === 0) {
            if (list) list.style.display = 'none';
            if (empty) {
                empty.style.display = 'block';
                empty.innerHTML = `
                    <div class="empty-icon"><i class="fas fa-search" aria-hidden="true"></i></div>
                    <h3>No results found</h3>
                    <p>Try different search terms or filters</p>
                `;
            }
            return;
        }

        if (list) list.style.display = 'block';
        if (empty) empty.style.display = 'none';

        if (list) {
            list.innerHTML = items.map((item, index) => `
                <div class="history-item" data-id="${item.id}" style="animation-delay: ${index * 0.05}s">
                    <div class="history-item-header">
                        <div class="history-item-info">
                            <h4>
                                <i class="fas fa-${this.getHistoryIcon(item)}" aria-hidden="true"></i>
                                ${item.contentType} - ${item.mode}
                            </h4>
                            <p>
                                ${item.type === 'generated' ? 'Generated' : 'Scanned'} • 
                                ${new Date(item.timestamp).toLocaleDateString()}
                            </p>
                        </div>
                        <div class="history-item-meta">
                            <div>${new Date(item.timestamp).toLocaleTimeString()}</div>
                        </div>
                    </div>
                    <div class="history-item-preview">${item.preview}</div>
                    <div class="history-item-actions">
                        <button class="btn btn-sm btn-secondary" onclick="app.copyHistoryItem(${item.id})" aria-label="Copy content">
                            <i class="fas fa-copy" aria-hidden="true"></i>
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="app.downloadHistoryItem(${item.id})" aria-label="Download content">
                            <i class="fas fa-download" aria-hidden="true"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteHistoryItem(${item.id})" aria-label="Delete item">
                            <i class="fas fa-trash" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    async copyHistoryItem(id) {
        const item = this.history.find(h => h.id === id);
        if (!item) return;

        try {
            await navigator.clipboard.writeText(item.content);
            this.toast('Content copied! 📋', 'success');
        } catch (error) {
            console.error('Copy history item error:', error);
            this.toast('Copy failed', 'error');
        }
    }

    downloadHistoryItem(id) {
        const item = this.history.find(h => h.id === id);
        if (!item) return;

        try {
            if (item.qrData && item.qrData !== 'stored_in_indexeddb') {
                const link = document.createElement('a');
                link.download = `qr-code-${item.id}.png`;
                link.href = item.qrData;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const blob = new Blob([item.content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `content-${item.id}.txt`;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
            this.toast('Downloaded! 📥', 'success');
        } catch (error) {
            console.error('Download history item error:', error);
            this.toast('Download failed', 'error');
        }
    }

    async deleteHistoryItem(id) {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            this.history = this.history.filter(h => h.id !== id);
            await this.storageManager.saveHistory(this.history);
            this.loadHistory();
            this.updateStats();
            this.toast('Item deleted! 🗑️', 'warning');
        } catch (error) {
            console.error('Delete history item error:', error);
            this.toast('Delete failed', 'error');
        }
    }

    async clearHistory() {
        if (!confirm('Are you sure you want to clear all history? This action cannot be undone.')) return;

        try {
            this.history = [];
            await this.storageManager.saveHistory(this.history);
            this.loadHistory();
            this.updateStats();
            this.toast('History cleared! 🧹', 'warning');
        } catch (error) {
            console.error('Clear history error:', error);
            this.toast('Clear failed', 'error');
        }
    }

    async exportHistory() {
        try {
            const exportData = await this.storageManager.exportHistory();
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            link.download = `scanzo-history-${timestamp}.json`;
            link.href = url;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            this.toast('History exported! 📤', 'success');
        } catch (error) {
            console.error('Export history error:', error);
            this.toast('Export failed', 'error');
        }
    }

    // Permissions
    async checkPermissions() {
        try {
            if ('permissions' in navigator) {
                const permission = await navigator.permissions.query({ name: 'camera' });
                console.log('Camera permission:', permission.state);
                
                permission.addEventListener('change', () => {
                    console.log('Camera permission changed:', permission.state);
                });
            }
        } catch (error) {
            console.warn('Permissions API not supported');
        }
    }

    // UI Helpers
    showLoading(show, text = 'Working...') {
        const loading = document.getElementById('loading');
        const loadingText = document.querySelector('.loading-text');
        
        if (show) {
            if (loadingText) loadingText.textContent = text;
            if (loading) loading.classList.add('active');
        } else {
            if (loading) loading.classList.remove('active');
        }
    }

    showError(message) {
        const errorBoundary = document.getElementById('error-boundary');
        const errorMessage = document.getElementById('error-message');
        const app = document.getElementById('app');
        
        if (errorMessage) errorMessage.textContent = message;
        if (errorBoundary) errorBoundary.style.display = 'block';
        if (app) app.style.display = 'none';
    }

    toast(message, type = 'success', duration = 3000) {
        const toast = document.getElementById('toast');
        const icon = document.querySelector('.toast-icon');
        const msg = document.querySelector('.toast-message');
        const progress = document.querySelector('.toast-progress');

        if (!toast) return;

        toast.className = `toast ${type}`;
        clearTimeout(this.toastTimeout);
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        if (icon) icon.className = `toast-icon ${icons[type]}`;
        if (msg) msg.textContent = message;

        toast.classList.add('show');
        
        if (progress) {
            progress.style.width = '100%';
            progress.style.transition = `width ${duration}ms linear`;
            
            setTimeout(() => {
                progress.style.width = '0%';
            }, 50);
        }

        this.toastTimeout = setTimeout(() => this.hideToast(), duration);
        
        // Also log to console
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    hideToast() {
        const toast = document.getElementById('toast');
        const progress = document.querySelector('.toast-progress');
        
        if (toast) toast.classList.remove('show');
        if (progress) {
            progress.style.transition = '';
            progress.style.width = '100%';
        }
        
        clearTimeout(this.toastTimeout);
    }

    // PWA
    initPWA() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                try {
                    const registration = await navigator.serviceWorker.register('./sw.js');
                    console.log('✅ SW registered:', registration);
                    
                    // Handle service worker updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                this.showUpdateAvailable();
                            }
                        });
                    });
                } catch (error) {
                    console.log('❌ SW registration failed:', error);
                }
            });
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Show install prompt after user interaction
            setTimeout(() => {
                if (this.deferredPrompt && !sessionStorage.getItem('installDismissed')) {
                    this.showInstallPrompt();
                }
            }, 5000);
        });

        window.addEventListener('appinstalled', () => {
            this.toast('App installed successfully! 🎉', 'success');
            this.deferredPrompt = null;
        });
    }

    showInstallPrompt() {
        // Install prompt is handled in the HTML file for better UX
        console.log('Install prompt available');
    }

    showUpdateAvailable() {
        this.toast('App update available! Reload to get the latest version.', 'info', 5000);
    }

    animate() {
        // Animate elements on load
        setTimeout(() => {
            document.querySelectorAll('.animate-slide-up, .animate-fade-up')
                .forEach((el, index) => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                });
        }, 100);

        // Set up intersection observer for scroll animations
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            }, { threshold: 0.1 });

            document.querySelectorAll('.feature-card, .history-item').forEach(el => {
                observer.observe(el);
            });
        }
    }

    cleanup() {
        this.stopCamera();
        this.qrScanner?.destroy();
        this.cameraHandler?.destroy();
        
        if (this.deferredPrompt) {
            this.deferredPrompt = null;
        }
        
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        
        console.log('🧹 App cleanup completed');
    }
}

// Global function for tab switching (keeping for inline onclick handlers)
function switchTab(tab) {
    if (window.app) {
        window.app.switchTab(tab);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing ScanzoQR...');
    
    // Check for required libraries
    if (typeof QRCode === 'undefined' || typeof jsQR === 'undefined') {
        console.error('❌ Required libraries not loaded');
        
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: #0D1117; color: #F0F6FC; display: flex;
            align-items: center; justify-content: center; text-align: center;
            padding: 20px; z-index: 10000; flex-direction: column;
        `;
        errorDiv.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h2 style="color: #FF6B35; margin-bottom: 16px;">Libraries Not Loaded</h2>
            <p style="margin-bottom: 24px; max-width: 400px;">
                QR code libraries failed to load. Please check your internet connection and refresh the page.
            </p>
            <button onclick="location.reload()" style="padding: 12px 24px; background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-refresh"></i> Reload Page
            </button>
        `;
        document.body.appendChild(errorDiv);
        return;
    }
    
    try {
        window.app = new ScanzoQRApp();
        console.log('✅ ScanzoQR App initialized successfully');
    } catch (error) {
        console.error('❌ App initialization failed:', error);
    }
});

// Fallback initialization
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('📋 Document already loaded, initializing immediately...');
    
    setTimeout(() => {
        if (!window.app) {
            try {
                window.app = new ScanzoQRApp();
                console.log('✅ ScanzoQR App initialized (fallback)');
            } catch (error) {
                console.error('❌ Fallback initialization failed:', error);
            }
        }
    }, 100);
}

console.log('📜 ScanzoQR Script v2.1.0 loaded successfully');
