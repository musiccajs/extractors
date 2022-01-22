import Musicca, { Media, PluginType, MemoryQueue } from 'musicca';
import { Readable } from 'stream';
import { PlaylistMedia, SoundcloudExtractor } from '../src';

const isCI = Boolean(process.env.CI) || process.env.CI === 'true' || false;
const MUSIC_URL = 'https://soundcloud.com/miraie/cute';
const PLAYLIST_URL = 'https://soundcloud.com/miraie/sets/miraie';

const testIf = (statement: boolean) => statement ? test : test.skip;

const client = new Musicca<MemoryQueue>({
  plugins: [
    new SoundcloudExtractor()
  ],
  structs: {
    queue: MemoryQueue
  }
});

describe('initiating client', () => {
  test('should set queue struct to be MemoryQueue', () => {
    expect(client.queues.Struct).toBe(MemoryQueue);
  });

  test('should have extractor installed', () => {
    expect(client.extractors.get('sc-ext')).toBeInstanceOf(SoundcloudExtractor);
  });
});

describe('extracting music', () => {
  const extracted = client.extractors.extract(MUSIC_URL) as Promise<Media<SoundcloudExtractor>>;

  test('should resolve to correct metadata', () => extracted.then((res) => {
    const media = res;

    expect(media.type).toBe(PluginType.Media);
    expect(media.extractor).toBeInstanceOf(SoundcloudExtractor);
    expect(media.url).toBe(MUSIC_URL);
    expect(media.data.title.includes('i like cute girls')).toBeTruthy();
  }));

  testIf(!isCI)('should download to readable stream', () => extracted.then((res) => res.fetch()).then((stream) => {
    expect(stream).toBeInstanceOf(Readable);
    // Destroy stream after use
    stream.destroy();
  }));
});

describe('extracting playlist', () => {
  const extracted = client.extractors.extract(PLAYLIST_URL) as Promise<Media<SoundcloudExtractor>[]>;

  test('should resolve to correct metadatas', () => extracted.then((res) => {
    expect(Array.isArray(res)).toBeTruthy();

    const [first, second, third] = res as PlaylistMedia[];
    expect(first.type).toBe(PluginType.Media);
    expect(first.id).toBe('332859511');
    expect(first.data.title).toBe('Everytime Sweet');
    expect(first.data.playlist.url).toBe(PLAYLIST_URL);

    expect(second.type).toBe(PluginType.Media);
    expect(second.id).toBe('396799776');
    expect(second.data.title).toBe('Setka & Miraie - Dainty');
    expect(second.data.playlist.url).toBe(PLAYLIST_URL);

    expect(third.type).toBe(PluginType.Media);
    expect(third.id).toBe('306093838');
    expect(third.data.title).toBe('Konosuba ED (Miraie Remix)');
    expect(third.data.playlist.url).toBe(PLAYLIST_URL);
  }));

  testIf(!isCI)('should download videos to readable stream', () => extracted
    .then((res) => {
      const [first, second, third] = res;

      return Promise.all([
        first.fetch(),
        second.fetch(),
        third.fetch()
      ]);
    }).then(([fStream, sStream, tStream]) => {
      expect(fStream).toBeInstanceOf(Readable);
      expect(sStream).toBeInstanceOf(Readable);
      expect(tStream).toBeInstanceOf(Readable);

      // Destroy stream after use
      fStream.destroy();
      sStream.destroy();
      tStream.destroy();
    })
  );
});

describe('search', () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  test('should find music', () => client.extractors.get<SoundcloudExtractor>('sc-ext')!.search('tokyo nights linked emotions', 'track', 5).then((res) => {
    const [first] = res;
    expect(first.type).toBe(PluginType.Media);
    expect(first.id).toBe('1063058293');
    expect(first.data.title).toBe('Tokyo Nights【F/C LiNKED EMOTiONS】');
    expect(first.data.playlist).toBe(null);
  }));
});