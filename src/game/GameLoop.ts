/**
 * GameLoop class for managing game animation loop with fixed time step
 */
export class GameLoop {
  private rafId: number | null = null;
  private isRunning: boolean = false;
  private updateFn: (timestamp: number) => void;
  private renderFn: () => void;

  /**
   * Create a new GameLoop instance
   * @param updateFn Function called on fixed time step for game logic
   * @param renderFn Function called for rendering after updates
   */
  constructor(updateFn: (timestamp: number) => void, renderFn: () => void) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.gameLoop = this.gameLoop.bind(this);
  }

  /**
   * Start the game loop
   */
  public start(): void {
    if (!this.isRunning) {
      this.isRunning = true;

      // Start the animation frame loop
      this.rafId = requestAnimationFrame(this.gameLoop);
    }
  }

  /**
   * Stop the game loop
   */
  public stop(): void {
    if (this.isRunning && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.isRunning = false;
    }
  }

  /**
   * The main game loop function
   * @param timestamp Current timestamp from requestAnimationFrame
   */
  private gameLoop(timestamp: number): void {
    // Continue the loop if still running
    if (this.isRunning) {
      this.rafId = requestAnimationFrame(this.gameLoop);
    }

    // Run the update function with the timestamp provided by requestAnimationFrame
    this.updateFn(timestamp);

    // Run the render function
    this.renderFn();
  }

  /**
   * Check if the game loop is currently running
   */
  public isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Set a new update function
   */
  public setUpdateFunction(updateFn: (timestamp: number) => void): void {
    this.updateFn = updateFn;
  }

  /**
   * Set a new render function
   */
  public setRenderFunction(renderFn: () => void): void {
    this.renderFn = renderFn;
  }
}
