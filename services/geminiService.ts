import { GoogleGenAI, FunctionDeclaration, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Intent, LiveAgentState } from '../types';
import { createHeyGenToken, startHeyGenSession, stopHeyGenSession } from './heygenService';
import { initializeHeyGenStream, sendAudioToHeyGen, interruptHeyGen, stopHeyGenStream } from './heygenStream';
import { RemoteTrack } from 'livekit-client';

// Helper functions for audio encoding/decoding (as per Gemini API guidance)
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0; // Convert Int16 to Float32 range [-1, 1]
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768; // Convert to 16-bit PCM
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

let inputAudioContext: AudioContext | null = null;
let outputAudioContext: AudioContext | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let mediaStreamSource: MediaStreamAudioSourceNode | null = null;
let mediaStream: MediaStream | null = null;
let outputNode: GainNode | null = null;
let sources = new Set<AudioBufferSourceNode>();
let nextStartTime = 0;

let isAwake = true;
let wakeWord = 'Lisa';
let silenceTimer: any = null; // Use any to avoid NodeJS vs Browser type conflicts
let currentHeyGenSessionToken: string | null = null;
let silenceTimeoutMs = 30000;

let sessionPromise: Promise<any> | null = null; // Promise for the live session connection
let sessionInstance: any | null = null; // The actual LiveSession instance

interface StartLiveAgentCallbacks {
  onAgentStateChange: (state: Partial<LiveAgentState>) => void;
  onSpeechResponse: (text: string) => void;
  onIntent: (intent: Intent, args: Record<string, unknown>) => Promise<any>;
  onAvatarVideoTrack?: (track: RemoteTrack) => void;
}

