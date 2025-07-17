export class AudioExporter {
  private audioContext: AudioContext;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async exportSpeechToAudio(
    sentences: string[],
    voice: SpeechSynthesisVoice | null,
    speed: number,
    volume: number,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
      try {
        // Create a destination for recording
        const destination = this.audioContext.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(destination.stream);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/wav' });
          resolve(audioBlob);
        };

        mediaRecorder.start();

        // Speak each sentence and record
        for (let i = 0; i < sentences.length; i++) {
          await this.speakSentence(sentences[i], voice, speed, volume);
          if (onProgress) {
            onProgress((i + 1) / sentences.length * 100);
          }
        }

        mediaRecorder.stop();
      } catch (error) {
        reject(error);
      }
    });
  }

  private speakSentence(
    text: string,
    voice: SpeechSynthesisVoice | null,
    speed: number,
    volume: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed;
      utterance.volume = volume;
      if (voice) {
        utterance.voice = voice;
      }
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve(); // Continue even if there's an error
      
      window.speechSynthesis.speak(utterance);
    });
  }

  async createAudioFromText(
    text: string,
    voice: SpeechSynthesisVoice | null,
    speed: number = 1,
    volume: number = 1
  ): Promise<Blob> {
    const sentences = text
      .replace(/([.!?])\s+/g, '$1|')
      .replace(/([.!?])([A-Z])/g, '$1|$2')
      .split('|')
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);

    return this.exportSpeechToAudio(sentences, voice, speed, volume);
  }
}