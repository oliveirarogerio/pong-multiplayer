<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import gameManager from '../game/GameManager';
import { GameStatus, ConnectionStatus, PlayerRole } from '../types';
import webRTCService from '../services/WebRTCService';
import VolumeControl from './VolumeControl.vue';
import audioService from '../services/AudioService';

// State
const gameStatus = ref<GameStatus>(gameManager.getGameState().status);
const connectionStatus = ref<ConnectionStatus>(webRTCService.getConnectionStatus());
const hostSessionCode = ref<string>('');
const joinSessionCode = ref<string>('');
const isHost = ref<boolean>(gameManager.getPlayerRole() === PlayerRole.HOST);
const connectionError = ref<string>('');
const isCreatingSession = ref<boolean>(false);
const isJoiningSession = ref<boolean>(false);
const sessionCode = ref<string>('');
const isGeneratingCode = ref<boolean>(false);
const codeCopied = ref<boolean>(false);

// Computed properties
const isConnected = computed(() => connectionStatus.value === ConnectionStatus.CONNECTED);
const isWaitingForOpponent = computed(() => gameStatus.value === GameStatus.WAITING_FOR_OPPONENT);
const isPlaying = computed(() => gameStatus.value === GameStatus.PLAYING);
const isPaused = computed(() => gameStatus.value === GameStatus.PAUSED);
const isGameOver = computed(() => gameStatus.value === GameStatus.GAME_OVER);

// Add new computed property for start button state
const canStartGame = computed(() => {
    // In network game, both players must be connected
    if (webRTCService.getConnectionStatus() !== ConnectionStatus.DISCONNECTED) {
        return isConnected.value && isWaitingForOpponent.value;
    }
    // In local game, can start anytime when waiting
    return isWaitingForOpponent.value;
});

// Check if there's a valid host session code to display
const hasSessionCode = computed(() => {
  return isHost.value && !!sessionCode.value;
});

// Check if we have the permanent code vs temporary
const isPermanentCode = computed(() => {
  if (!sessionCode.value) return false;
  // Code is permanent if it's different from the initial hostSessionCode
  // or contains characteristic patterns of permanent codes
  return (hostSessionCode.value && sessionCode.value !== hostSessionCode.value) || 
         (sessionCode.value.includes('EB') || sessionCode.value.length >= 6);
});

// Action handlers
function startGame() {console.log(`Current game status: ${gameManager.getGameState().status}`);gameManager.startGame();console.log(`Game status after startGame call: ${gameManager.getGameState().status}`);
}

function pauseGame() {gameManager.pauseGame();
}

function resumeGame() {gameManager.resumeGame();
}

function restartGame() {gameManager.restartGame();
}

function updateSessionCode() {
  const info = webRTCService.getSessionInfo();
  if (info && info.code) {
    const newCode = info.code;
    // Only update if code changed
    if (newCode !== sessionCode.value) {
      sessionCode.value = newCode;
      // If we get a new code that's different from the initial one,
      // we likely received the permanent code
      if (hostSessionCode.value && newCode !== hostSessionCode.value) {
        isGeneratingCode.value = false;
      }
    }
  }
}

