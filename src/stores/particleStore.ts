import { defineStore } from "pinia";
import particleService from "../services/ParticleService";

/**
 * Store to manage particle effect settings
 */
export const useParticleStore = defineStore("particles", {
  state: () => ({
    enabled: particleService.isParticlesEnabled(),
  }),

  actions: {
    /**
     * Toggle particle effects on/off
     */
    toggleParticles() {
      this.enabled = !this.enabled;
      particleService.setEnabled(this.enabled);
    },

    /**
     * Set particle effects state
     */
    setParticlesEnabled(enabled: boolean) {
      this.enabled = enabled;
      particleService.setEnabled(enabled);
    },
  },

  getters: {
    /**
     * Check if particles are enabled
     */
    isEnabled: (state) => state.enabled,
  },
});