export const startLiveAgent = async (
  onAgentStateChange: (state: Partial<LiveAgentState>) => void,
  onSpeechResponse: (text: string) => void,
  onIntent: (intent: Intent, args: Record<string, unknown>) => Promise<any>,
  functionDeclarations: FunctionDeclaration[],
  systemInstruction?: string,
  onAvatarVideoTrack?: (track: RemoteTrack) => void,
  config?: { wakeWord?: string; silenceTimeout?: number; avatarId?: string },
) => {
  if (config?.wakeWord) wakeWord = config.wakeWord;
  if (config?.silenceTimeout) silenceTimeoutMs = config.silenceTimeout;

  console.log('*** DEBUG: Entering startLiveAgent function ***');
  if (sessionInstance || sessionPromise) {
    console.warn('Live agent actually starting or already connected. Skipping double init.');
    return sessionPromise ? await sessionPromise : sessionInstance;
  }

  // Explicitly check API key
  if (!process.env.API_KEY) {
    console.error('ERROR: API_KEY is undefined or empty. Cannot initialize GoogleGenAI.');
    onAgentStateChange({ error: 'API key not configured.', isProcessing: false });
    throw new Error('API_KEY_MISSING'); // Throw a custom error to be caught by UI
  }

  try {
    console.log('DEBUG: Creating GoogleGenAI instance...');
    // Always create a new GoogleGenAI instance to ensure the most up-to-date API key is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    console.log('DEBUG: GoogleGenAI instance created.');

    console.log('DEBUG: Initializing AudioContexts...');
    inputAudioContext = new (window.AudioContext)({ sampleRate: 16000 });
    outputAudioContext = new (window.AudioContext)({ sampleRate: 24000 });
    console.log('DEBUG: AudioContexts initialized. Input state:', inputAudioContext.state, 'Output state:', outputAudioContext.state);

    // Attempt to resume audio contexts
    if (inputAudioContext.state === 'suspended') {
      console.log('DEBUG: Resuming input AudioContext...');
      await inputAudioContext.resume();
      console.log('DEBUG: Input AudioContext resumed. State:', inputAudioContext.state);
    }
    if (outputAudioContext.state === 'suspended') {
      console.log('DEBUG: Resuming output AudioContext...');
      await outputAudioContext.resume();
      console.log('DEBUG: Output AudioContext resumed. State:', outputAudioContext.state);
    }

    outputNode = outputAudioContext.createGain();
    outputNode.connect(outputAudioContext.destination);
    console.log('DEBUG: Output gain node created and connected to destination.');

    // Get user media (microphone)
    console.log('DEBUG: Requesting microphone access...');
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('DEBUG: Microphone access granted.');
    } catch (err) {
      console.error('ERROR: Failed to get microphone access:', err);
      onAgentStateChange({ error: 'Microphone access denied or failed. Please allow microphone access and try again.', isProcessing: false });
      throw new Error('Microphone access failed');
    }

    mediaStreamSource = inputAudioContext.createMediaStreamSource(mediaStream);
    scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
    console.log('DEBUG: MediaStreamSource and ScriptProcessor created.');

    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
      const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);

      // Calculate RMS (Root Mean Square) for simple Voice Activity Detection (VAD)
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);

      // Threshold 0.002 is a more sensitive default for "active speaking"
      if (rms > 0.002) {
        if (isAwake) {
          resetSilenceTimer(onAgentStateChange);
        }
      }

      const pcmBlob = createPcmBlob(inputData);
      sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    mediaStreamSource.connect(scriptProcessor);
    scriptProcessor.connect(inputAudioContext.destination);
    console.log('DEBUG: Microphone stream connected to script processor.');

    console.log('DEBUG: Attempting to connect to Gemini Live API...');

    console.log('DEBUG: Calling ai.live.connect with config:', {
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      voice: 'Zephyr'
    });

    const connectionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: async () => {
          console.log('*** DEBUG: onopen callback fired! ***');
          isAwake = true;
          onAgentStateChange({ isListening: true, isProcessing: false, error: null, isAwake: true });
          nextStartTime = 0; // Reset nextStartTime on new session
          resetSilenceTimer(onAgentStateChange);

          // Initialize HeyGen Avatar if enabled
          const isAvatarEnabled = import.meta.env.VITE_ENABLE_AVATAR === 'true';
          if (isAvatarEnabled && config?.avatarId) {
            try {
              console.log('DEBUG: Initializing HeyGen Avatar session...');
              const isSandbox = import.meta.env.VITE_HEYGEN_IS_SANDBOX === 'true';
              const { session_token } = await createHeyGenToken(config.avatarId, isSandbox);
              currentHeyGenSessionToken = session_token;

              if (!session_token) {
                console.error('ERROR: No session token found in HeyGen response');
                return;
              }

              const { livekit_url, livekit_token, websocket_url } = await startHeyGenSession(session_token);
              await initializeHeyGenStream(livekit_url, livekit_token, websocket_url, (track) => {
                if (onAvatarVideoTrack) onAvatarVideoTrack(track);
              });
              console.log('DEBUG: HeyGen Avatar stream initialized.');
            } catch (err: any) {
              console.error('ERROR: Failed to initialize HeyGen Avatar:', err);
              currentHeyGenSessionToken = null; // Clear token if start failed

              let warning = 'Voice agent active, but video avatar failed to start.';
              if (err.message && err.message.includes('403')) {
                warning = 'HeyGen Session Limit/Credits reached. Falling back to voice-only.';
              }

              onAgentStateChange({ error: warning });
            }
          }
        },
        onmessage: async (message: LiveServerMessage) => {
          console.log('DEBUG: onmessage callback received. isAwake:', isAwake);
          if (isAwake) resetSilenceTimer(onAgentStateChange); // Any server activity resets timer

          // Process transcription
          if (message.serverContent?.outputTranscription) {
            onAgentStateChange({ currentOutputTranscription: message.serverContent.outputTranscription.text });
            console.log('DEBUG: Model Transcription:', message.serverContent.outputTranscription.text);
            if (isAwake) resetSilenceTimer(onAgentStateChange); // Agent activity resets timer
          }

          if (message.serverContent?.inputTranscription) {
            const userText = message.serverContent.inputTranscription.text;
            onAgentStateChange({ currentInputTranscription: userText });

            const normalizedText = userText.toLowerCase().trim();
            const normalizedWakeWord = wakeWord.toLowerCase().trim();

            // Support multi-lingual transcriptions for "Lisa" (Hindi: लीसा, Tamil: லீசா/தீசா, etc.)
            const multilingualWakeWords = [
              normalizedWakeWord,
              'लीसा', // Hindi
              'லீசா', // Tamil
              'தீசா', // Tamil (per user logs)
              'లీసా', // Telugu
              'ಲಿಸಾ', // Kannada
              'ലിസ',  // Malayalam
            ].join('|');

            // More robust wake word detection using regex with multi-script support
            const wakeWordRegex = new RegExp(`(${multilingualWakeWords})`, 'i');
            const isMatch = wakeWordRegex.test(normalizedText);

            console.log(`[WAKE_CHECK] userText: "${userText}", wakeWord: "${wakeWord}", match: ${isMatch}, isAwake: ${isAwake}`);

            if (!isAwake && isMatch) {
              console.log(`[WAKE_ACTION] Triggered by wake word script match!`);
              isAwake = true;
              onAgentStateChange({
                error: null,
                isAwake: true,
                currentOutputTranscription: "Waking up..."
              });
              resetSilenceTimer(onAgentStateChange);
            } else if (isAwake) {
              resetSilenceTimer(onAgentStateChange);
            }
          }

          // Handle function calls (always wake up agent if function is called)
          if (message.toolCall && message.toolCall.functionCalls) {
            console.log('DEBUG: Function call detected. Waking up agent if paused.');
            if (!isAwake) {
              isAwake = true;
              onAgentStateChange({ isAwake: true, error: null });
            }
            if (isAwake) resetSilenceTimer(onAgentStateChange);
            for (const fc of message.toolCall.functionCalls) {
              // ...
              // ... (rest of function call logic)
              try {
                const response = await onIntent(fc.name as Intent, fc.args || {});
                sessionInstance?.sendToolResponse({
                  functionResponses: [{
                    id: fc.id,
                    name: fc.name,
                    response: response || { result: "Function executed successfully." },
                  }]
                });
                if (isAwake) resetSilenceTimer(onAgentStateChange); // Reset after tool response
              } catch (e) {
                console.error('ERROR: Error executing function:', fc.name, e);
                sessionInstance?.sendToolResponse({
                  functionResponses: {
                    id: fc.id,
                    name: fc.name,
                    response: { error: `Error executing ${fc.name}: ${(e as Error).message}` },
                  }
                });
              }
            }
          }

          // Process model's text output
          const modelTextOutput = message.serverContent?.modelTurn?.parts[0]?.text;
          if (modelTextOutput) {
            if (!isAwake) {
              const proactiveWakeupPhrases = ['yes', 'here', 'help', 'assist', 'lisa', 'नमस्ते', 'வணக்கம்'];
              const lowerOutput = modelTextOutput.toLowerCase();
              const shouldProactiveWake = proactiveWakeupPhrases.some(p => lowerOutput.includes(p));

              if (shouldProactiveWake) {
                console.log(`[WAKE_ACTION] Proactive wakeup triggered by model text: "${modelTextOutput}"`);
                isAwake = true;
                onAgentStateChange({ isAwake: true, error: null });
                resetSilenceTimer(onAgentStateChange);
              } else {
                console.log('DEBUG: Model tried to speak text while agent is NOT awake. Ignoring.');
                return;
              }
            }
            console.log('DEBUG: Model text output:', modelTextOutput);
            onSpeechResponse(modelTextOutput);
            resetSilenceTimer(onAgentStateChange);
          }

          // Process audio output
          const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64EncodedAudioString && outputAudioContext && outputNode) {
            if (!isAwake) {
              console.log('DEBUG: Model sent audio while agent is NOT awake. Ignoring.');
              return;
            }
            console.log('DEBUG: Received audio chunk. scheduling playback.');

            const delayMs = Number(import.meta.env.VITE_AUDIO_PLAYBACK_DELAY || 500);
            const delaySeconds = delayMs / 1000;

            // Only set isSpeaking to true if no other audio is currently playing
            if (sources.size === 0) {
              onAgentStateChange({ isSpeaking: true });
              resetSilenceTimer(onAgentStateChange);
              // Fresh turn: Offset the start time to allow HeyGen video to arrive
              nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime + delaySeconds);
            } else {
              nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
            }

            try {
              const audioBytes = decode(base64EncodedAudioString);
              // Send to HeyGen if enabled
              if (import.meta.env.VITE_ENABLE_AVATAR === 'true') {
                sendAudioToHeyGen(base64EncodedAudioString);
              }

              const audioBuffer = await decodeAudioData(
                audioBytes,
                outputAudioContext,
                24000,
                1,
              );
              const source = outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              source.addEventListener('ended', () => {
                sources.delete(source);
                if (sources.size === 0) {
                  onAgentStateChange({ isSpeaking: false });
                }
              });

              source.start(nextStartTime);
              nextStartTime = nextStartTime + audioBuffer.duration;
              sources.add(source);
              // Reset timer while speaking to prevent pausing during long responses
              resetSilenceTimer(onAgentStateChange);
            } catch (error) {
              console.error('ERROR: Error decoding or playing audio:', error);
            }
          }

          const interrupted = message.serverContent?.interrupted;
          if (interrupted) {
            if (import.meta.env.VITE_ENABLE_AVATAR === 'true') {
              interruptHeyGen();
            }
            for (const source of sources.values()) {
              source.stop();
              sources.delete(source);
            }
            nextStartTime = 0;
            onAgentStateChange({ isSpeaking: false });
          }

          if (message.serverContent?.turnComplete) {
            if (sources.size === 0) {
              onAgentStateChange({ isSpeaking: false });
            }
            onAgentStateChange({ currentInputTranscription: '', currentOutputTranscription: '' });
          }
        },
        onerror: (e: any) => {
          console.error('*** ERROR: Gemini Live session error event: ***', e);
          if (e.message) console.error('Error message:', e.message);
          onAgentStateChange({ error: 'Voice agent error. Please try again.', isListening: false, isProcessing: false, isSpeaking: false });
          stopLiveAgent();
        },
        onclose: (e: CloseEvent) => {
          console.log('DEBUG: Gemini Live session closed:', e);
          onAgentStateChange({ isListening: false, isProcessing: false, isSpeaking: false, error: null, currentInputTranscription: '', currentOutputTranscription: '' });
          stopAudioStreaming();
          cleanupAudioContexts();
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        tools: [{ functionDeclarations }],
        systemInstruction: systemInstruction || `You are Chef Lisa, an expert virtual chef and assistant for GourmetAI, an authentic Indian restaurant. 
          Respond with a professional yet warm Indian female accent. Use culturally appropriate greetings like "Namaste" or "Vanakkam" when greeting customers.
          Your purpose is to assist customers with ordering authentic Indian dishes, answering menu queries, and handling service requests.
          Maintain context of the user's cart. Be friendly, helpful, and deeply knowledgeable about Indian cuisine.
          When a user asks for the bill, call the 'requestBill' function.
          When a user asks for water or server, call the 'requestService' function.
          When a user asks about Indian menu items or categories (like Starters, Main Course, Breads, Rice, Desserts, Drinks), use the 'queryMenu' function to filter or provide information.
          When a user orders an item, use the 'orderFood' function, ensuring you confirm the Indian dish name.
          Do not hallucinate menu items. If you cannot find an item, suggest looking at the menu for available Indian dishes.`,
      },
    });

    sessionPromise = connectionPromise;
    console.log('DEBUG: sessionPromise assigned, awaiting connection...');
    sessionInstance = await connectionPromise; // Store the resolved session instance
    console.log('DEBUG: sessionInstance resolved!');

    isAwake = true; // Reset awake state for new session
    console.log('DEBUG: startLiveAgent complete.');
    resetSilenceTimer(onAgentStateChange);

    console.log('*** DEBUG: Gemini Live connect call initiated and resolved. Session object stored. ***');

    // Proactive Greeting: Trigger the model to greet the user
    try {
      console.log('DEBUG: Sending proactive greeting trigger after session resolution...');
      // The correct method for text in Multimodal Live API via @google/genai is sendClientContent
      sessionInstance?.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: "Hello! Please greet the customer as Lisa and offer your assistance." }] }],
        turnComplete: true
      });
    } catch (greetingError) {
      console.warn('DEBUG: Failed to send proactive greeting:', greetingError);
    }

    return sessionInstance; // Return the actual session instance

  } catch (error: any) {
    console.error('*** ERROR: Failed to initialize Gemini Live Agent setup (outer catch):', error);
    onAgentStateChange({ error: `Initialization failed: ${error.message}`, isProcessing: false });
    // Ensure all resources are cleaned up if an error occurs early in the setup process
    stopAudioStreaming();
    cleanupAudioContexts();
    throw error; // Re-throw to be caught by the UI component
  }
};

