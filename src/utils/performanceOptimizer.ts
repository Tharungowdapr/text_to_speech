/**
 * Performance Optimization Utilities for Large PDF Documents
 * Handles efficient indexing, lazy loading, and memory management
 */

export interface PerformanceMetrics {
  documentSize: number;
  pageCount: number;
  indexingTime: number;
  memoryUsage: number;
  lastOptimization: number;
}

export interface OptimizationConfig {
  maxPagesInMemory: number;
  indexingBatchSize: number;
  lazyLoadThreshold: number;
  memoryCleanupInterval: number;
  cacheSize: number;
}

export class PerformanceOptimizer {
  private config: OptimizationConfig;
  private metrics: PerformanceMetrics;
  private pageCache: Map<number, any> = new Map();
  private indexCache: Map<string, any> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<OptimizationConfig>) {
    this.config = {
      maxPagesInMemory: 50,
      indexingBatchSize: 10,
      lazyLoadThreshold: 100,
      memoryCleanupInterval: 30000, // 30 seconds
      cacheSize: 100,
      ...config
    };

    this.metrics = {
      documentSize: 0,
      pageCount: 0,
      indexingTime: 0,
      memoryUsage: 0,
      lastOptimization: Date.now()
    };

    this.startMemoryCleanup();
  }

  /**
   * Optimize document processing based on size and complexity
   */
  async optimizeDocumentProcessing(
    pdfDocument: any,
    onProgress?: (progress: number) => void
  ): Promise<{
    shouldUseLazyLoading: boolean;
    batchSize: number;
    recommendedCacheSize: number;
  }> {
    const startTime = Date.now();
    
    try {
      this.metrics.pageCount = pdfDocument.numPages;
      this.metrics.documentSize = await this.estimateDocumentSize(pdfDocument);

      // Determine optimization strategy based on document size
      const shouldUseLazyLoading = this.metrics.pageCount > this.config.lazyLoadThreshold;
      const batchSize = this.calculateOptimalBatchSize();
      const recommendedCacheSize = this.calculateOptimalCacheSize();

      // Update configuration based on document characteristics
      if (shouldUseLazyLoading) {
        this.config.maxPagesInMemory = Math.min(
          this.config.maxPagesInMemory,
          Math.max(10, Math.floor(this.metrics.pageCount / 10))
        );
      }

      this.metrics.indexingTime = Date.now() - startTime;
      this.metrics.lastOptimization = Date.now();

      return {
        shouldUseLazyLoading,
        batchSize,
        recommendedCacheSize
      };

    } catch (error) {
      console.error('Error optimizing document processing:', error);
      return {
        shouldUseLazyLoading: false,
        batchSize: this.config.indexingBatchSize,
        recommendedCacheSize: this.config.cacheSize
      };
    }
  }

  /**
   * Process pages in optimized batches
   */
  async processPagesInBatches<T>(
    totalPages: number,
    processor: (pageNumber: number) => Promise<T>,
    onProgress?: (progress: number) => void,
    onBatchComplete?: (batch: T[], batchNumber: number) => void
  ): Promise<T[]> {
    const results: T[] = [];
    const batchSize = this.calculateOptimalBatchSize();
    const totalBatches = Math.ceil(totalPages / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startPage = batchIndex * batchSize + 1;
      const endPage = Math.min(startPage + batchSize - 1, totalPages);
      
      // Process batch
      const batchPromises: Promise<T>[] = [];
      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        batchPromises.push(processor(pageNum));
      }

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        if (onBatchComplete) {
          onBatchComplete(batchResults, batchIndex + 1);
        }

        if (onProgress) {
          const progress = ((batchIndex + 1) / totalBatches) * 100;
          onProgress(progress);
        }

        // Memory cleanup between batches for large documents
        if (this.metrics.pageCount > this.config.lazyLoadThreshold) {
          await this.performMemoryCleanup();
        }

      } catch (error) {
        console.error(`Error processing batch ${batchIndex + 1}:`, error);
        // Continue with next batch
      }
    }

    return results;
  }

  /**
   * Lazy load page content with caching
   */
  async lazyLoadPage(
    pageNumber: number,
    loader: (pageNum: number) => Promise<any>
  ): Promise<any> {
    const cacheKey = `page_${pageNumber}`;
    
    // Check cache first
    if (this.pageCache.has(pageNumber)) {
      return this.pageCache.get(pageNumber);
    }

    try {
      const pageData = await loader(pageNumber);
      
      // Cache the page if we have space
      if (this.pageCache.size < this.config.maxPagesInMemory) {
        this.pageCache.set(pageNumber, pageData);
      } else {
        // Remove oldest cached page
        const oldestKey = this.pageCache.keys().next().value;
        if (oldestKey !== undefined) {
          this.pageCache.delete(oldestKey);
        }
        this.pageCache.set(pageNumber, pageData);
      }

      return pageData;

    } catch (error) {
      console.error(`Error lazy loading page ${pageNumber}:`, error);
      throw error;
    }
  }

  /**
   * Optimize text indexing for search and navigation
   */
  async optimizeTextIndexing(
    textContent: string[],
    onProgress?: (progress: number) => void
  ): Promise<Map<string, number[]>> {
    const index = new Map<string, number[]>();
    const batchSize = Math.max(100, Math.floor(textContent.length / 10));

    for (let i = 0; i < textContent.length; i += batchSize) {
      const batch = textContent.slice(i, i + batchSize);
      
      batch.forEach((text, batchIndex) => {
        const actualIndex = i + batchIndex;
        const words = this.extractSearchableWords(text);
        
        words.forEach(word => {
          if (!index.has(word)) {
            index.set(word, []);
          }
          index.get(word)!.push(actualIndex);
        });
      });

      if (onProgress) {
        const progress = Math.min(100, ((i + batchSize) / textContent.length) * 100);
        onProgress(progress);
      }

      // Yield control to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return index;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  /**
   * Clear all caches and reset
   */
  clearCaches(): void {
    this.pageCache.clear();
    this.indexCache.clear();
    this.updateMemoryUsage();
  }

  /**
   * Destroy optimizer and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clearCaches();
  }

  /**
   * Private helper methods
   */
  private async estimateDocumentSize(pdfDocument: any): Promise<number> {
    // Simplified size estimation - in real implementation,
    // this would analyze actual document size
    return pdfDocument.numPages * 1024; // Rough estimate
  }

  private calculateOptimalBatchSize(): number {
    if (this.metrics.pageCount <= 50) return 5;
    if (this.metrics.pageCount <= 200) return 10;
    if (this.metrics.pageCount <= 500) return 20;
    return 25;
  }

  private calculateOptimalCacheSize(): number {
    const baseSize = Math.min(100, Math.max(20, Math.floor(this.metrics.pageCount / 10)));
    return Math.min(baseSize, this.config.cacheSize);
  }

  private extractSearchableWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 50); // Limit words per text block
  }

  private async performMemoryCleanup(): Promise<void> {
    // Remove least recently used pages from cache
    if (this.pageCache.size > this.config.maxPagesInMemory * 0.8) {
      const keysToRemove = Array.from(this.pageCache.keys())
        .slice(0, Math.floor(this.pageCache.size * 0.3));
      
      keysToRemove.forEach(key => this.pageCache.delete(key));
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.updateMemoryUsage();
  }

  private updateMemoryUsage(): void {
    // Simplified memory usage calculation
    this.metrics.memoryUsage = 
      (this.pageCache.size * 1024) + 
      (this.indexCache.size * 512);
  }

  private startMemoryCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.performMemoryCleanup();
    }, this.config.memoryCleanupInterval);
  }
}