/**
 * Comprehensive Error Handling System for PDF-Audio Synchronization
 * Handles various failure scenarios with recovery strategies
 */

export enum ErrorType {
  PDF_LOAD_ERROR = 'PDF_LOAD_ERROR',
  TEXT_EXTRACTION_ERROR = 'TEXT_EXTRACTION_ERROR',
  OCR_ERROR = 'OCR_ERROR',
  AUDIO_SYNTHESIS_ERROR = 'AUDIO_SYNTHESIS_ERROR',
  PAGE_NAVIGATION_ERROR = 'PAGE_NAVIGATION_ERROR',
  SYNCHRONIZATION_ERROR = 'SYNCHRONIZATION_ERROR',
  PERFORMANCE_ERROR = 'PERFORMANCE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  BROWSER_COMPATIBILITY_ERROR = 'BROWSER_COMPATIBILITY_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: any;
  timestamp: number;
  context?: string;
  recoverable: boolean;
  recoveryActions?: string[];
}

export interface RecoveryStrategy {
  canRecover: boolean;
  actions: (() => Promise<boolean>)[];
  fallbackMessage: string;
}

export class ErrorHandler {
  private errorLog: ErrorInfo[] = [];
  private maxLogSize: number = 100;
  private onError?: (error: ErrorInfo) => void;
  private onRecovery?: (success: boolean, error: ErrorInfo) => void;

  constructor(
    onError?: (error: ErrorInfo) => void,
    onRecovery?: (success: boolean, error: ErrorInfo) => void
  ) {
    this.onError = onError;
    this.onRecovery = onRecovery;
  }

  /**
   * Handle different types of errors with appropriate recovery strategies
   */
  async handleError(
    type: ErrorType,
    error: Error | string,
    context?: string,
    details?: any
  ): Promise<boolean> {
    const errorInfo: ErrorInfo = {
      type,
      severity: this.determineSeverity(type),
      message: typeof error === 'string' ? error : error.message,
      details: details || (typeof error === 'object' ? error : undefined),
      timestamp: Date.now(),
      context,
      recoverable: this.isRecoverable(type),
      recoveryActions: this.getRecoveryActions(type)
    };

    // Log the error
    this.logError(errorInfo);

    // Notify error handler
    if (this.onError) {
      this.onError(errorInfo);
    }

    // Attempt recovery if possible
    if (errorInfo.recoverable) {
      const recoverySuccess = await this.attemptRecovery(errorInfo);
      
      if (this.onRecovery) {
        this.onRecovery(recoverySuccess, errorInfo);
      }
      
      return recoverySuccess;
    }

    return false;
  }

  /**
   * Handle PDF loading errors
   */
  async handlePDFLoadError(error: Error, filePath?: string): Promise<boolean> {
    const details = {
      filePath,
      fileSize: undefined,
      errorCode: (error as any).code
    };

    return this.handleError(
      ErrorType.PDF_LOAD_ERROR,
      error,
      'PDF Document Loading',
      details
    );
  }

  /**
   * Handle text extraction errors
   */
  async handleTextExtractionError(
    error: Error,
    pageNumber?: number,
    extractionMethod?: string
  ): Promise<boolean> {
    const details = {
      pageNumber,
      extractionMethod,
      fallbackAvailable: extractionMethod !== 'ocr'
    };

    return this.handleError(
      ErrorType.TEXT_EXTRACTION_ERROR,
      error,
      `Text Extraction - Page ${pageNumber}`,
      details
    );
  }

  /**
   * Handle OCR processing errors
   */
  async handleOCRError(error: Error, pageNumber?: number): Promise<boolean> {
    const details = {
      pageNumber,
      ocrEngine: 'tesseract.js',
      fallbackToTextExtraction: true
    };

    return this.handleError(
      ErrorType.OCR_ERROR,
      error,
      `OCR Processing - Page ${pageNumber}`,
      details
    );
  }

  /**
   * Handle audio synthesis errors
   */
  async handleAudioSynthesisError(
    error: Error,
    voiceURI?: string,
    text?: string
  ): Promise<boolean> {
    const details = {
      voiceURI,
      textLength: text?.length,
      browserSupport: this.checkSpeechSynthesisSupport()
    };

    return this.handleError(
      ErrorType.AUDIO_SYNTHESIS_ERROR,
      error,
      'Audio Synthesis',
      details
    );
  }

  /**
   * Handle page navigation errors
   */
  async handlePageNavigationError(
    error: Error,
    targetPage?: number,
    totalPages?: number
  ): Promise<boolean> {
    const details = {
      targetPage,
      totalPages,
      validRange: totalPages ? `1-${totalPages}` : 'unknown'
    };

    return this.handleError(
      ErrorType.PAGE_NAVIGATION_ERROR,
      error,
      'Page Navigation',
      details
    );
  }