function hostGame() {
  connectionError.value = '';
  isCreatingSession.value = true;
  isGeneratingCode.value = true;
  
  try {
    hostSessionCode.value = gameManager.initializeHost();
    isHost.value = true;
    
    // Initial temporary code
    sessionCode.value = hostSessionCode.value;
    
    const statusListener = (status: ConnectionStatus) => {
      connectionStatus.value = status;
      
      // Check for updated session code whenever status changes
      updateSessionCode();
      
      if (status === ConnectionStatus.CONNECTED) {
        isCreatingSession.value = false;
      } else if (status === ConnectionStatus.ERROR) {
        isCreatingSession.value = false;
        isGeneratingCode.value = false;
      } else if (status === ConnectionStatus.DISCONNECTED) {
        isCreatingSession.value = false;
        isGeneratingCode.value = false;
      }
    };
    
    webRTCService.onStatusChange(statusListener);
    
    // Set up an interval to check for the session code
    const checkInterval = setInterval(() => {
      updateSessionCode();
      if (sessionCode.value && sessionCode.value !== hostSessionCode.value) {
        clearInterval(checkInterval);
        isGeneratingCode.value = false;
      }
    }, 1000);
    
    // Clear interval and end loading state after 15 seconds regardless
    setTimeout(() => {
      clearInterval(checkInterval);
      isGeneratingCode.value = false;
    }, 15000);
    
    // Play sound for session creation
    if (audioService.isAudioEnabled()) {
      audioService.playSound('start', 0.5);
    }
    
  } catch (error) {
    isCreatingSession.value = false;
    isGeneratingCode.value = false;
    connectionError.value = `Failed to create session: ${error instanceof Error ? error.message : String(error)}`;
    
    // Play error sound
    if (audioService.isAudioEnabled()) {
      audioService.playSound('wall_hit', 0.7, 0.8);
    }
  }
}

async function joinGame() {
  if (joinSessionCode.value.length === 0) {
    connectionError.value = 'Please enter a session code';
    return;
  }
  
  // Format and validate the session code
  const formattedCode = joinSessionCode.value.trim().toUpperCase();
  
  // Validate format
  const sessionCodePattern = /^[A-Za-z0-9]{6,8}$/;
  if (!sessionCodePattern.test(formattedCode)) {
    connectionError.value = 'Invalid session code format (6-8 characters)';
    return;
  }
  
  connectionError.value = '';
  isJoiningSession.value = true;
  
  // Play attempt sound
  if (audioService.isAudioEnabled()) {
    audioService.playSound('countdown', 0.5);
  }
  
  try {
    const statusListener = (status: ConnectionStatus) => {
      connectionStatus.value = status;
      
      if (status === ConnectionStatus.CONNECTED) {
        isJoiningSession.value = false;
      } else if (status === ConnectionStatus.ERROR) {
        isJoiningSession.value = false;
      }
    };
    
    webRTCService.onStatusChange(statusListener);
    
    await gameManager.joinGame(formattedCode);
    isHost.value = false;
  } catch (error) {
    console.error("Error joining game:", error);
    connectionError.value = error instanceof Error ? error.message : "Failed to join game";
    isJoiningSession.value = false;
    
    // Play error sound
    if (audioService.isAudioEnabled()) {
      audioService.playSound('wall_hit', 0.7, 0.8);
    }
  }
}

function resetConnection() {
  connectionError.value = '';
  connectionStatus.value = ConnectionStatus.DISCONNECTED;
  hostSessionCode.value = '';
  joinSessionCode.value = '';
  sessionCode.value = '';
  isGeneratingCode.value = false;
  gameManager.cleanup();
}

// Register error handler
webRTCService.onError((error) => {
  connectionError.value = error.message;
  isGeneratingCode.value = false;
  
  // Play error sound
  if (audioService.isAudioEnabled()) {
    audioService.playSound('wall_hit', 0.7, 0.8);
  }
});

// Update status
function updateStatus() {
  const previousStatus = connectionStatus.value;
  gameStatus.value = gameManager.getGameState().status;
  connectionStatus.value = webRTCService.getConnectionStatus();
  
  // Play sound when connection status changes
  if (previousStatus !== connectionStatus.value) {
    if (connectionStatus.value === ConnectionStatus.CONNECTED) {
      // Play connection success sound
      if (audioService.isAudioEnabled()) {
        audioService.playSound('score', 0.7);
      }
    } else if (connectionStatus.value === ConnectionStatus.ERROR) {
      // Play error sound
      if (audioService.isAudioEnabled()) {
        audioService.playSound('wall_hit', 0.7, 0.8);
      }
    }
  }
  
  // Regularly check for session code updates
  updateSessionCode();
}

