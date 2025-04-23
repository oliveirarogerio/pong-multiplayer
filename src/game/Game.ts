import {
  GameState,
  GameStatus,
  GameConfig,
  PlayerRole,
  Vector2D,
  PowerUp,
  PowerUpType,
} from "../types";
import { Ball } from "./Ball";
import { Paddle } from "./Paddle";
import audioService from "../services/AudioService";
import particleService from "../services/ParticleService";
import PowerUpManager from "./PowerUpManager";

// Default game configuration
const DEFAULT_CONFIG: GameConfig = {
  ballSpeed: 400,
  paddleHeight: 80,
  paddleWidth: 12,
  winningScore: 11,
  enablePowerUps: true,
  powerUpFrequency: 15,
  enableTurboMode: true,
  enablePaddleShrinking: true,
  enableCurveBall: true,
};

/**
 * Main game engine class that manages the Pong game state
 */
export class Game {
  // Game objects
  private ball!: Ball;
  private playerPaddle!: Paddle;
  private opponentPaddle!: Paddle;
  private additionalBalls: Ball[] = [];
  private powerUpManager: PowerUpManager;
  private turboModeActive: boolean = false;
  private turboModeTimeRemaining: number = 0;
  private gameSpeedMultiplier: number = 1.0;
  private maxAdditionalBalls: number = 2;

  // Game state
  private status: GameStatus = GameStatus.WAITING_FOR_OPPONENT;
  private playerScore: number = 0;
  private opponentScore: number = 0;
  private countdown: number = 3;
  private countdownTimer: number = 0;
  private winner: "player" | "opponent" | null = null;

  // Game configuration
  private config: GameConfig;
  private role: PlayerRole;

  // Field dimensions
  private fieldWidth: number = 800;
  private fieldHeight: number = 600;

  // Game loop
  private lastUpdateTime: number = 0;
  private fixedTimeStep: number = 1 / 120; // 120 updates per second (was 60)
  private accumulator: number = 0;

  // Add a private timeout property to the class
  private countdownTimeout: number | null = null;

  /**
   * Create a new game instance
   * @param role The player's role (host or client)
   * @param config Game configuration
   */
  constructor(
    role: PlayerRole = PlayerRole.HOST,
    config: Partial<GameConfig> = {}
  ) {
    this.role = role;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize game objects
    this.initializeGameObjects();

    // Initialize power-up manager
    this.powerUpManager = new PowerUpManager(
      this.fieldWidth,
      this.fieldHeight,
      this.config.powerUpFrequency
    );
  }

  /**
   * Initialize the ball and paddles
   */
  private initializeGameObjects(): void {
    // Initialize the ball at the center of the field
    this.ball = new Ball(
      { x: this.fieldWidth / 2, y: this.fieldHeight / 2 },
      10,
      { x: 0, y: 0 },
      this.config.ballSpeed
    );

    // Place paddles at left and right sides of the field
    const paddleY = this.fieldHeight / 2;

    // Left paddle (player for host, opponent for client)
    const leftPaddleX = 30;

    // Right paddle (opponent for host, player for client)
    const rightPaddleX = this.fieldWidth - 30;

    if (this.role === PlayerRole.HOST) {
      this.playerPaddle = new Paddle(
        { x: leftPaddleX, y: paddleY },
        this.config.paddleWidth,
        this.config.paddleHeight,
        500,
        0,
        this.fieldHeight
      );

      this.opponentPaddle = new Paddle(
        { x: rightPaddleX, y: paddleY },
        this.config.paddleWidth,
        this.config.paddleHeight,
        500,
        0,
        this.fieldHeight
      );
    } else {
      this.playerPaddle = new Paddle(
        { x: rightPaddleX, y: paddleY },
        this.config.paddleWidth,
        this.config.paddleHeight,
        500,
        0,
        this.fieldHeight
      );

      this.opponentPaddle = new Paddle(
        { x: leftPaddleX, y: paddleY },
        this.config.paddleWidth,
        this.config.paddleHeight,
        500,
        0,
        this.fieldHeight
      );
    }
  }