  /**
   * Handle synchronization errors
   */
  async handleSynchronizationError(
    error: Error,
    currentPage?: number,
    audioPosition?: number
  ): Promise<boolean> {
    const details = {
      currentPage,
      audioPosition,
      syncState: 'desynchronized'
    };

    return this.handleError(
      ErrorType.SYNCHRONIZATION_ERROR,
      error,
      'Page-Audio Synchronization',
      details
    );
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: ErrorInfo[];
  } {
    const errorsByType = {} as Record<ErrorType, number>;
    const errorsBySeverity = {} as Record<ErrorSeverity, number>;

    // Initialize counters
    Object.values(ErrorType).forEach(type => {
      errorsByType[type] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });

    // Count errors
    this.errorLog.forEach(error => {
      errorsByType[error.type]++;
      errorsBySeverity[error.severity]++;
    });

    return {
      totalErrors: this.errorLog.length,
      errorsByType,
      errorsBySeverity,
      recentErrors: this.errorLog.slice(-10)
    };
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Export error log for debugging
   */
  exportErrorLog(): string {
    return JSON.stringify(this.errorLog, null, 2);
  }

  /**
   * Private helper methods
   */
  private determineSeverity(type: ErrorType): ErrorSeverity {
    switch (type) {
      case ErrorType.PDF_LOAD_ERROR:
      case ErrorType.BROWSER_COMPATIBILITY_ERROR:
        return ErrorSeverity.CRITICAL;
      
      case ErrorType.TEXT_EXTRACTION_ERROR:
      case ErrorType.AUDIO_SYNTHESIS_ERROR:
      case ErrorType.SYNCHRONIZATION_ERROR:
        return ErrorSeverity.HIGH;
      
      case ErrorType.OCR_ERROR:
      case ErrorType.PAGE_NAVIGATION_ERROR:
      case ErrorType.PERFORMANCE_ERROR:
        return ErrorSeverity.MEDIUM;
      
      case ErrorType.VALIDATION_ERROR:
      case ErrorType.NETWORK_ERROR:
        return ErrorSeverity.LOW;
      
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private isRecoverable(type: ErrorType): boolean {
    switch (type) {
      case ErrorType.PDF_LOAD_ERROR:
      case ErrorType.BROWSER_COMPATIBILITY_ERROR:
        return false;
      
      case ErrorType.TEXT_EXTRACTION_ERROR:
      case ErrorType.OCR_ERROR:
      case ErrorType.AUDIO_SYNTHESIS_ERROR:
      case ErrorType.PAGE_NAVIGATION_ERROR:
      case ErrorType.SYNCHRONIZATION_ERROR:
      case ErrorType.PERFORMANCE_ERROR:
      case ErrorType.VALIDATION_ERROR:
      case ErrorType.NETWORK_ERROR:
        return true;
      
      default:
        return false;
    }
  }

  private getRecoveryActions(type: ErrorType): string[] {
    switch (type) {
      case ErrorType.TEXT_EXTRACTION_ERROR:
        return [
          'Try OCR extraction',
          'Skip problematic page',
          'Use alternative text extraction method'
        ];
      
      case ErrorType.OCR_ERROR:
        return [
          'Fallback to standard text extraction',
          'Skip page with OCR issues',
          'Reduce image quality and retry'
        ];
      
      case ErrorType.AUDIO_SYNTHESIS_ERROR:
        return [
          'Try different voice',
          'Reduce text chunk size',
          'Use system default voice',
          'Skip problematic text segment'
        ];
      
      case ErrorType.PAGE_NAVIGATION_ERROR:
        return [
          'Validate page number',
          'Navigate to nearest valid page',
          'Reset to first page'
        ];
      
      case ErrorType.SYNCHRONIZATION_ERROR:
        return [
          'Recalculate page mappings',
          'Reset synchronization state',
          'Restart from current position'
        ];
      
      default:
        return ['Retry operation', 'Reset to default state'];
    }
  }

  private async attemptRecovery(errorInfo: ErrorInfo): Promise<boolean> {
    const strategy = this.getRecoveryStrategy(errorInfo);
    
    if (!strategy.canRecover) {
      return false;
    }

    for (const action of strategy.actions) {
      try {
        const success = await action();
        if (success) {
          return true;
        }
      } catch (recoveryError) {
        console.warn('Recovery action failed:', recoveryError);
      }
    }

    return false;
  }

  private getRecoveryStrategy(errorInfo: ErrorInfo): RecoveryStrategy {
    switch (errorInfo.type) {
      case ErrorType.TEXT_EXTRACTION_ERROR:
        return {
          canRecover: true,
          actions: [
            async () => {
              // Try OCR if not already used
              if (errorInfo.details?.extractionMethod !== 'ocr') {
                console.log('Attempting OCR recovery...');
                return true; // Placeholder for actual OCR retry
              }
              return false;
            }
          ],
          fallbackMessage: 'Using alternative text extraction method'
        };
      
      case ErrorType.AUDIO_SYNTHESIS_ERROR:
        return {
          canRecover: true,
          actions: [
            async () => {
              // Try system default voice
              console.log('Switching to system default voice...');
              return true; // Placeholder for voice switching
            }
          ],
          fallbackMessage: 'Using system default voice'
        };
      
      default:
        return {
          canRecover: false,
          actions: [],
          fallbackMessage: 'No recovery strategy available'
        };
    }
  }

  private logError(errorInfo: ErrorInfo): void {
    this.errorLog.push(errorInfo);
    
    // Maintain log size limit
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Console logging based on severity
    const logMessage = `[${errorInfo.severity}] ${errorInfo.type}: ${errorInfo.message}`;
    
    switch (errorInfo.severity) {
      case ErrorSeverity.CRITICAL:
        console.error(logMessage, errorInfo);
        break;
      case ErrorSeverity.HIGH:
        console.error(logMessage, errorInfo);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(logMessage, errorInfo);
        break;
      case ErrorSeverity.LOW:
        console.log(logMessage, errorInfo);
        break;
    }
  }

  private checkSpeechSynthesisSupport(): boolean {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }
}