// Use onMounted to set up event listeners and initialize
onMounted(() => {
  // Initial update
  updateStatus();
  
  // Set interval for updates
  const interval = setInterval(updateStatus, 500);
  
  // Add keyboard shortcut for retry
  const handleKeyDown = (event: KeyboardEvent) => {
    // If Enter key is pressed and retry button is visible
    if (event.key === 'Enter' && 
        (connectionError.value.includes('Session not found') || 
         connectionError.value.includes('Failed to join'))) {
      // Only trigger if not already joining
      if (!isJoiningSession.value) {
        retryJoin();
      }
    }
  };
  
  // Add event listener for keydown
  window.addEventListener('keydown', handleKeyDown);
  
  onUnmounted(() => {
    clearInterval(interval);
    window.removeEventListener('keydown', handleKeyDown);
  });
});

async function retryJoin() {
  if (joinSessionCode.value.length === 0) {
    connectionError.value = 'Please enter a session code';
    return;
  }
  
  // Clear previous error and set joining state
  connectionError.value = '';
  isJoiningSession.value = true;
  
  // Play attempt sound
  if (audioService.isAudioEnabled()) {
    audioService.playSound('countdown', 0.5);
  }
  
  try {
    // Use the existing joinSessionCode
    const formattedCode = joinSessionCode.value.trim().toUpperCase();
    
    const statusListener = (status: ConnectionStatus) => {
      connectionStatus.value = status;
      
      if (status === ConnectionStatus.CONNECTED) {
        isJoiningSession.value = false;
      } else if (status === ConnectionStatus.ERROR) {
        // Set a short timeout to ensure we don't instantly reset the joining state
        // This gives better UX feedback that something is happening
        setTimeout(() => {
          isJoiningSession.value = false;
        }, 1000);
      }
    };
    
    webRTCService.onStatusChange(statusListener);
    
    await gameManager.joinGame(formattedCode);
    isHost.value = false;
  } catch (error) {
    console.error("Error retrying join:", error);
    connectionError.value = error instanceof Error ? error.message : "Failed to join game";
    
    // Set a short delay before resetting the joining state
    setTimeout(() => {
      isJoiningSession.value = false;
    }, 1000);
    
    // Play error sound
    if (audioService.isAudioEnabled()) {
      audioService.playSound('wall_hit', 0.7, 0.8);
    }
  }
}

// Copy session code to clipboard
function copySessionCode() {
  if (!sessionCode.value) return;
  
  navigator.clipboard.writeText(sessionCode.value)
    .then(() => {
      codeCopied.value = true;
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        codeCopied.value = false;
      }, 2000);
      
      // Play feedback sound
      if (audioService.isAudioEnabled()) {
        audioService.playSound('countdown', 0.3, 1.2);
      }
    })
    .catch(err => {
      console.error('Could not copy session code: ', err);
    });
}
</script>