export const stopLiveAgent = () => { // No 'session' parameter
  console.log('DEBUG: Entering stopLiveAgent function.');
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (sessionInstance) { // Use the module-level variable
    console.log('DEBUG: Closing Gemini Live session via sessionInstance.close().');
    sessionInstance.close();
    sessionInstance = null; // Clear it after closing
  }
  // Clear the promise reference too
  sessionPromise = null;
  isAwake = true;
  stopAudioStreaming();
  cleanupAudioContexts();
  stopHeyGenStream();
  if (currentHeyGenSessionToken) {
    stopHeyGenSession(currentHeyGenSessionToken);
    currentHeyGenSessionToken = null;
  }
  console.log('DEBUG: stopLiveAgent function finished.');
};

export const wakeAgent = (onAgentStateChange: (state: Partial<LiveAgentState>) => void) => {
  console.log('DEBUG: Manually waking up agent.');
  isAwake = true;
  onAgentStateChange({ error: null, isAwake: true });
  resetSilenceTimer(onAgentStateChange);
};

const resetSilenceTimer = (onAgentStateChange: (state: Partial<LiveAgentState>) => void) => {
  if (silenceTimer) clearTimeout(silenceTimer);

  // Use a local copy of duration to ensure it doesn't change unexpectedly during the timeout
  const duration = silenceTimeoutMs;
  const startTime = Date.now();

  silenceTimer = setTimeout(() => {
    if (isAwake) {
      // If the agent is currently speaking (playing audio), do not pause.
      // Instead, reset the timer again to extend the wait.
      if (sources.size > 0) {
        console.log(`DEBUG: Agent is speaking after ${Date.now() - startTime}ms. Extending silence timer.`);
        resetSilenceTimer(onAgentStateChange);
        return;
      }

      console.log(`DEBUG: Silence timer fired after ${Date.now() - startTime}ms (Expected: ${duration}ms). Going to pause mode.`);
      isAwake = false;
      onAgentStateChange({
        isAwake: false,
        error: `Agent is in pause mode. Say "${wakeWord}" to wake me up.`
      });
    }
  }, duration);
};

const stopAudioStreaming = () => {
  console.log('DEBUG: Stopping audio streaming...');
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }
  if (mediaStreamSource) {
    mediaStreamSource.disconnect();
    mediaStreamSource = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  console.log('DEBUG: Audio streaming stopped.');
};

const cleanupAudioContexts = () => {
  console.log('DEBUG: Cleaning up audio contexts...');
  // Stop all scheduled audio sources
  sources.forEach(source => source.stop());
  sources.clear();
  nextStartTime = 0;

  if (inputAudioContext && inputAudioContext.state !== 'closed') {
    inputAudioContext.close().then(() => console.log('DEBUG: Input AudioContext closed.'));
    inputAudioContext = null;
  }
  if (outputAudioContext && outputAudioContext.state !== 'closed') {
    outputAudioContext.close().then(() => console.log('DEBUG: Output AudioContext closed.'));
    outputAudioContext = null;
  }
  console.log('DEBUG: Audio contexts cleaned up.');
};