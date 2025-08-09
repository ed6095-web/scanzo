// 📱 Enhanced Camera Handler Module
class CameraHandler {
    constructor() {
        this.stream = null;
        this.video = null;
        this.devices = [];
        this.currentDeviceIndex = 0;
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

    // Initialize camera system
    async init(videoElement) {
        try {
            this.video = videoElement || document.getElementById('scanner-video');
            
            if (!this.video) {
                throw new Error('Video element not found');
            }

            // Check for camera support
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

    // Set up event listeners for camera handling
    setupEventListeners() {
        // Handle device changes (camera connected/disconnected)
        if (navigator.mediaDevices.addEventListener) {
            navigator.mediaDevices.addEventListener('devicechange', () => {
                this.handleDeviceChange();
            });
        }

        // Handle video events
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

    // Enumerate available camera devices
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

    // Handle device changes
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

    // Start camera with specified constraints
    async startCamera(facingMode = 'environment', deviceId = null) {
        try {
            if (!this.isInitialized) {
                throw new Error('Camera handler not initialized');
            }

            // Stop existing stream
            await this.stopCamera();

            // Build constraints
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

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            // Wait for video to be ready
            await this.waitForVideoReady();

            // Update current facing mode
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
            
            let userFriendlyMessage = this.getErrorMessage(error);
            this.triggerCallback('onError', new Error(userFriendlyMessage));
            
            throw new Error(userFriendlyMessage);
        }
    }

    // Wait for video to be ready for processing
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

            // Auto play video
            this.video.play().catch(reject);
        });
    }

    // Stop camera and clean up
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

    // Switch between available cameras
    async switchCamera() {
        try {
            if (this.devices.length <= 1) {
                throw new Error('Only one camera available');
            }

            this.currentDeviceIndex = (this.currentDeviceIndex + 1) % this.devices.length;
            const selectedDevice = this.devices[this.currentDeviceIndex];

            await this.startCamera(null, selectedDevice.deviceId);

            return {
                device: selectedDevice,
                index: this.currentDeviceIndex
            };

        } catch (error) {
            console.error('Camera switch failed:', error);
            throw error;
        }
    }

    // Switch between front and back camera (mobile)
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

    // Check camera permissions
    async checkPermissions() {
        try {
            if ('permissions' in navigator) {
                const permission = await navigator.permissions.query({ name: 'camera' });
                return {
                    state: permission.state,
                    granted: permission.state === 'granted',
                    denied: permission.state === 'denied'
                };
            }

            // Fallback: try to access camera
            try {
                const testStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1, height: 1 }
                });
                testStream.getTracks().forEach(track => track.stop());
                return { state: 'granted', granted: true, denied: false };
            } catch {
                return { state: 'denied', granted: false, denied: true };
            }

        } catch (error) {
            console.warn('Permission check failed:', error);
            return { state: 'prompt', granted: false, denied: false };
        }
    }

    // Request camera permissions
    async requestPermissions() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1, height: 1 }
            });
            
            stream.getTracks().forEach(track => track.stop());
            return true;

        } catch (error) {
            console.error('Permission request failed:', error);
            return false;
        }
    }

    // Get camera capabilities
    async getCameraCapabilities() {
        if (!this.stream) {
            throw new Error('No active camera stream');
        }

        try {
            const track = this.stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            const settings = track.getSettings();
            const constraints = track.getConstraints();

            return {
                capabilities,
                settings,
                constraints,
                label: track.label
            };

        } catch (error) {
            console.error('Failed to get camera capabilities:', error);
            return null;
        }
    }

    // Apply camera settings
    async applyCameraSettings(settings) {
        if (!this.stream) {
            throw new Error('No active camera stream');
        }

        try {
            const track = this.stream.getVideoTracks()[0];
            await track.applyConstraints(settings);
            return true;

        } catch (error) {
            console.error('Failed to apply camera settings:', error);
            return false;
        }
    }

    // Get user-friendly error messages
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

    // Set callback functions
    onStreamReady(callback) {
        this.callbacks.onStreamReady = callback;
    }

    onError(callback) {
        this.callbacks.onError = callback;
    }

    onDeviceChange(callback) {
        this.callbacks.onDeviceChange = callback;
    }

    // Trigger callbacks
    triggerCallback(callbackName, data) {
        if (this.callbacks[callbackName]) {
            this.callbacks[callbackName](data);
        }
    }

    // Get current camera info
    getCurrentCameraInfo() {
        if (!this.stream) {
            return null;
        }

        const track = this.stream.getVideoTracks()[0];
        return {
            label: track.label,
            settings: track.getSettings(),
            facingMode: this.constraints.video.facingMode,
            deviceId: track.getSettings().deviceId,
            isActive: track.readyState === 'live'
        };
    }

    // Clean up resources
    destroy() {
        this.stopCamera();
        
        if (this.video) {
            this.video.removeEventListener('loadedmetadata', this.handleVideoMetadata);
            this.video.removeEventListener('error', this.handleVideoError);
        }

        this.callbacks = {};
        this.devices = [];
        this.isInitialized = false;
    }
}

// Export for use
window.CameraHandler = CameraHandler;
