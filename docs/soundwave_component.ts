import { Modal } from 'obsidian';

// SoundWaveVisualizer.ts
export class SoundWaveVisualizer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private animationId: number | null = null;
    private isRecording: boolean = false;

    constructor(container: HTMLElement, width: number = 200, height: number = 60) {
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.canvas.style.backgroundColor = '#f5f5f5';
        this.canvas.style.borderRadius = '4px';
        
        this.ctx = this.canvas.getContext('2d')!;
        container.appendChild(this.canvas);
        
        // Start with static wave
        this.drawStaticWave();
    }

    // Initialize audio context and analyser
    async initAudioContext(stream: MediaStream): Promise<void> {
        try {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            
            this.analyser = audioContext.createAnalyser();
            this.analyser.fftSize = 128; // Smaller for performance
            this.analyser.smoothingTimeConstant = 0.8;
            
            source.connect(this.analyser);
            
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
        }
    }

    // Start recording visualization
    startRecording(stream: MediaStream): void {
        this.isRecording = true;
        this.initAudioContext(stream).then(() => {
            this.animate();
        });
    }

    // Stop recording visualization
    stopRecording(): void {
        this.isRecording = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.drawStaticWave();
    }

    // Animation loop for real-time visualization
    private animate(): void {
        if (!this.isRecording || !this.analyser || !this.dataArray) return;

        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw waveform
        this.drawWaveform(this.dataArray);
    }

    // Draw the actual waveform
    private drawWaveform(dataArray: Uint8Array): void {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerY = height / 2;
        
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#666666';
        this.ctx.beginPath();
        
        const sliceWidth = width / dataArray.length;
        let x = 0;
        
        // Create smooth wave based on frequency data
        for (let i = 0; i < dataArray.length; i++) {
            const amplitude = (dataArray[i] / 255.0) * 0.8; // Scale down
            const y = centerY + (Math.sin(x * 0.02 + Date.now() * 0.005) * amplitude * centerY);
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        this.ctx.stroke();
    }

    // Draw static wave when not recording
    private drawStaticWave(): void {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerY = height / 2;
        
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#cccccc';
        this.ctx.beginPath();
        
        // Draw flat line
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(width, centerY);
        this.ctx.stroke();
    }

    // Clean up
    destroy(): void {
        this.stopRecording();
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// Usage in your recording modal
export class RecordingModal extends Modal {
    private soundWave: SoundWaveVisualizer;
    private mediaRecorder: MediaRecorder | null = null;

    onOpen() {
        const { contentEl } = this;
        
        // Create modal structure
        const timerContainer = contentEl.createEl('div', { cls: 'timer-container' });
        const timerDisplay = timerContainer.createEl('div', { text: '00:00.00', cls: 'timer-display' });
        
        // Add sound wave container
        const waveContainer = contentEl.createEl('div', { cls: 'wave-container' });
        waveContainer.style.display = 'flex';
        waveContainer.style.justifyContent = 'center';
        waveContainer.style.margin = '20px 0';
        
        // Initialize sound wave visualizer
        this.soundWave = new SoundWaveVisualizer(waveContainer, 200, 60);
        
        // Add buttons container
        const buttonsContainer = contentEl.createEl('div', { cls: 'buttons-container' });
        const startButton = buttonsContainer.createEl('button', { text: 'Start', cls: 'start-button' });
        
        // Button event handlers
        startButton.addEventListener('click', this.startRecording.bind(this));
    }

    private async startRecording(): Promise<void> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Start sound wave visualization
            this.soundWave.startRecording(stream);
            
            // Initialize MediaRecorder for actual recording
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.start();
            
            // Update UI
            // ... your existing recording logic
            
        } catch (error) {
            console.error('Failed to start recording:', error);
        }
    }

    private stopRecording(): void {
        // Stop sound wave visualization
        this.soundWave.stopRecording();
        
        // Stop media recorder
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
        }
        
        // ... your existing stop logic
    }

    onClose() {
        // Clean up
        if (this.soundWave) {
            this.soundWave.destroy();
        }
        super.onClose();
    }
}