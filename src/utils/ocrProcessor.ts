import { createWorker } from 'tesseract.js';

export class OCRProcessor {
  private worker: Tesseract.Worker | null = null;

  async initialize(): Promise<void> {
    if (!this.worker) {
      this.worker = await createWorker('eng');
    }
  }

  async extractTextFromImage(imageData: ImageData | HTMLCanvasElement | string): Promise<string> {
    if (!this.worker) {
      await this.initialize();
    }

    try {
      const { data: { text } } = await this.worker!.recognize(imageData);
      return text.trim();
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  async processImagePDF(pdfPage: any): Promise<string> {
    try {
      // Get the page as a canvas
      const viewport = pdfPage.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await pdfPage.render(renderContext).promise;

      // Extract text using OCR
      const text = await this.extractTextFromImage(canvas);
      return text;
    } catch (error) {
      console.error('Error processing image PDF:', error);
      throw error;
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}