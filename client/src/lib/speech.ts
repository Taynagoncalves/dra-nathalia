import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fala → texto (Web Speech API, pt-BR) e texto → fala (voz da Tayna).
 * Funciona no Chrome e no Edge (computador e Android). Sem suporte (ex.: Firefox),
 * o site oferece digitar no lugar.
 */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const RecognitionCtor = (): (new () => Recognition) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const speechRecognitionSupported = () => typeof window !== 'undefined' && !!RecognitionCtor();

/**
 * Microfone com transcrição contínua. `onFinal` recebe cada trecho finalizado;
 * `interim` mostra o que está sendo dito agora.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => {
    wanted.current = false;
    rec.current?.stop();
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    const Ctor = RecognitionCtor();
    if (!Ctor) return setError('Este navegador não transcreve a fala. Use o Chrome ou o Edge, ou digite.');
    setError(null);
    const r = new Ctor();
    r.lang = 'pt-BR';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) onFinalRef.current(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wanted.current = false;
        setError('Permita o uso do microfone para transcrever a fala.');
      }
    };
    // O Chrome encerra sozinho após silêncio: reinicia enquanto o microfone estiver "ligado".
    r.onend = () => {
      if (wanted.current) {
        try {
          r.start();
        } catch {
          /* já reiniciando */
        }
      } else setListening(false);
    };
    rec.current = r;
    wanted.current = true;
    r.start();
    setListening(true);
  }, []);

  useEffect(() => () => {
    wanted.current = false;
    rec.current?.abort();
  }, []);

  return { listening, interim, error, start, stop, supported: speechRecognitionSupported() };
}

/** Voz da Tayna (feminina, pt-BR quando disponível). Resolve quando termina de falar. */
export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 1.03;
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('pt'));
    u.voice =
      voices.find((v) => /luciana|francisca|maria|vitoria|female|feminina/i.test(v.name)) ??
      voices.find((v) => v.lang.toLowerCase() === 'pt-br') ??
      voices[0] ??
      null;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export const stopSpeaking = () => {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
};
