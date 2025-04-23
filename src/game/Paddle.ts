import { PaddleState, Vector2D } from "../types";

/**
 * Class representing a paddle in the Pong game
 */
export class Paddle {
  private position: Vector2D;
  private width: number;
  private height: number;
  private speed: number;
  private isMovingUp: boolean = false;
  private isMovingDown: boolean = false;
  private minY: number;
  private maxY: number;
  // Enhanced mechanics
  private isRebounding: boolean = false;
  private reboundTime: number = 0;
  private reboundDuration: number = 0.3; // seconds
  private reboundSpeed: number = 1.5; // multiplier for rebound speed
  private boostZoneSize: number = 0.15; // percentage of field height for boost zone
  private boostMultiplier: number = 1.5; // Increased from 1.3 for faster boost
  // New properties for paddle dynamics
  private originalHeight: number;
  private targetHeight: number; // For smooth size transitions
  private resizeRate: number = 50; // How fast the paddle resizes per second
  private shrinkFactor: number = 0.99; // Rate at which paddle shrinks over time (1.0 = no shrink)
  private minPaddleHeight: number = 30; // Minimum paddle height
  private maxPaddleHeight: number = 120; // Maximum paddle height
  private dashCooldown: number = 0; // Cooldown timer for dash ability
  private dashDuration: number = 0; // Current dash duration
  private dashSpeed: number = 2.5; // Multiplier for dash speed
  private maxDashDuration: number = 0.15; // Maximum dash duration in seconds
  private maxDashCooldown: number = 0.8; // Cooldown between dashes in seconds
  private isDashing: boolean = false; // Whether currently dashing
  private consecutiveHits: number = 0; // Tracking consecutive hits for combo effects
  private isCurrentlyShrunken: boolean = false;

  /**
   * Create a new paddle
   * @param initialPosition Initial position of the paddle
   * @param width Width of the paddle
   * @param height Height of the paddle
   * @param speed Movement speed of the paddle
   * @param minY Minimum Y position (top boundary)
   * @param maxY Maximum Y position (bottom boundary)
   */
  constructor(
    initialPosition: Vector2D = { x: 0, y: 0 },
    width: number = 10,
    height: number = 60,
    speed: number = 300,
    minY: number = 0,
    maxY: number = 600
  ) {
    this.position = { ...initialPosition };
    this.width = width;
    this.height = height;
    this.originalHeight = height;
    this.targetHeight = height;
    this.speed = speed;
    this.minY = minY;
    this.maxY = maxY;
  }

  /**
   * Update the paddle's position based on its movement state
   * @param deltaTime Time elapsed since last update in seconds
   */
  public update(deltaTime: number): void {
    // Handle rebounding state
    if (this.isRebounding) {
      this.updateRebound(deltaTime);
    } else if (this.isDashing) {
      this.updateDash(deltaTime);
    } else {
      // Normal movement
      this.updateMovement(deltaTime);
    }

    // Update dash cooldown
    if (this.dashCooldown > 0) {
      this.dashCooldown = Math.max(0, this.dashCooldown - deltaTime);
    }

    // Update paddle height with smooth transitions
    this.updatePaddleSize(deltaTime);

    // Apply gradual shrinking over time (only if paddle is larger than minimum)
    if (this.height > this.minPaddleHeight) {
      this.targetHeight *= Math.pow(this.shrinkFactor, deltaTime);
      this.targetHeight = Math.max(this.minPaddleHeight, this.targetHeight);
    }
  }

  /**
   * Update the paddle's movement (normal state)
   * @param deltaTime Time elapsed since last update
   */
  private updateMovement(deltaTime: number): void {
    let direction = 0;

    // Determine the movement direction
    if (this.isMovingUp && !this.isMovingDown) {
      direction = -1; // Up is negative in screen coordinates
    } else if (this.isMovingDown && !this.isMovingUp) {
      direction = 1; // Down is positive in screen coordinates
    }

    // Apply movement with speed and time delta
    if (direction !== 0) {
      // Calculate current movement speed with boost if in boost zone
      let currentSpeed = this.speed;

      // Check if in top boost zone
      const topBoostZone =
        this.minY + (this.maxY - this.minY) * this.boostZoneSize;
      if (this.position.y - this.height / 2 < topBoostZone && direction < 0) {
        currentSpeed *= this.boostMultiplier;
      }

      // Check if in bottom boost zone
      const bottomBoostZone =
        this.maxY - (this.maxY - this.minY) * this.boostZoneSize;
      if (
        this.position.y + this.height / 2 > bottomBoostZone &&
        direction > 0
      ) {
        currentSpeed *= this.boostMultiplier;
      }

      const newY = this.position.y + direction * currentSpeed * deltaTime;

      // Calculate the paddle's top and bottom positions
      const paddleTop = newY - this.height / 2;
      const paddleBottom = newY + this.height / 2;

      // Check for boundary collisions and initiate rebound if needed
      if (paddleTop <= this.minY && direction < 0) {
        // Hitting top boundary while moving up
        this.startRebound(direction);
      } else if (paddleBottom >= this.maxY && direction > 0) {
        // Hitting bottom boundary while moving down
        this.startRebound(direction);
      } else {
        // Normal movement within bounds
        this.position.y = Math.max(
          this.minY + this.height / 2,
          Math.min(newY, this.maxY - this.height / 2)
        );
      }
    }
  }

