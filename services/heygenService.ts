export interface HeyGenSessionResponse {
    session_id: string;
    session_token: string;
}

export interface HeyGenStartResponse {
    livekit_url: string;
    livekit_token: string;
    websocket_url: string;
}

const API_BASE = 'https://api.liveavatar.com/v1';

export const createHeyGenToken = async (avatarId: string, isSandbox: boolean = false): Promise<HeyGenSessionResponse> => {
    const apiKey = import.meta.env.VITE_HEYGEN_API_KEY;
    if (!apiKey) throw new Error('VITE_HEYGEN_API_KEY is missing');

    console.log('DEBUG: request to /sessions/token', { avatar_id: avatarId, is_sandbox: isSandbox });
    const response = await fetch(`${API_BASE}/sessions/token`, {
        method: 'POST',
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            mode: 'LITE',
            avatar_id: avatarId,
            is_sandbox: isSandbox
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`ERROR: HeyGen Token Request failed with status ${response.status}:`, errorText);
        throw new Error(`HeyGen Token Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('DEBUG: HeyGen Token response:', data);
    if (data.data && data.data.session_token) {
        console.log('DEBUG: Found token in data.data.session_token');
    } else if (data.session_token) {
        console.log('DEBUG: Found token in data.session_token');
    }
    return data.data || data;
};

export const startHeyGenSession = async (sessionToken: string): Promise<HeyGenStartResponse> => {
    console.log('DEBUG: request to /sessions/start with token length:', sessionToken?.length);
    console.log('DEBUG: token prefix:', sessionToken?.substring(0, 20));
    const response = await fetch(`${API_BASE}/sessions/start`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`ERROR: HeyGen Start Session failed with status ${response.status}:`, errorText);
        throw new Error(`HeyGen Start Error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('DEBUG: HeyGen Session started successfully.');

    if (result.data) {
        const data = result.data;
        console.log('DEBUG: Session Data Keys:', Object.keys(data));

        const mappedResponse = {
            livekit_url: data.livekit_url || data.url,
            livekit_token: data.livekit_client_token || data.access_token || data.livekit_token,
            websocket_url: data.ws_url || data.websocket_url || data.url
        };

        console.log('DEBUG: HeyGen Start Response Mapped:', {
            url: mappedResponse.livekit_url,
            tokenLength: mappedResponse.livekit_token?.length,
            wsUrlLength: mappedResponse.websocket_url?.length
        });

        return mappedResponse;
    }

    throw new Error('HeyGen Start Error: No data returned in response');
};

export const stopHeyGenSession = async (sessionToken: string): Promise<void> => {
    if (!sessionToken) return;
    console.log('DEBUG: Requesting HeyGen Session Stop...');
    try {
        const response = await fetch(`${API_BASE}/sessions/stop`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            console.log('DEBUG: HeyGen Session stopped successfully.');
        } else {
            const text = await response.text();
            console.warn('DEBUG: HeyGen Session stop returned status:', response.status, text);
        }
    } catch (err) {
        console.error('ERROR: Failed to stop HeyGen session:', err);
    }
};

export const getHeyGenAvatars = async (): Promise<any> => {
    const apiKey = import.meta.env.VITE_HEYGEN_API_KEY;
    if (!apiKey) throw new Error('VITE_HEYGEN_API_KEY is missing');

    const response = await fetch(`${API_BASE}/avatars/public`, {
        headers: {
            'X-API-KEY': apiKey,
            'accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('ERROR: Failed to fetch HeyGen avatars:', errorText);
        return null;
    }

    return response.json();
};
