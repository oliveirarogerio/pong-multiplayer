/**
 * Audio Service for the Pong game
 * Handles loading, playing and managing game audio
 */
export class AudioService {
  private context: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private volume: number = 0.5;
  private muted: boolean = false;
  private initialized: boolean = false;
  private gainNode: GainNode | null = null;

  /**
   * Initialize the audio context
   * Must be called after a user interaction
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();

    try {
      // Create audio context
      this.context = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Create master gain node
      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = this.muted ? 0 : this.volume;
      this.gainNode.connect(this.context.destination);// Preload game sounds
      await this.preloadGameSounds();

      this.initialized = true;
      return Promise.resolve();
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
      return Promise.reject(error);
    }
  }

  /**
   * Add a sound to the library
   * @param id Sound identifier
   * @param buffer Audio buffer for the sound
   */
  public addSound(id: string, buffer: AudioBuffer): void {
    this.sounds.set(id, buffer);
  }

  /**
   * Play a sound by ID
   * @param id Sound identifier
   * @param volumeMultiplier Volume multiplier (0-1)
   * @param pitch Pitch multiplier (default: 1.0)
   */
  public playSound(
    id: string,
    volumeMultiplier: number = 1,
    pitch: number = 1.0
  ): void {
    if (!this.initialized || !this.context || !this.gainNode || this.muted) {
      return;
    }

    const buffer = this.sounds.get(id);
    if (!buffer) {
      console.warn(`Sound not found: ${id}`);
      return;
    }

    // Create source node
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = pitch;

    // Create gain node for this sound
    const gainNode = this.context.createGain();
    gainNode.gain.value = this.volume * volumeMultiplier;

    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(this.gainNode);

    // Play the sound
    source.start(0);
  }

  /**
   * Set the master volume
   * @param volume Volume level (0-1)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));

    if (this.gainNode && !this.muted) {
      this.gainNode.gain.value = this.volume;
    }
  }

  /**
   * Get the current volume level
   */
  public getVolume(): number {
    return this.volume;
  }

  /**
   * Set mute state
   * @param muted Whether audio should be muted
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;

    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : this.volume;
    }
  }

  /**
   * Get the current mute state
   */
  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Preload all game sounds
   */
  private async preloadGameSounds(): Promise<void> {
    if (!this.context) {
      return Promise.reject(new Error("Audio context not initialized"));
    }

    const soundFiles = {
      paddle_hit: "/sounds/paddle_hit.mp3",
      wall_hit: "/sounds/wall_hit.mp3",
      score: "/sounds/score.mp3",
      game_over: "/sounds/game_over.mp3",
      countdown: "/sounds/countdown.mp3",
      start: "/sounds/start.mp3",
    };

    const loadPromises = Object.entries(soundFiles).map(async ([id, path]) => {
      try {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        this.addSound(id, audioBuffer);} catch (error) {
        console.warn(`Failed to load sound ${id} from ${path}:`, error);
      }
    });

    return Promise.all(loadPromises).then(() => {});
  }

  /**
   * Check if audio is enabled
   */
  public isAudioEnabled(): boolean {
    return this.initialized && !this.muted;
  }

  /**
   * Get current mute state
   */
  public isMutedState(): boolean {
    return this.muted;
  }

  /**
   * Get the master volume
   */
  public getMasterVolume(): number {
    return this.volume;
  }
}

// Export a singleton instance
const audioService = new AudioService();
export default audioService;
