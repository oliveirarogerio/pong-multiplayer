// Export all game components from a single file
export * from "./Ball";
export * from "./Paddle";
export * from "./Game";
export * from "./GameLoop";
export * from "./GameManager";

// Also export the singleton GameManager instance
import gameManager from "./GameManager";
export { gameManager };
export default gameManager;
