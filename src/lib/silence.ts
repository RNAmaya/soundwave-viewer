export interface Region {
  start: number;
  end: number;
}

export interface SilenceOptions {
  threshold: number;
  minDuration: number;
}

export const DEFAULT_SILENCE: SilenceOptions = {
  threshold: 0.045,
  minDuration: 0.8,
};

export function detectSilences(
  peaks: Float32Array | null,
  duration: number,
  options: SilenceOptions = DEFAULT_SILENCE,
): Region[] {
  if (!peaks || peaks.length === 0 || duration <= 0) return [];
  const bucket = duration / peaks.length;
  const regions: Region[] = [];
  let from: number | null = null;

  for (let i = 0; i < peaks.length; i++) {
    const quiet = peaks[i] < options.threshold;
    if (quiet && from === null) from = i;
    if (!quiet && from !== null) {
      pushRegion(regions, from * bucket, i * bucket, options.minDuration);
      from = null;
    }
  }
  if (from !== null)
    pushRegion(
      regions,
      from * bucket,
      peaks.length * bucket,
      options.minDuration,
    );
  return regions;
}

function pushRegion(
  regions: Region[],
  start: number,
  end: number,
  minDuration: number,
) {
  if (end - start >= minDuration) regions.push({ start, end });
}

export function crossedRegionStart(
  regions: Region[],
  from: number,
  to: number,
): Region | null {
  for (const region of regions) {
    if (region.start > from && region.start <= to) return region;
    if (region.start > to) break;
  }
  return null;
}
