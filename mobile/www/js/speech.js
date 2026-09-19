// Text-to-speech and speech-to-text. TTS uses the standard Web Speech
// Synthesis API, which Android's WebView (Chromium-based) supports well.
// STT tries the Web Speech Recognition API first; Android WebViews don't
// reliably support it without Google Play Services wired in, so every
// voice screen also ships a plain text field — tapping its keyboard's own
// mic button (Gboard dictation) is a rock-solid fallback that works
// regardless of in-app speech-API support.
const JarvisSpeech = (() => {
  let isSpeaking = false;
  const speakingListeners = new Set();

  function setSpeaking(value) {
    isSpeaking = value;
    speakingListeners.forEach((fn) => fn(value));
  }

  function onSpeakingChange(fn) {
    speakingListeners.add(fn);
    return () => speakingListeners.delete(fn);
  }

  function speak(text) {
    stop();
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }

  function stop() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  // --- speech-to-text ---
  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;
  let isListening = false;
  const listeningListeners = new Set();
  const transcriptListeners = new Set();

  function onListeningChange(fn) {
    listeningListeners.add(fn);
    return () => listeningListeners.delete(fn);
  }
  function onTranscript(fn) {
    transcriptListeners.add(fn);
    return () => transcriptListeners.delete(fn);
  }

  function supportsNativeSTT() {
    return !!SpeechRecognitionImpl;
  }

  function startListening() {
    if (!SpeechRecognitionImpl) return false;
    recognizer = new SpeechRecognitionImpl();
    recognizer.continuous = false;
    recognizer.interimResults = true;
    recognizer.lang = navigator.language || "en-US";

    recognizer.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      transcriptListeners.forEach((fn) => fn(text));
    };
    recognizer.onend = () => {
      isListening = false;
      listeningListeners.forEach((fn) => fn(false));
    };
    recognizer.onerror = () => {
      isListening = false;
      listeningListeners.forEach((fn) => fn(false));
    };

    recognizer.start();
    isListening = true;
    listeningListeners.forEach((fn) => fn(true));
    return true;
  }

  function stopListening() {
    if (recognizer) recognizer.stop();
    isListening = false;
    listeningListeners.forEach((fn) => fn(false));
  }

  return {
    speak,
    stop,
    get isSpeaking() {
      return isSpeaking;
    },
    onSpeakingChange,
    supportsNativeSTT,
    startListening,
    stopListening,
    onListeningChange,
    onTranscript,
    get isListening() {
      return isListening;
    },
  };
})();
