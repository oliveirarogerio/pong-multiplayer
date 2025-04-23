import { io, Socket } from "socket.io-client";

/**
 * Interface for session information
 */
export interface SessionInfo {
  sessionId: string;
  isHost: boolean;
}

/**
 * Interface for signaling events
 */
interface SignalingEvents {
  offer: (offer: RTCSessionDescriptionInit) => void;
  answer: (answer: RTCSessionDescriptionInit) => void;
  iceCandidate: (data: { from: string; candidate: RTCIceCandidate }) => void;
  clientJoined: () => void;
  hostDisconnected: () => void;
  clientDisconnected: () => void;
  connectionError: (error: Error) => void;
}

/**
 * Response types for server communications
 */
interface CreateSessionResponse {
  sessionId?: string;
  error?: string;
}

interface JoinSessionResponse {
  success?: boolean;
  error?: string;
}

/**
 * A service to handle WebRTC signaling through a remote server
 */
export class RemoteSignalingService {
  private socket: Socket | null = null;
  private sessionInfo: SessionInfo | null = null;
  private eventListeners: {
    [K in keyof SignalingEvents]?: Array<SignalingEvents[K]>;
  } = {};
  private signalingServerUrl: string;
  private alternativeServers: string[] = [
    "https://signaling-server-production-11db.up.railway.app",
    "https://pong-signaling.herokuapp.com",
    "https://pong-signaling-server.onrender.com",
  ];
  private currentServerIndex: number = 0;

  /**
   * Create a new RemoteSignalingService
   * @param signalingServerUrl URL of the signaling server (defaults to Railway deployment)
   */
  constructor(
    signalingServerUrl: string = "https://signaling-server-production-11db.up.railway.app"
  ) {
    // Remove any trailing slashes
    this.signalingServerUrl = signalingServerUrl.replace(/\/+$/, "");

    // Set the first server as the current one
    this.alternativeServers.unshift(this.signalingServerUrl);
    this.alternativeServers = [...new Set(this.alternativeServers)]; // Remove duplicates
  }

