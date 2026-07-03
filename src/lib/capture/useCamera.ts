'use client';

/**
 * useCamera — manages the webcam MediaStream + a hidden <video> element.
 * Handles permission denial, multi-camera enumeration, and front/back switching.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'error';

export interface CameraInfo {
  deviceId: string;
  label: string;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        setStatus('error');
        setError('This browser does not support camera access.');
        return;
      }
      setStatus('requesting');
      setError(null);
      stop();
      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.playsInline = true;
          video.muted = true;
          await video.play().catch(() => {});
        }

        // enumerate only after permission so labels are populated
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices
          .filter((d) => d.kind === 'videoinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `camera ${i + 1}` }));
        setCameras(cams);

        const track = stream.getVideoTracks()[0];
        setActiveDeviceId(track?.getSettings().deviceId ?? deviceId ?? null);
        setStatus('ready');
      } catch (e) {
        const err = e as DOMException;
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          setStatus('denied');
          setError('Camera permission was blocked.');
        } else if (err.name === 'NotFoundError') {
          setStatus('error');
          setError('No camera found on this device.');
        } else {
          setStatus('error');
          setError(err.message || 'Could not start the camera.');
        }
      }
    },
    [stop],
  );

  /** Cycle to the next available camera (front/back/external). */
  const flip = useCallback(() => {
    if (cameras.length < 2) return;
    const idx = cameras.findIndex((c) => c.deviceId === activeDeviceId);
    const next = cameras[(idx + 1) % cameras.length];
    start(next.deviceId);
  }, [cameras, activeDeviceId, start]);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, status, error, cameras, activeDeviceId, start, stop, flip };
}
