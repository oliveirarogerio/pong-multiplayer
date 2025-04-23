/**
 * Shared TypeScript types for the multiplayer Pong game
 */

// Game state types

/**
 * Represents a 2D vector or position
 */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Power-up types available in the game
 */
export enum PowerUpType {
  SPEED_UP = "speed_up", // Increases ball speed
  ENLARGE_PADDLE = "enlarge_paddle", // Makes your paddle larger
  SHRINK_OPPONENT = "shrink_opponent", // Makes opponent's paddle smaller
  CURVE_BALL = "curve_ball", // Adds curve to the ball's movement
  MULTI_BALL = "multi_ball", // Adds an additional ball
  TURBO_MODE = "turbo_mode", // Temporarily increases game speed
}

/**
 * Represents an active power-up in the game
 */
export interface PowerUp {
  type: PowerUpType;
  position: Vector2D;
  radius: number;
  active: boolean;
  duration: number; // How long the power-up lasts once collected (in seconds)
  activatedTime?: number; // When the power-up was activated
  affectsPlayer?: "player" | "opponent"; // Which player is affected by this power-up
  strength?: number; // How strong the effect is (multiplier)
}

/**
 * Represents the game ball state
 */
export interface BallState {
  position: Vector2D;
  velocity: Vector2D;
  radius: number;
  speedScaleFactor?: number;
  hitCounter?: number;
  curveIntensity?: number; // For curve ball physics (0 = straight, 1 = max curve)
  curveDirection?: number; // Angle in radians for curve direction
  isActive?: boolean; // For multi-ball support
}

/**
 * Represents a player's paddle state
 */
export interface PaddleState {
  position: Vector2D;
  width: number;
  height: number;
  isMovingUp: boolean;
  isMovingDown: boolean;
  isRebounding?: boolean;
  reboundTime?: number;
}

/**
 * Possible game states
 */
export enum GameStatus {
  WAITING_FOR_OPPONENT = "waiting_for_opponent",
  COUNTDOWN = "countdown",
  PLAYING = "playing",
  PAUSED = "paused",
  GAME_OVER = "game_over",
}

/**
 * Game configuration settings
 */
export interface GameConfig {
  ballSpeed: number;
  paddleHeight: number;
  paddleWidth: number;
  winningScore: number;
  enablePowerUps: boolean;
  // New configuration options
  powerUpFrequency: number; // How often power-ups appear (in seconds)
  enableTurboMode: boolean; // Whether turbo mode feature is enabled
  enablePaddleShrinking: boolean; // Whether paddles shrink over time
  enableCurveBall: boolean; // Whether curve ball physics is enabled
}

/**
 * Complete game state that will be synchronized between peers
 */
export interface GameState {
  status: GameStatus;
  ball: BallState;
  playerPaddle: PaddleState;
  opponentPaddle: PaddleState;
  playerScore: number;
  opponentScore: number;
  timestamp: number;
  countdown?: number;
  winner?: "player" | "opponent" | null;
  config: GameConfig;
  // New fields for advanced mechanics
  powerUps?: PowerUp[];
  activePowerUps?: PowerUp[];
  additionalBalls?: BallState[]; // For multi-ball power-up
  turboModeActive?: boolean;
  turboModeTimeRemaining?: number;
  gameSpeedMultiplier?: number; // Overall game speed multiplier
}

// Network communication types

/**
 * Possible roles in the game
 */
export enum PlayerRole {
  HOST = "host",
  CLIENT = "client",
}

/**
 * Types of messages that can be sent over the WebRTC data channel
 */
export enum MessageType {
  GAME_STATE = "game_state",
  PADDLE_MOVE = "paddle_move",
  GAME_CONTROL = "game_control",
  PING = "ping",
  PONG = "pong",
}

/**
 * Control actions that can be sent
 */
export enum GameControlAction {
  START = "start",
  PAUSE = "pause",
  RESUME = "resume",
  RESTART = "restart",
}

/**
 * Base interface for all network messages
 */
export interface NetworkMessage {
  type: MessageType;
  timestamp: number;
}

/**
 * Game state update message
 */
export interface GameStateMessage extends NetworkMessage {
  type: MessageType.GAME_STATE;
  state: GameState;
}

/**
 * Paddle movement update message
 */
export interface PaddleMoveMessage extends NetworkMessage {
  type: MessageType.PADDLE_MOVE;
  isMovingUp: boolean;
  isMovingDown: boolean;
}

/**
 * Game control message
 */
export interface GameControlMessage extends NetworkMessage {
  type: MessageType.GAME_CONTROL;
  action: GameControlAction;
}

/**
 * Connection status for WebRTC
 */
export enum ConnectionStatus {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  ERROR = "error",
}

/**
 * Session information
 */
export interface SessionInfo {
  code: string;
  isHost: boolean;
  password?: string;
}

/**
 * Type for union of all possible network messages
 */
export type AnyNetworkMessage =
  | GameStateMessage
  | PaddleMoveMessage
  | GameControlMessage
  | NetworkMessage;