  /**
   * Connect to the signaling server
   */
  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect();
      }

      try {
        // Connect to the signaling server with enhanced settings for Windows
        this.socket = io(this.signalingServerUrl, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          randomizationFactor: 0.5,
          timeout: 20000, // 20 second timeout
          autoConnect: true,
          forceNew: true, // Force a new connection to avoid reusing problematic ones
        });

        // Set up connection timeout
        const connectionTimeout = setTimeout(() => {
          console.error(
            `Connection to signaling server timed out after 20 seconds`
          );
          if (!this.socket?.connected) {
            // Try next server in the list
            this.tryNextServer(resolve, reject);
          }
        }, 20000);

        // Set up event handlers
        this.socket.on("connect", () => {
          this.currentServerIndex = 0; // Reset the server index when we connect successfully
          clearTimeout(connectionTimeout);
          resolve();
        });

        this.socket.on("connect_error", (error: Error) => {
          console.error("Connection error to signaling server:", error);
          clearTimeout(connectionTimeout);
          this.tryNextServer(resolve, reject);
        });

        this.socket.on("disconnect", (reason: string) => {
          // Handle specific disconnect reasons
          if (
            reason === "io server disconnect" ||
            reason === "io client disconnect"
          ) {
            // The server or client intentionally disconnected
          } else {
            // For other reasons like transport close, try to reconnect
            this.socket?.connect();
          }
        });

        this.socket.on("reconnect_error", (error: Error) => {
          console.error("Reconnection error:", error);
        });

        this.socket.on("reconnect_failed", () => {
          console.error("Failed to reconnect after multiple attempts");
          this.tryNextServer(resolve, reject);
        });

        // Set up signaling events
        this.setupSignalingEvents();

        // For Windows, try to ping the server to check connectivity
        this.pingServer();
      } catch (error) {
        console.error("Failed to connect to signaling server:", error);
        reject(error);
      }
    });
  }

  /**
   * Try connecting to the next server in the list
   */
  private tryNextServer(
    resolve: (value: void) => void,
    reject: (reason: Error) => void
  ): void {
    // Try next server in the list
    this.currentServerIndex++;
    if (this.currentServerIndex < this.alternativeServers.length) {
      this.signalingServerUrl =
        this.alternativeServers[this.currentServerIndex];

      // Clean up current socket
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      // Try the next server
      this.connect().then(resolve).catch(reject);
      return;
    }

    // If we've tried all servers, report the error
    const error = new Error(
      `Failed to connect to any signaling server after trying ${this.alternativeServers.length} servers`
    );
    this.triggerEvent("connectionError", error);
    reject(error);
  }

  /**
   * Set up signaling events
   */
  private setupSignalingEvents(): void {
    if (!this.socket) return;

    this.socket.on("offer", (offer: RTCSessionDescriptionInit) => {
      this.triggerEvent("offer", offer);
    });

    this.socket.on("answer", (answer: RTCSessionDescriptionInit) => {
      this.triggerEvent("answer", answer);
    });

    this.socket.on(
      "iceCandidate",
      (data: { from: string; candidate: RTCIceCandidate }) => {
        this.triggerEvent("iceCandidate", data);
      }
    );

    this.socket.on("clientJoined", () => {
      this.triggerEvent("clientJoined");
    });

    this.socket.on("hostDisconnected", () => {
      this.triggerEvent("hostDisconnected");
    });

    this.socket.on("clientDisconnected", () => {
      this.triggerEvent("clientDisconnected");
    });
  }

  /**
   * Ping the server to test connectivity
   */
  private pingServer(): void {
    if (!this.socket || !this.socket.connected) return;

    this.socket.emit("ping", Date.now(), () => {});
  }

  /**
   * Create a new session as host
   * @returns Session information
   */
  public async createSession(): Promise<SessionInfo> {
    try {
      await this.connect();

      return new Promise((resolve, reject) => {
        if (!this.socket) {
          const error = new Error("Socket not connected");
          console.error("Cannot create session: Socket not connected");
          reject(error);
          return;
        }

        if (!this.socket.connected) {
          const error = new Error("Socket disconnected unexpectedly");
          console.error(
            "Cannot create session: Socket disconnected unexpectedly"
          );
          reject(error);
          return;
        }

        this.socket.emit("createSession", (response: CreateSessionResponse) => {
          if (response.error) {
            console.error(`Session creation failed: ${response.error}`);
            reject(new Error(response.error));
            return;
          }

          if (!response.sessionId) {
            console.error("No session ID received in response");
            reject(new Error("No session ID received"));
            return;
          }

          this.sessionInfo = {
            sessionId: response.sessionId,
            isHost: true,
          };

          resolve(this.sessionInfo);
        });

        // Add timeout for session creation
        setTimeout(() => {
          if (!this.sessionInfo) {
            console.error("Session creation timed out after 10 seconds");
            reject(
              new Error("Session creation timeout - no response from server")
            );
          }
        }, 10000);
      });
    } catch (error) {
      console.error("Error in createSession:", error);
      throw error;
    }
  }

  /**
   * Join an existing session as client
   * @param sessionId The session ID to join
   * @returns Session information
   */
  public async joinSession(sessionId: string): Promise<SessionInfo> {
    try {
      await this.connect();

      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error("Socket not connected"));
          return;
        }

        if (!this.socket.connected) {
          reject(new Error("Socket not connected to signaling server"));
          return;
        }

        this.socket.emit(
          "joinSession",
          { sessionId },
          (response: JoinSessionResponse) => {
            if (response.error) {
              reject(new Error(`Failed to join session: ${response.error}`));
              return;
            }

            if (!response.success) {
              reject(new Error("Session exists but join failed, try again"));
              return;
            }

            this.sessionInfo = {
              sessionId,
              isHost: false,
            };

            resolve(this.sessionInfo);
          }
        );
      });
    } catch (error) {
      console.error("Error in joinSession:", error);
      throw error;
    }
  }

  /**
   * Send an SDP offer
   * @param offer The SDP offer to send
   */
  public sendOffer(offer: RTCSessionDescriptionInit): void {
    if (!this.socket || !this.sessionInfo) {
      console.error("Cannot send offer: Not connected or no active session");
      return;
    }

    this.socket.emit("offer", {
      sessionId: this.sessionInfo.sessionId,
      offer,
    });
  }

  /**
   * Send an SDP answer
   * @param answer The SDP answer to send
   */
  public sendAnswer(answer: RTCSessionDescriptionInit): void {
    if (!this.socket || !this.sessionInfo) {
      console.error("Cannot send answer: Not connected or no active session");
      return;
    }

    this.socket.emit("answer", {
      sessionId: this.sessionInfo.sessionId,
      answer,
    });
  }

  /**
   * Send an ICE candidate
   * @param candidate The ICE candidate to send
   */
  public sendIceCandidate(candidate: RTCIceCandidate): void {
    if (!this.socket || !this.sessionInfo) {
      console.error(
        "Cannot send ICE candidate: Not connected or no active session"
      );
      return;
    }

    this.socket.emit("iceCandidate", {
      sessionId: this.sessionInfo.sessionId,
      candidate,
      isHost: this.sessionInfo.isHost,
    });
  }

  /**
   * Register an event listener
   * @param event Event type
   * @param callback Callback function
   */
  public on<K extends keyof SignalingEvents>(
    event: K,
    callback: SignalingEvents[K]
  ): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }

    this.eventListeners[event]?.push(callback);
  }

  /**
   * Remove an event listener
   * @param event Event type
   * @param callback Callback function to remove
   */
  public off<K extends keyof SignalingEvents>(
    event: K,
    callback: SignalingEvents[K]
  ): void {
    const listeners = this.eventListeners[event];
    if (!listeners) return;

    const index = listeners.indexOf(callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Trigger an event
   * @param event Event type
   * @param args Arguments to pass to the event listeners
   */
  private triggerEvent<K extends keyof SignalingEvents>(
    event: K,
    ...args: Parameters<SignalingEvents[K]>
  ): void {
    const listeners = this.eventListeners[event];
    if (!listeners) return;

    listeners.forEach((listener) => {
      try {
        (listener as Function)(...args);
      } catch (error) {
        console.error(`Error in ${event} event listener:`, error);
      }
    });
  }

  /**
   * Get current session information
   */
  public getSessionInfo(): SessionInfo | null {
    return this.sessionInfo;
  }

  /**
   * Check if connected to the signaling server
   */
  public isConnected(): boolean {
    return !!this.socket?.connected;
  }

  /**
   * Disconnect from the signaling server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.sessionInfo = null;
  }

  /**
   * Check if a session exists before attempting to join
   * @param sessionId The session ID to check
   * @returns Promise that resolves to true if session exists, false otherwise
   */
  public async checkSessionExists(sessionId: string): Promise<boolean> {
    try {
      await this.connect();

      return new Promise((resolve) => {
        if (!this.socket || !this.socket.connected) {
          console.warn("Cannot check session: Socket not connected");
          resolve(false);
          return;
        }

        this.socket.emit(
          "checkSession",
          { sessionId },
          (response: { exists: boolean; error?: string }) => {
            if (response.error) {
              console.warn(`Error checking session: ${response.error}`);
              resolve(false);
              return;
            }

            resolve(response.exists);
          }
        );

        // If no response after 3 seconds, assume false
        setTimeout(() => resolve(false), 3000);
      });
    } catch (error) {
      console.error("Error checking session:", error);
      return false;
    }
  }

  /**
   * Remove all event listeners
   */
  public removeAllListeners(): void {
    this.eventListeners = {};
  }
}

// Export a singleton instance
export const remoteSignalingService = new RemoteSignalingService();
export default remoteSignalingService;
