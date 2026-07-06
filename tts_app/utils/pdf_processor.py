import re
from io import BytesIO


class PDFProcessor:
    @staticmethod
    def extract_text(pdf_bytes: bytes, force_ocr: bool = False) -> tuple:
        from pypdf import PdfReader
        reader = PdfReader(BytesIO(pdf_bytes))
        num_pages = len(reader.pages)
        raw_parts = []
        sentences_with_pages = []

        # Open PDF once for OCR if needed
        ocr_doc = None
        if force_ocr:
            try:
                import fitz
                ocr_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            except ImportError:
                ocr_doc = None

        for page_num, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            raw_parts.append(text)

            if force_ocr or (not text.strip()):
                text = PDFProcessor._ocr_page(ocr_doc, page_num)

            if text.strip():
                page_sentences = PDFProcessor._split_sentences(text)
                for s in page_sentences:
                    sentences_with_pages.append({"text": s, "page": page_num})

        if ocr_doc:
            ocr_doc.close()

        raw = " ".join(raw_parts)
        chapters = PDFProcessor._detect_chapters(raw)
        return raw, sentences_with_pages, num_pages, chapters

    @staticmethod
    def _ocr_page(ocr_doc, page_num: int) -> str:
        if ocr_doc is None:
            return ""
        try:
            import fitz
            from PIL import Image
            import pytesseract
        except ImportError:
            return ""
        try:
            page = ocr_doc[page_num]
            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            return pytesseract.image_to_string(img)
        except Exception:
            return ""

    @staticmethod
    def _split_sentences(text: str) -> list:
        text = re.sub(r"\s+", " ", text).strip()
        parts = re.split(r"(?<=[.!?])\s+", text)
        result = []
        for p in parts:
            p = p.strip()
            if len(p) > 1 and re.search(r"[a-zA-Z]", p):
                result.append(p)
        return result if result else ([text] if text else [])

    @staticmethod
    def _detect_chapters(raw_text: str) -> list:
        chapters = []
        lines = raw_text.split("\n")
        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped:
                continue
            words = stripped.split()
            word_count = len(words)
            is_short = word_count <= 8
            is_all_caps = stripped == stripped.upper() and word_count > 1
            starts_with_chapter = stripped.lower().startswith(("chapter ", "section ", "part "))
            if (is_all_caps and is_short) or starts_with_chapter:
                chapters.append({"title": stripped, "line": i, "index": len(chapters) + 1})
        return chapters

    @staticmethod
    def search_text(text: str, query: str) -> list:
        if not query:
            return []
        results = []
        sentences = PDFProcessor._split_sentences(text)
        for i, s in enumerate(sentences):
            idx = s.lower().find(query.lower())
            if idx != -1:
                results.append({
                    "sentence_index": i,
                    "text": s,
                    "match_start": idx,
                    "match_end": idx + len(query),
                    "context": s[max(0, idx - 30):idx + len(query) + 30]
                })
        return results
