import { Game } from "./Game";
import { GameLoop } from "./GameLoop";
import webRTCService from "../services/WebRTCService";
import syncService from "../services/SyncService";
import audioService from "../services/AudioService";
import {
  MessageType,
  PlayerRole,
  GameState,
  PaddleMoveMessage,
  GameControlAction,
  GameControlMessage,
  GameStatus,
  GameConfig,
  GameStateMessage,
  ConnectionStatus,
} from "../types";

/**
 * GameManager class that coordinates game state, networking and rendering
 */
export class GameManager {
  private game: Game;
  private gameLoop: GameLoop;
  private inputState: { up: boolean; down: boolean } = {
    up: false,
    down: false,
  };
  private isHost: boolean = false;
  private isNetworkGame: boolean = false;
  private keysPressed: { [key: string]: boolean } = {};
  private keyboardEventsBound: boolean = false;

  // Add properties to track game control messages
  private lastProcessedGameControl: {
    action: GameControlAction;
    timestamp: number;
  } | null = null;
  private isStarting: boolean = false;

  /**
   * Create a new GameManager instance
   * @param config Game configuration
   * @param renderFn Function for rendering the game state
   */
  constructor(
    config: Partial<GameConfig> = {},
    renderFn: () => void = () => {}
  ) {
    this.isHost = webRTCService.getRole() === PlayerRole.HOST;
    this.isNetworkGame =
      webRTCService.getConnectionStatus() !== ConnectionStatus.DISCONNECTED;
    const role = this.isHost ? PlayerRole.HOST : PlayerRole.CLIENT;

    // Initialize the game
    this.game = new Game(role, config);

    // Initialize the game loop
    this.gameLoop = new GameLoop(this.update.bind(this), renderFn);

    // Set up network message handlers
    this.setupNetworkHandlers();

    // Initialize audio
    this.initializeAudio();

    // Listen for ping/pong event requests to sync game state
    window.addEventListener("host-ping-received", this.handleHostPingEvent);
    window.addEventListener("client-pong-received", this.handleClientPongEvent);
  }

  /**
   * Set up network message handlers for multiplayer
   */
  private setupNetworkHandlers(): void {
    // Handle game state updates from the host
    webRTCService.on<GameStateMessage>(MessageType.GAME_STATE, (message) => {
      if (!this.isHost) {
        // Buffer received state for reconciliation
        syncService.bufferGameState(message.state);

        // Log the received state status to help with debugging
        // Check if we need to reconcile (fix client-side prediction)
        const localState = this.game.getState();

        // If we're in waiting state but host is not, transition out of waiting
        if (
          localState.status === GameStatus.WAITING_FOR_OPPONENT &&
          message.state.status !== GameStatus.WAITING_FOR_OPPONENT
        ) {
          this.game.setStatus(message.state.status);

          // Start the game loop if it's not running
          this.gameLoop.start();

          // Start syncing if needed
          syncService.start();
        }

        if (syncService.needsReconciliation(localState, message.state)) {
          this.game.setState(message.state);
        } else {
          // Just update opponent state and other non-local entities
          const updatedState = { ...localState };
          updatedState.ball = message.state.ball;
          updatedState.opponentPaddle = message.state.opponentPaddle;
          updatedState.playerScore = message.state.playerScore;
          updatedState.opponentScore = message.state.opponentScore;
          updatedState.status = message.state.status;
          updatedState.countdown = message.state.countdown;
          updatedState.winner = message.state.winner;
          this.game.setState(updatedState);
        }
      }
    });

    // Handle paddle movement messages from the client
    webRTCService.on<PaddleMoveMessage>(MessageType.PADDLE_MOVE, (message) => {
      if (this.isHost) {
        // Buffer received input for prediction if needed
        syncService.bufferInput(message);

        // Log received paddle movement
        if (message.isMovingUp || message.isMovingDown) {
        }

        // Update opponent paddle
        this.game.setOpponentInput(
          message.isUpPressed || false,
          message.isDownPressed || false
        );
      } else {
        console.warn(
          "CLIENT received paddle movement message but is not host, ignoring"
        );
      }
    });

    // Handle game control messages
    webRTCService.on<GameControlMessage>(
      MessageType.GAME_CONTROL,
      (message) => {
        // Check if this is a duplicate message we've already processed
        if (this.lastProcessedGameControl?.timestamp && message.timestamp) {
          if (message.timestamp < this.lastProcessedGameControl.timestamp) {
            return;
          }
        }

        // Store processed control:
        this.lastProcessedGameControl = {
          action: message.action,
          timestamp: message.timestamp || Date.now(),
        };
        switch (message.action) {
          case GameControlAction.START:
            if (!this.isStarting) {
              this.isStarting = true;
              this.startGame();
              // Reset starting flag after a short delay
              setTimeout(() => {
                this.isStarting = false;
              }, 2000);
            } else {
            }
            break;
          case GameControlAction.PAUSE:
            this.pauseGame();
            break;
          case GameControlAction.RESUME:
            this.resumeGame();
            break;
          case GameControlAction.RESTART:
            this.restartGame();
            break;
        }
      }
    );

    // Handle connection status changes
    webRTCService.onStatusChange((status) => {
      this.isNetworkGame = status !== ConnectionStatus.DISCONNECTED;
      if (!this.isNetworkGame) {
        this.game.setStatus(GameStatus.WAITING_FOR_OPPONENT);
      } else if (status === ConnectionStatus.CONNECTED) {
        // Play connection sound when opponent connects
        audioService.playSound("game_start", 0.5);

        // Make sure keyboard bindings are active for both host and client
        this.bindKeyboardEvents();
        // If we're the host, ensure clients know our status immediately
        if (this.isHost) {
          syncService.syncGameState(this.game.getState(), Date.now());
        } else {
          // Send a ping to trigger host to send their current state
          webRTCService.sendMessage({
            type: MessageType.PING,
            timestamp: Date.now(),
          });
        }
      }
    });
  }

