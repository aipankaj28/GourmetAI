import { Room, RoomEvent, RemoteTrack, Track } from 'livekit-client';

let room: Room | null = null;
let ws: WebSocket | null = null;
let eventIdCount = 0;

export const initializeHeyGenStream = async (
    livekitUrl: string,
    livekitToken: string,
    websocketUrl: string,
    onVideoTrack: (track: RemoteTrack) => void
) => {
    if (room) await room.disconnect();

    room = new Room();

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Video) {
            onVideoTrack(track as RemoteTrack);
        }
    });

    console.log('DEBUG: Connecting to LiveKit room at', livekitUrl);
    await room.connect(livekitUrl, livekitToken);
    console.log('DEBUG: LiveKit room connected successfully.');

    // Initialize WebSocket for LITE mode events
    console.log('DEBUG: Connecting to HeyGen WebSocket at', websocketUrl);
    return new Promise<void>((resolve, reject) => {
        ws = new WebSocket(websocketUrl);

        ws.onopen = () => {
            console.log('DEBUG: HeyGen WebSocket connected.');
            resolve();
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('DEBUG: HeyGen WS Event:', data.type);
        };

        ws.onerror = (error) => {
            console.error('ERROR: HeyGen WebSocket error:', error);
            reject(error);
        };
    });
};

export const sendAudioToHeyGen = (base64Audio: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const message = {
        type: 'agent.speak',
        audio: base64Audio,
        event_id: `evt-${++eventIdCount}`
    };

    ws.send(JSON.stringify(message));
};

export const interruptHeyGen = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ type: 'agent.interrupt' }));
};

export const stopHeyGenStream = async () => {
    if (ws) {
        ws.close();
        ws = null;
    }
    if (room) {
        await room.disconnect();
        room = null;
    }
};
