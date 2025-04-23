import { BallState, Vector2D } from "../types";

/**
 * Class representing the ball in the Pong game
 */
export class Ball {
  private position: Vector2D;
  private velocity: Vector2D;
  private radius: number;
  private baseSpeed: number;
  private speedScaleFactor: number = 1.0;
  private curveIntensity: number = 0;
  private curveDirection: number = 1;
  // New properties for enhanced mechanics
  private hitCounter: number = 0;
  private maxSpeedScale: number = 2.2; // Increased from 1.8 for faster gameplay
  private hitSpeedIncrement: number = 0.08; // Increased from 0.05 for faster acceleration
  // New curve ball properties
  private maxSpeed: number;

  /**
   * Create a new ball
   * @param position Initial position of the ball
   * @param radius Ball radius
   * @param velocity Initial velocity of the ball
   * @param baseSpeed Base speed of the ball
   */
  constructor(
    position: Vector2D,
    radius: number,
    velocity: Vector2D,
    baseSpeed: number
  ) {
    this.position = position;
    this.radius = radius;
    this.velocity = velocity;
    this.baseSpeed = baseSpeed;
    this.maxSpeed = baseSpeed;
  }

  /**
   * Update the ball's position based on its velocity
   * @param deltaTime Time elapsed since last update in seconds
   */
  public update(deltaTime: number): void {
    // Update position based on velocity and time
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
  }

  /**
   * Reset the ball to its initial position
   * @param position New position
   * @param velocity New velocity
   * @param resetSpeed Whether to reset the speed scaling
   */
  public reset(
    position: Vector2D,
    velocity: Vector2D,
    resetSpeed: boolean = true
  ): void {
    this.position = { ...position };
    this.velocity = { ...velocity };

    if (resetSpeed) {
      this.resetSpeedScaling();
    }
  }

  /**
   * Reset speed scaling back to base values
   */
  private resetSpeedScaling(): void {
    this.hitCounter = 0;
    this.speedScaleFactor = 1.0;
    // Apply the current scale factor to velocity
    this.normalizeVelocity();
  }

  /**
   * Normalize velocity to maintain direction but adjust for current speed scale
   */
  private normalizeVelocity(): void {
    // Calculate the effective max speed with scaling
    const effectiveMaxSpeed = this.baseSpeed * this.speedScaleFactor;

    // Get current velocity magnitude
    const currentSpeed = Math.sqrt(
      this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
    );

    // Only normalize if we have movement
    if (currentSpeed > 0) {
      // Set the speed to the base speed with the current scaling
      const speedFactor = effectiveMaxSpeed / currentSpeed;
      this.velocity.x *= speedFactor;
      this.velocity.y *= speedFactor;
    }
  }

