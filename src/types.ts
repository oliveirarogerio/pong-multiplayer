export interface Vector2D {
  x: number;
  y: number;
}

export interface PaddleState {
  position: Vector2D;
  width: number;
  height: number;
  isMovingUp: boolean;
  isMovingDown: boolean;
  isRebounding?: boolean;
  reboundTime?: number;
}

export interface BallState {
  position: Vector2D;
  velocity: Vector2D;
  radius: number;
  speedScaleFactor?: number;
  hitCounter?: number;
  curveIntensity?: number;
  curveDirection?: number;
}

export interface GameState {
  status: GameStatus;
  playerScore: number;
  opponentScore: number;
  countdown?: number;
  winner?: "player" | "opponent" | null;
  playerPaddle: PaddleState;
  opponentPaddle: PaddleState;
  ball: BallState;
  additionalBalls?: BallState[];
  config: GameConfig;
  turboModeActive?: boolean;
  turboModeTimeRemaining?: number;
  activePowerUps?: PowerUp[];
  powerUps?: PowerUp[];
  gameSpeedMultiplier?: number;
  timestamp?: number;
}

export enum GameStatus {
  WAITING_FOR_OPPONENT = "WAITING_FOR_OPPONENT",
  COUNTDOWN = "COUNTDOWN",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  GAME_OVER = "GAME_OVER",
}

export enum PlayerRole {
  HOST = "HOST",
  GUEST = "GUEST",
  CLIENT = "CLIENT", // Alternative to GUEST in some contexts
}

export enum ConnectionStatus {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  ERROR = "ERROR",
}

export enum PowerUpType {
  ENLARGE_PADDLE = "ENLARGE_PADDLE",
  SHRINK_OPPONENT = "SHRINK_OPPONENT",
  EXTRA_BALL = "EXTRA_BALL",
  TURBO_MODE = "TURBO_MODE",
  SPEED_UP = "SPEED_UP",
  CURVE_BALL = "CURVE_BALL",
  MULTI_BALL = "MULTI_BALL",
}

export interface PowerUp {
  type: PowerUpType;
  position: Vector2D;
  radius: number;
  affectsPlayer: "player" | "opponent";
  duration?: number;
  activatedTime?: number;
  active?: boolean;
}

export interface GameConfig {
  enablePowerUps: boolean;
  enableTurboMode: boolean;
  enablePaddleShrinking: boolean;
  enableCurveBall: boolean;
  ballSpeed: number;
  paddleWidth: number;
  paddleHeight: number;
  powerUpFrequency: number;
  winningScore: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  enablePowerUps: false,
  enableTurboMode: false,
  enablePaddleShrinking: false,
  enableCurveBall: false,
  ballSpeed: 400,
  paddleWidth: 10,
  paddleHeight: 60,
  powerUpFrequency: 10,
  winningScore: 11,
};

export enum GameControlAction {
  START = "START",
  PAUSE = "PAUSE",
  RESUME = "RESUME",
  RESTART = "RESTART",
}

export enum MessageType {
  GAME_STATE = "GAME_STATE",
  PADDLE_MOVE = "PADDLE_MOVE",
  GAME_CONTROL = "GAME_CONTROL",
  PING = "PING",
  PONG = "PONG",
}

export interface BaseMessage {
  timestamp?: number;
}

export interface PaddleMoveMessage extends BaseMessage {
  type: MessageType.PADDLE_MOVE;
  isUpPressed: boolean;
  isDownPressed: boolean;
  isMovingUp?: boolean;
  isMovingDown?: boolean;
}

export interface GameControlMessage extends BaseMessage {
  type: MessageType.GAME_CONTROL;
  action: GameControlAction;
}

export interface GameStateMessage extends BaseMessage {
  type: MessageType.GAME_STATE;
  state: GameState;
}

export interface PingMessage extends BaseMessage {
  type: MessageType.PING;
}

export interface PongMessage extends BaseMessage {
  type: MessageType.PONG;
}

export interface SessionInfo {
  code: string;
  role: PlayerRole;
  isHost: boolean;
  password?: string;
}

export type AnyNetworkMessage =
  | GameStateMessage
  | PaddleMoveMessage
  | GameControlMessage
  | PingMessage
  | PongMessage;
