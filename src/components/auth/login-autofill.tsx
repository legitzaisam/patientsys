import type { AnimationEvent, FormEvent } from "react";

/** Reads a browser-filled value into React state. */
export function autofillHandlers(setValue: (value: string) => void) {
  return {
    onInput: (event: FormEvent<HTMLInputElement>) => setValue(event.currentTarget.value),
    onAnimationStart: (event: AnimationEvent<HTMLInputElement>) => {
      if (event.animationName === "aetheria-autofill") setValue(event.currentTarget.value);
    },
  };
}
