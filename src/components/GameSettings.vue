<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import audioService from '../services/AudioService';
import particleService from '../services/ParticleService';
import gameManager from '../game/GameManager';
import { GameConfig, DEFAULT_CONFIG } from '../types';

// State for settings
const volume = ref(0.5);
const isMuted = ref(false);
const audioEnabled = ref(false);
const particlesEnabled = ref(true);
const hasInteracted = ref(false);

// Get game config from the game state instead
const gameState = ref(gameManager.getGameState());
const gameConfig = ref<GameConfig>(gameState.value.config);

// Dynamic gameplay settings
const powerUpsEnabled = ref<boolean>(gameConfig.value.enablePowerUps || false);
const turboModeEnabled = ref<boolean>(gameConfig.value.enableTurboMode || false);
const paddleShrinkingEnabled = ref<boolean>(gameConfig.value.enablePaddleShrinking || false);
const curveBallEnabled = ref<boolean>(gameConfig.value.enableCurveBall || false);

// Initialize with current values
onMounted(() => {
  volume.value = audioService.getVolume();
  isMuted.value = audioService.isMuted();
  audioEnabled.value = audioService.isAudioEnabled();
  particlesEnabled.value = particleService.isParticlesEnabled();
  
  // Add user interaction listeners to enable audio
  document.addEventListener('click', initializeAudio, { once: true });
  document.addEventListener('keydown', initializeAudio, { once: true });

  // Initialize with current game config
  gameConfig.value = { ...DEFAULT_CONFIG, ...gameManager.getGame().getConfig() };
});

// Update volume
function updateVolume(e: Event) {
  const newVolume = parseFloat((e.target as HTMLInputElement).value);
  volume.value = newVolume;
  audioService.setVolume(newVolume);
  
  // If setting volume to zero, also mute
  if (newVolume === 0 && !isMuted.value) {
    toggleMute();
  }
  // If increasing volume from zero and it's muted, unmute
  else if (newVolume > 0 && isMuted.value) {
    toggleMute();
  }
}

// Toggle mute
function toggleMute() {
  isMuted.value = !isMuted.value;
  audioService.setMuted(isMuted.value);
  
  if (!isMuted.value && hasInteracted.value) {
    // Play a sound when unmuting as feedback
    audioService.playSound('paddle_hit', 0.5);
  }
}

// Toggle particles
function toggleParticles() {
  particlesEnabled.value = !particlesEnabled.value;
  particleService.setEnabled(particlesEnabled.value);
  
  if (audioEnabled.value && !isMuted.value) {
    // Play a sound when toggling particles
    audioService.playSound('wall_hit', 0.5);
  }
}

// Initialize audio context
function initializeAudio() {
  hasInteracted.value = true;
  audioService.initialize()
    .then(() => {
      audioEnabled.value = true;})
    .catch(error => {
      console.error('Failed to initialize audio:', error);
      audioEnabled.value = false;
    });
}

/**
 * Update game configuration settings
 */
function updateConfig() {
  gameManager.updateConfig(gameConfig.value);
}

/**
 * Toggle power-ups
 */
function togglePowerUps() {
  powerUpsEnabled.value = !powerUpsEnabled.value;
  updateConfig();
}

/**
 * Toggle turbo mode
 */
function toggleTurboMode() {
  turboModeEnabled.value = !turboModeEnabled.value;
  updateConfig();
}

/**
 * Toggle paddle shrinking
 */
function togglePaddleShrinking() {
  paddleShrinkingEnabled.value = !paddleShrinkingEnabled.value;
  updateConfig();
}

/**
 * Toggle curve ball physics
 */
function toggleCurveBall() {
  curveBallEnabled.value = !curveBallEnabled.value;
  updateConfig();
}

// Watch for changes in game configuration
watch(gameConfig, () => {
  updateConfig();
}, { deep: true });
</script>

<template>
  <div class="settings-control">
    <h3>Game Settings</h3>
    
    <div class="settings-section">
      <h4>Audio</h4>
      
      <div class="volume-control">
        <button 
          @click="toggleMute" 
          class="mute-button"
          :class="{ 'muted': isMuted }"
        >
          <span v-if="isMuted">🔇</span>
          <span v-else-if="volume <= 0.3">🔈</span>
          <span v-else-if="volume <= 0.7">🔉</span>
          <span v-else>🔊</span>
        </button>
        
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          class="volume-slider"
          :value="volume"
          @input="updateVolume" 
        />
      </div>
      
      <div v-if="!hasInteracted" class="audio-message">
        Click or press a key to initialize audio
      </div>
    </div>
    
    <div class="settings-section">
      <h4>Visual Effects</h4>
      
      <div class="toggle-control">
        <span class="toggle-label">Particles</span>
        <label class="toggle-switch">
          <input 
            type="checkbox" 
            :checked="particlesEnabled"
            @change="toggleParticles"
          />
          <span class="slider"></span>
        </label>
      </div>
    </div>
    
    <div class="settings-section">
      <h3>Dynamic Gameplay</h3>
      
      <div class="setting-control">
        <label>Power-Ups</label>
        <div class="toggle-switch" @click="togglePowerUps">
          <div class="toggle-slider" :class="{ active: powerUpsEnabled }"></div>
        </div>
      </div>
      
      <div class="setting-control">
        <label>Turbo Mode</label>
        <div class="toggle-switch" @click="toggleTurboMode">
          <div class="toggle-slider" :class="{ active: turboModeEnabled }"></div>
        </div>
      </div>
      
      <div class="setting-control">
        <label>Paddle Shrinking</label>
        <div class="toggle-switch" @click="togglePaddleShrinking">
          <div class="toggle-slider" :class="{ active: paddleShrinkingEnabled }"></div>
        </div>
      </div>
      
      <div class="setting-control">
        <label>Curve Ball Physics</label>
        <div class="toggle-switch" @click="toggleCurveBall">
          <div class="toggle-slider" :class="{ active: curveBallEnabled }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-control {
  background-color: rgba(44, 62, 80, 0.8);
  border-radius: 8px;
  padding: 15px;
  color: white;
  width: 100%;
  max-width: 300px;
}

h3 {
  margin-top: 0;
  margin-bottom: 15px;
  text-align: center;
}

h4 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 16px;
  color: #ecf0f1;
}

.settings-section {
  margin-bottom: 20px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mute-button {
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.mute-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.mute-button.muted {
  opacity: 0.7;
}

.volume-slider {
  flex-grow: 1;
  -webkit-appearance: none;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.toggle-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-label {
  font-size: 14px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.3);
  transition: .4s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #2196F3;
}

input:focus + .slider {
  box-shadow: 0 0 1px #2196F3;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.audio-message {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
  text-align: center;
}

.setting-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.toggle-switch {
  cursor: pointer;
}

.toggle-slider {
  width: 20px;
  height: 20px;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  transition: background-color 0.2s;
}

.toggle-slider.active {
  background-color: #2196F3;
}
</style> 