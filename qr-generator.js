// 🎨 Enhanced QR Generator Module
class QRGeneratorModule {
    constructor() {
        this.canvas = null;
        this.defaultOptions = {
            width: 256,
            height: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'M'
        };
        
        this.init();
    }

    init() {
        this.canvas = document.getElementById('qr-canvas');
        if (!this.canvas) {
            console.error('QR canvas not found');
        }
    }

    // Generate QR code with enhanced options
    async generate(content, customOptions = {}) {
        if (!this.canvas) {
            throw new Error('QR canvas not initialized');
        }

        if (!content || content.trim() === '') {
            throw new Error('Content cannot be empty');
        }

        try {
            // Merge options
            const options = { ...this.defaultOptions, ...customOptions };
            
            // Validate content length
            const maxLength = this.getMaxLength(options.errorCorrectionLevel);
            if (content.length > maxLength) {
                throw new Error(`Content too long. Max ${maxLength} characters for ${options.errorCorrectionLevel} error correction.`);
            }

            // Generate QR code
            await QRCode.toCanvas(this.canvas, content, options);
            
            // Add visual enhancements
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

    // Get maximum content length based on error correction level
    getMaxLength(errorCorrectionLevel) {
        const limits = {
            'L': 2953, // Low
            'M': 2331, // Medium
            'Q': 1663, // Quartile
            'H': 1273  // High
        };
        return limits[errorCorrectionLevel] || limits['M'];
    }

    // Add visual enhancements to generated QR
    addEnhancements() {
        if (!this.canvas) return;

        // Add shine effect
        this.addShineEffect();
        
        // Add subtle shadow
        this.addCanvasShadow();
    }

    addShineEffect() {
        const shine = document.querySelector('.qr-shine');
        if (shine) {
            shine.style.animation = 'none';
            // Force reflow
            shine.offsetHeight;
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

    // Generate with custom colors based on theme
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

    // Generate with custom styling
    async generateStyled(content, style = 'default') {
        let options = {};

        switch (style) {
            case 'rounded':
                options = {
                    width: 300,
                    height: 300,
                    margin: 3,
                    color: {
                        dark: '#667eea',
                        light: '#ffffff'
                    }
                };
                break;
                
            case 'minimal':
                options = {
                    width: 200,
                    height: 200,
                    margin: 1,
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    }
                };
                break;
                
            case 'high-contrast':
                options = {
                    width: 256,
                    height: 256,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    },
                    errorCorrectionLevel: 'H'
                };
                break;
                
            default:
                options = this.defaultOptions;
        }

        return await this.generate(content, options);
    }

    // Download QR code with custom filename
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

    // Get QR code as different formats
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

    // Share QR code (mobile-friendly)
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

    // Validate QR content
    validateContent(content, type = 'text') {
        if (!content) {
            return { valid: false, error: 'Content is required' };
        }

        switch (type) {
            case 'text':
                if (content.length > 2953) {
                    return { valid: false, error: 'Text too long (max 2953 characters)' };
                }
                break;
                
            case 'url':
                try {
                    new URL(content);
                } catch {
                    return { valid: false, error: 'Invalid URL format' };
                }
                break;
                
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(content)) {
                    return { valid: false, error: 'Invalid email format' };
                }
                break;
        }

        return { valid: true };
    }

    // Get QR code info
    getQRInfo() {
        if (!this.canvas) {
            return null;
        }

        return {
            width: this.canvas.width,
            height: this.canvas.height,
            hasContent: true,
            format: 'PNG',
            timestamp: new Date().toISOString()
        };
    }

    // Clear current QR code
    clear() {
        if (this.canvas) {
            const context = this.canvas.getContext('2d');
            context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}

// Export for use
window.QRGeneratorModule = QRGeneratorModule;