  /**
   * Update the game state with fixed time step
   * @param currentTime Current time in milliseconds
   */
  public update(currentTime: number): void {
    if (!this.lastUpdateTime) {
      this.lastUpdateTime = currentTime;
      return;
    }

    // Calculate the time delta in seconds
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;

    // Cap deltaTime to prevent spiral of death (large updates after lag)
    const cappedDeltaTime = Math.min(deltaTime, 0.1); // Max 100ms

    // Use a fixed time step for physics calculations
    this.accumulator += cappedDeltaTime;

    // Cap the number of steps to prevent freezing when catching up
    const maxSteps = 5;
    let steps = 0;

    while (this.accumulator >= this.fixedTimeStep && steps < maxSteps) {
      this.fixedUpdate(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
      steps++;
    }

    // If we've hit the step limit but still have accumulated time,
    // drop the remainder to avoid playing catch-up indefinitely
    if (steps >= maxSteps && this.accumulator >= this.fixedTimeStep) {
      this.accumulator = 0;
    }
  }

  /**
   * Update the game state with a fixed time step
   * @param deltaTime Time step in seconds
   */
  private fixedUpdate(deltaTime: number): void {
    // Don't update game logic if waiting for opponent or game is over
    if (
      this.status === GameStatus.WAITING_FOR_OPPONENT ||
      this.status === GameStatus.GAME_OVER
    ) {
      return;
    }

    // Handle countdown
    if (this.status === GameStatus.COUNTDOWN) {
      // Debug logging}, delta: ${deltaTime.toFixed(
          4
        )}`
      );

      this.countdownTimer += deltaTime;

      // Force progress if timer is too high without triggering countdown decrement
      if (this.countdownTimer > 2) {
        console.warn(
          "Countdown timer too high without progressing, forcing countdown decrement"
        );
        this.countdown--;
        this.countdownTimer = 0;

        // If countdown is done, start the game
        if (this.countdown <= 0) {this.startGame();
          return;
        }
      } else if (this.countdownTimer >= 1) {
        this.countdown--;
        this.countdownTimer = 0;// Play countdown sound
        if (this.countdown > 0) {
          // Higher pitch for lower numbers (more urgency)
          const pitch = 1.0 + 0.1 * (3 - this.countdown);
          audioService.playSound("countdown", 1.0, pitch);
        }

        if (this.countdown <= 0) {this.startGame();
        }
      }

      // Additional safeguard: if countdown is stuck at same value for too long
      if (this.countdown < 0) {
        console.warn("Countdown value is negative, forcing game start");
        this.startGame();
      }

      return;
    }

    // Don't update if paused
    if (this.status === GameStatus.PAUSED) {
      return;
    }

    // Update game speed multiplier
    this.updateGameSpeed(deltaTime);

    // Apply game speed multiplier to delta time
    const adjustedDeltaTime = deltaTime * this.gameSpeedMultiplier;

    // Update power-ups
    if (this.config.enablePowerUps) {
      this.powerUpManager.update(adjustedDeltaTime);
    }

    // Update paddles
    this.playerPaddle.update(adjustedDeltaTime);
    this.opponentPaddle.update(adjustedDeltaTime);

    // Update ball
    this.ball.update(adjustedDeltaTime);

    // Update additional balls if any
    for (const ball of this.additionalBalls) {
      ball.update(adjustedDeltaTime);
    }

    // Check for ball-paddle collisions
    this.checkPaddleCollisions();

    // Check for ball-boundary collisions
    this.checkBoundaryCollisions();

    // Check for power-up collections
    if (this.config.enablePowerUps) {
      this.checkPowerUpCollections();
    }

    // Check for scoring
    this.checkScoring();

    // Apply paddle shrinking if enabled
    if (this.config.enablePaddleShrinking) {
      this.updatePaddleShrinking();
    }
  }

  /**
   * Update the game speed multiplier
   * @param deltaTime Time elapsed since last update
   */
  private updateGameSpeed(deltaTime: number): void {
    // Update turbo mode timer if active
    if (this.turboModeActive) {
      this.turboModeTimeRemaining -= deltaTime;

      if (this.turboModeTimeRemaining <= 0) {
        this.turboModeActive = false;
        this.gameSpeedMultiplier = 1.0;}
    }

    // Check for turbo mode power-ups
    if (this.config.enableTurboMode) {
      const playerHasTurbo = this.powerUpManager.isPowerUpActive(
        PowerUpType.TURBO_MODE,
        "player"
      );

      const opponentHasTurbo = this.powerUpManager.isPowerUpActive(
        PowerUpType.TURBO_MODE,
        "opponent"
      );

      // Apply turbo mode if either player has it
      if (playerHasTurbo || opponentHasTurbo) {
        this.turboModeActive = true;
        this.turboModeTimeRemaining = 5; // 5 seconds of turbo mode
        this.gameSpeedMultiplier = 1.5; // 50% faster game speed
      }
    }
  }

  /**
   * Apply paddle shrinking over time
   */
  private updatePaddleShrinking(): void {
    // Implementation without deltaTime parameter
    if (this.playerPaddle.isShrunken()) {
      this.playerPaddle.resetSize();
    }
    if (this.opponentPaddle.isShrunken()) {
      this.opponentPaddle.resetSize();
    }
  }

  /**
   * Check for ball-paddle collisions
   */
  private checkPaddleCollisions(): void {
    // Get paddle positions and dimensions
    const playerPos = this.playerPaddle.getPosition();
    const playerWidth = this.playerPaddle.getWidth();
    const playerHeight = this.playerPaddle.getHeight();

    const opponentPos = this.opponentPaddle.getPosition();
    const opponentWidth = this.opponentPaddle.getWidth();
    const opponentHeight = this.opponentPaddle.getHeight();

    // Check collision with player paddle
    const isPlayerPaddleOnLeft = this.role === PlayerRole.HOST;
    const playerCollision = this.ball.checkPaddleCollision(
      playerPos.x,
      playerPos.y,
      playerWidth,
      playerHeight,
      isPlayerPaddleOnLeft
    );

    // Check collision with opponent paddle
    const isOpponentPaddleOnLeft = this.role !== PlayerRole.HOST;
    const opponentCollision = this.ball.checkPaddleCollision(
      opponentPos.x,
      opponentPos.y,
      opponentWidth,
      opponentHeight,
      isOpponentPaddleOnLeft
    );

    // Check additional balls for collisions
    for (const ball of this.additionalBalls) {
      const addPlayerCollision = ball.checkPaddleCollision(
        playerPos.x,
        playerPos.y,
        playerWidth,
        playerHeight,
        isPlayerPaddleOnLeft
      );

      const addOpponentCollision = ball.checkPaddleCollision(
        opponentPos.x,
        opponentPos.y,
        opponentWidth,
        opponentHeight,
        isOpponentPaddleOnLeft
      );

      if (addPlayerCollision) {
        this.playerPaddle.recordHit();
        const pitch = 1.0 + Math.random() * 0.2 - 0.1;
        audioService.playSound("paddle_hit", 0.8, pitch);
        const ballPos = ball.getPosition();
        particleService.createPaddleHitEffect(ballPos.x, ballPos.y);
      }

      if (addOpponentCollision) {
        this.opponentPaddle.recordHit();
        const pitch = 1.0 + Math.random() * 0.2 - 0.1;
        audioService.playSound("paddle_hit", 0.8, pitch);
        const ballPos = ball.getPosition();
        particleService.createPaddleHitEffect(ballPos.x, ballPos.y);
      }
    }

    // Play paddle hit sound and create particles
    if (playerCollision) {
      this.playerPaddle.recordHit();
      const pitch = 1.0 + Math.random() * 0.2 - 0.1; // Random pitch between 0.9 and 1.1
      audioService.playSound("paddle_hit", 1.0, pitch);

      // Create particles at ball position
      const ballPos = this.ball.getPosition();
      particleService.createPaddleHitEffect(ballPos.x, ballPos.y);
    }

    if (opponentCollision) {
      this.opponentPaddle.recordHit();
      const pitch = 1.0 + Math.random() * 0.2 - 0.1;
      audioService.playSound("paddle_hit", 1.0, pitch);

      const ballPos = this.ball.getPosition();
      particleService.createPaddleHitEffect(ballPos.x, ballPos.y);
    }
  }

  /**
   * Check for ball-boundary collisions
   */
  private checkBoundaryCollisions(): void {
    // Check main ball
    const wallCollision = this.ball.checkBoundaryCollision(0, this.fieldHeight);

    if (wallCollision) {
      const ballPos = this.ball.getPosition();
      audioService.playSound("wall_hit");
      particleService.createWallHitEffect(ballPos.x, ballPos.y);
    }

    // Check additional balls
    for (const ball of this.additionalBalls) {
      const additionalWallCollision = ball.checkBoundaryCollision(
        0,
        this.fieldHeight
      );

      if (additionalWallCollision) {
        const ballPos = ball.getPosition();
        audioService.playSound("wall_hit", 0.7);
        particleService.createWallHitEffect(ballPos.x, ballPos.y);
      }
    }
  }

  /**
   * Check for power-up collections
   */
  private checkPowerUpCollections(): void {
    // Check main ball for power-up collection
    const ballPos = this.ball.getPosition();
    const ballRadius = this.ball.getRadius();
    const ballVelocity = this.ball.getVelocity();
    const isMovingTowardsPlayer =
      (this.role === PlayerRole.HOST && ballVelocity.x < 0) ||
      (this.role !== PlayerRole.HOST && ballVelocity.x > 0);

    const collectedPowerUp = this.powerUpManager.checkPowerUpCollection(
      ballPos,
      ballRadius,
      isMovingTowardsPlayer
    );

    if (collectedPowerUp) {
      this.applyPowerUpEffect(collectedPowerUp);
    }

    // Check additional balls for power-up collection
    for (const ball of this.additionalBalls) {
      const addBallPos = ball.getPosition();
      const addBallRadius = ball.getRadius();
      const addBallVelocity = ball.getVelocity();
      const isAddBallTowardsPlayer =
        (this.role === PlayerRole.HOST && addBallVelocity.x < 0) ||
        (this.role !== PlayerRole.HOST && addBallVelocity.x > 0);

      const addCollectedPowerUp = this.powerUpManager.checkPowerUpCollection(
        addBallPos,
        addBallRadius,
        isAddBallTowardsPlayer
      );

      if (addCollectedPowerUp) {
        this.applyPowerUpEffect(addCollectedPowerUp);
      }
    }
  }

  /**
   * Apply effects from collected power-ups
   * @param powerUp The collected power-up
   */
  private applyPowerUpEffect(powerUp: PowerUp): void {
    const isPlayerPowerUp = powerUp.affectsPlayer === "player";
    const isOpponentPowerUp = powerUp.affectsPlayer === "opponent";`
    );

