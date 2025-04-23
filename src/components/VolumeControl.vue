<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import audioService from '../services/AudioService';
import { useParticleStore } from '../stores/particleStore';

// Component state
const volume = ref(0.5);
const isMuted = ref(false);
const particleStore = useParticleStore();

// Set initial values from audioService
onMounted(() => {
  // Initialize audio on first user interaction
  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('keydown', initAudio, { once: true });
  
  // Set initial values
  volume.value = audioService.getVolume();
  isMuted.value = audioService.isMuted();
});

// Initialize audio context
function initAudio() {
  audioService.initialize().catch(error => {
    console.error('Failed to initialize audio:', error);
  });
}

// Set volume when slider changes
function setVolume(e: Event) {
  const newVolume = parseFloat((e.target as HTMLInputElement).value);
  volume.value = newVolume;
  audioService.setVolume(newVolume);
  
  // If user sets volume to 0, mute the audio
  if (newVolume === 0 && !isMuted.value) {
    toggleMute();
  } 
  // If user increases volume from 0 and is muted, unmute
  else if (newVolume > 0 && isMuted.value) {
    toggleMute();
  }
}

// Toggle mute state
function toggleMute() {
  isMuted.value = !isMuted.value;
  audioService.setMuted(isMuted.value);
}

// Toggle particles
function toggleParticles() {
  particleStore.toggleParticles();
}

// Watch for changes to maintain sync with audio service
watch(volume, (newVolume) => {
  audioService.setVolume(newVolume);
});

watch(isMuted, (newMuted) => {
  audioService.setMuted(newMuted);
});
</script>

<template>
  <div class="volume-control">
    <button 
      @click="toggleMute" 
      class="mute-button"
    >
      <span v-if="isMuted">🔇</span>
      <span v-else>🔊</span>
    </button>
    
    <input 
      type="range" 
      min="0" 
      max="1" 
      step="0.01" 
      class="volume-slider"
      :value="volume"
      @input="setVolume" 
    />
    
    <label class="particle-toggle" title="Toggle particle effects">
      <input 
        type="checkbox" 
        :checked="particleStore.enabled"
        @change="toggleParticles"
      />
      <span>✨</span>
    </label>
  </div>
</template>

<style scoped>
.volume-control {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 15px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.3);
}

.mute-button {
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.mute-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100px;
  height: 5px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.particle-toggle {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.6);
  transition: color 0.2s ease;
  padding: 4px;
}

.particle-toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.particle-toggle input:checked + span {
  color: white;
}

.particle-toggle:hover {
  color: white;
}
</style> 