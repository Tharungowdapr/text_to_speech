import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { PDFReader } from './pages/PDFReader';
import { TextToSpeech } from './pages/TextToSpeech';
import { NavigationDemo } from './pages/NavigationDemo';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reader" element={<PDFReader />} />
        <Route path="/text-to-speech" element={<TextToSpeech />} />
        <Route path="/navigation-demo" element={<NavigationDemo />} />
      </Routes>
    </Router>
  );
}

export default App;