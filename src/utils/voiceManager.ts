/**
 * Voice Manager - Handles voice selection and filtering for English-only TTS
 */

export interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  isGoogle: boolean;
  quality: number; // Higher is better
}

export class VoiceManager {
  private static instance: VoiceManager;
  private voices: VoiceInfo[] = [];
  private initialized = false;

  static getInstance(): VoiceManager {
    if (!VoiceManager.instance) {
      VoiceManager.instance = new VoiceManager();
    }
    return VoiceManager.instance;
  }

  /**
   * Initialize voice manager and load available English voices
   */
  async initialize(): Promise<void> {
    return new Promise((resolve) => {
      const loadVoices = () => {
        const allVoices = speechSynthesis.getVoices();
        this.voices = this.filterAndRankVoices(allVoices);
        this.initialized = true;
        resolve();
      };

      // Voices might not be loaded immediately
      if (speechSynthesis.getVoices().length > 0) {
        loadVoices();
      } else {
        speechSynthesis.onvoiceschanged = () => {
          loadVoices();
          speechSynthesis.onvoiceschanged = null;
        };
      }
    });
  }

  /**
   * Filter voices to English only and rank by quality
   */
  private filterAndRankVoices(allVoices: SpeechSynthesisVoice[]): VoiceInfo[] {
    const englishVoices = allVoices.filter(voice => 
      voice.lang.startsWith('en-') || voice.lang === 'en'
    );

    return englishVoices.map(voice => ({
      voice,
      isGoogle: this.isGoogleVoice(voice),
      quality: this.calculateVoiceQuality(voice)
    })).sort((a, b) => b.quality - a.quality);
  }

  /**
   * Check if voice is a Google voice
   */
  private isGoogleVoice(voice: SpeechSynthesisVoice): boolean {
    return voice.name.toLowerCase().includes('google') ||
           voice.voiceURI.toLowerCase().includes('google') ||
           voice.name.toLowerCase().includes('chrome');
  }

  /**
   * Calculate voice quality score for ranking
   */
  private calculateVoiceQuality(voice: SpeechSynthesisVoice): number {
    let score = 0;
    
    // Prefer Google voices
    if (this.isGoogleVoice(voice)) score += 100;
    
    // Prefer US English
    if (voice.lang === 'en-US') score += 50;
    else if (voice.lang.startsWith('en-')) score += 30;
    
    // Prefer local voices for better performance
    if (voice.localService) score += 20;
    
    // Prefer default voices
    if (voice.default) score += 10;
    
    // Prefer certain voice names (higher quality)
    const highQualityNames = ['neural', 'premium', 'enhanced', 'natural'];
    if (highQualityNames.some(name => voice.name.toLowerCase().includes(name))) {
      score += 25;
    }
    
    return score;
  }

  /**
   * Get all available English voices
   */
  getEnglishVoices(): VoiceInfo[] {
    if (!this.initialized) {
      console.warn('VoiceManager not initialized. Call initialize() first.');
      return [];
    }
    return this.voices;
  }

  /**
   * Get Google voices only
   */
  getGoogleVoices(): VoiceInfo[] {
    return this.getEnglishVoices().filter(voiceInfo => voiceInfo.isGoogle);
  }

  /**
   * Get the best available voice based on preference
   */
  getBestVoice(preferGoogle: boolean = true): SpeechSynthesisVoice | null {
    const voices = this.getEnglishVoices();
    if (voices.length === 0) return null;

    if (preferGoogle) {
      const googleVoices = this.getGoogleVoices();
      if (googleVoices.length > 0) {
        return googleVoices[0].voice;
      }
    }

    return voices[0].voice;
  }

  /**
   * Find voice by URI
   */
  getVoiceByURI(voiceURI: string): SpeechSynthesisVoice | null {
    const voiceInfo = this.voices.find(v => v.voice.voiceURI === voiceURI);
    return voiceInfo ? voiceInfo.voice : null;
  }

  /**
   * Get voice display name with quality indicator
   */
  getVoiceDisplayName(voice: SpeechSynthesisVoice): string {
    const voiceInfo = this.voices.find(v => v.voice.voiceURI === voice.voiceURI);
    const isGoogle = voiceInfo?.isGoogle || false;
    const quality = voiceInfo?.quality || 0;
    
    let displayName = voice.name;
    
    // Add quality indicators
    if (isGoogle) displayName += ' (Google)';
    if (quality > 150) displayName += ' ⭐';
    
    return displayName;
  }
}