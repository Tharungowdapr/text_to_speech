import os
import uuid
import asyncio
import io
import threading
from django.conf import settings

VOICES = {
    "en-US-JennyNeural": {"lang": "en", "gender": "Female", "name": "Jenny (US Female)"},
    "en-US-GuyNeural": {"lang": "en", "gender": "Male", "name": "Guy (US Male)"},
    "en-US-AriaNeural": {"lang": "en", "gender": "Female", "name": "Aria (US Female)"},
    "en-US-ChristopherNeural": {"lang": "en", "gender": "Male", "name": "Christopher (US Male)"},
    "en-US-EmmaMultilingualNeural": {"lang": "en", "gender": "Female", "name": "Emma (Multilingual)"},
    "en-US-BrianMultilingualNeural": {"lang": "en", "gender": "Male", "name": "Brian (Multilingual)"},
    "en-GB-RyanNeural": {"lang": "en", "gender": "Male", "name": "Ryan (UK Male)"},
    "en-GB-SoniaNeural": {"lang": "en", "gender": "Female", "name": "Sonia (UK Female)"},
    "en-AU-NatashaNeural": {"lang": "en", "gender": "Female", "name": "Natasha (AU Female)"},
    "en-AU-WilliamMultilingualNeural": {"lang": "en", "gender": "Male", "name": "William (AU Male)"},
    "en-IN-NeerjaNeural": {"lang": "en", "gender": "Female", "name": "Neerja (IN Female)"},
    "en-IN-PrabhatNeural": {"lang": "en", "gender": "Male", "name": "Prabhat (IN Male)"},
    "es-MX-JorgeNeural": {"lang": "es", "gender": "Male", "name": "Jorge (MX Male)"},
    "es-MX-DaliaNeural": {"lang": "es", "gender": "Female", "name": "Dalia (MX Female)"},
    "es-ES-AlvaroNeural": {"lang": "es", "gender": "Male", "name": "Alvaro (ES Male)"},
    "es-ES-ElviraNeural": {"lang": "es", "gender": "Female", "name": "Elvira (ES Female)"},
    "fr-FR-HenriNeural": {"lang": "fr", "gender": "Male", "name": "Henri (FR Male)"},
    "fr-FR-DeniseNeural": {"lang": "fr", "gender": "Female", "name": "Denise (FR Female)"},
    "de-DE-KillianNeural": {"lang": "de", "gender": "Male", "name": "Killian (DE Male)"},
    "de-DE-KatjaNeural": {"lang": "de", "gender": "Female", "name": "Katja (DE Female)"},
    "it-IT-DiegoNeural": {"lang": "it", "gender": "Male", "name": "Diego (IT Male)"},
    "it-IT-ElsaNeural": {"lang": "it", "gender": "Female", "name": "Elsa (IT Female)"},
    "pt-BR-AntonioNeural": {"lang": "pt", "gender": "Male", "name": "Antonio (BR Male)"},
    "pt-BR-FranciscaNeural": {"lang": "pt", "gender": "Female", "name": "Francisca (BR Female)"},
    "nl-NL-MaartenNeural": {"lang": "nl", "gender": "Male", "name": "Maarten (NL Male)"},
    "nl-NL-FennaNeural": {"lang": "nl", "gender": "Female", "name": "Fenna (NL Female)"},
    "ja-JP-KeitaNeural": {"lang": "ja", "gender": "Male", "name": "Keita (JP Male)"},
    "ja-JP-NanamiNeural": {"lang": "ja", "gender": "Female", "name": "Nanami (JP Female)"},
    "ko-KR-InJoonNeural": {"lang": "ko", "gender": "Male", "name": "InJoon (KR Male)"},
    "ko-KR-SunHiNeural": {"lang": "ko", "gender": "Female", "name": "SunHi (KR Female)"},
    "zh-CN-XiaoxiaoNeural": {"lang": "zh-CN", "gender": "Female", "name": "Xiaoxiao (CN Female)"},
    "zh-CN-YunxiNeural": {"lang": "zh-CN", "gender": "Male", "name": "Yunxi (CN Male)"},
    "ru-RU-DmitryNeural": {"lang": "ru", "gender": "Male", "name": "Dmitry (RU Male)"},
    "ru-RU-SvetlanaNeural": {"lang": "ru", "gender": "Female", "name": "Svetlana (RU Female)"},
    "ar-SA-HamedNeural": {"lang": "ar", "gender": "Male", "name": "Hamed (SA Male)"},
    "ar-SA-ZariyahNeural": {"lang": "ar", "gender": "Female", "name": "Zariyah (SA Female)"},
    "hi-IN-MadhurNeural": {"lang": "hi", "gender": "Male", "name": "Madhur (IN Male)"},
    "hi-IN-SwaraNeural": {"lang": "hi", "gender": "Female", "name": "Swara (IN Female)"},
}

