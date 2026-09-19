import Foundation
import Speech
import AVFoundation

enum VoiceCommandError: Error {
    case notAuthorized
    case recognizerUnavailable
}

/// Push-to-talk speech-to-text. You tap "Ask Jarvis", speak, tap again (or
/// pause) to stop, and get the transcript back. Uses on-device recognition
/// where available; Apple's Speech framework falls back to server-based
/// recognition otherwise, same as Siri dictation elsewhere on iOS.
@MainActor
final class VoiceCommandService: NSObject, ObservableObject {
    static let shared = VoiceCommandService()

    @Published private(set) var isListening = false
    @Published private(set) var liveTranscript = ""

    private let recognizer = SFSpeechRecognizer(locale: Locale.current)
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    func requestAuthorization() async -> Bool {
        let speechStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        let micStatus = await AVAudioApplication.requestRecordPermission()
        return speechStatus == .authorized && micStatus
    }

    func startListening() throws {
        guard let recognizer, recognizer.isAvailable else {
            throw VoiceCommandError.recognizerUnavailable
        }
        stopListening()

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        self.request = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()
        isListening = true
        liveTranscript = ""

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let result {
                self.liveTranscript = result.bestTranscription.formattedString
            }
            if error != nil || (result?.isFinal ?? false) {
                self.stopListening()
            }
        }
    }

    /// Returns the final transcript captured since `startListening()`.
    @discardableResult
    func stopListening() -> String {
        let transcript = liveTranscript
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        isListening = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        return transcript
    }
}