  /**
   * Main update function called by the game loop
   * @param timestamp Current timestamp
   */
  private update(timestamp: number): void {
    // Update game logic
    this.game.update(timestamp);

    // Sync game state over the network
    this.syncNetworkState(timestamp);
  }

  /**
   * Synchronize game state over the network
   * @param timestamp Current timestamp
   */
  private syncNetworkState(timestamp: number): void {
    if (!this.isNetworkGame) return;

    // Use the SyncService to handle state synchronization
    if (this.isHost) {
      // Host sends full game state to client
      syncService.syncGameState(this.game.getState(), timestamp);
    } else {
      // Client sends input state to host
      syncService.syncInputState(
        this.inputState.up,
        this.inputState.down,
        timestamp
      );

      // If client is in waiting state but already connected, check with host
      if (
        this.game.getStatus() === GameStatus.WAITING_FOR_OPPONENT &&
        webRTCService.getConnectionStatus() === ConnectionStatus.CONNECTED
      ) {
        // Request current game state from host by sending a ping
        webRTCService.sendMessage({
          type: MessageType.PING,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Set player input for paddle movement
   * @param isUpPressed Whether the up key is pressed
   * @param isDownPressed Whether the down key is pressed
   */
  public setPlayerInput(isUpPressed: boolean, isDownPressed: boolean): void {
    this.inputState = { up: isUpPressed, down: isDownPressed };
    this.game.setPlayerInput(isUpPressed, isDownPressed);
  }

  /**
   * Start the game
   */
  public startGame(): void {
    console.log(`Current game status: ${this.game.getState().status}`);
    console.log(
      `WebRTC connection status: ${webRTCService.getConnectionStatus()}`
    );

    // Check if both players are connected in network game
    if (this.isNetworkGame) {
      if (webRTCService.getConnectionStatus() !== ConnectionStatus.CONNECTED) {
        return;
      }

      // Only host can control the game in multiplayer mode
      if (!this.isHost) {
        this.sendGameControl(GameControlAction.START);
        return;
      }
    }

    this.game.startCountdown();
    this.gameLoop.start();

    // Start the synchronization service
    if (this.isNetworkGame) {
      syncService.start();
    }

    // Notify the client if we're the host
    if (this.isNetworkGame && this.isHost) {
      this.sendGameControl(GameControlAction.START);
    }
  }

  /**
   * Pause the game
   */
  public pauseGame(): void {
    if (this.isNetworkGame && !this.isHost) {
      this.sendGameControl(GameControlAction.PAUSE);
      return;
    }

    this.game.pauseGame();

    if (this.isNetworkGame && this.isHost) {
      this.sendGameControl(GameControlAction.PAUSE);
    }
  }

  /**
   * Resume the game
   */
  public resumeGame(): void {
    if (this.isNetworkGame && !this.isHost) {
      this.sendGameControl(GameControlAction.RESUME);
      return;
    }

    this.game.resumeGame();

    if (this.isNetworkGame && this.isHost) {
      this.sendGameControl(GameControlAction.RESUME);
    }
  }

  /**
   * Restart the game
   */
  public restartGame(): void {
    if (this.isNetworkGame && !this.isHost) {
      this.sendGameControl(GameControlAction.RESTART);
      return;
    }

    this.game.restartGame();

    if (this.isNetworkGame && this.isHost) {
      this.sendGameControl(GameControlAction.RESTART);
    }
  }

  /**
   * Send a game control message over the network
   * @param action The game control action
   */
  private sendGameControl(action: GameControlAction): void {
    webRTCService.sendMessage({
      type: MessageType.GAME_CONTROL,
      action,
      timestamp: Date.now(),
    });
  }

  /**
   * Stop the game and clean up resources
   */
  public stop(): void {
    this.gameLoop.stop();
    this.unbindKeyboardEvents();
    syncService.stop();
  }

  /**
   * Bind keyboard events for paddle control
   */
  public bindKeyboardEvents(): void {
    if (this.keyboardEventsBound) {
      return;
    }
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));
    this.keyboardEventsBound = true;
  }

  /**
   * Unbind keyboard events
   */
  public unbindKeyboardEvents(): void {
    if (!this.keyboardEventsBound) return;

    window.removeEventListener("keydown", this.handleKeyDown.bind(this));
    window.removeEventListener("keyup", this.handleKeyUp.bind(this));
    this.keyboardEventsBound = false;
  }

  /**
   * Handle key down events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return;

    const key = event.key.toLowerCase();
    this.keysPressed[key] = true;

    this.updateInputState();
  }

  /**
   * Handle key up events
   */
  private handleKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keysPressed[key] = false;

    this.updateInputState();
  }

  /**
   * Update input state based on keys pressed
   */
  private updateInputState(): void {
    const upPressed =
      this.keysPressed["arrowup"] ||
      this.keysPressed["w"] ||
      this.keysPressed["up"];
    const downPressed =
      this.keysPressed["arrowdown"] ||
      this.keysPressed["s"] ||
      this.keysPressed["down"];

    this.setPlayerInput(upPressed, downPressed);
  }

  /**
   * Update field dimensions
   */
  public resizeField(width: number, height: number): void {
    this.game.resizeField(width, height);
  }

  /**
   * Get the current game state
   */
  public getGameState(): GameState {
    return this.game.getState();
  }

  /**
   * Update game configuration
   */
  public updateConfig(config: Partial<GameConfig>): void {
    this.game.updateConfig(config);
  }

  /**
   * Get the player's role
   */
  public getPlayerRole(): PlayerRole {
    return this.isHost ? PlayerRole.HOST : PlayerRole.CLIENT;
  }

  /**
   * Get the game instance
   */
  public getGame(): Game {
    return this.game;
  }

  /**
   * Initialize a host session and return the session code
   * @returns The session code to share with the client
   */
  public initializeHost(): string {
    try {
      const sessionCode = webRTCService.initHostSession();
      // Update local state
      this.isHost = true;
      this.isNetworkGame = true;
      // The Game class is initialized with the player role in the constructor
      // No need to set it again
      return sessionCode;
    } catch (error) {
      console.error("=== GAME MANAGER: HOST INITIALIZATION FAILED ===");
      console.error("Error details:", error);
      throw error;
    }
  }

  /**
   * Join an existing game
   * @returns Promise that resolves when joined successfully, rejects on error
   */
  public async joinGame(sessionCode: string): Promise<void> {
    try {
      await webRTCService.joinSession(sessionCode);

      // Ensure keyboard bindings are active for the client
      this.bindKeyboardEvents();

      // Ensure that the game knows the client's role
      this.isHost = false;
      this.isNetworkGame = true;
    } catch (error) {
      console.error("Error joining game:", error);
      throw error;
    }
  }

  /**
   * Clean up all resources
   */
  public cleanup(): void {
    this.stop();

    // Call the game's cleanup method to release any timers or resources
    if (this.game) {
      this.game.cleanup();
    }

    // Remove event listeners
    window.removeEventListener("host-ping-received", this.handleHostPingEvent);
    window.removeEventListener(
      "client-pong-received",
      this.handleClientPongEvent
    );

    webRTCService.close();
  }

  /**
   * Handle host ping event
   */
  private handleHostPingEvent = () => {
    if (this.isHost) {
      syncService.syncGameState(this.game.getState(), Date.now());
    }
  };

  /**
   * Handle client pong event
   */
  private handleClientPongEvent = () => {
    if (!this.isHost) {
      // If we're still waiting, send another ping to request state
      if (this.game.getStatus() === GameStatus.WAITING_FOR_OPPONENT) {
        webRTCService.sendMessage({
          type: MessageType.PING,
          timestamp: Date.now(),
        });
      }
    }
  };

  /**
   * Initialize audio system
   */
  private initializeAudio(): void {
    // Audio needs user interaction to start
    const initAudio = async () => {
      try {
        await audioService.initialize();
        // Play a subtle initialization sound to confirm audio is working
        audioService.playSound("countdown", 0.2, 0.8);
      } catch (error) {
        console.error("Failed to initialize audio:", error);
      }
    };

    // Try to initialize on first user interaction
    window.addEventListener("click", initAudio, { once: true });
    window.addEventListener("keydown", initAudio, { once: true });
  }

  /**
   * Set render callback
   */
  public setRenderCallback(callback: () => void): void {
    this.gameLoop.setRenderFunction(callback);
  }
}

// Export a singleton instance
export const gameManager = new GameManager();
export default gameManager;