FALLBACK_LANG_MAP = {
    "en": "en", "es": "es", "fr": "fr", "de": "de", "it": "it",
    "pt": "pt", "nl": "nl", "ja": "ja", "ko": "ko", "zh-CN": "zh-CN",
    "ru": "ru", "ar": "ar", "hi": "hi",
}

_loop = None
_loop_lock = threading.Lock()

def _get_loop():
    global _loop
    if _loop is None:
        with _loop_lock:
            if _loop is None:
                _loop = asyncio.new_event_loop()
                asyncio.set_event_loop(_loop)
    return _loop

def _run_async(coro):
    loop = _get_loop()
    try:
        return loop.run_until_complete(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        _loop = loop
        return loop.run_until_complete(coro)


class TTSEngine:
    @staticmethod
    def generate_audio(text: str, voice_id: str = "en-US-JennyNeural") -> tuple:
        os.makedirs(settings.AUDIO_DIR, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.mp3"
        filepath = os.path.join(settings.AUDIO_DIR, filename)
        try:
            voice_info = VOICES.get(voice_id)
            if voice_info:
                _run_async(TTSEngine._edge_generate(text, voice_id, filepath))
            else:
                from gtts import gTTS
                lang = voice_id if voice_id in FALLBACK_LANG_MAP else "en"
                tts = gTTS(text=text, lang=lang, slow=False)
                tts.save(filepath)
            if os.path.getsize(filepath) < 100:
                os.remove(filepath)
                return None, "Audio generation failed (empty output)"
            return filename, None
        except Exception as e:
            return None, f"TTS failed: {e}"

    @staticmethod
    async def _edge_generate(text: str, voice_id: str, filepath: str):
        import edge_tts
        communicate = edge_tts.Communicate(text, voice_id)
        await communicate.save(filepath)

    @staticmethod
    async def _edge_generate_stream(text: str, voice_id: str) -> bytes:
        """Generate audio and return bytes directly for streaming"""
        import edge_tts
        communicate = edge_tts.Communicate(text, voice_id)
        audio_data = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.write(chunk["data"])
        return audio_data.getvalue()

    @staticmethod
    def generate_audio_stream(text: str, voice_id: str = "en-US-JennyNeural") -> tuple:
        voice_info = VOICES.get(voice_id)
        if voice_info:
            try:
                audio_bytes = _run_async(TTSEngine._edge_generate_stream(text, voice_id))
                if len(audio_bytes) >= 100:
                    return audio_bytes, None
            except Exception:
                pass
            try:
                from gtts import gTTS
                tts = gTTS(text=text, lang="en", slow=False)
                audio_data = io.BytesIO()
                tts.write_to_fp(audio_data)
                audio_bytes = audio_data.getvalue()
                if len(audio_bytes) >= 100:
                    return audio_bytes, None
            except Exception:
                pass
            return None, "Audio generation failed"
        try:
            from gtts import gTTS
            lang = voice_id if voice_id in FALLBACK_LANG_MAP else "en"
            tts = gTTS(text=text, lang=lang, slow=False)
            audio_data = io.BytesIO()
            tts.write_to_fp(audio_data)
            audio_bytes = audio_data.getvalue()
            if len(audio_bytes) >= 100:
                return audio_bytes, None
        except Exception:
            pass
        return None, "Audio generation failed"

    @staticmethod
    def generate_audio_batch(texts: list, voice_id: str = "en-US-JennyNeural", max_concurrent: int = 5) -> dict:
        os.makedirs(settings.AUDIO_DIR, exist_ok=True)
        results = {}
        voice_info = VOICES.get(voice_id)

        async def _run():
            sem = asyncio.Semaphore(max_concurrent)
            async def _one(idx, text):
                async with sem:
                    fname = f"{uuid.uuid4().hex}.mp3"
                    fpath = os.path.join(settings.AUDIO_DIR, fname)
                    if voice_info:
                        import edge_tts
                        comm = edge_tts.Communicate(text, voice_id)
                        await comm.save(fpath)
                    else:
                        from gtts import gTTS
                        lang = voice_id if voice_id in FALLBACK_LANG_MAP else "en"
                        loop = asyncio.get_running_loop()
                        def _sync_save():
                            tts = gTTS(text=text, lang=lang, slow=False)
                            tts.save(fpath)
                        await loop.run_in_executor(None, _sync_save)
                    if os.path.getsize(fpath) >= 100:
                        results[idx] = fname
            tasks = [_one(i, t) for i, t in enumerate(texts) if t.strip()]
            await asyncio.gather(*tasks)

        asyncio.run(_run())
        return results

    @staticmethod
    def supported_voices() -> dict:
        return VOICES

    @staticmethod
    def supported_languages() -> list:
        return list(FALLBACK_LANG_MAP.keys())
