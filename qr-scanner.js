// 🎯 Enhanced QR Scanner Module
class QRScannerModule {
    constructor() {
        this.isScanning = false;
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.facingMode = 'environment';
        this.scanCallback = null;
        this.statusCallback = null;
        
        this.init();
    }

    init() {
        this.video = document.getElementById('scanner-video');
        this.canvas = this.createScannerCanvas();
        this.context = this.canvas.getContext('2d');
        this.bindEvents();
    }

    createScannerCanvas() {
        let canvas = document.getElementById('scanner-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'scanner-canvas';
            canvas.style.display = 'none';
            document.body.appendChild(canvas);
        }
        return canvas;
    }

    bindEvents() {
        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isScanning) {
                this.pauseScanning();
            } else if (!document.hidden && this.stream && !this.isScanning) {
                this.resumeScanning();
            }
        });

        // Handle orientation change for mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (this.isScanning) {
                    this.restartScanning();
                }
            }, 500);
        });
    }

    // Set callbacks
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

    // Enhanced camera access with better error handling
    async startCamera() {
        try {
            this.updateStatus('Starting camera...', 'loading');

            // Check if getUserMedia is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported on this device');
            }

            const constraints = {
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    frameRate: { ideal: 30, max: 30 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play()
                        .then(resolve)
                        .catch(reject);
                };
                
                this.video.onerror = reject;
                
                // Timeout after 10 seconds
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
            } else if (error.name === 'OverconstrainedError') {
                errorMessage = 'Camera constraints not supported';
            }
            
            this.updateStatus(errorMessage, 'error');
            throw new Error(errorMessage);
        }
    }

    stopCamera() {
        try {
            if (this.stream) {
                this.stream.getTracks().forEach(track => {
                    track.stop();
                });
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

        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        await this.restartScanning();
        
        return this.facingMode;
    }

    async restartScanning() {
        this.stopCamera();
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.startCamera();
    }

    pauseScanning() {
        this.isScanning = false;
        this.updateStatus('Scanning paused', 'warning');
    }

    resumeScanning() {
        if (this.stream) {
            this.isScanning = true;
            this.startDetection();
            this.updateStatus('Scanning resumed...', 'active');
        }
    }

    // Enhanced QR detection with jsQR
    startDetection() {
        if (!this.isScanning || !this.stream || !this.video) return;

        const detectQR = () => {
            if (!this.isScanning || !this.video.videoWidth || !this.video.videoHeight) {
                if (this.isScanning) {
                    requestAnimationFrame(detectQR);
                }
                return;
            }

            try {
                // Set canvas size to match video
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;

                // Draw current video frame to canvas
                this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

                // Get image data for QR detection
                const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

                // Use jsQR for detection
                const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert"
                });

                if (qrCode) {
                    // QR code found!
                    this.handleQRFound(qrCode);
                    return;
                }

                // Continue scanning
                if (this.isScanning) {
                    requestAnimationFrame(detectQR);
                }

            } catch (error) {
                console.error('QR detection error:', error);
                if (this.isScanning) {
                    setTimeout(detectQR, 100); // Retry after 100ms
                }
            }
        };

        detectQR();
    }

    handleQRFound(qrCode) {
        this.isScanning = false;
        
        if (this.scanCallback) {
            this.scanCallback(qrCode.data);
        }
        
        this.updateStatus('QR code found!', 'success');
        
        // Add visual feedback
        this.showScanSuccess();
    }

    showScanSuccess() {
        // Add success animation to scan area
        const scanArea = document.querySelector('.scan-area');
        if (scanArea) {
            scanArea.style.borderColor = '#00E676';
            scanArea.style.boxShadow = '0 0 20px rgba(0, 230, 118, 0.5)';
            
            setTimeout(() => {
                scanArea.style.borderColor = '';
                scanArea.style.boxShadow = '';
            }, 1000);
        }
    }

    // Scan from uploaded file
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
                        // Create temporary canvas for file scanning
                        const tempCanvas = document.createElement('canvas');
                        const tempContext = tempCanvas.getContext('2d');
                        
                        tempCanvas.width = img.width;
                        tempCanvas.height = img.height;
                        tempContext.drawImage(img, 0, 0);
                        
                        const imageData = tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                        
                        // Try different inversion attempts for better detection
                        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "attemptBoth"
                        });
                        
                        if (qrCode) {
                            resolve(qrCode.data);
                        } else {
                            reject(new Error('No QR code found in image'));
                        }
                        
                    } catch (error) {
                        reject(new Error('Failed to process image'));
                    }
                };
                
                img.onerror = () => {
                    reject(new Error('Failed to load image'));
                };
                
                img.src = e.target.result;
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsDataURL(file);
        });
    }

    // Get available cameras
    async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        } catch (error) {
            console.error('Failed to enumerate devices:', error);
            return [];
        }
    }

    // Check camera permissions
    async checkPermissions() {
        try {
            if ('permissions' in navigator) {
                const permission = await navigator.permissions.query({ name: 'camera' });
                return permission.state;
            }
            return 'prompt';
        } catch (error) {
            console.warn('Permissions API not supported');
            return 'prompt';
        }
    }

    // Clean up resources
    destroy() {
        this.stopCamera();
        
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        this.scanCallback = null;
        this.statusCallback = null;
    }
}

// Export for use
window.QRScannerModule = QRScannerModule;
