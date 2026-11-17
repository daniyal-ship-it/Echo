import { HttpError } from './security';
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 90;
// PCM WAV only. Known metadata chunks are bounded, ignored and stripped before dispatch.
export function validateMeetingAudio(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (b.length > MAX_AUDIO_BYTES) throw new HttpError(413, 'Recording exceeds 3 MiB.');
  if (
    b.length < 44 ||
    b.toString('ascii', 0, 4) !== 'RIFF' ||
    b.toString('ascii', 8, 12) !== 'WAVE' ||
    b.readUInt32LE(4) !== b.length - 8
  )
    throw new HttpError(415, 'Use a complete PCM WAV recording.');
  let format = false,
    size = 0,
    seenData = false;
  for (let offset = 12; offset < b.length;) {
    if (offset + 8 > b.length) throw new HttpError(415, 'Truncated WAV header.');
    const type = b.toString('ascii', offset, offset + 4),
      length = b.readUInt32LE(offset + 4);
    const start = offset + 8,
      end = start + length;
    if (end > b.length) throw new HttpError(415, 'Truncated WAV data.');
    if (type === 'fmt ') {
      if (
        format ||
        length !== 16 ||
        b.readUInt16LE(start) !== 1 ||
        b.readUInt16LE(start + 2) !== 1 ||
        b.readUInt32LE(start + 4) !== 16000 ||
        b.readUInt32LE(start + 8) !== 32000 ||
        b.readUInt16LE(start + 12) !== 2 ||
        b.readUInt16LE(start + 14) !== 16
      )
        throw new HttpError(415, 'Use 16 kHz, mono, 16-bit PCM WAV.');
      format = true;
    } else if (type === 'data') {
      if (seenData || !format || length % 2) throw new HttpError(415, 'Invalid WAV audio.');
      seenData = true;
      size = length;
    } else if (!['LIST', 'JUNK'].includes(type))
      throw new HttpError(
        415,
        'Unsupported WAV chunk. Export PCM WAV with LIST/JUNK metadata only.',
      );
    offset = end + (length % 2);
    if (offset > b.length) throw new HttpError(415, 'Invalid WAV padding.');
  }
  const seconds = size / 32000;
  if (!format || !seenData || seconds < 0.1 || seconds > MAX_AUDIO_SECONDS)
    throw new HttpError(413, 'Recording must be between 0.1 and 90 seconds.');
  return seconds;
}
/** Strip metadata; send only verified PCM samples with a canonical header. */
export function canonicalMeetingAudio(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  validateMeetingAudio(bytes);
  const b = Buffer.from(bytes);
  let samples = Buffer.alloc(0);
  for (let offset = 12; offset < b.length;) {
    const length = b.readUInt32LE(offset + 4);
    if (b.toString('ascii', offset, offset + 4) === 'data')
      samples = b.subarray(offset + 8, offset + 8 + length);
    offset += 8 + length + (length % 2);
  }
  const out = Buffer.alloc(44 + samples.length);
  out.write('RIFF');
  out.writeUInt32LE(out.length - 8, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16000, 24);
  out.writeUInt32LE(32000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(samples.length, 40);
  samples.copy(out, 44);
  return new Uint8Array(out);
}
export async function boundedBody(
  request: Request | Response,
  limit: number,
  milliseconds = 10000,
) {
  if (Number(request.headers.get('content-length')) > limit)
    throw new HttpError(413, 'Request exceeds the size limit.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing recording.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel().catch(() => undefined);
      reject(new HttpError(408, 'Transfer timed out.'));
    }, milliseconds);
  });
  try {
    await Promise.race([
      timeout,
      (async () => {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.length;
          if (length > limit) throw new HttpError(413, 'Request exceeds the size limit.');
          chunks.push(part.value);
        }
      })(),
    ]);
    return new Uint8Array(Buffer.concat(chunks));
  } finally {
    clearTimeout(timer!);
    await reader.cancel().catch(() => undefined);
  }
}
