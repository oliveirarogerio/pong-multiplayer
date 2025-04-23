<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

const error = ref<Error | null>(null);

onErrorCaptured((err: Error) => {
  error.value = err;
  return false; // Prevent error from propagating
});

const reloadPage = () => {
  window.location.reload();
};
</script>

<template>
  <div v-if="error" class="error-boundary">
    <div class="error-content">
      <h2>Oops! Something went wrong</h2>
      <p>We're sorry, but there was an error loading the game.</p>
      <p class="error-details">{{ error.message }}</p>
      <button @click="reloadPage">
        Reload Game
      </button>
    </div>
  </div>
  <slot v-else></slot>
</template>

<style scoped>
.error-boundary {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.9);
  color: white;
  z-index: 9999;
}

.error-content {
  text-align: center;
  padding: 2rem;
  background-color: #1e2a38;
  border-radius: 8px;
  max-width: 80%;
}

h2 {
  color: #ff4d4d;
  margin-bottom: 1rem;
}

.error-details {
  margin: 1rem 0;
  padding: 1rem;
  background-color: rgba(255, 77, 77, 0.1);
  border-radius: 4px;
  font-family: monospace;
  word-break: break-word;
}

button {
  padding: 0.5rem 1rem;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #2980b9;
}
</style> 