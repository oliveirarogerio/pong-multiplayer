/**
 * Utility to generate game sounds programmatically
 * This helps avoid the need for external sound files
 */
export class SoundGenerator {
  private audioContext: AudioContext | null = null;

  /**
   * Initialize audio context (or retrieve existing one)
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Generate a short beep sound
   * @param frequency Base frequency of the beep
   * @param duration Duration in seconds
   * @param type Oscillator type
   * @returns Audio buffer containing the generated sound
   */
  public async generateBeep(
    frequency: number = 440,
    duration: number = 0.05,
    type: OscillatorType = "square"
  ): Promise<AudioBuffer> {
    const ctx = this.getAudioContext();
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(duration * sampleRate);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Create simple waveform based on type
    for (let i = 0; i < bufferSize; i++) {
      const t = i / sampleRate;

      // Apply very short attack/release to avoid clicks
      let amplitude = 1;
      const attackTime = 0.005;
      const releaseTime = 0.01;

      if (t < attackTime) {
        // Attack
        amplitude = t / attackTime;
      } else if (t > duration - releaseTime) {
        // Release
        amplitude = (duration - t) / releaseTime;
      }

      // Generate waveform based on selected type
      switch (type) {
        case "sine":
          data[i] = Math.sin(2 * Math.PI * frequency * t) * amplitude;
          break;
        case "square":
          data[i] =
            Math.sign(Math.sin(2 * Math.PI * frequency * t)) * amplitude;
          break;
        case "sawtooth":
          data[i] = ((t * frequency) % 1) * 2 - 1 * amplitude;
          break;
        case "triangle":
          data[i] = Math.abs(((t * frequency) % 1) * 2 - 1) * 2 - 1 * amplitude;
          break;
        default:
          data[i] = Math.sin(2 * Math.PI * frequency * t) * amplitude;
      }
    }

    return buffer;
  }

  /**
   * Generate a paddle hit sound
   */
  public async generatePaddleHitSound(): Promise<AudioBuffer> {
    return this.generateBeep(600, 0.05, "square");
  }

  /**
   * Generate a wall hit sound
   */
  public async generateWallHitSound(): Promise<AudioBuffer> {
    return this.generateBeep(300, 0.05, "square");
  }

  /**
   * Generate a score sound
   */
  public async generateScoreSound(): Promise<AudioBuffer> {
    return this.generateBeep(800, 0.2, "square");
  }

  /**
   * Generate a game start sound
   */
  public async generateGameStartSound(): Promise<AudioBuffer> {
    return this.generateBeep(440, 0.3, "square");
  }

  /**
   * Generate a game over sound
   */
  public async generateGameOverSound(): Promise<AudioBuffer> {
    return this.generateBeep(220, 0.5, "square");
  }

  /**
   * Generate a countdown beep
   */
  public async generateCountdownSound(): Promise<AudioBuffer> {
    return this.generateBeep(500, 0.1, "square");
  }

  /**
   * Convert an AudioBuffer to a Blob URL that can be used as a source for an audio element
   */
  public audioBufferToBlob(buffer: AudioBuffer): string {
    // Create an offline context to render the sound
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    // Create a buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);

    // Start and render
    source.start(0);

    // Return a promise that resolves with the rendered audio data
    return URL.createObjectURL(
      new Blob([this.encodeWAV(buffer)], { type: "audio/wav" })
    );
  }

  /**
   * Encode AudioBuffer to WAV format
   * @param buffer AudioBuffer to encode
   * @returns ArrayBuffer containing WAV data
   */
  private encodeWAV(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    // Extract the audio data
    const channelData = [];
    for (let channel = 0; channel < numChannels; channel++) {
      channelData.push(buffer.getChannelData(channel));
    }

    // Create the buffer
    const dataLength = channelData[0].length * numChannels * (bitDepth / 8);
    const buffer1 = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer1);

    // Write the WAV header
    // "RIFF" chunk descriptor
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, "WAVE");

    // "fmt " sub-chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // byte rate
    view.setUint16(32, numChannels * (bitDepth / 8), true); // block align
    view.setUint16(34, bitDepth, true);

    // "data" sub-chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, dataLength, true);

    // Write the PCM samples
    const offset = 44;
    if (bitDepth === 16) {
      for (let i = 0; i < channelData[0].length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
          const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
          view.setInt16(offset + (i * numChannels + channel) * 2, value, true);
        }
      }
    }

    return buffer1;
  }

  /**
   * Helper to write a string to a DataView
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

// Export a singleton instance
const soundGenerator = new SoundGenerator();
export default soundGenerator;
