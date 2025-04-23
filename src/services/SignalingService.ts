/**
 * Simple in-memory signaling service to simulate SDP and ICE candidate exchange
 *
 * Note: In a real-world application, this would be a separate server-side component
 * that facilitates WebRTC connection establishment between peers.
 */

// Store active sessions by code
interface SessionData {
  offer?: RTCSessionDescriptionInit;
  iceCandidates: RTCIceCandidate[];
  hostConnected: boolean;
  clientConnected: boolean;
}

export class SignalingService {
  private sessions: Map<string, SessionData> = new Map();

  /**
   * Generate a session code for a host
   * @returns A unique session code
   */
  public generateSessionCode(): string {
    // Generate a random 6-character alphanumeric session code
    const sessionCode = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    // Initialize session data
    this.sessions.set(sessionCode, {
      iceCandidates: [],
      hostConnected: true,
      clientConnected: false,
    });

    return sessionCode;
  }

  /**
   * Check if a session exists
   * @param sessionCode The session code to check
   * @returns True if the session exists
   */
  public sessionExists(sessionCode: string): boolean {
    return this.sessions.has(sessionCode);
  }

  /**
   * Store an SDP offer from the host
   * @param sessionCode The session code
   * @param offer The SDP offer
   */
  public setOffer(sessionCode: string, offer: RTCSessionDescriptionInit): void {
    const session = this.sessions.get(sessionCode);
    if (!session) return;

    session.offer = offer;
  }

  /**
   * Get the SDP offer for a session
   * @param sessionCode The session code
   * @returns The SDP offer, or undefined if not available
   */
  public getOffer(sessionCode: string): RTCSessionDescriptionInit | undefined {
    return this.sessions.get(sessionCode)?.offer;
  }

  /**
   * Add an ICE candidate for a session
   * @param sessionCode The session code
   * @param candidate The ICE candidate
   */
  public addIceCandidate(
    sessionCode: string,
    candidate: RTCIceCandidate
  ): void {
    const session = this.sessions.get(sessionCode);
    if (!session) return;

    session.iceCandidates.push(candidate);
  }

  /**
   * Get all ICE candidates for a session
   * @param sessionCode The session code
   * @returns Array of ICE candidates
   */
  public getIceCandidates(sessionCode: string): RTCIceCandidate[] {
    return this.sessions.get(sessionCode)?.iceCandidates || [];
  }

  /**
   * Set client connection status for a session
   * @param sessionCode The session code
   * @param connected Whether the client is connected
   */
  public setClientConnected(sessionCode: string, connected: boolean): void {
    const session = this.sessions.get(sessionCode);
    if (!session) return;

    session.clientConnected = connected;
  }

  /**
   * Get connection status for a session
   * @param sessionCode The session code
   * @returns Object with host and client connection status
   */
  public getConnectionStatus(
    sessionCode: string
  ): { hostConnected: boolean; clientConnected: boolean } | undefined {
    const session = this.sessions.get(sessionCode);
    if (!session) return undefined;

    return {
      hostConnected: session.hostConnected,
      clientConnected: session.clientConnected,
    };
  }

  /**
   * Close a session when it's no longer needed
   * @param sessionCode The session code
   */
  public closeSession(sessionCode: string): void {
    this.sessions.delete(sessionCode);
  }
}

// Export a singleton instance
export const signalingService = new SignalingService();
export default signalingService;
