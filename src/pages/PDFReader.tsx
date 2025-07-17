import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileUp, Play, Pause, Volume2, Settings, Moon, Sun, SkipBack, SkipForward, Rewind, FastForward, ArrowLeft } from 'lucide-react';
import { PDFViewer } from '../components/PDFViewer';
import { useStore } from '../store';
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
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentence, setCurrentSentence] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [sentencePageMap, setSentencePageMap] = useState<Map<number, number>>(new Map());
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const speechSynthesis = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const { darkMode, setDarkMode, setCurrentHighlight, addRecentPDF } = useStore();

  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !selectedVoice) {
        setSelectedVoice(voices[0]);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, []);

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

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      const newSentencePageMap = new Map();
      let totalTextLength = 0;

      // First pass: calculate total text length
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => {
            // Handle different types of text content
            if (typeof item.str === 'string') {
              return item.str;
            } else if (item.chars) {
              return item.chars.map((char: any) => char.unicode).join('');
            }
            return '';
          })
          .join(' ');
        
        totalTextLength += pageText.length;
      }

      // Second pass: extract text with proper page mapping
      let processedLength = 0;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        
        // Get page text content
        const textContent = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false,
        });

        // Process text content with position information
        const textItems = textContent.items
          .sort((a: any, b: any) => {
            // Sort by vertical position first
            if (Math.abs(a.transform[5] - b.transform[5]) > 5) {
              return b.transform[5] - a.transform[5];
            }
            // Then by horizontal position
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

        const pageText = textItems.join(' ')
          // Clean up common PDF text artifacts
          .replace(/\s+/g, ' ')
          .replace(/[^\S\r\n]+/g, ' ')
          .trim();

        fullText += pageText + ' ';
        processedLength += pageText.length;
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
      let currentPage = 1;
      let textProcessed = 0;
      const avgTextPerPage = totalTextLength / pdf.numPages;

      sentenceArray.forEach((sentence, index) => {
        textProcessed += sentence.length;
        while (textProcessed > avgTextPerPage * currentPage && currentPage < pdf.numPages) {
          currentPage++;
        }
        newSentencePageMap.set(index, currentPage);
      });

      setExtractedText(fullText);
      setSentences(sentenceArray);
      setSentencePageMap(newSentencePageMap);

      if (sentenceArray.length === 0) {
        throw new Error('No readable text found in the PDF');
      }

    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      alert('Error extracting text from PDF. The file might be scanned, image-based, or protected.');
    }
  };

  const speakSentence = (index: number) => {
    if (index >= 0 && index < sentences.length) {
      const utterance = new SpeechSynthesisUtterance(sentences[index]);
      utterance.rate = speed;
      utterance.volume = volume;
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

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (utteranceRef.current) {
      utteranceRef.current.rate = newSpeed;
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (utteranceRef.current) {
      utteranceRef.current.volume = newVolume;
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

  useEffect(() => {
    if (textContainerRef.current && autoScroll) {
      const sentenceElements = textContainerRef.current.children;
      if (sentenceElements[currentSentence]) {
        sentenceElements[currentSentence].scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentSentence, autoScroll]);

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Fixed Header */}
      <div className={`sticky top-0 z-10 px-4 pt-4 pb-2 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`rounded-lg shadow-lg p-4 transition-colors duration-200 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className={`p-2 rounded-lg ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                PDF to Audio Converter
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                darkMode 
                  ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                  : 'bg-white hover:bg-gray-100'
              }`}>
                <FileUp className="w-4 h-4" />
                <span className="text-sm">Upload PDF</span>
                <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
              </label>
              <button
                onClick={extractTextFromPDF}
                disabled={!pdfFile}
                className={`flex items-center gap-2 px-3 py-1.5 text-white rounded-lg transition-colors text-sm ${
                  darkMode 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-blue-500 hover:bg-blue-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Extract Text
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-1.5 rounded-full ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
              >
                {darkMode ? <Sun className="w-5 h-5 text-white" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Split View Container */}
      <div className="flex h-[calc(100vh-5rem)] px-4 gap-4 pb-4">
        {/* Left Side - PDF Viewer */}
        <div className="w-1/2 overflow-hidden">
          {pdfFile ? (
            <div className={`h-full rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <PDFViewer
                file={pdfFile}
                currentSentence={sentences[currentSentence] || ''}
                currentPage={sentencePageMap.get(currentSentence) || 1}
                autoScroll={autoScroll}
              />
            </div>
          ) : (
            <div className={`h-full rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg flex items-center justify-center`}>
              <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Upload a PDF to start
              </p>
            </div>
          )}
        </div>

        {/* Right Side - Text and Controls */}
        <div className="w-1/2 flex flex-col gap-4">
          {/* Controls Panel */}
          <div className={`p-4 rounded-lg shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex flex-col gap-4">
              {/* Voice Selection */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <select
                  value={selectedVoice?.voiceURI || ''}
                  onChange={(e) => {
                    const voice = availableVoices.find(v => v.voiceURI === e.target.value);
                    if (voice) setSelectedVoice(voice);
                  }}
                  className={`px-3 py-1.5 rounded border ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>

              {/* Playback Controls */}
              <div className="flex justify-center gap-2">
                <button
                  onClick={jumpBackward}
                  disabled={!extractedText || currentSentence === 0}
                  className={`p-2 rounded-full transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Rewind className="w-5 h-5" />
                </button>
                <button
                  onClick={skipBackward}
                  disabled={!extractedText || currentSentence === 0}
                  className={`p-2 rounded-full transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleSpeech}
                  disabled={!extractedText}
                  className={`p-3 rounded-full transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>
                <button
                  onClick={skipForward}
                  disabled={!extractedText || currentSentence === sentences.length - 1}
                  className={`p-2 rounded-full transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <SkipForward className="w-5 h-5" />
                </button>
                <button
                  onClick={jumpForward}
                  disabled={!extractedText || currentSentence === sentences.length - 1}
                  className={`p-2 rounded-full transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <FastForward className="w-5 h-5" />
                </button>
              </div>

              {/* Volume and Speed Controls */}
              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <Volume2 className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-24"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Settings className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                  <select
                    value={speed}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    className={`px-2 py-1 rounded border transition-colors ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1">1x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="1.75">1.75x</option>
                    <option value="2">2x</option>
                  </select>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded"
                  />
                  <span className={`text-sm ${darkMode ? 'text-white' : 'text-gray-700'}`}>Auto-scroll</span>
                </label>
              </div>
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