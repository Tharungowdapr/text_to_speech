import os
import asyncio
import io
import hashlib
import logging
from datetime import datetime, timedelta
from django.conf import settings

logger = logging.getLogger(__name__)

AUDIO_CACHE_MAX_AGE_DAYS = 7
AUDIO_CACHE_MAX_ENTRIES = 10000

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


def _run_async(coro):
    """Run async coroutine - reuses event loop if possible"""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result()
    return asyncio.run(coro)


class TTSEngine:
    @staticmethod
    def prune_audio_cache():
        """Delete old AudioCache entries to prevent unbounded growth."""
        from tts_app.models import AudioCache
        cutoff = datetime.now() - timedelta(days=AUDIO_CACHE_MAX_AGE_DAYS)
        AudioCache.objects.filter(created_at__lt=cutoff).delete()
        count = AudioCache.objects.count()
        if count > AUDIO_CACHE_MAX_ENTRIES:
            ids_to_delete = AudioCache.objects.order_by(
                'created_at'
            ).values_list('id', flat=True)[
                :count - AUDIO_CACHE_MAX_ENTRIES
            ]
            AudioCache.objects.filter(id__in=list(ids_to_delete)).delete()

    @staticmethod
    def _get_cache_key(text: str, voice_id: str) -> str:
        return hashlib.sha256(f"{text}::{voice_id}".encode('utf-8')).hexdigest()

    @staticmethod
    def generate_audio(text: str, voice_id: str = "en-US-JennyNeural") -> tuple:
        from tts_app.models import AudioCache
        cache_key = TTSEngine._get_cache_key(text, voice_id)

        # Check DB cache
        cache_obj = AudioCache.objects.filter(cache_key=cache_key).first()
        filename = f"{cache_key}.mp3"
        filepath = os.path.join(settings.AUDIO_DIR, filename)

        if cache_obj:
            if not os.path.exists(filepath):
                os.makedirs(settings.AUDIO_DIR, exist_ok=True)
                with open(filepath, "wb") as f:
                    f.write(cache_obj.audio_data)
            return filename, None

        os.makedirs(settings.AUDIO_DIR, exist_ok=True)
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
                # Try espeak-ng as last resort
                try:
                    import subprocess
                    subprocess.run(
                        ["espeak-ng", "-w", filepath, "-s", "150", "-v", "en", text[:4000]],
                        check=True, capture_output=True, timeout=30,
                    )
                    if os.path.getsize(filepath) >= 100:
                        with open(filepath, "rb") as f:
                            AudioCache.objects.create(cache_key=cache_key, audio_data=f.read())
                        return filename, None
                except Exception:
                    pass
                return None, "Audio generation failed (empty output)"

            with open(filepath, "rb") as f:
                AudioCache.objects.create(cache_key=cache_key, audio_data=f.read())
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
    async def _edge_generate_stream_with_timing(text: str, voice_id: str) -> tuple:
        """Generate audio + word boundary timing data"""
        import edge_tts
        communicate = edge_tts.Communicate(text, voice_id)
        audio_data = io.BytesIO()
        words = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({
                    "text": chunk["text"],
                    "offset": chunk["offset"] / 10000000,
                    "duration": chunk["duration"] / 10000000,
                })
        return audio_data.getvalue(), words

    @staticmethod
    def _generate_audio_stream_cached(text: str, voice_id: str) -> tuple:
        """Internal cached version - tries edge_tts, gTTS, espeak-ng (all free, no API keys)"""
        cache_key = f"{text}::{voice_id}"
        if hasattr(TTSEngine, '_memory_cache') and cache_key in TTSEngine._memory_cache:
            return TTSEngine._memory_cache[cache_key], None

        edge_error = None
        voice_info = VOICES.get(voice_id)
        if voice_info:
            try:
                audio_bytes = _run_async(TTSEngine._edge_generate_stream(text, voice_id))
                if len(audio_bytes) >= 100:
                    return audio_bytes, None
            except Exception as e:
                logger.exception("edge_tts generation failed for voice=%s", voice_id)
                edge_error = str(e)

        # gTTS fallback (free Google Translate TTS, no key needed)
        try:
            from gtts import gTTS
            tts = gTTS(text=text, lang="en", slow=False)
            audio_data = io.BytesIO()
            tts.write_to_fp(audio_data)
            audio_bytes = audio_data.getvalue()
            if len(audio_bytes) >= 100:
                return audio_bytes, None
        except Exception as e:
            logger.warning("gTTS fallback failed: %s", e)

        # espeak-ng fallback (fully offline, no API needed)
        try:
            import subprocess
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = tmp.name
            subprocess.run(
                ["espeak-ng", "-w", tmp_path, "-s", "150", "-v", "en", text[:4000]],
                check=True, capture_output=True, timeout=30,
            )
            with open(tmp_path, "rb") as f:
                audio_bytes = f.read()
            os.unlink(tmp_path)
            if len(audio_bytes) >= 100:
                return audio_bytes, None
        except Exception as e:
            logger.warning("espeak-ng fallback failed: %s", e)

        return None, f"All TTS engines failed (edge_tts: {edge_error})"

    @staticmethod
    def generate_audio_stream(text: str, voice_id: str = "en-US-JennyNeural") -> tuple:
        """Public method with in-memory cache for instant repeated requests"""
        if not hasattr(TTSEngine, '_memory_cache'):
            TTSEngine._memory_cache = {}

        cache_key = f"{text}::{voice_id}"
        if cache_key in TTSEngine._memory_cache:
            return TTSEngine._memory_cache[cache_key], None

        audio_bytes, error = TTSEngine._generate_audio_stream_cached(text, voice_id)
        if not error:
            TTSEngine._memory_cache[cache_key] = audio_bytes
        return audio_bytes, error

    @staticmethod
    def generate_audio_stream_with_timing(text: str, voice_id: str = "en-US-JennyNeural") -> tuple:
        """Generate audio + word boundary timing for word-level highlighting"""
        if not hasattr(TTSEngine, '_timing_cache'):
            TTSEngine._timing_cache = {}
        timing_key = f"timing::{text}::{voice_id}"
        if timing_key in TTSEngine._timing_cache:
            return TTSEngine._timing_cache[timing_key], None

        voice_info = VOICES.get(voice_id)
        if voice_info:
            try:
                audio_bytes, words = _run_async(TTSEngine._edge_generate_stream_with_timing(text, voice_id))
                if len(audio_bytes) >= 100:
                    result = {"audio": audio_bytes, "words": words}
                    TTSEngine._timing_cache[timing_key] = result
                    return result, None
            except Exception as e:
                logger.warning("edge_tts timing failed for voice=%s: %s", voice_id, e)

        audio_bytes, error = TTSEngine.generate_audio_stream(text, voice_id)
        if error:
            return None, error
        return {"audio": audio_bytes, "words": []}, None

    @staticmethod
    def generate_audio_batch(texts: list, voice_id: str = "en-US-JennyNeural", max_concurrent: int = 5) -> dict:
        from tts_app.models import AudioCache
        os.makedirs(settings.AUDIO_DIR, exist_ok=True)
        results = {}
        voice_info = VOICES.get(voice_id)

        async def _run():
            sem = asyncio.Semaphore(max_concurrent)

            async def _one(idx, text):
                async with sem:
                    cache_key = TTSEngine._get_cache_key(text, voice_id)
                    fname = f"{cache_key}.mp3"
                    fpath = os.path.join(settings.AUDIO_DIR, fname)

                    # Sync DB access inside async using thread
                    loop = asyncio.get_running_loop()

                    def _check_db():
                        return AudioCache.objects.filter(cache_key=cache_key).first()
                    cache_obj = await loop.run_in_executor(None, _check_db)

                    if cache_obj:
                        if not os.path.exists(fpath):
                            def _write():
                                with open(fpath, "wb") as f:
                                    f.write(cache_obj.audio_data)
                            await loop.run_in_executor(None, _write)
                        results[idx] = fname
                        return

                    use_gtts = False
                    if voice_info:
                        import edge_tts
                        try:
                            comm = edge_tts.Communicate(text, voice_id)
                            await comm.save(fpath)
                        except edge_tts.exceptions.NoAudioReceived:
                            logger.warning("edge_tts NoAudioReceived for voice=%s, falling back to gTTS", voice_id)
                            use_gtts = True
                    else:
                        use_gtts = True
                    if use_gtts:
                        from gtts import gTTS
                        lang = voice_id if voice_id in FALLBACK_LANG_MAP else "en"

                        def _sync_save():
                            tts = gTTS(text=text, lang=lang, slow=False)
                            tts.save(fpath)
                        await loop.run_in_executor(None, _sync_save)

                    if os.path.getsize(fpath) >= 100:
                        def _save_db():
                            with open(fpath, "rb") as f:
                                AudioCache.objects.create(cache_key=cache_key, audio_data=f.read())
                        await loop.run_in_executor(None, _save_db)
                        results[idx] = fname
            tasks = [_one(i, t) for i, t in enumerate(texts) if t.strip()]
            await asyncio.gather(*tasks)

        _run_async(_run())
        TTSEngine.prune_audio_cache()
        return results

    @staticmethod
    def supported_voices() -> dict:
        return VOICES

    @staticmethod
    def supported_languages() -> list:
        return list(FALLBACK_LANG_MAP.keys())
