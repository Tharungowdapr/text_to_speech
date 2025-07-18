import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileUp, ArrowLeft, Download, Loader, Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { PDFViewer } from '../components/PDFViewer';
import { MobileControls } from '../components/MobileControls';
import { TextHighlighter } from '../components/TextHighlighter';
import { VoiceSelector } from '../components/VoiceSelector';
import { VoiceManager } from '../utils/voiceManager';
import { useStore } from '../store';
import { OCRProcessor } from '../utils/ocrProcessor';
import { AudioExporter } from '../utils/audioExport';
import { saveAs } from 'file-saver';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export function PDFReader() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialPdfFile = location.state?.pdfFile;
  
  const [pdfFile, setPdfFile] = useState<File | null>(initialPdfFile || null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentence, setCurrentSentence] = useState(0);
  const [sentencePageMap, setSentencePageMap] = useState<Map<number, number>>(new Map());
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [useOCR, setUseOCR] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  
  const speechSynthesis = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ocrProcessorRef = useRef<OCRProcessor | null>(null);
  const audioExporterRef = useRef<AudioExporter | null>(null);
  const voiceManager = VoiceManager.getInstance();
  
  const { 
    darkMode, 
    setDarkMode, 
    setCurrentHighlight, 
    addRecentPDF,
    playbackSpeed,
    setPlaybackSpeed,
    playbackVolume,
    setPlaybackVolume,
    selectedVoiceURI,
    setSelectedVoiceURI,
    preferredVoiceType,
    setPreferredVoiceType,
    autoScroll,
    setAutoScroll
  } = useStore();

  useEffect(() => {
    const initializeVoices = async () => {
      await voiceManager.initialize();
      
      if (selectedVoiceURI) {
        const voice = voiceManager.getVoiceByURI(selectedVoiceURI);
        setSelectedVoice(voice);
      } else {
        const bestVoice = voiceManager.getBestVoice(preferredVoiceType === 'google');
        if (bestVoice) {
          setSelectedVoice(bestVoice);
          setSelectedVoiceURI(bestVoice.voiceURI);
        }
      }
    };

    initializeVoices();

    // Initialize OCR processor
    ocrProcessorRef.current = new OCRProcessor();
    audioExporterRef.current = new AudioExporter();

    return () => {
      if (ocrProcessorRef.current) {
        ocrProcessorRef.current.terminate();
      }
    };
  }, [selectedVoiceURI, preferredVoiceType, setSelectedVoiceURI]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const pdfData = {
        id: Date.now().toString(),
        name: file.name,
        lastOpened: new Date().toISOString(),
        file: file
      };
      addRecentPDF(pdfData);
      setPdfFile(file);
      setExtractedText('');
      setSentences([]);
      setCurrentSentence(0);
      setSentencePageMap(new Map());
      setCurrentHighlight(null);
      setIsPlaying(false);
      if (utteranceRef.current) {
        speechSynthesis.cancel();
      }
    }
  };

  const extractTextFromPDF = async () => {
    if (!pdfFile) return;

    setIsExtracting(true);
    setExtractionProgress(0);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      const newSentencePageMap = new Map();
      
      for (let i = 1; i <= pdf.numPages; i++) {
        setExtractionProgress((i / pdf.numPages) * 100);
        const page = await pdf.getPage(i);
        
        let pageText = '';
        
        if (useOCR) {
          // Use OCR for image-based PDFs
          try {
            if (!ocrProcessorRef.current) {
              ocrProcessorRef.current = new OCRProcessor();
              await ocrProcessorRef.current.initialize();
            }
            pageText = await ocrProcessorRef.current.processImagePDF(page);
          } catch (ocrError) {
            console.warn('OCR failed for page', i, 'falling back to text extraction');
            pageText = await extractTextFromPage(page);
          }
        } else {
          // Standard text extraction
          pageText = await extractTextFromPage(page);
          
          // If no text found and OCR is available, suggest using OCR
          if (!pageText.trim() && i === 1) {
            const useOCRConfirm = confirm(
              'No text found on the first page. This might be a scanned PDF. Would you like to use OCR (Optical Character Recognition) to extract text from images?'
            );
            if (useOCRConfirm) {
              setUseOCR(true);
              // Restart extraction with OCR
              await extractTextFromPDF();
              return;
            }
          }
        }
        
        if (pageText.trim()) {
          fullText += pageText + ' ';
        }
      }

      // Split text into sentences with improved sentence detection
      const sentenceArray = fullText
        .replace(/([.!?])\s+/g, '$1|')
        .replace(/([.!?])([A-Z])/g, '$1|$2')
        .split('|')
        .map(sentence => sentence.trim())
        .filter(sentence => {
          // Filter out invalid sentences
          const isValid = sentence.length > 0 &&
            sentence.split(' ').length > 1 && // At least 2 words
            /[a-zA-Z]/.test(sentence); // Contains at least one letter
          return isValid;
        });

      // Map sentences to pages
      const avgSentencesPerPage = Math.ceil(sentenceArray.length / pdf.numPages);

      sentenceArray.forEach((sentence, index) => {
        const estimatedPage = Math.min(pdf.numPages, Math.ceil((index + 1) / avgSentencesPerPage));
        newSentencePageMap.set(index, estimatedPage);
      });

      setExtractedText(fullText);
      setSentences(sentenceArray);
      setSentencePageMap(newSentencePageMap);
      setExtractionProgress(100);

      if (sentenceArray.length === 0) {
        throw new Error('No readable text found in the PDF');
      }

    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      alert(`Error extracting text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}. The file might be scanned, image-based, or protected.`);
    } finally {
      setIsExtracting(false);
      setExtractionProgress(0);
    }
  };

  const extractTextFromPage = async (page: any): Promise<string> => {
    try {
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });

      // Process text content with position information
      const textItems = textContent.items
        .sort((a: any, b: any) => {
          // Sort by vertical position first (top to bottom)
          if (Math.abs(a.transform[5] - b.transform[5]) > 5) {
            return b.transform[5] - a.transform[5];
          }
          // Then by horizontal position (left to right)
          return a.transform[4] - b.transform[4];
        })
        .map((item: any) => {
          if (typeof item.str === 'string') {
            return item.str;
          } else if (item.chars) {
            return item.chars.map((char: any) => char.unicode).join('');
          }
          return '';
        });

      return textItems.join(' ')
        .replace(/\s+/g, ' ')
        .replace(/[^\S\r\n]+/g, ' ')
        .trim();
    } catch (error) {
      console.error('Error extracting text from page:', error);
      return '';
    }
  };

  const exportAudio = async () => {
    if (sentences.length === 0 || !audioExporterRef.current) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      const audioBlob = await audioExporterRef.current.exportSpeechToAudio(
        sentences,
        selectedVoice,
        playbackSpeed,
        playbackVolume,
        (progress) => setExportProgress(progress)
      );

      const fileName = pdfFile ? `${pdfFile.name.replace('.pdf', '')}_audio.wav` : 'text_to_speech.wav';
      saveAs(audioBlob, fileName);
    } catch (error) {
      console.error('Error exporting audio:', error);
      alert('Could not export audio. This feature may not be fully supported in your browser.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const speakSentence = (index: number) => {
    if (index >= 0 && index < sentences.length) {
      const utterance = new SpeechSynthesisUtterance(sentences[index]);
      utterance.rate = playbackSpeed;
      utterance.volume = playbackVolume;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.onend = () => {
        if (index < sentences.length - 1) {
          setCurrentSentence(index + 1);
          setCurrentHighlight({ pageNumber: sentencePageMap.get(index + 1) || 1, text: sentences[index + 1] });
          speakSentence(index + 1);
        } else {
          setIsPlaying(false);
          setCurrentSentence(0);
          setCurrentHighlight(null);
        }
      };
      utteranceRef.current = utterance;
      setCurrentHighlight({ pageNumber: sentencePageMap.get(index) || 1, text: sentences[index] });
      speechSynthesis.speak(utterance);
    }
  };

  const toggleSpeech = () => {
    if (isPlaying) {
      speechSynthesis.cancel();
      setIsPlaying(false);
      setCurrentHighlight(null);
    } else {
      setIsPlaying(true);
      speakSentence(currentSentence);
    }
  };

  const skipForward = () => {
    if (currentSentence < sentences.length - 1) {
      speechSynthesis.cancel();
      setCurrentSentence(prev => prev + 1);
      if (isPlaying) {
        speakSentence(currentSentence + 1);
      }
    }
  };

  const skipBackward = () => {
    if (currentSentence > 0) {
      speechSynthesis.cancel();
      setCurrentSentence(prev => prev - 1);
      if (isPlaying) {
        speakSentence(currentSentence - 1);
      }
    }
  };

  const jumpForward = () => {
    const newIndex = Math.min(sentences.length - 1, currentSentence + 5);
    speechSynthesis.cancel();
    setCurrentSentence(newIndex);
    if (isPlaying) {
      speakSentence(newIndex);
    }
  };

  const jumpBackward = () => {
    const newIndex = Math.max(0, currentSentence - 5);
    speechSynthesis.cancel();
    setCurrentSentence(newIndex);
    if (isPlaying) {
      speakSentence(newIndex);
    }
  };

  const handleSentenceClick = (index: number) => {
    speechSynthesis.cancel();
    setCurrentSentence(index);
    if (isPlaying) {
      speakSentence(index);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Mobile-optimized Header */}
      <div className={`sticky top-0 z-20 px-4 pt-2 pb-2 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`rounded-xl shadow-lg p-3 transition-colors duration-200 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => navigate('/')}
                className={`touch-button p-2 rounded-lg ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className={`text-lg sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                PDF to Audio Converter
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <label className={`touch-button flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                darkMode 
                  ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                  : 'bg-white hover:bg-gray-100'
              }`}>
                <FileUp className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
                <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
              </label>
              <button
                onClick={extractTextFromPDF}
                disabled={!pdfFile}
                className={`touch-button flex items-center gap-1 px-2 py-1.5 text-white rounded-lg transition-colors text-sm relative ${
                  darkMode 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-blue-500 hover:bg-blue-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isExtracting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Extracting... {Math.round(extractionProgress)}%</span>
                  </>
                ) : (
                  <span className="hidden sm:inline">Extract</span>
                )}
              </button>
              <label className="hidden sm:flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useOCR}
                  onChange={(e) => setUseOCR(e.target.checked)}
                  className="rounded"
                />
                <span className={`text-sm ${darkMode ? 'text-white' : 'text-gray-700'}`}>Use OCR</span>
              </label>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`touch-button p-2 rounded-full ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
              >
                {darkMode ? <Sun className="w-5 h-5 text-white" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Voice Selector Modal */}
      {showVoiceSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30 p-4">
          <div className={`max-w-md w-full max-h-[80vh] rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  Select Voice
                </h2>
                <button
                  onClick={() => setShowVoiceSelector(false)}
                  className={`touch-button p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  ✕
                </button>
              </div>
              <VoiceSelector
                selectedVoiceURI={selectedVoiceURI}
                onVoiceChange={(uri) => {
                  setSelectedVoiceURI(uri);
                  const voice = voiceManager.getVoiceByURI(uri);
                  setSelectedVoice(voice);
                }}
                preferredType={preferredVoiceType}
                onPreferredTypeChange={setPreferredVoiceType}
                darkMode={darkMode}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Mobile Layout */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-5rem)] px-4 gap-4 pb-4">
        {/* PDF Viewer */}
        <div className="w-full lg:w-1/2 overflow-hidden">
          {pdfFile ? (
            <div className={`h-full rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <PDFViewer
                file={pdfFile}
                currentSentence={sentences[currentSentence] || ''}
                currentPage={sentencePageMap.get(currentSentence) || 1}
                autoScroll={autoScroll}
                highlightText={sentences[currentSentence]}
              />
            </div>
          ) : (
            <div className={`h-full rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg flex items-center justify-center`}>
              <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Upload a PDF to start
              </p>
            </div>
          )}
        </div>

        {/* Controls and Text Preview */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          {/* Mobile Controls */}
          <div className={`p-4 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <MobileControls
              isPlaying={isPlaying}
              onTogglePlay={toggleSpeech}
              onSkipBack={skipBackward}
              onSkipForward={skipForward}
              onJumpBack={jumpBackward}
              onJumpForward={jumpForward}
              volume={playbackVolume}
              onVolumeChange={setPlaybackVolume}
              speed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              disabled={!extractedText}
              darkMode={darkMode}
              showSettings={showSettings}
              onToggleSettings={() => setShowSettings(!showSettings)}
            />
            
            {/* Additional Controls */}
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                className={`touch-button flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <span>Voice Settings</span>
              </button>
              <button
                onClick={exportAudio}
                disabled={sentences.length === 0 || isExporting}
                className={`touch-button flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  darkMode 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isExporting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Exporting... {Math.round(exportProgress)}%</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Export Audio</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Text Preview */}
          <div className={`flex-1 p-4 rounded-lg shadow-lg overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            {sentences.length > 0 ? (
              <div 
                ref={textContainerRef}
                className={`h-full overflow-y-auto pr-4 space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                {sentences.map((sentence, index) => (
                  <div
                    key={index}
                    onClick={() => handleSentenceClick(index)}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      index === currentSentence
                        ? 'bg-blue-500 text-white'
                        : darkMode
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {sentence}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Extract text from PDF to start
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}