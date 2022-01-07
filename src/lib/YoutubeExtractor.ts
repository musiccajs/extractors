import { Extractor, ExtractorOptions, Media, Nullable } from 'musicca';
import ytdl, { downloadOptions, getInfoOptions } from 'ytdl-core';
import ytsr, {
  Options as YtsrOptions,
  Result as YtsrResult,
  ContinueResult as YtsrContinueResult,
  Continuation as YtsrContinuation
} from 'ytsr';
import ytpl, { Options as YtplOptions } from 'ytpl';

export interface YoutubeExtractorOptions extends ExtractorOptions, downloadOptions {}

export interface ExtendedYtsrContinueResult extends YtsrContinueResult {
  next(): Promise<Nullable<ExtendedYtsrContinueResult>>;
}

export interface ExtendedYtsrResult extends YtsrResult {
  next(): Promise<Nullable<ExtendedYtsrContinueResult>>;
}

export class YoutubeExtractor extends Extractor<YoutubeExtractorOptions> {
  constructor(options?: YoutubeExtractorOptions) {
    super('youtube-extractor', options, 'yt-ext');
  }

  validate(input: string): boolean {
    return ytdl.validateURL(input)
      || ytdl.validateID(input)
      || ytpl.validateID(input);
  }

  async extract(input: string, options?: getInfoOptions | YtplOptions): Promise<Media<YoutubeExtractor> | Media<YoutubeExtractor>[]> {
    // Youtube video
    if (ytdl.validateURL(input) || ytdl.validateID(input)) {
      const id = ytdl.validateID(input) ? input : ytdl.getURLVideoID(input);
      const { videoDetails } = await ytdl.getBasicInfo(id, options);

      return new Media<YoutubeExtractor>(this, videoDetails.video_url, {
        title: videoDetails.title,
        duration: parseInt(videoDetails.lengthSeconds, 10) ,
        description: videoDetails.description,
        source: videoDetails.author.channel_url,
        thumbnail: videoDetails.thumbnails.find((th) => th.url.includes('maxresdefault'))?.url ?? videoDetails.thumbnails[0]?.url,
        ageRestricted: videoDetails.age_restricted,
        isLive: videoDetails.isLiveContent,
        fromPlaylist: false,
        playlist: null,
      }, videoDetails.videoId);
    }

    // Playlist
    const playlist = await ytpl(input, options);
    return playlist.items.map((item) => new Media<YoutubeExtractor>(this, item.shortUrl, {
      title: item.title,
      duration: item.durationSec,
      source: item.author.url,
      thumbnail: item.bestThumbnail.url,
      isLive: item.isLive,
      fromPlaylist: true,
      playlist: playlist.url,
      position: item.index
    }, item.id));
  }

  fetch(url: string) {
    return ytdl(url, this.options);
  }

  async search(input: string, options?: YtsrOptions): Promise<ExtendedYtsrResult> {
    const result = await ytsr(input, options).then((res) => YoutubeExtractor.appendNext<ExtendedYtsrResult>(res, res.continuation));

    return result;
  }

  static async appendNext<T extends ExtendedYtsrResult | ExtendedYtsrContinueResult>(result: YtsrResult | YtsrContinueResult, continuation: Nullable<YtsrContinuation>): Promise<T> {
    // eslint-disable-next-line no-param-reassign
    (result as T).next = async () => {
      if (!continuation) return null;

      const nextResult = await ytsr.continueReq(continuation);

      return YoutubeExtractor.appendNext(nextResult, nextResult.continuation);
    };

    return result as T;
  }
}