  /**
   * Update paddle during dash state
   * @param deltaTime Time elapsed since last update
   */
  private updateDash(deltaTime: number): void {
    this.dashDuration -= deltaTime;

    let direction = 0;

    // Determine dash direction (locked in when dash started)
    if (this.isMovingUp && !this.isMovingDown) {
      direction = -1;
    } else if (this.isMovingDown && !this.isMovingUp) {
      direction = 1;
    }

    if (direction !== 0) {
      // Apply boosted dash speed
      const dashSpeedValue = this.speed * this.dashSpeed;
      const newY = this.position.y + direction * dashSpeedValue * deltaTime;

      // Ensure paddle stays within bounds
      this.position.y = Math.max(
        this.minY + this.height / 2,
        Math.min(newY, this.maxY - this.height / 2)
      );
    }

    // End dash if duration expires
    if (this.dashDuration <= 0) {
      this.isDashing = false;
      this.dashCooldown = this.maxDashCooldown;
    }
  }

  /**
   * Attempt to perform a dash move
   * @returns Whether the dash was started successfully
   */
  public attemptDash(): boolean {
    // Can only dash if not already dashing, not rebounding, and cooldown is expired
    if (!this.isDashing && !this.isRebounding && this.dashCooldown <= 0) {
      this.isDashing = true;
      this.dashDuration = this.maxDashDuration;
      return true;
    }
    return false;
  }

  /**
   * Update paddle height with smooth transitions
   * @param deltaTime Time elapsed since last update
   */
  private updatePaddleSize(deltaTime: number): void {
    if (this.height !== this.targetHeight) {
      // Calculate direction and amount of size change
      const direction = this.height < this.targetHeight ? 1 : -1;
      const change = this.resizeRate * deltaTime;

      // Apply the change with clamping
      if (direction > 0) {
        this.height = Math.min(this.targetHeight, this.height + change);
      } else {
        this.height = Math.max(this.targetHeight, this.height - change);
      }

      // Ensure paddle doesn't go outside boundaries after resize
      this.position.y = Math.max(
        this.minY + this.height / 2,
        Math.min(this.position.y, this.maxY - this.height / 2)
      );
    }
  }

  /**
   * Apply a resize effect to the paddle
   * @param sizeFactor Multiplier for the paddle size (1.0 = no change)
   * @param instant Whether to apply the change instantly or gradually
   */
  public applyResizeEffect(sizeFactor: number, instant: boolean = false): void {
    const newHeight = Math.min(
      this.maxPaddleHeight,
      Math.max(this.minPaddleHeight, this.originalHeight * sizeFactor)
    );

    if (instant) {
      this.height = newHeight;
      this.targetHeight = newHeight;
    } else {
      this.targetHeight = newHeight;
    }

    this.isCurrentlyShrunken = sizeFactor < 1;
  }

  /**
   * Reset the paddle size to its original value
   * @param instant Whether to apply the change instantly or gradually
   */
  public resetSize(instant: boolean = false): void {
    if (instant) {
      this.height = this.originalHeight;
      this.targetHeight = this.originalHeight;
    } else {
      this.targetHeight = this.originalHeight;
    }

    this.isCurrentlyShrunken = false;
  }

  /**
   * Get the current state of the paddle
   */
  public getState(): PaddleState {
    return {
      position: { ...this.position },
      width: this.width,
      height: this.height,
      isMovingUp: this.isMovingUp,
      isMovingDown: this.isMovingDown,
      isRebounding: this.isRebounding,
      reboundTime: this.reboundTime,
    };
  }

  /**
   * Set the state of the paddle from a PaddleState object
   */
  public setState(state: PaddleState): void {
    this.position = { ...state.position };
    this.width = state.width;
    this.height = state.height;
    this.targetHeight = state.height; // Update target height too
    this.isMovingUp = state.isMovingUp;
    this.isMovingDown = state.isMovingDown;

    // Set rebounding state if provided
    if (state.isRebounding !== undefined) {
      this.isRebounding = state.isRebounding;
    }

    if (state.reboundTime !== undefined) {
      this.reboundTime = state.reboundTime;
    }

    // Ensure the position is within boundaries
    this.setPosition(this.position);
  }

