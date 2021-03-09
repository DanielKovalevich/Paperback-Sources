import {
  Source,
  Manga,
  Chapter,
  ChapterDetails,
  HomeSection,
  SearchRequest,
  TagSection,
  PagedResults,
  SourceInfo,
  MangaUpdates,
  TagType
} from "paperback-extensions-common"
import { parseChapterDetails, parseChapters, parseHomeSections, parseMangaDetails, parseSearch, parseTags, parseUpdatedManga, parseViewMore, searchMetadata } from "./MangaLifeParsing"

export const ML_DOMAIN = 'https://manga4life.com'
const headers = { "content-type": "application/x-www-form-urlencoded" }
const method = 'GET'

export const MangaLifeInfo: SourceInfo = {
  version: '2.1.0',
  name: 'Manga4Life',
  icon: 'icon.png',
  author: 'Daniel Kovalevich',
  authorWebsite: 'https://github.com/DanielKovalevich',
  description: 'Extension that pulls manga from MangaLife, includes Advanced Search and Updated manga fetching',
  hentaiSource: false,
  websiteBaseURL: ML_DOMAIN,
  sourceTags: [
    {
      text: "Notifications",
      type: TagType.GREEN
    }
  ]
}

export class MangaLife extends Source {
  getMangaShareUrl(mangaId: string): string | null { return `${ML_DOMAIN}/manga/${mangaId}` }

  async getMangaDetails(mangaId: string): Promise<Manga> {
    const request = createRequestObject({
      url: `${ML_DOMAIN}/manga/`,
      method,
      param: mangaId
    })

    const response = await this.requestManager.schedule(request, 1)
    let $ = this.cheerio.load(response.data)
    return parseMangaDetails($, mangaId)
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    const request = createRequestObject({
      url: `${ML_DOMAIN}/manga/`,
      method,
      headers,
      param: mangaId
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    return parseChapters($, mangaId)
  }

  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    const request = createRequestObject({
      url: `${ML_DOMAIN}/read-online/`,
      headers,
      method,
      param: chapterId
    })

    const response = await this.requestManager.schedule(request, 1)
    return parseChapterDetails(response.data, mangaId, chapterId);
  }

  async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
    const request = createRequestObject({
      url: `${ML_DOMAIN}/`,
      headers,
      method,
    })

    const response = await this.requestManager.schedule(request, 1)
    const returnObject = parseUpdatedManga(response, time, ids);
    mangaUpdatesFoundCallback(createMangaUpdates(returnObject))
  }

  async searchRequest(query: SearchRequest, _metadata: any): Promise<PagedResults> {
    const metadata = searchMetadata(query);
    const request = createRequestObject({
      url: `${ML_DOMAIN}/directory/`,
      metadata,
      headers,
      method,
    })

    const response = await this.requestManager.schedule(request, 1)
    return parseSearch(response.data, metadata)
  }

  async getTags(): Promise<TagSection[] | null> {
    const request = createRequestObject({
      url: `${ML_DOMAIN}/search/`,
      method,
      headers,
    })

    const response = await this.requestManager.schedule(request, 1)
    return parseTags(response.data);
  }

  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    const request = createRequestObject({
      url: `${ML_DOMAIN}`,
      method,
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    parseHomeSections($, response.data, sectionCallback);
  }

  async getViewMoreItems(homepageSectionId: string, _metadata: any): Promise<PagedResults | null> {
    const request = createRequestObject({
      url: ML_DOMAIN,
      method,
    })

    const response = await this.requestManager.schedule(request, 1)
    return parseViewMore(response.data, homepageSectionId);
  }
}