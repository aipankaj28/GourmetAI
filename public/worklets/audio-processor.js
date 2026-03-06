class AudioInputProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input.length > 0) {
            const inputData = input[0];

            // Calculate RMS for VAD (Voice Activity Detection)
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);

            // We need to clone the buffer because it's a shared resource in worklets
            // and will be cleared once this function returns.
            const clonedData = new Float32Array(inputData);

            this.port.postMessage({
                audio: clonedData,
                rms: rms
            }, [clonedData.buffer]);
        }
        return true;
    }
}

registerProcessor('audio-input-processor', AudioInputProcessor);
