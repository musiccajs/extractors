import { Extractor, ExtractorOptions, Media, MediaData } from 'musicca';
import Soundcloud, { SoundcloudPlaylistV2, SoundcloudTrackV2 } from 'soundcloud.ts';
import { Readable } from 'stream';
import { Utils } from '..';

export interface SoundcloudExtractorOptions extends ExtractorOptions {
  clientId?: string;
  oauthToken?: string;
}

export type AcceptedTypeName = 'track' | 'playlist';
export type AcceptedType = SoundcloudPlaylistV2 | SoundcloudTrackV2;
export interface SoundcloudMediaData extends MediaData {
  genre: string;
}

export interface PlaylistMediaDataPlaylist {
  url: string;
  id: string;
  title: string;
  thumbnail?: string;
}

export interface PlaylistMediaData extends SoundcloudMediaData {
  playlist: PlaylistMediaDataPlaylist;
}

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

    if (data.kind === 'playlist') {
      (data as SoundcloudPlaylistV2).tracks = await this.resolveTracks((data as SoundcloudPlaylistV2).tracks);
      return this.format('playlist', data as SoundcloudPlaylistV2, false);
    }

    return this.format('track', data as SoundcloudTrackV2, false);
  }

  async fetch(url: string): Promise<Readable> {
    const stream = await this.client.util.streamTrack(url) as Readable;
    return stream;
  }

  async resolveTracks(tracks: SoundcloudTrackV2[]): Promise<SoundcloudTrackV2[]> {
    const limited = tracks.splice(tracks.findIndex((tr) => !tr.title));
    const chunks = Utils.chunk(limited, 50);
    const all = await Promise.all(
      chunks.map((ch) => this.client.api.getV2('/tracks', { ids: ch.map((t) => t.id).join(',') }))
    );

    return tracks.concat(all.flat());
  }

  protected format(type: 'track', info: SoundcloudTrackV2, raw: true, extend?: Record<string, unknown>): SoundcloudMediaData;
  // eslint-disable-next-line lines-between-class-members
  protected format(type: 'playlist', info: SoundcloudPlaylistV2, raw: true, extend?: Record<string, unknown>): PlaylistMediaData[];
  // eslint-disable-next-line lines-between-class-members
  protected format(type: 'track', info: SoundcloudTrackV2, raw: false): Media<SoundcloudExtractor>;
  // eslint-disable-next-line lines-between-class-members
  protected format(type: 'playlist', info: SoundcloudPlaylistV2, raw: false): Media<SoundcloudExtractor>[];
  // eslint-disable-next-line lines-between-class-members
  protected format(type: AcceptedTypeName, info: AcceptedType, raw = false, extend = {}) {
    if (!this.ACCEPTABLE_TYPES.includes(type)) throw new Error(`Invalid type: ${type}`);

    if (type === 'playlist') {
      const { tracks, permalink_url: url, title, id, artwork_url: thumbnail } = info as SoundcloudPlaylistV2;

      return tracks.map((track) => {
        const data = this.format('track', track, true, {
          fromPlaylist: true,
          playlist: {
            url,
            title,
            id,
            thumbnail,
          },
        }) as PlaylistMediaData;

        if (raw) return data;

        return new Media<SoundcloudExtractor>(this, track.permalink_url, data, track.id.toString());
      });
    }

    const {
      user,
      description,
      full_duration: duration,
      permalink_url: url,
      title,
      id,
      artwork_url: thumbnail,
      genre
    } = info as SoundcloudTrackV2;

    const data = {
      title,
      duration: Math.floor(duration / 1000),
      description,
      source: user.permalink_url,
      thumbnail,
      genre,
      fromPlaylist: false,
      playlist: null,
      ...extend
    } as SoundcloudMediaData;

    if (raw) return data;

    return new Media<SoundcloudExtractor>(this, url, data, id.toString());
  }

  async search(query: string, type: 'track', limit?: number): Promise<Media<SoundcloudExtractor>[]>;
  // eslint-disable-next-line lines-between-class-members
  async search(query: string, type: 'playlist', limit?: number): Promise<Media<SoundcloudExtractor>[][]>;
  // eslint-disable-next-line lines-between-class-members
  async search(query: string, type: AcceptedTypeName, limit = 10) {
    if (!this.ACCEPTABLE_TYPES.includes(type)) throw new Error(`Invalid type: ${type}`);

    if (type === 'playlist') {
      const { collection } = await this.client.playlists.searchV2({ q: query, limit });
      return collection.map((pl) => this.format('playlist', pl, false));
    }

    const { collection } = await this.client.tracks.searchV2({ q: query, limit });
    return collection.map((tr) => this.format('track', tr, false));
  }
}

export interface PlaylistMedia extends Media<SoundcloudExtractor> {
  data: PlaylistMediaData;
}