<template>
  <div class="game-controls">
    <!-- Connection Controls -->
    <div v-if="!isConnected" class="control-section">
      <h3>Connection</h3>
      
      <!-- Error message -->
      <div v-if="connectionError" class="error-message">
        <p>{{ connectionError }}</p>
        
        <!-- Session not found error helper -->
        <p v-if="connectionError.includes('Session not found')" class="error-help">
          The session code you entered doesn't exist or has expired. Please check the code and try again, or ask the host to create a new session.
        </p>
        
        <!-- Connection failed helper -->
        <p v-if="connectionError.includes('Failed to connect')" class="error-help">
          Unable to establish a connection. This could be due to network issues or firewall settings. Check your internet connection and try again.
        </p>
        
        <!-- Timeout error helper -->
        <p v-if="connectionError.includes('timed out')" class="error-help">
          The connection request timed out. The host may have left the session or there might be network issues. Try again or ask the host to create a new session.
        </p>
        
        <!-- General error helper -->
        <p v-if="!connectionError.includes('Session not found') && 
                 !connectionError.includes('Failed to connect') && 
                 !connectionError.includes('timed out')" class="error-help">
          Something went wrong with the connection. Please try again or create a new session.
        </p>
        
        <div class="error-actions">
          <button 
            v-if="connectionError.includes('Session not found') || 
                  connectionError.includes('Failed to join') || 
                  connectionError.includes('timed out') ||
                  connectionError.includes('Failed to connect')" 
            @click="retryJoin" 
            class="retry-button pulse-animation"
            :disabled="isJoiningSession"
          >
            <span v-if="!isJoiningSession">Try Again (Enter)</span>
            <span v-else>Retrying<span class="loading-dots"></span></span>
          </button>
          <button @click="resetConnection" class="secondary-button">Reset</button>
        </div>
      </div>
      
      <div class="connection-controls">
        <!-- Host Game -->
        <div class="host-section">
          <button 
            @click="hostGame" 
            class="primary-button"
            :disabled="isCreatingSession"
          >
            {{ isCreatingSession ? 'Creating...' : 'Host Game' }}
          </button>
          
          <div v-if="hasSessionCode" class="session-code">
            <div v-if="isGeneratingCode" class="code-status-banner temporary">
              <span class="warning-icon">⚠️</span>
              <span>Generating permanent code<span class="loading-dots"></span></span>
            </div>
            <div v-else-if="!isPermanentCode" class="code-status-banner temporary">
              <span class="warning-icon">⚠️</span>
              <span>This is a temporary code - wait for permanent code</span>
            </div>
            <div v-else class="code-status-banner permanent">
              <span class="success-icon">✓</span>
              <span>Permanent code ready</span>
            </div>
            <div 
              class="code-display" 
              :class="{ 'code-temporary': !isPermanentCode, 'code-permanent': isPermanentCode }"
              @click="copySessionCode"
            >
              {{ sessionCode }}
              <span v-if="isGeneratingCode" class="code-status">generating<span class="loading-dots"></span></span>
              <span v-else-if="codeCopied" class="code-status copy-success">copied!</span>
              <span v-else class="code-status">(click to copy)</span>
            </div>
            <p class="code-note" v-if="!isPermanentCode">
              Please wait for the permanent code to be generated...
            </p>
            <p class="code-note" v-else>
              Share this permanent code with your opponent to start playing
            </p>
          </div>
        </div>
        
        <!-- Join Game -->
        <div class="join-section">
          <div class="join-input-group">
            <input
              v-model="joinSessionCode"
              placeholder="Enter code"
              class="session-input"
              :disabled="isJoiningSession"
            />
            <button 
              @click="joinGame" 
              class="primary-button"
              :disabled="isJoiningSession || !joinSessionCode"
            >
              {{ isJoiningSession ? 'Joining...' : 'Join' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Game Controls -->
    <div v-if="isConnected" class="control-section">
      <!-- Show session code for host after connected -->
      <div v-if="isHost && hasSessionCode" class="connected-session-info">
        <span>Session code: </span>
        <span class="connected-code">{{ sessionCode }}</span>
      </div>
    
      <div class="game-buttons">
        <button 
          v-if="isWaitingForOpponent" 
          @click="startGame" 
          class="primary-button"
          :disabled="!canStartGame"
        >
          {{ canStartGame ? 'Start Game' : 'Waiting for Opponent...' }}
        </button>
        
        <button 
          v-if="isPlaying" 
          @click="pauseGame" 
          class="secondary-button"
        >
          Pause
        </button>
        
        <button 
          v-if="isPaused" 
          @click="resumeGame" 
          class="primary-button"
        >
          Resume
        </button>
        
        <button 
          v-if="isGameOver || isPaused" 
          @click="restartGame" 
          class="secondary-button"
        >
          Restart
        </button>
      </div>
    </div>
    
    <!-- Audio Controls -->
    <div class="audio-section">
      <VolumeControl />
    </div>
    
    <!-- Game instructions -->
    <div class="instructions">
      <p>Use ↑/↓ or W/S to move your paddle</p>
    </div>
  </div>
</template>

<style scoped>
.game-controls {
  padding: 15px;
  background-color: #1e2a38;
  color: white;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.error-message {
  background-color: rgba(255, 0, 0, 0.1);
  color: #ff4d4d;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 15px;
  border: 1px solid rgba(255, 0, 0, 0.3);
  text-align: center;
}

.error-help {
  color: #ffb3b3;
  font-size: 0.9em;
  margin-top: 5px;
  margin-bottom: 10px;
  line-height: 1.4;
  font-style: italic;
}

.error-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}

.control-section, .audio-section {
  margin-bottom: 15px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

h3 {
  font-size: 1.2rem;
  margin-bottom: 15px;
  text-align: center;
}

.connection-controls {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  width: 100%;
  max-width: 800px;
}

.host-section, .join-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 250px;
  flex: 1;
}

.session-code {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 4px;
  text-align: center;
}

.session-code p {
  margin: 0 0 5px 0;
  font-size: 0.9rem;
}

.code-status-banner {
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.code-status-banner.temporary {
  background-color: rgba(255, 166, 0, 0.2);
  border: 1px solid rgba(255, 166, 0, 0.4);
  color: #ffa600;
}

.code-status-banner.permanent {
  background-color: rgba(75, 181, 67, 0.2);
  border: 1px solid rgba(75, 181, 67, 0.4);
  color: #4bb543;
}

.warning-icon {
  font-size: 1.2em;
}

.success-icon {
  color: #4bb543;
  font-size: 1.2em;
}

.code-display {
  font-family: monospace;
  font-size: 1.5em;
  padding: 12px 20px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  user-select: all;
}

.code-temporary {
  background-color: rgba(255, 166, 0, 0.1);
  border: 2px dashed rgba(255, 166, 0, 0.4);
  color: #ffa600;
}

.code-permanent {
  background-color: rgba(75, 181, 67, 0.1);
  border: 2px solid rgba(75, 181, 67, 0.4);
  color: #4bb543;
}

.code-note {
  margin-top: 8px;
  font-size: 0.9em;
  color: #666;
}

.loading-dots:after {
  content: '...';
  animation: dots 1.5s steps(4, end) infinite;
}

@keyframes dots {
  0%, 20% { content: ''; }
  40% { content: '.'; }
  60% { content: '..'; }
  80%, 100% { content: '...'; }
}

.connected-session-info {
  margin-bottom: 10px;
  font-size: 0.9rem;
}

.connected-code {
  font-weight: bold;
  background-color: rgba(52, 152, 219, 0.2);
  padding: 3px 6px;
  border-radius: 4px;
  letter-spacing: 1px;
}

.join-input-group {
  display: flex;
  gap: 8px;
}

.session-input {
  flex: 1;
  padding: 8px;
  border-radius: 4px;
  border: none;
  font-size: 1rem;
  background-color: rgba(255, 255, 255, 0.9);
  color: #333;
}

.game-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.primary-button, .secondary-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 100px;
}

.primary-button {
  background-color: #3498db;
  color: white;
}

.primary-button:hover {
  background-color: #2980b9;
}

.secondary-button {
  background-color: #95a5a6;
  color: white;
}

.secondary-button:hover {
  background-color: #7f8c8d;
}

.instructions {
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  text-align: center;
  max-width: 600px;
  width: 100%;
}

.instructions p {
  margin: 0;
  font-size: 0.9rem;
}

.primary-button:disabled, .secondary-button:disabled {
  background-color: #95a5a6;
  color: rgba(255, 255, 255, 0.7);
  cursor: not-allowed;
  opacity: 0.7;
}

.audio-section {
  display: flex;
  justify-content: center;
  margin: 15px 0;
}

.retry-button {
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.retry-button:hover {
  background-color: #c0392b;
}

.retry-button:disabled {
  background-color: #95a5a6;
  color: rgba(255, 255, 255, 0.7);
  cursor: not-allowed;
}

.pulse-animation {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7);
  }
  
  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 8px rgba(231, 76, 60, 0);
  }
  
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(231, 76, 60, 0);
  }
}

.copy-success {
  color: #2ecc71;
  font-weight: bold;
}

@media (max-width: 600px) {
  .connection-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .host-section, .join-section {
    width: 100%;
  }
}
</style>