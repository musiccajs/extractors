import { Extractor, ExtractorOptions, Media } from 'musicca';
import Soundcloud, { SoundcloudPlaylistV2, SoundcloudTrackV2 } from 'soundcloud.ts';
import { Readable } from 'stream';

export interface SoundcloudExtractorOptions extends ExtractorOptions {
  clientId?: string;
  oauthToken?: string;
}

export type AcceptedTypeName = 'track' | 'playlist';
export type AcceptedType = SoundcloudPlaylistV2 | SoundcloudTrackV2;

export class SoundcloudExtractor extends Extractor<SoundcloudExtractorOptions> {
  protected client: Soundcloud;

  protected readonly ACCEPTABLE_TYPES = ['track', 'playlist'];

  constructor(options?: SoundcloudExtractorOptions) {
    super('soundcloud-extractor', options, 'sc-ext');

    this.client = new Soundcloud(options?.clientId, options?.oauthToken);
  }

  validate(input: string) {
    return /^https?:\/\/(?:(?:www|m)\.)?soundcloud\.com\/(.*)$/.test(input);
  }

  async extract(input: string): Promise<Media<SoundcloudExtractor> | Media<SoundcloudExtractor>[]> {
    const data = await this.client.resolve.getV2(input, true).catch(() => null) as AcceptedType | null;
    if (!data || !this.ACCEPTABLE_TYPES.includes((data as NonNullable<AcceptedType>)?.kind)) throw new Error('This soundcloud url is not supported');

    if (data.kind === 'playlist') return this.format('playlist', data as SoundcloudPlaylistV2);

    return this.format('track', data as SoundcloudTrackV2);
  }

  async fetch(url: string): Promise<Readable> {
    const stream = await this.client.util.streamTrack(url) as Readable;
    return stream;
  }

  protected format(type: 'track', info: SoundcloudTrackV2): Media<SoundcloudExtractor>;
  // eslint-disable-next-line lines-between-class-members
  protected format(type: 'playlist', info: SoundcloudPlaylistV2): Media<SoundcloudExtractor>[];
  // eslint-disable-next-line lines-between-class-members
  protected format(type: AcceptedTypeName, info: AcceptedType) {
    if (!this.ACCEPTABLE_TYPES.includes(type)) throw new Error(`Invalid type: ${type}`);

    if (type === 'playlist') {
      const { tracks, permalink_url: url, title, id, artwork_url: thumbnail } = info as SoundcloudPlaylistV2;

      return tracks.map((track) => new Media<SoundcloudExtractor>(this, track.permalink_url, {
        title: track.title,
        duration: track.full_duration,
        description: track.description,
        source: track.user.permalink_url,
        thumbnail: track.artwork_url,
        fromPlaylist: true,
        playlist: {
          url,
          title,
          id,
          thumbnail
        }
      }, track.id.toString()));
    }

    const {
      user,
      description,
      full_duration: duration,
      permalink_url: url,
      title,
      id,
      artwork_url: thumbnail,
    } = info as SoundcloudTrackV2;

    return new Media<SoundcloudExtractor>(this, url, {
      title,
      duration,
      description,
      source: user.permalink_url,
      thumbnail,
      fromPlaylist: false,
      playlist: null
    }, id.toString());
  }

  async search(query: string, type: 'track', limit: number): Promise<Media<SoundcloudExtractor>[]>;
  // eslint-disable-next-line lines-between-class-members
  async search(query: string, type: 'playlist', limit: number): Promise<Media<SoundcloudExtractor>[][]>;
  // eslint-disable-next-line lines-between-class-members
  async search(query: string, type: AcceptedTypeName, limit = 10) {
    if (!this.ACCEPTABLE_TYPES.includes(type)) throw new Error(`Invalid type: ${type}`);

    if (type === 'playlist') {
      const { collection } = await this.client.playlists.searchV2({ q: query, limit });
      return collection.map((pl) => this.format('playlist', pl));
    }

    const { collection } = await this.client.tracks.searchV2({ q: query, limit });
    return collection.map((tr) => this.format('track', tr));
  }
}