  /**
   * Increase the ball speed after a paddle hit
   */
  private increaseBallSpeed(): void {
    this.hitCounter++;

    // More aggressive speed increase formula
    this.speedScaleFactor = Math.min(
      this.maxSpeedScale,
      1.0 + this.hitCounter * this.hitSpeedIncrement * (1 + Math.random() * 0.2)
    );

    // Apply the new speed scale to the velocity
    this.normalizeVelocity();}x (Hit #${
        this.hitCounter
      })`
    );
  }

  /**
   * Check if the ball collides with the top or bottom boundaries
   * @param boundaryTop Top boundary Y coordinate
   * @param boundaryBottom Bottom boundary Y coordinate
   * @returns True if a collision occurred
   */
  public checkBoundaryCollision(
    boundaryTop: number,
    boundaryBottom: number
  ): boolean {
    const nextY = this.position.y + this.velocity.y;

    // Check top and bottom boundaries
    if (nextY - this.radius <= boundaryTop) {
      // Top boundary collision
      this.velocity.y = Math.abs(this.velocity.y); // Ensure the ball bounces down
      this.position.y = boundaryTop + this.radius + 0.1; // Prevent sticking
      return true;
    } else if (nextY + this.radius >= boundaryBottom) {
      // Bottom boundary collision
      this.velocity.y = -Math.abs(this.velocity.y); // Ensure the ball bounces up
      this.position.y = boundaryBottom - this.radius - 0.1; // Prevent sticking
      return true;
    }

    return false;
  }

  /**
   * Check if the ball passes the left or right boundaries (scoring)
   * @param boundaryLeft Left boundary X coordinate
   * @param boundaryRight Right boundary X coordinate
   * @returns 'left', 'right', or null if no scoring boundary was passed
   */
  public checkScoringBoundary(
    boundaryLeft: number,
    boundaryRight: number
  ): "left" | "right" | null {
    if (this.position.x - this.radius <= boundaryLeft) {
      return "left";
    } else if (this.position.x + this.radius >= boundaryRight) {
      return "right";
    }
    return null;
  }

  /**
   * Check if the ball collides with a paddle
   * @param paddleX X coordinate of the paddle
   * @param paddleY Y coordinate of the paddle
   * @param paddleWidth Width of the paddle
   * @param paddleHeight Height of the paddle
   * @param isLeftPaddle Whether this is the left paddle
   * @returns True if a collision occurred
   */
  public checkPaddleCollision(
    paddleX: number,
    paddleY: number,
    paddleWidth: number,
    paddleHeight: number,
    isLeftPaddle: boolean
  ): boolean {
    // For the left paddle, the x position is at the leftmost point
    // For the right paddle, the x position is at the rightmost point
    const paddleLeft = isLeftPaddle ? paddleX : paddleX - paddleWidth;
    const paddleRight = isLeftPaddle ? paddleX + paddleWidth : paddleX;
    const paddleTop = paddleY - paddleHeight / 2;
    const paddleBottom = paddleY + paddleHeight / 2;

    // The closest point on the paddle to the center of the ball
    const closestX = Math.max(
      paddleLeft,
      Math.min(this.position.x, paddleRight)
    );
    const closestY = Math.max(
      paddleTop,
      Math.min(this.position.y, paddleBottom)
    );

    // Calculate the distance between the closest point and the center of the ball
    const distanceX = this.position.x - closestX;
    const distanceY = this.position.y - closestY;
    const distanceSquared = distanceX * distanceX + distanceY * distanceY;

    // Check if the distance is less than the radius of the ball
    if (distanceSquared <= this.radius * this.radius) {
      // Handle collision with the paddle
      const previousVelocityX = this.velocity.x;

      // Reverse the x velocity
      this.velocity.x = isLeftPaddle
        ? Math.abs(this.velocity.x)
        : -Math.abs(this.velocity.x);

      // Add some angle based on where on the paddle it hit
      // Higher on the paddle = more upward angle, lower = more downward angle
      const hitPositionRelative =
        (this.position.y - paddleY) / (paddleHeight / 2);

      // Enhanced physics: more extreme angles near the edges
      const angleFactor = Math.pow(hitPositionRelative, 3) * 10; // Increased from 8
      this.velocity.y += angleFactor;

      // Add random curve effect if hit is off-center
      if (Math.abs(hitPositionRelative) > 0.3) {
        // Curve intensity based on how off-center the hit is
        const curveIntensity = Math.min(
          0.8,
          Math.abs(hitPositionRelative) * 0.7
        );
        // Direction based on which side of the paddle was hit
        const curveDirection =
          hitPositionRelative > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.setCurve(curveIntensity, curveDirection);
      }

      // Cap the y velocity ratio to maintain overall speed
      const currentSpeed = Math.sqrt(
        this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
      );
      const maxYRatio = 0.85; // Increased from 0.8 to allow steeper angles

      if (Math.abs(this.velocity.y / currentSpeed) > maxYRatio) {
        // Too much y velocity, normalize
        const yDirection = this.velocity.y > 0 ? 1 : -1;
        const xDirection = this.velocity.x > 0 ? 1 : -1;

        // Set y component to be at most maxYRatio of total speed
        this.velocity.y = currentSpeed * maxYRatio * yDirection;

        // Recalculate x to maintain total speed
        const newXMagnitude = Math.sqrt(
          currentSpeed * currentSpeed - this.velocity.y * this.velocity.y
        );
        this.velocity.x = newXMagnitude * xDirection;
      }

      // Increase speed after each paddle hit
      this.increaseBallSpeed();

      // Prevent the ball from getting stuck in the paddle
      if (isLeftPaddle) {
        // If coming from the left side, push it right
        if (previousVelocityX < 0) {
          this.position.x = paddleRight + this.radius + 0.1;
        }
      } else {
        // If coming from the right side, push it left
        if (previousVelocityX > 0) {
          this.position.x = paddleLeft - this.radius - 0.1;
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Set curve parameters for the ball
   * @param intensity How strong the curve is (0-1)
   * @param direction Direction of the curve in radians
   */
  public setCurve(intensity: number, direction: number): void {
    this.curveIntensity = Math.min(1, Math.max(0, intensity));
    this.curveDirection = direction;
  }

  /**
   * Get the current state of the ball
   */
  public getState(): BallState {
    return {
      position: { ...this.position },
      velocity: { ...this.velocity },
      radius: this.radius,
      speedScaleFactor: this.speedScaleFactor,
      hitCounter: this.hitCounter,
      curveIntensity: this.curveIntensity,
      curveDirection: this.curveDirection,
    };
  }

  /**
   * Set the state of the ball from a BallState object
   */
  public setState(state: BallState): void {
    this.position = { ...state.position };
    this.velocity = { ...state.velocity };
    this.radius = state.radius;

    // Only update speed scaling if provided
    if (state.speedScaleFactor !== undefined) {
      this.speedScaleFactor = state.speedScaleFactor;
    }

    if (state.hitCounter !== undefined) {
      this.hitCounter = state.hitCounter;
    }

    // Update curve properties if available
    if (state.curveIntensity !== undefined) {
      this.curveIntensity = state.curveIntensity;
    }

    if (state.curveDirection !== undefined) {
      this.curveDirection = state.curveDirection;
    }
  }

  /**
   * Get the position of the ball
   */
  public getPosition(): Vector2D {
    return { ...this.position };
  }

  /**
   * Get the velocity of the ball
   */
  public getVelocity(): Vector2D {
    return { ...this.velocity };
  }

  /**
   * Set the velocity of the ball
   */
  public setVelocity(velocity: Vector2D): void {
    this.velocity = { ...velocity };
  }

  /**
   * Get the radius of the ball
   */
  public getRadius(): number {
    return this.radius;
  }

  /**
   * Get the current speed scale factor
   */
  public getSpeedScaleFactor(): number {
    return this.speedScaleFactor;
  }

  /**
   * Get the hit counter value
   */
  public getHitCounter(): number {
    return this.hitCounter;
  }

  public setMaxSpeed(speed: number): void {
    this.maxSpeed = speed;
    // If current speed exceeds new max, cap it
    if (Math.abs(this.velocity.x) > this.maxSpeed) {
      this.velocity.x = this.maxSpeed * Math.sign(this.velocity.x);
    }
    if (Math.abs(this.velocity.y) > this.maxSpeed) {
      this.velocity.y = this.maxSpeed * Math.sign(this.velocity.y);
    }
  }
}