    switch (powerUp.type) {
      case PowerUpType.SPEED_UP:
        // Increase ball speed by 30%
        const currentSpeed = this.ball.getSpeedScaleFactor();
        const newFactor = Math.min(2.5, currentSpeed * 1.3);
        this.ball.setState({
          ...this.ball.getState(),
          speedScaleFactor: newFactor,
        });
        break;

      case PowerUpType.ENLARGE_PADDLE:
        if (isPlayerPowerUp) {
          this.playerPaddle.applyResizeEffect(1.5);
        } else if (isOpponentPowerUp) {
          this.opponentPaddle.applyResizeEffect(1.5);
        }
        break;

      case PowerUpType.SHRINK_OPPONENT:
        if (isPlayerPowerUp) {
          this.opponentPaddle.applyResizeEffect(0.7);
        } else if (isOpponentPowerUp) {
          this.playerPaddle.applyResizeEffect(0.7);
        }
        break;

      case PowerUpType.CURVE_BALL:
        // Add curve to ball movement
        const curveIntensity = 0.8;
        const curveDirection = Math.random() * Math.PI * 2;
        this.ball.setCurve(curveIntensity, curveDirection);
        break;

      case PowerUpType.MULTI_BALL:
        this.addExtraBall();
        break;

      case PowerUpType.TURBO_MODE:
        this.turboModeActive = true;
        this.turboModeTimeRemaining = 5;
        this.gameSpeedMultiplier = 1.5;
        break;
    }
  }

  /**
   * Add an extra ball to the game
   */
  private addExtraBall(): void {
    if (this.additionalBalls.length >= this.maxAdditionalBalls) {
      // Already at max additional balls
      return;
    }

    // Create a new ball at the center
    const centerPosition: Vector2D = {
      x: this.fieldWidth / 2,
      y: this.fieldHeight / 2,
    };

    // Initial velocity has random direction
    const angle = Math.random() * Math.PI * 2;
    const speed = this.config.ballSpeed;
    const velocity: Vector2D = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    };

    const extraBall = new Ball(
      centerPosition,
      10,
      velocity,
      this.config.ballSpeed
    );

    // Set the same speed scaling as the main ball
    extraBall.setState({
      ...extraBall.getState(),
      speedScaleFactor: this.ball.getSpeedScaleFactor(),
    });

    this.additionalBalls.push(extraBall);

    // Create particle effect for the new ball
    particleService.createExplosion(
      centerPosition.x,
      centerPosition.y,
      30,
      "#33FFFF",
      100,
      300,
      0.5,
      1.0
    );

    audioService.playSound("score", 0.8, 1.5);
  }

  /**
   * Check if the ball has scored
   */
  private checkScoring(): void {
    const scoringSide = this.ball.checkScoringBoundary(0, this.fieldWidth);
    let scored = false;

    if (scoringSide === "left") {
      // Score for the right player (opponent if host, player if client)
      if (this.role === PlayerRole.HOST) {
        this.opponentScore++;
        this.playerPaddle.resetHitCombo();
      } else {
        this.playerScore++;
        this.opponentPaddle.resetHitCombo();
      }
      this.resetBall(false);
      audioService.playSound("score");
      scored = true;

      // Create score particles
      particleService.createScoreEffect(0, this.fieldHeight / 2);
    } else if (scoringSide === "right") {
      // Score for the left player (player if host, opponent if client)
      if (this.role === PlayerRole.HOST) {
        this.playerScore++;
        this.opponentPaddle.resetHitCombo();
      } else {
        this.opponentScore++;
        this.playerPaddle.resetHitCombo();
      }
      this.resetBall(true);
      audioService.playSound("score");
      scored = true;

      // Create score particles
      particleService.createScoreEffect(this.fieldWidth, this.fieldHeight / 2);
    }

    // Check additional balls for scoring
    for (let i = this.additionalBalls.length - 1; i >= 0; i--) {
      const ball = this.additionalBalls[i];
      const additionalScoringSide = ball.checkScoringBoundary(
        0,
        this.fieldWidth
      );

      if (additionalScoringSide) {
        // Remove the ball when it scores
        this.additionalBalls.splice(i, 1);

        if (additionalScoringSide === "left") {
          particleService.createScoreEffect(0, this.fieldHeight / 2);
        } else {
          particleService.createScoreEffect(
            this.fieldWidth,
            this.fieldHeight / 2
          );
        }

        audioService.playSound("score", 0.7);
      }
    }

    // Check for win condition
    if (this.playerScore >= this.config.winningScore) {
      this.endGame("player");
    } else if (this.opponentScore >= this.config.winningScore) {
      this.endGame("opponent");
    }

    // If a score happened, clear power-ups from the field
    if (scored) {
      this.powerUpManager.clearFieldPowerUps();
    }
  }

  /**
   * Reset the ball after scoring
   * @param serveToLeft Whether to serve to the left side
   */
  private resetBall(serveToLeft: boolean): void {
    const centerPosition: Vector2D = {
      x: this.fieldWidth / 2,
      y: this.fieldHeight / 2,
    };

    // Set initial velocity based on who serves
    // Add a slight vertical component for variation
    const vx = (serveToLeft ? -1 : 1) * this.config.ballSpeed;
    const vy = (Math.random() - 0.5) * (this.config.ballSpeed * 0.5);

    this.ball.reset(centerPosition, { x: vx, y: vy });

    // Reset paddle positions
    this.playerPaddle.setPosition({
      x: this.playerPaddle.getPosition().x,
      y: this.fieldHeight / 2,
    });

    this.opponentPaddle.setPosition({
      x: this.opponentPaddle.getPosition().x,
      y: this.fieldHeight / 2,
    });

    // Clear any additional balls
    this.additionalBalls = [];
  }

  /**
   * Start the countdown to begin the game
   */
  public startCountdown(): void {CALLED ===");console.log(
      `Existing timer: ${this.countdownTimeout !== null ? "active" : "none"}`
    );

    // If game already started or in countdown, don't start again
    if (
      this.status === GameStatus.PLAYING ||
      this.status === GameStatus.COUNTDOWN
    ) {return;
    }

    // Stop any existing countdown
    if (this.countdownTimeout !== null) {clearTimeout(this.countdownTimeout);
      this.countdownTimeout = null;
    }

    // Reset the game state for a new round
    this.resetBall(Math.random() < 0.5);
    this.countdown = 3;
    this.status = GameStatus.COUNTDOWN;// Play countdown sound
    audioService.playSound("countdown", 0.7);

    // Schedule the actual game start
    this.countdownTimeout = window.setTimeout(() => {");
      this.decrementCountdown();
    }, 1000);

    // Set up failsafe to ensure game can start if countdown gets stuck
    this.setupCountdownFailsafe();COMPLETED ===");
  }

  private decrementCountdown(): void {// Decrement the countdown value
    this.countdown--;
    this.countdownTimer = 0;// If countdown is done, start the game
    if (this.countdown <= 0) {// Play start sound
      audioService.playSound("start", 1.0);
      this.startGame();
      return;
    }

    // Play countdown sound with increasing pitch as we get closer to start
    const pitch = 1.0 + 0.1 * (3 - this.countdown);
    audioService.playSound("countdown", 1.0, pitch);// Schedule next decrement
    this.countdownTimeout = window.setTimeout(() => {this.decrementCountdown();
    }, 1000);}

  /**
   * Setup a failsafe mechanism to ensure countdown progresses
   */
  private setupCountdownFailsafe(): void {
    // Clear any existing timeout
    if (this.countdownTimeout !== null) {
      window.clearTimeout(this.countdownTimeout);}// If countdown is done, start the game
    if (this.countdown <= 0) {this.startGame();
      return;
    }

    // Set a 1-second timeout to decrement the countdown
    this.countdownTimeout = window.setTimeout(() => {// Decrement the countdown
      this.countdown--;
      this.countdownTimer = 0;// Play countdown sound
      if (this.countdown > 0) {
        const pitch = 1.0 + 0.1 * (3 - this.countdown);
        audioService.playSound("countdown", 1.0, pitch);}

      // Continue the failsafe chain
      this.setupCountdownFailsafe();
    }, 1000);}

  /**
   * Start the game after countdown
   */
  private startGame(): void {// Clear any countdown failsafe timeout
    if (this.countdownTimeout !== null) {window.clearTimeout(this.countdownTimeout);
      this.countdownTimeout = null;}

    // Make sure we're not already in playing state to avoid duplicate calls
    if (this.status === GameStatus.PLAYING) {return;
    }

    this.status = GameStatus.PLAYING;// Serve the ball to a random side to start
    const serveToLeft = Math.random() >= 0.5;
    this.resetBall(serveToLeft);.x}, y=${
        this.ball.getVelocity().y
      }`
    );
  }

  /**
   * Pause the game
   */
  public pauseGame(): void {
    if (this.status === GameStatus.PLAYING) {
      this.status = GameStatus.PAUSED;
    }
  }

  /**
   * Resume the game
   */
  public resumeGame(): void {
    if (this.status === GameStatus.PAUSED) {
      this.status = GameStatus.PLAYING;
    }
  }

  /**
   * End the game with a winner
   * @param winner The winner ('player' or 'opponent')
   */
  private endGame(winner: "player" | "opponent"): void {
    this.status = GameStatus.GAME_OVER;
    this.winner = winner;
    audioService.playSound("game_over");
  }

  /**
   * Clean up any timers or resources
   */
  public cleanup(): void {
    // Clear any countdown timeout
    if (this.countdownTimeout !== null) {window.clearTimeout(this.countdownTimeout);
      this.countdownTimeout = null;
    }

    // Clear all power-ups
    if (this.powerUpManager) {
      this.powerUpManager.reset();
    }

    // Reset game speed
    this.turboModeActive = false;
    this.gameSpeedMultiplier = 1.0;
  }

  /**
   * Restart the game
   */
  public restartGame(): void {
    // Clean up any existing timers
    this.cleanup();

    this.playerScore = 0;
    this.opponentScore = 0;
    this.winner = null;
    this.initializeGameObjects();

    // Reset power-ups
    this.powerUpManager.reset();

    // Reset game speed
    this.turboModeActive = false;
    this.gameSpeedMultiplier = 1.0;

    // Reset additional balls
    this.additionalBalls = [];

    this.startCountdown();
  }

  /**
   * Set the player's input for paddle movement
   * @param isUpPressed Whether the up key is pressed
   * @param isDownPressed Whether the down key is pressed
   */
  public setPlayerInput(isUpPressed: boolean, isDownPressed: boolean): void {
    this.playerPaddle.setMovingUp(isUpPressed);
    this.playerPaddle.setMovingDown(isDownPressed);
  }

  /**
   * Set the opponent's input for paddle movement
   * @param isUpPressed Whether the up key is pressed
   * @param isDownPressed Whether the down key is pressed
   */
  public setOpponentInput(isUpPressed: boolean, isDownPressed: boolean): void {
    this.opponentPaddle.setMovingUp(isUpPressed);
    this.opponentPaddle.setMovingDown(isDownPressed);
  }

  /**
   * Get the current game state
   */
  public getState(): GameState {
    const additionalBallStates = this.additionalBalls.map((ball) =>
      ball.getState()
    );

    return {
      status: this.status,
      ball: this.ball.getState(),
      playerPaddle: this.playerPaddle.getState(),
      opponentPaddle: this.opponentPaddle.getState(),
      playerScore: this.playerScore,
      opponentScore: this.opponentScore,
      timestamp: Date.now(),
      countdown:
        this.status === GameStatus.COUNTDOWN ? this.countdown : undefined,
      winner: this.winner,
      config: { ...this.config },
      // New fields for enhanced mechanics
      powerUps: this.powerUpManager.getFieldPowerUps(),
      activePowerUps: this.powerUpManager.getActivePowerUps(),
      additionalBalls: additionalBallStates,
      turboModeActive: this.turboModeActive,
      turboModeTimeRemaining: this.turboModeTimeRemaining,
      gameSpeedMultiplier: this.gameSpeedMultiplier,
    };
  }

  /**
   * Set the game state from a GameState object
   * @param state Game state
   */
  public setState(state: GameState): void {
    const oldStatus = this.status;
    this.status = state.status;

    // Log important state transitions
    if (oldStatus !== state.status) {// Special handling for transitions from WAITING_FOR_OPPONENT
      if (oldStatus === GameStatus.WAITING_FOR_OPPONENT) {// If transitioning to PLAYING directly, ensure we've initialized properly
        if (
          state.status === GameStatus.PLAYING &&
          this.ball.getVelocity().x === 0 &&
          this.ball.getVelocity().y === 0
        ) {// Give the ball a velocity since we're jumping directly to PLAYING
          const serveToLeft = Math.random() >= 0.5;
          this.resetBall(serveToLeft);
        }
      }
    }

    // Special handling for countdown state
    if (
      state.status === GameStatus.COUNTDOWN &&
      oldStatus !== GameStatus.COUNTDOWN
    ) {this.startCountdown(); // This will set up the failsafe
      return; // startCountdown already sets everything we need
    }

    // Update object states
    this.ball.setState(state.ball);
    this.playerPaddle.setState(state.playerPaddle);
    this.opponentPaddle.setState(state.opponentPaddle);

    // Update game state
    this.playerScore = state.playerScore;
    this.opponentScore = state.opponentScore;

    // Only update countdown if in countdown state to prevent recursion issues
    if (
      state.status === GameStatus.COUNTDOWN &&
      state.countdown !== undefined
    ) {
      // Only update countdown if remote value is different
      if (this.countdown !== state.countdown) {this.countdown = state.countdown;
        this.countdownTimer = 0; // Reset timer when changing countdown value
      }
    }

    this.winner = state.winner || null;
    this.config = { ...state.config };

    // Set new fields for enhanced mechanics
    if (state.powerUps) {
      // We don't directly set powerUps here because they're managed by PowerUpManager
      // Instead, we'll use this information when rendering
    }

    if (state.turboModeActive !== undefined) {
      this.turboModeActive = state.turboModeActive;
    }

    if (state.turboModeTimeRemaining !== undefined) {
      this.turboModeTimeRemaining = state.turboModeTimeRemaining;
    }

    if (state.gameSpeedMultiplier !== undefined) {
      this.gameSpeedMultiplier = state.gameSpeedMultiplier;
    }

    // Update additional balls
    if (state.additionalBalls && state.additionalBalls.length > 0) {
      // Make sure we have the right number of balls
      while (this.additionalBalls.length < state.additionalBalls.length) {
        this.additionalBalls.push(
          new Ball(
            { x: this.fieldWidth / 2, y: this.fieldHeight / 2 },
            10,
            { x: 0, y: 0 },
            this.config.ballSpeed
          )
        );
      }

      // Remove excess balls
      while (this.additionalBalls.length > state.additionalBalls.length) {
        this.additionalBalls.pop();
      }

      // Update each ball state
      for (let i = 0; i < state.additionalBalls.length; i++) {
        this.additionalBalls[i].setState(state.additionalBalls[i]);
      }
    } else {
      // Clear additional balls if there are none in the state
      this.additionalBalls = [];
    }
  }

  /**
   * Draw power-ups on the game canvas
   * @param ctx Canvas rendering context
   */
  public drawPowerUps(ctx: CanvasRenderingContext2D): void {
    if (this.config.enablePowerUps) {
      this.powerUpManager.draw(ctx);
    }
  }

  /**
   * Get the current game status
   */
  public getStatus(): GameStatus {
    return this.status;
  }

  /**
   * Set the game status
   */
  public setStatus(status: GameStatus): void {
    this.status = status;
  }

  /**
   * Resize the game field
   * @param width New width of the game field
   * @param height New height of the game field
   */
  public resizeField(width: number, height: number): void {
    this.fieldWidth = width;
    this.fieldHeight = height;

    // Update paddle boundaries
    this.playerPaddle.setBoundaries(0, this.fieldHeight);
    this.opponentPaddle.setBoundaries(0, this.fieldHeight);

    // Update power-up manager's field size
    if (this.powerUpManager) {
      this.powerUpManager.setFieldSize(width, height);
    }
  }

  /**
   * Update game configuration
   * @param config Partial game configuration to update
   */
  public updateConfig(config: Partial<GameConfig>): void {
    this.config = { ...this.config, ...config };

    // Apply configuration to ball
    if (config.ballSpeed !== undefined) {
      this.ball.setMaxSpeed(config.ballSpeed);
    }

    // Apply configuration to paddles
    if (config.paddleHeight !== undefined || config.paddleWidth !== undefined) {
      const width = config.paddleWidth ?? this.playerPaddle.getWidth();
      const height = config.paddleHeight ?? this.playerPaddle.getHeight();

      this.playerPaddle.setWidth(width);
      this.playerPaddle.setHeight(height);
      this.opponentPaddle.setWidth(width);
      this.opponentPaddle.setHeight(height);
    }

    // Update power-up settings
    if (this.powerUpManager && config.powerUpFrequency !== undefined) {
      this.powerUpManager.setFrequency(config.powerUpFrequency);
    }
  }

  public getConfig(): GameConfig {
    return { ...this.config };
  }
}
