import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getVoiceCallToken } from "@/lib/clinic.functions";

export type VoiceCallState = "idle" | "connecting" | "ringing" | "connected" | "ended" | "error";

/**
 * Browser call via the Twilio Voice SDK. The SDK (~100KB) is imported lazily
 * on the first call, the AccessToken comes from getVoiceCallToken, and the
 * TwiML App dials whatever `to` number we pass — in this app always a
 * TWILIO_DEMO_NUMBERS pool number, never a fixture patient's fake one.
 */
export function useVoiceCall() {
  const [state, setState] = useState<VoiceCallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const fetchToken = useServerFn(getVoiceCallToken);
  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const endWith = useCallback((finalState: "ended" | "error") => {
    stopTimer();
    callRef.current = null;
    setMuted(false);
    setState(finalState);
  }, []);

  const start = useCallback(
    async (to: string) => {
      if (callRef.current) return; // one call at a time
      setError(null);
      setMuted(false);
      setSeconds(0);
      setState("connecting");
      try {
        const { token } = await fetchToken();
        const { Device } = await import("@twilio/voice-sdk");
        let device = deviceRef.current;
        if (device) {
          device.updateToken(token);
        } else {
          device = new Device(token, { logLevel: "silent" });
          deviceRef.current = device;
        }
        const call = await device.connect({ params: { To: to } });
        callRef.current = call;
        call.on("ringing", () => setState("ringing"));
        call.on("accept", () => {
          setState("connected");
          stopTimer();
          timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        });
        call.on("disconnect", () => endWith("ended"));
        call.on("cancel", () => endWith("ended"));
        call.on("reject", () => endWith("ended"));
        call.on("error", (callError: Error) => {
          setError(callError.message);
          endWith("error");
        });
      } catch (startError) {
        setError((startError as Error).message);
        endWith("error");
      }
    },
    [fetchToken, endWith],
  );

  const hangUp = useCallback(() => {
    callRef.current?.disconnect();
    // If the call never connected there is no disconnect event to catch.
    if (!callRef.current) endWith("ended");
  }, [endWith]);

  const toggleMute = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const next = !muted;
    call.mute(next);
    setMuted(next);
  }, [muted]);

  const dismiss = useCallback(() => setState("idle"), []);

  useEffect(
    () => () => {
      stopTimer();
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    },
    [],
  );

  return { state, error, muted, seconds, start, hangUp, toggleMute, dismiss };
}
