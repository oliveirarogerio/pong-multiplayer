import { PowerUp, PowerUpType, Vector2D } from "../types";
import particleService from "../services/ParticleService";
import audioService from "../services/AudioService";

/**
 * Class for managing power-ups in the game
 */
export class PowerUpManager {
  private powerUps: PowerUp[] = [];
  private activePowerUps: PowerUp[] = [];
  private fieldWidth: number = 800;
  private fieldHeight: number = 600;
  private spawnTimer: number = 0;
  private spawnInterval: number = 15; // Seconds between spawns
  private maxPowerUps: number = 1; // Max number of powerups on screen
  private powerUpRadius: number = 15;
  private powerUpColors: Map<PowerUpType, string> = new Map([
    [PowerUpType.SPEED_UP, "#FF5733"],
    [PowerUpType.ENLARGE_PADDLE, "#33FF57"],
    [PowerUpType.SHRINK_OPPONENT, "#5733FF"],
    [PowerUpType.CURVE_BALL, "#FFFF33"],
    [PowerUpType.MULTI_BALL, "#33FFFF"],
    [PowerUpType.TURBO_MODE, "#FF33FF"],
  ]);

  /**
   * Create a PowerUpManager
   * @param fieldWidth Width of the game field
   * @param fieldHeight Height of the game field
   * @param spawnInterval Seconds between power-up spawns
   */
  constructor(
    fieldWidth: number = 800,
    fieldHeight: number = 600,
    spawnInterval: number = 15
  ) {
    this.fieldWidth = fieldWidth;
    this.fieldHeight = fieldHeight;
    this.spawnInterval = spawnInterval;
    this.spawnTimer = spawnInterval * 0.5; // Start halfway to first spawn
  }

  /**
   * Update the power-up system
   * @param deltaTime Time elapsed since last update
   */
  public update(deltaTime: number): void {
    // Update spawn timer
    this.spawnTimer -= deltaTime;

    // Spawn new power-up if needed
    if (this.spawnTimer <= 0 && this.powerUps.length < this.maxPowerUps) {
      this.spawnPowerUp();
      this.spawnTimer = this.spawnInterval;
    }

    // Update active power-ups duration
    for (let i = this.activePowerUps.length - 1; i >= 0; i--) {
      const powerUp = this.activePowerUps[i];

      if (powerUp.activatedTime !== undefined) {
        const elapsedTime = (Date.now() - powerUp.activatedTime) / 1000;

        // Remove expired power-ups
        if (powerUp.duration !== undefined && elapsedTime >= powerUp.duration) {
          this.activePowerUps.splice(i, 1);
        }
      }
    }
  }

  /**
   * Spawn a new power-up at a random position
   */
  private spawnPowerUp(): void {
    // Select a random power-up type
    const powerUpTypes = Object.values(PowerUpType);
    const randomType = powerUpTypes[
      Math.floor(Math.random() * powerUpTypes.length)
    ] as PowerUpType;

    // Generate a random position that's not too close to the edges
    const padding = this.powerUpRadius * 2;
    const x = padding + Math.random() * (this.fieldWidth - padding * 2);
    const y = padding + Math.random() * (this.fieldHeight - padding * 2);

    // Create the power-up
    const powerUp: PowerUp = {
      type: randomType,
      position: { x, y },
      radius: 10,
      active: true,
      duration: 10, // Default duration
      affectsPlayer: Math.random() < 0.5 ? "player" : "opponent",
    };

    this.powerUps.push(powerUp);
  }

  /**
   * Check if the ball collects any power-ups
   * @param ballPosition Ball position
   * @param ballRadius Ball radius
   * @param isPlayer Whether the ball is moving toward the player's side
   * @returns Collected power-up or null
   */
  public checkPowerUpCollection(
    ballPosition: Vector2D,
    ballRadius: number,
    isPlayer: boolean
  ): PowerUp | null {
    for (let i = 0; i < this.powerUps.length; i++) {
      const powerUp = this.powerUps[i];

      // Calculate distance between ball and power-up
      const dx = ballPosition.x - powerUp.position.x;
      const dy = ballPosition.y - powerUp.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check for collision
      if (distance < ballRadius + powerUp.radius) {
        // Remove power-up from field
        this.powerUps.splice(i, 1);

        // Set which player the power-up affects
        powerUp.affectsPlayer = isPlayer ? "player" : "opponent";

        // Set activation time
        powerUp.activatedTime = Date.now();

        // Add to active power-ups
        this.activePowerUps.push(powerUp);

        // Create particle effect
        particleService.createExplosion(
          powerUp.position.x,
          powerUp.position.y,
          30,
          this.getPowerUpColor(powerUp.type),
          100,
          300,
          0.5,
          1.0
        );

        // Play sound
        audioService.playSound("score", 0.7, 1.2);

        return powerUp;
      }
    }

    return null;
  }

