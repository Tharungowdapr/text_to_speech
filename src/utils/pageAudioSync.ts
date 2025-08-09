/**
 * Page-Audio Synchronization System
 * Handles mapping between PDF pages and audio playback positions
 */

export interface PageMapping {
  pageNumber: number;
  startCharIndex: number;
  endCharIndex: number;
  startSentenceIndex: number;
  endSentenceIndex: number;
  wordCount: number;
  textContent: string;
  isEmpty: boolean;
  hasImages: boolean;
  extractionMethod: 'text' | 'ocr' | 'mixed';
}

export interface PlaybackState {
  currentPage: number;
  currentSentenceIndex: number;
  currentCharIndex: number;
  totalPages: number;
  totalSentences: number;
  isPlaying: boolean;
  playbackPosition: number; // 0-1 representing progress within current page
}

export interface AudioPosition {
  sentenceIndex: number;
  pageNumber: number;
  characterOffset: number;
  timestamp: number;
}

export class PageAudioSynchronizer {
  private pageMap: Map<number, PageMapping> = new Map();
  private sentenceToPageMap: Map<number, number> = new Map();
  private playbackState: PlaybackState;
  private debounceTimer: NodeJS.Timeout | null = null;
  private onStateChange?: (state: PlaybackState) => void;
  private onError?: (error: string) => void;

  constructor(
    onStateChange?: (state: PlaybackState) => void,
    onError?: (error: string) => void
  ) {
    this.playbackState = {
      currentPage: 1,
      currentSentenceIndex: 0,
      currentCharIndex: 0,
      totalPages: 0,
      totalSentences: 0,
      isPlaying: false,
      playbackPosition: 0
    };
    this.onStateChange = onStateChange;
    this.onError = onError;
  }

  /**
   * Initialize page mappings from extracted text and PDF metadata
   */
  async initializePageMappings(
    pdfPages: any[],
    sentences: string[],
    extractionMethod: 'text' | 'ocr' | 'mixed' = 'text'
  ): Promise<void> {
    try {
      this.pageMap.clear();
      this.sentenceToPageMap.clear();

      let currentCharIndex = 0;
      let currentSentenceIndex = 0;
      const avgSentencesPerPage = Math.ceil(sentences.length / pdfPages.length);

      for (let pageNum = 1; pageNum <= pdfPages.length; pageNum++) {
        const pageData = pdfPages[pageNum - 1];
        
        // Calculate sentences for this page
        const sentencesForPage = this.calculateSentencesForPage(
          sentences,
          pageNum,
          pdfPages.length,
          avgSentencesPerPage
        );

        const startSentenceIndex = currentSentenceIndex;
        const endSentenceIndex = Math.min(
          currentSentenceIndex + sentencesForPage.length - 1,
          sentences.length - 1
        );

        const pageText = sentencesForPage.join(' ');
        const startCharIndex = currentCharIndex;
        const endCharIndex = currentCharIndex + pageText.length - 1;

        // Create page mapping
        const pageMapping: PageMapping = {
          pageNumber: pageNum,
          startCharIndex,
          endCharIndex,
          startSentenceIndex,
          endSentenceIndex,
          wordCount: this.countWords(pageText),
          textContent: pageText,
          isEmpty: pageText.trim().length === 0,
          hasImages: await this.detectImages(pageData),
          extractionMethod
        };

        this.pageMap.set(pageNum, pageMapping);

        // Map sentences to pages
        for (let i = startSentenceIndex; i <= endSentenceIndex; i++) {
          this.sentenceToPageMap.set(i, pageNum);
        }

        currentCharIndex = endCharIndex + 1;
        currentSentenceIndex = endSentenceIndex + 1;
      }

      this.playbackState.totalPages = pdfPages.length;
      this.playbackState.totalSentences = sentences.length;
      this.notifyStateChange();

    } catch (error) {
      this.handleError(`Failed to initialize page mappings: ${error}`);
    }
  }

  /**
   * Navigate to specific page and sync audio position
   */
  async navigateToPage(pageNumber: number, startPlayback: boolean = false): Promise<boolean> {
    try {
      // Validate page number
      if (!this.isValidPageNumber(pageNumber)) {
        this.handleError(`Invalid page number: ${pageNumber}. Must be between 1 and ${this.playbackState.totalPages}`);
        return false;
      }

      // Debounce rapid page switching
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      return new Promise((resolve) => {
        this.debounceTimer = setTimeout(async () => {
          const pageMapping = this.pageMap.get(pageNumber);
          if (!pageMapping) {
            this.handleError(`Page mapping not found for page ${pageNumber}`);
            resolve(false);
            return;
          }

          // Handle empty pages
          if (pageMapping.isEmpty) {
            const nextPageWithContent = this.findNextPageWithContent(pageNumber);
            if (nextPageWithContent) {
              this.handleError(`Page ${pageNumber} is empty. Jumping to page ${nextPageWithContent} with content.`);
              resolve(await this.navigateToPage(nextPageWithContent, startPlayback));
              return;
            } else {
              this.handleError(`Page ${pageNumber} is empty and no subsequent pages have content.`);
              resolve(false);
              return;
            }
          }

          // Update playback state
          this.playbackState.currentPage = pageNumber;
          this.playbackState.currentSentenceIndex = pageMapping.startSentenceIndex;
          this.playbackState.currentCharIndex = pageMapping.startCharIndex;
          this.playbackState.playbackPosition = 0;

          if (startPlayback) {
            this.playbackState.isPlaying = true;
          }

          this.notifyStateChange();
          resolve(true);
        }, 300); // 300ms debounce
      });

    } catch (error) {
      this.handleError(`Failed to navigate to page ${pageNumber}: ${error}`);
      return false;
    }
  }

