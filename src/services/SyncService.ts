import {
  GameState,
  MessageType,
  PaddleMoveMessage,
  GameStatus,
} from "../types";
import webRTCService from "./WebRTCService";

/**
 * Synchronization parameters for tuning network behavior
 */
interface SyncConfig {
  syncInterval: number; // How often to sync full state (ms)
  inputSyncInterval: number; // How often to sync input (ms)
  maxPredictionTime: number; // Maximum time to run prediction for (ms)
  reconciliationThreshold: number; // Distance threshold for state reconciliation
  pingInterval: number; // How often to check connection health (ms)
}

/**
 * Default synchronization configuration
 */
const DEFAULT_CONFIG: SyncConfig = {
  syncInterval: 16, // ~60 times per second (was 50)
  inputSyncInterval: 16, // ~60 times per second (was 33)
  maxPredictionTime: 200, // 200ms max prediction (was 100)
  reconciliationThreshold: 10, // 10px threshold for reconciliation (was 5)
  pingInterval: 5000, // Ping every 5 seconds
};

/**
 * Service to handle synchronization of game state between peers
 */
export class SyncService {
  private config: SyncConfig;
  private lastSyncTime: number = 0;
  private lastInputSyncTime: number = 0;
  private stateBuffer: GameState[] = [];
  private inputBuffer: PaddleMoveMessage[] = [];
  private networkLatency: number = 0;
  private syncInterval: number | null = null;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start synchronization
   */
  public start(): void {
    if (this.syncInterval) return;

    // Clear existing buffers
    this.stateBuffer = [];
    this.inputBuffer = [];this.syncInterval = window.setInterval(() => {
      this.measureLatency();
    }, this.config.pingInterval);

    // Force an immediate latency measurement
    this.measureLatency();
  }

  /**
   * Stop synchronization
   */
  public stop(): void {
    if (this.syncInterval) {
      window.clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.stateBuffer = [];
    this.inputBuffer = [];
  }

  /**
   * Measure network latency using ping/pong messages
   */
  private measureLatency(): void {
    const pingStartTime = Date.now();

    // Set up a handler for the pong response
    const pongHandler = () => {
      const pongTime = Date.now();
      this.networkLatency = pongTime - pingStartTime;// Remove the handler after receiving the response
      webRTCService.off(MessageType.PONG, pongHandler);
    };

    // Register the pong handler
    webRTCService.on(MessageType.PONG, pongHandler);

    // Send a ping message
    webRTCService.sendMessage({
      type: MessageType.PING,
      timestamp: Date.now(),
    });
  }

  /**
   * Synchronize game state (called by host)
   * @param state Current game state
   * @param timestamp Current timestamp
   */
  public syncGameState(state: GameState, timestamp: number): boolean {
    // Always sync if this is a critical game state (regardless of timing)
    const isImportantState =
      state.status === GameStatus.COUNTDOWN ||
      state.status === GameStatus.PLAYING ||
      state.status === GameStatus.GAME_OVER ||
      state.countdown !== undefined;

    // Check if it's time to sync based on the interval
    if (
      !isImportantState &&
      timestamp - this.lastSyncTime < this.config.syncInterval
    ) {
      return false;
    }

    // Update last sync time
    this.lastSyncTime = timestamp;

    // Add more diagnostics for important states
    if (isImportantState) {}

    // Send game state
    return webRTCService.sendGameState({
      type: MessageType.GAME_STATE,
      state,
      timestamp: Date.now(),
    });
  }

  /**
   * Synchronize input state (called by client)
   * @param isMovingUp Whether up key is pressed
   * @param isMovingDown Whether down key is pressed
   * @param timestamp Current timestamp
   */
  public syncInputState(
    isMovingUp: boolean,
    isMovingDown: boolean,
    timestamp: number
  ): boolean {
    // Check if it's time to sync based on the interval
    if (timestamp - this.lastInputSyncTime < this.config.inputSyncInterval) {
      return false;
    }

    // Update last input sync time
    this.lastInputSyncTime = timestamp;

    // Log input changes for debugging
    if (isMovingUp || isMovingDown) {}

    // Send input state
    const result = webRTCService.sendMessage({
      type: MessageType.PADDLE_MOVE,
      isUpPressed: isMovingUp,
      isDownPressed: isMovingDown,
      timestamp: Date.now(),
    });

    // Log if message wasn't sent
    if (!result) {
      console.warn("Failed to send paddle movement message to host");
    }

    return result;
  }

  /**
   * Buffer received game state for interpolation/prediction
   * @param state Received game state
   */
  public bufferGameState(state: GameState): void {
    // Log important state changes for debugging
    if (this.stateBuffer.length > 0) {
      const lastState = this.stateBuffer[this.stateBuffer.length - 1];
      if (lastState.status !== state.status) {}
    }

    // Keep only last few states in buffer (limit to 10)
    if (this.stateBuffer.length >= 10) {
      this.stateBuffer.shift();
    }

    // Add new state
    this.stateBuffer.push(state);
  }

  /**
   * Buffer received input for prediction
   * @param input Received input message
   */
  public bufferInput(input: PaddleMoveMessage): void {
    // Keep only last few inputs in buffer (limit to 10)
    if (this.inputBuffer.length >= 10) {
      this.inputBuffer.shift();
    }

    // Add new input
    this.inputBuffer.push(input);
  }

  /**
   * Get estimated network latency
   * @returns Network latency in milliseconds
   */
  public getNetworkLatency(): number {
    return this.networkLatency;
  }

  /**
   * Get the most recent state from the buffer
   * @returns Most recent game state or undefined if buffer is empty
   */
  public getLatestState(): GameState | undefined {
    if (this.stateBuffer.length === 0) return undefined;
    return this.stateBuffer[this.stateBuffer.length - 1];
  }

  /**
   * Calculate if state reconciliation is needed
   * @param localState Current local state
   * @param remoteState Received remote state
   * @returns True if reconciliation is needed
   */
  public needsReconciliation(
    localState: GameState,
    remoteState: GameState
  ): boolean {
    // Check ball position difference
    const ballDiff = Math.sqrt(
      Math.pow(localState.ball.position.x - remoteState.ball.position.x, 2) +
        Math.pow(localState.ball.position.y - remoteState.ball.position.y, 2)
    );

    // Check paddle position differences
    const playerPaddleDiff = Math.abs(
      localState.playerPaddle.position.y - remoteState.playerPaddle.position.y
    );

    const opponentPaddleDiff = Math.abs(
      localState.opponentPaddle.position.y -
        remoteState.opponentPaddle.position.y
    );

    // Return true if any difference exceeds the threshold
    return (
      ballDiff > this.config.reconciliationThreshold ||
      playerPaddleDiff > this.config.reconciliationThreshold ||
      opponentPaddleDiff > this.config.reconciliationThreshold
    );
  }
}

// Export a singleton instance
export const syncService = new SyncService();
export default syncService;