  /**
   * Record a successful hit for combo tracking
   */
  public recordHit(): void {
    this.consecutiveHits++;

    // Apply temporary paddle enlargement on successful hits
    if (this.consecutiveHits >= 3) {
      // 5% larger for every hit above 2, up to 30% max
      const growFactor = Math.min(1.3, 1.0 + (this.consecutiveHits - 2) * 0.05);
      this.applyResizeEffect(growFactor);
    }
  }

  /**
   * Reset consecutive hit counter when opponent scores
   */
  public resetHitCombo(): void {
    this.consecutiveHits = 0;
    // Reset paddle size gradually when combo breaks
    this.targetHeight = this.originalHeight;
  }

  /**
   * Start a rebound effect
   * @param originalDirection The direction (-1 for up, 1 for down) the paddle was moving
   */
  private startRebound(originalDirection: number): void {
    this.isRebounding = true;
    this.reboundTime = 0;

    // Automatically reverse the movement direction
    if (originalDirection < 0) {
      // Was moving up, now move down
      this.isMovingUp = false;
      this.isMovingDown = true;
    } else {
      // Was moving down, now move up
      this.isMovingUp = true;
      this.isMovingDown = false;
    }
  }

  /**
   * Update the paddle during a rebound
   * @param deltaTime Time elapsed since last update
   */
  private updateRebound(deltaTime: number): void {
    this.reboundTime += deltaTime;

    let direction = 0;

    // Determine direction based on current movement state
    if (this.isMovingUp && !this.isMovingDown) {
      direction = -1;
    } else if (this.isMovingDown && !this.isMovingUp) {
      direction = 1;
    }

    if (direction !== 0) {
      // Apply boosted speed during rebound
      const reboundSpeedValue = this.speed * this.reboundSpeed;
      const newY = this.position.y + direction * reboundSpeedValue * deltaTime;

      // Ensure paddle stays within bounds
      this.position.y = Math.max(
        this.minY + this.height / 2,
        Math.min(newY, this.maxY - this.height / 2)
      );
    }

    // End rebound after duration expires
    if (this.reboundTime >= this.reboundDuration) {
      this.isRebounding = false;
    }
  }

  /**
   * Check if paddle is currently in rebound state
   */
  public isInRebound(): boolean {
    return this.isRebounding;
  }

  /**
   * Set the paddle's movement state for upward movement
   * @param isMoving Whether the paddle should move up
   */
  public setMovingUp(isMoving: boolean): void {
    this.isMovingUp = isMoving;
  }

  /**
   * Set the paddle's movement state for downward movement
   * @param isMoving Whether the paddle should move down
   */
  public setMovingDown(isMoving: boolean): void {
    this.isMovingDown = isMoving;
  }

  /**
   * Get the paddle's current position
   */
  public getPosition(): Vector2D {
    return { ...this.position };
  }

  /**
   * Set the paddle's position
   * @param position New position
   */
  public setPosition(position: Vector2D): void {
    this.position.x = position.x;

    // Ensure the Y position stays within bounds
    this.position.y = Math.max(
      this.minY + this.height / 2,
      Math.min(position.y, this.maxY - this.height / 2)
    );
  }

  /**
   * Set the boundaries for the paddle's movement
   * @param minY Minimum Y position (top boundary)
   * @param maxY Maximum Y position (bottom boundary)
   */
  public setBoundaries(minY: number, maxY: number): void {
    this.minY = minY;
    this.maxY = maxY;

    // Update position to ensure it's within the new boundaries
    this.setPosition(this.position);
  }

  /**
   * Get the width of the paddle
   */
  public getWidth(): number {
    return this.width;
  }

  /**
   * Set the width of the paddle
   */
  public setWidth(width: number): void {
    this.width = width;
  }

  /**
   * Get the height of the paddle
   */
  public getHeight(): number {
    return this.height;
  }

  /**
   * Set the height of the paddle
   */
  public setHeight(height: number): void {
    this.height = height;

    // Update position to ensure it's within boundaries after height change
    this.setPosition(this.position);
  }

  /**
   * Get the movement speed of the paddle
   */
  public getSpeed(): number {
    return this.speed;
  }

  /**
   * Set the movement speed of the paddle
   */
  public setSpeed(speed: number): void {
    this.speed = speed;
  }

  /**
   * Check if the paddle is currently moving up
   */
  public isUpPressed(): boolean {
    return this.isMovingUp;
  }

  /**
   * Check if the paddle is currently moving down
   */
  public isDownPressed(): boolean {
    return this.isMovingDown;
  }

  public isShrunken(): boolean {
    return this.isCurrentlyShrunken;
  }
}