  /**
   * Update audio position and sync with page display
   */
  updateAudioPosition(sentenceIndex: number): void {
    try {
      if (sentenceIndex < 0 || sentenceIndex >= this.playbackState.totalSentences) {
        return;
      }

      const pageNumber = this.sentenceToPageMap.get(sentenceIndex);
      if (!pageNumber) {
        return;
      }

      const pageMapping = this.pageMap.get(pageNumber);
      if (!pageMapping) {
        return;
      }

      // Calculate position within page
      const sentencesInPage = pageMapping.endSentenceIndex - pageMapping.startSentenceIndex + 1;
      const sentencePositionInPage = sentenceIndex - pageMapping.startSentenceIndex;
      const playbackPosition = sentencesInPage > 0 ? sentencePositionInPage / sentencesInPage : 0;

      // Update state
      this.playbackState.currentPage = pageNumber;
      this.playbackState.currentSentenceIndex = sentenceIndex;
      this.playbackState.playbackPosition = Math.max(0, Math.min(1, playbackPosition));

      this.notifyStateChange();

    } catch (error) {
      this.handleError(`Failed to update audio position: ${error}`);
    }
  }

  /**
   * Get audio position for specific page
   */
  getAudioPositionForPage(pageNumber: number): AudioPosition | null {
    try {
      const pageMapping = this.pageMap.get(pageNumber);
      if (!pageMapping) {
        return null;
      }

      return {
        sentenceIndex: pageMapping.startSentenceIndex,
        pageNumber: pageNumber,
        characterOffset: pageMapping.startCharIndex,
        timestamp: Date.now()
      };

    } catch (error) {
      this.handleError(`Failed to get audio position for page ${pageNumber}: ${error}`);
      return null;
    }
  }

  /**
   * Get current playback state
   */
  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Get page mapping for specific page
   */
  getPageMapping(pageNumber: number): PageMapping | null {
    return this.pageMap.get(pageNumber) || null;
  }

  /**
   * Get all page mappings
   */
  getAllPageMappings(): PageMapping[] {
    return Array.from(this.pageMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
  }

  /**
   * Set playback state
   */
  setPlaybackState(isPlaying: boolean): void {
    this.playbackState.isPlaying = isPlaying;
    this.notifyStateChange();
  }

  /**
   * Calculate progress within current page
   */
  calculatePageProgress(): number {
    const pageMapping = this.pageMap.get(this.playbackState.currentPage);
    if (!pageMapping) return 0;

    const totalSentencesInPage = pageMapping.endSentenceIndex - pageMapping.startSentenceIndex + 1;
    const currentSentenceInPage = this.playbackState.currentSentenceIndex - pageMapping.startSentenceIndex;
    
    return totalSentencesInPage > 0 ? currentSentenceInPage / totalSentencesInPage : 0;
  }

  /**
   * Private helper methods
   */
  private calculateSentencesForPage(
    sentences: string[],
    pageNumber: number,
    totalPages: number,
    avgSentencesPerPage: number
  ): string[] {
    const startIndex = (pageNumber - 1) * avgSentencesPerPage;
    const endIndex = Math.min(startIndex + avgSentencesPerPage, sentences.length);
    return sentences.slice(startIndex, endIndex);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private async detectImages(pageData: any): Promise<boolean> {
    // Simplified image detection - in real implementation, 
    // this would analyze the PDF page for image content
    return false;
  }

  private isValidPageNumber(pageNumber: number): boolean {
    return Number.isInteger(pageNumber) && 
           pageNumber >= 1 && 
           pageNumber <= this.playbackState.totalPages;
  }

  private findNextPageWithContent(startPage: number): number | null {
    for (let page = startPage + 1; page <= this.playbackState.totalPages; page++) {
      const mapping = this.pageMap.get(page);
      if (mapping && !mapping.isEmpty) {
        return page;
      }
    }
    return null;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.playbackState });
    }
  }

  private handleError(message: string): void {
    console.error(`PageAudioSynchronizer: ${message}`);
    if (this.onError) {
      this.onError(message);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.pageMap.clear();
    this.sentenceToPageMap.clear();
  }
}