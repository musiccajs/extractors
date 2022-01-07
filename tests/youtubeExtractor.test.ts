import Musicca, { Media, PluginType } from 'musicca';
import { MemoryQueue } from '@musicca/structs';
import { Readable } from 'stream';
import { Video } from 'ytsr';
import { YoutubeExtractor } from '../src';

const isCI = Boolean(process.env.CI) || process.env.CI === 'true' || false;
const VIDEO_ID = 'dQw4w9WgXcQ';
const PLAYLIST_ID = 'PL01Ds3tdh2SqI7t-FeAMiQZzs5xxzWqeu';

const testIf = (statement: boolean) => statement ? test : test.skip;

const client = new Musicca<MemoryQueue>({
  plugins: [
    new YoutubeExtractor()
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
    expect(client.extractors.get('yt-ext')).toBeInstanceOf(YoutubeExtractor);
  });
});

describe('extracting video', () => {
  const extracted = client.extractors.extract(`https://www.youtube.com/watch?v=${VIDEO_ID}`) as Promise<Media<YoutubeExtractor>>;

  test('should resolve to correct metadata', () => extracted.then((res) => {
    const media = res;

    expect(media.type).toBe(PluginType.Media);
    expect(media.extractor).toBeInstanceOf(YoutubeExtractor);
    expect(media.id).toBe(VIDEO_ID);
    expect(media.url).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
    expect(media.data.title.includes('Never Gonna Give You Up')).toBeTruthy();
  }));

  testIf(!isCI)('should download video to readable stream', () => extracted.then((res) => res.fetch()).then((stream) => {
    expect(stream).toBeInstanceOf(Readable);
    // Destroy stream after use
    stream.destroy();
  }));
});

describe('extracting playlist', () => {
  const extracted = client.extractors.extract(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`) as Promise<Media<YoutubeExtractor>[]>;

  test('should resolve to correct metadatas', () => extracted.then((res) => {
    expect(Array.isArray(res)).toBeTruthy();

    const [first, second, third] = res;
    // Original rikkurollu
    expect(first.type).toBe(PluginType.Media);
    expect(first.extractor).toBeInstanceOf(YoutubeExtractor);
    expect(first.id).toBe(VIDEO_ID);
    expect(first.url).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
    expect(first.data.title.includes('Never Gonna Give You Up')).toBeTruthy();
    expect(first.data.position).toBe(1);

    // JP ver. of rikkurollu
    expect(second.type).toBe(PluginType.Media);
    expect(second.extractor).toBeInstanceOf(YoutubeExtractor);
    expect(second.id).toBe('mW61VTLhNjQ');
    expect(second.url).toBe('https://www.youtube.com/watch?v=mW61VTLhNjQ');
    expect(
      second.data.title.includes('Never Gonna Give You Up') &&
      second.data.title.toLowerCase().includes('japanese ver.')
    ).toBeTruthy();
    expect(second.data.position).toBe(2);

    // ＲＩＣＫＹ☆ＳＴＡＲ
    expect(third.type).toBe(PluginType.Media);
    expect(third.extractor).toBeInstanceOf(YoutubeExtractor);
    expect(third.id).toBe('moZtoMP7HAA');
    expect(third.url).toBe('https://www.youtube.com/watch?v=moZtoMP7HAA');
    expect(
      third.data.title.includes('ＲＩＣＫＹ☆ＳＴＡＲ') &&
      third.data.title.includes('Motteke! Rikku Rōru')
    ).toBeTruthy();
    expect(third.data.position).toBe(3);
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
  test('should find videos', () => YoutubeExtractor.search('Never Gonna Give You Up', { limit: 5 }).then((res) => {
    const media = res.items[0] as Video;

    expect(media.type).toBe('video');
    expect(media.id).toBe(VIDEO_ID);
    expect(media.url).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
  }));
});