/**
 * Particle class for visual effects
 */
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;

  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    color: string,
    life: number
  ) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.color = color;
    this.life = life;
    this.maxLife = life;
  }

  /**
   * Update particle position and life
   * @param deltaTime Time since last update in seconds
   * @returns True if the particle is still alive
   */
  update(deltaTime: number): boolean {
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.life -= deltaTime;
    return this.life > 0;
  }

  /**
   * Draw the particle
   * @param ctx Canvas rendering context
   */
  draw(ctx: CanvasRenderingContext2D): void {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

/**
 * Particle emitter for creating visual effects
 */
export class ParticleService {
  private particles: Particle[] = [];
  private isEnabled: boolean = true;

  /**
   * Enable or disable particle effects
   * @param enabled Whether particles should be enabled
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Check if particles are enabled
   */
  public isParticlesEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Create a particle explosion effect
   * @param x X position
   * @param y Y position
   * @param count Number of particles
   * @param color Base color
   * @param minSpeed Minimum particle speed
   * @param maxSpeed Maximum particle speed
   * @param minLife Minimum particle lifetime in seconds
   * @param maxLife Maximum particle lifetime in seconds
   */
  public createExplosion(
    x: number,
    y: number,
    count: number = 20,
    color: string = "#FFFFFF",
    minSpeed: number = 50,
    maxSpeed: number = 200,
    minLife: number = 0.2,
    maxLife: number = 0.6
  ): void {
    if (!this.isEnabled) return;

    for (let i = 0; i < count; i++) {
      // Random angle
      const angle = Math.random() * Math.PI * 2;

      // Random speed
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);

      // Calculate velocity components
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      // Random radius
      const radius = 1 + Math.random() * 3;

      // Random life
      const life = minLife + Math.random() * (maxLife - minLife);

      // Create the particle
      this.particles.push(new Particle(x, y, vx, vy, radius, color, life));
    }
  }

  /**
   * Create a collision effect
   * @param x X position
   * @param y Y position
   * @param size Size of the effect
   */
  public createPaddleHitEffect(x: number, y: number, size: number = 1): void {
    this.createExplosion(
      x,
      y,
      15 * size,
      "#FFFFFF",
      100 * size,
      300 * size,
      0.2,
      0.5
    );
  }

  /**
   * Create a wall hit effect
   * @param x X position
   * @param y Y position
   */
  public createWallHitEffect(x: number, y: number): void {
    this.createExplosion(x, y, 10, "#CCCCCC", 50, 150, 0.1, 0.3);
  }

  /**
   * Create a scoring effect
   * @param x X position
   * @param y Y position
   */
  public createScoreEffect(x: number, y: number): void {
    this.createExplosion(x, y, 30, "#FFCC00", 100, 300, 0.5, 1.0);
  }

  /**
   * Update all particles
   * @param deltaTime Time since last update in seconds
   */
  public update(deltaTime: number): void {
    if (!this.isEnabled) {
      this.particles = [];
      return;
    }

    // Update each particle and keep only the active ones
    this.particles = this.particles.filter((particle) =>
      particle.update(deltaTime)
    );
  }

  /**
   * Draw all particles
   * @param ctx Canvas rendering context
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.isEnabled || this.particles.length === 0) return;

    // Draw each particle
    this.particles.forEach((particle) => particle.draw(ctx));
  }

  /**
   * Clear all particles
   */
  public clear(): void {
    this.particles = [];
  }
}

// Export a singleton instance
export const particleService = new ParticleService();
export default particleService;
