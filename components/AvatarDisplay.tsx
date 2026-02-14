import React, { useEffect, useRef } from 'react';
import { AVATAR_IDLE_IMAGE, AVATAR_LISTENING_GIF } from '../constants';
import { RemoteTrack, Track } from 'livekit-client';

interface AvatarDisplayProps {
  isListening: boolean;
  isSpeaking: boolean;
  error: string | null;
  videoTrack: RemoteTrack | null;
}

const AvatarDisplay: React.FC<AvatarDisplayProps> = ({ isListening, isSpeaking, error, videoTrack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarImage = isListening || isSpeaking ? AVATAR_LISTENING_GIF : AVATAR_IDLE_IMAGE;
  const isAvatarEnabled = import.meta.env.VITE_ENABLE_AVATAR === 'true';

  useEffect(() => {
    if (videoTrack && videoRef.current) {
      videoTrack.attach(videoRef.current);
    }
    return () => {
      if (videoTrack && videoRef.current) videoTrack.detach(videoRef.current);
    };
  }, [videoTrack]);

  return (
    <div className="relative w-48 h-48 sm:w-72 sm:h-72 rounded-3xl bg-blue-900 overflow-hidden flex items-center justify-center border-4 border-blue-400/30 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all duration-500 group-hover:scale-[1.02] group-hover:border-blue-400">
      {/* video container for HeyGen Avatar */}
      {isAvatarEnabled && (
        <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover ${videoTrack ? 'block' : 'hidden'}`} autoPlay playsInline />
      )}

      {/* Fallback image when no video track or disabled */}
      {(!isAvatarEnabled || !videoTrack) && (
        <img
          src={avatarImage}
          alt="AI Avatar"
          className="w-full h-full object-cover rounded-xl"
        />
      )}

      {(isListening || isSpeaking) && !error && (
        <div className="absolute inset-0 rounded-xl ring-4 ring-green-400 animate-pulse-slow pointer-events-none"></div>
      )}
      {error && (
        <div className="absolute inset-0 rounded-xl bg-red-600 bg-opacity-75 flex items-center justify-center">
          <span className="text-white text-3xl font-bold">!</span>
        </div>
      )}
    </div>
  );
};

export default AvatarDisplay;