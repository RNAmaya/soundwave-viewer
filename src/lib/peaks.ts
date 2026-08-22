export interface WaveformData {
  peaks: Float32Array;
  duration: number;
}

const BUCKETS = 3000;

export async function computeWaveform(
  file: Blob,
  buckets = BUCKETS,
): Promise<WaveformData> {
  const arrayBuffer = await file.arrayBuffer();
  const Ctx: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(arrayBuffer);
    const channels: Float32Array[] = [];
    for (let c = 0; c < audio.numberOfChannels; c++)
      channels.push(audio.getChannelData(c));

    const length = audio.length;
    const size = Math.max(1, Math.floor(length / buckets));
    const peaks = new Float32Array(buckets);
    let max = 0;

    for (let i = 0; i < buckets; i++) {
      const from = i * size;
      const to = Math.min(length, from + size);
      let peak = 0;
      for (const data of channels) {
        const step = Math.max(1, Math.floor((to - from) / 512));
        for (let j = from; j < to; j += step) {
          const v = Math.abs(data[j]);
          if (v > peak) peak = v;
        }
      }
      peaks[i] = peak;
      if (peak > max) max = peak;
    }

    if (max > 0) for (let i = 0; i < buckets; i++) peaks[i] /= max;
    return { peaks, duration: audio.duration };
  } finally {
    void ctx.close();
  }
}

export function resamplePeaks(peaks: Float32Array, bars: number): Float32Array {
  const out = new Float32Array(bars);
  if (bars <= 0 || peaks.length === 0) return out;
  const ratio = peaks.length / bars;
  for (let i = 0; i < bars; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.max(from + 1, Math.floor((i + 1) * ratio));
    let peak = 0;
    for (let j = from; j < to && j < peaks.length; j++) {
      if (peaks[j] > peak) peak = peaks[j];
    }
    out[i] = peak;
  }
  return out;
}