  /**
   * Get all active power-ups
   */
  public getActivePowerUps(): PowerUp[] {
    return [...this.activePowerUps];
  }

  /**
   * Get all power-ups on the field
   */
  public getFieldPowerUps(): PowerUp[] {
    return [...this.powerUps];
  }

  /**
   * Check if a specific type of power-up is active for a player
   * @param type Power-up type to check
   * @param player Which player to check for
   */
  public isPowerUpActive(
    type: PowerUpType,
    player: "player" | "opponent"
  ): boolean {
    return this.activePowerUps.some(
      (p) => p.type === type && p.affectsPlayer === player
    );
  }

  /**
   * Get the color for a power-up type
   * @param type Power-up type
   */
  public getPowerUpColor(type: PowerUpType): string {
    return this.powerUpColors.get(type) || "#FFFFFF";
  }

  /**
   * Reset all power-ups
   */
  public reset(): void {
    this.powerUps = [];
    this.activePowerUps = [];
    this.spawnTimer = this.spawnInterval;
  }

  /**
   * Clear all powerups from the field without resetting the timer
   */
  public clearFieldPowerUps(): void {
    this.powerUps = [];
  }

  /**
   * Set the field size for power-ups
   * @param width New field width
   * @param height New field height
   */
  public setFieldSize(width: number, height: number): void {
    this.fieldWidth = width;
    this.fieldHeight = height;
  }

  /**
   * Set the spawn frequency for power-ups
   * @param frequency New spawn interval in seconds
   */
  public setFrequency(frequency: number): void {
    this.spawnInterval = frequency;
    // Reset the spawn timer to avoid waiting too long if frequency is increased
    this.spawnTimer = Math.min(this.spawnTimer, frequency);
  }

  /**
   * Draw all power-ups on the field
   * @param ctx Canvas rendering context
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    // Draw each power-up
    for (const powerUp of this.powerUps) {
      const color = this.getPowerUpColor(powerUp.type);

      // Draw outer glow
      const gradient = ctx.createRadialGradient(
        powerUp.position.x,
        powerUp.position.y,
        powerUp.radius * 0.5,
        powerUp.position.x,
        powerUp.position.y,
        powerUp.radius * 1.5
      );
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.beginPath();
      ctx.arc(
        powerUp.position.x,
        powerUp.position.y,
        powerUp.radius * 1.5,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw the power-up
      ctx.beginPath();
      ctx.arc(
        powerUp.position.x,
        powerUp.position.y,
        powerUp.radius,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = color;
      ctx.fill();

      // Add pulsing effect
      const pulseSize = 1 + Math.sin(Date.now() / 200) * 0.1;
      ctx.beginPath();
      ctx.arc(
        powerUp.position.x,
        powerUp.position.y,
        powerUp.radius * 0.7 * pulseSize,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();

      // Draw icon based on type
      ctx.fillStyle = "#000000";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let icon = "";
      switch (powerUp.type) {
        case PowerUpType.SPEED_UP:
          icon = "⚡";
          break;
        case PowerUpType.ENLARGE_PADDLE:
          icon = "↕";
          break;
        case PowerUpType.SHRINK_OPPONENT:
          icon = "↓";
          break;
        case PowerUpType.CURVE_BALL:
          icon = "↺";
          break;
        case PowerUpType.MULTI_BALL:
          icon = "+";
          break;
        case PowerUpType.TURBO_MODE:
          icon = "⚡⚡";
          break;
      }

      ctx.fillText(icon, powerUp.position.x, powerUp.position.y);
    }
  }
}

export default PowerUpManager;
