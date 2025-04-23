<script setup lang="ts">
import { onMounted } from 'vue';
import GameCanvas from '../components/GameCanvas.vue';
import GameControls from '../components/GameControls.vue';
import gameManager from '../game/GameManager';

// Game dimensions
const gameWidth = 800;
const gameHeight = 600;

// Initialize game when component mounts
onMounted(() => {
  // Start the game in single player mode
  gameManager.initializeHost();
  gameManager.startGame();
});
</script>

<template>
  <div class="game-view">
    <header>
      <h1>Multiplayer Pong</h1>
    </header>
    
    <main class="game-container">
      <GameCanvas :width="gameWidth" :height="gameHeight" />
    </main>
    
    <footer class="controls-container">
      <GameControls />
    </footer>
  </div>
</template>

<style scoped>
.game-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
}

header {
  padding: 10px 0;
  text-align: center;
}

h1 {
  margin: 0;
  color: #34495e;
  font-size: 24px;
  font-weight: 500;
  letter-spacing: 1px;
}

.game-container {
  flex: 1;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.controls-container {
  width: 100%;
}

@media (prefers-color-scheme: dark) {
  h1 {
    color: #ecf0f1;
  }
}
</style> 