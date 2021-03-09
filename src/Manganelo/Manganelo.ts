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
  RequestHeaders,
  TagType
} from "paperback-extensions-common"
import { generateSearch, isLastPage, parseChapterDetails, parseChapters, parseHomeSections, parseMangaDetails, parseSearch, parseTags, parseUpdatedManga, parseViewMore, UpdatedManga } from "./ManganeloParser"

const MN_DOMAIN = 'https://manganelo.com'
const method = 'GET'
const headers = {
  "content-type": "application/x-www-form-urlencoded"
}

export const ManganeloInfo: SourceInfo = {
  version: '2.1.0',
  name: 'Manganelo',
  icon: 'icon.png',
  author: 'Daniel Kovalevich',
  authorWebsite: 'https://github.com/DanielKovalevich',
  description: 'Extension that pulls manga from Manganelo, includes Advanced Search and Updated manga fetching',
  hentaiSource: false,
  websiteBaseURL: MN_DOMAIN,
  sourceTags: [
    {
      text: "Notifications",
      type: TagType.GREEN
    }
  ]
}

export class Manganelo extends Source {
  getMangaShareUrl(mangaId: string): string | null { return `${MN_DOMAIN}/manga/${mangaId}` }

  async getMangaDetails(mangaId: string): Promise<Manga> {
    const request = createRequestObject({
      url: `${MN_DOMAIN}/manga/`,
      method,
      param: mangaId
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    return parseMangaDetails($, mangaId)
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    const request = createRequestObject({
      url: `${MN_DOMAIN}/manga/`,
      method,
      param: mangaId
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    return parseChapters($, mangaId)
  }

  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    const request = createRequestObject({
      url: `${MN_DOMAIN}/chapter/`,
      method,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Cookie: 'content_lazyload=off'
      },
      param: `${mangaId}/${chapterId}`
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    return parseChapterDetails($, mangaId, chapterId)
  }

  async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
    let page = 1
    let updatedManga: UpdatedManga = {
      ids: [],
      loadMore: true
    }

    while (updatedManga.loadMore) {
      const request = createRequestObject({
        url: `${MN_DOMAIN}/genre-all/`,
        method,
        headers,
        param: String(page++)
      })

      const response = await this.requestManager.schedule(request, 1)
      const $ = this.cheerio.load(response.data)
      updatedManga = parseUpdatedManga($, time, ids)

      if (updatedManga.ids.length > 0) {
        mangaUpdatesFoundCallback(createMangaUpdates({
          ids: updatedManga.ids
        }))
      }
    }
  }

  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    // Give Paperback a skeleton of what these home sections should look like to pre-render them
    const section1 = createHomeSection({ id: 'top_week', title: 'TOP OF THE WEEK' })
    const section2 = createHomeSection({ id: 'latest_updates', title: 'LATEST UPDATES', view_more: true })
    const section3 = createHomeSection({ id: 'new_manga', title: 'NEW MANGA', view_more: true })
    const sections = [section1, section2, section3]

    // Fill the homsections with data
    const request = createRequestObject({
      url: MN_DOMAIN,
      method,
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    parseHomeSections($, sections, sectionCallback)
  }

  async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
    let page : number = metadata?.page ?? 1
    const search = generateSearch(query)
    const request = createRequestObject({
      url: `${MN_DOMAIN}/advanced_search?`,
      method,
      headers,
      param: `${search}${'&page=' + page}`
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    const manga = parseSearch($)
    metadata = !isLastPage($) ? {page: page + 1} : undefined
    
    return createPagedResults({
      results: manga,
      metadata
    })
  }

  async getTags(): Promise<TagSection[] | null> {
    const request = createRequestObject({
      url: `${MN_DOMAIN}/advanced_search?`,
      method,
      headers,
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    return parseTags($)
  }

  async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
    let page : number = metadata?.page ?? 1
    let param = ''
    if (homepageSectionId === 'latest_updates')
      param = `/genre-all/${page}`
    else if (homepageSectionId === 'new_manga')
      param = `/genre-all/${page}?type=newest`
    else return Promise.resolve(null)

    const request = createRequestObject({
      url: `${MN_DOMAIN}`,
      method,
      param,
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    const manga = parseViewMore($)
    metadata = !isLastPage($) ? { page: page + 1 } : undefined

    return createPagedResults({
      results: manga,
      metadata
    })
  }

  globalRequestHeaders(): RequestHeaders {
    return {
      referer: MN_DOMAIN
    }
  }
}