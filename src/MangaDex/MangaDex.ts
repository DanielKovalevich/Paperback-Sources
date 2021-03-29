/* eslint-disable camelcase, @typescript-eslint/explicit-module-boundary-types, radix, unicorn/filename-case */
import {
  PagedResults,
  Source,
  Manga,
  Chapter,
  ChapterDetails,
  HomeSection,
  SearchRequest,
  SourceInfo,
  LanguageCode,
  TagType,
  MangaUpdates,
  Request
} from 'paperback-extensions-common'

import {
  Parser,
} from './Parser'

let IS_BETA: boolean
try {
  // `IS_PUBLIC` is not defined at bundle time
  // this will throw an error at bundle time
  IS_BETA = IS_PUBLIC === 'false'
} catch {
  IS_BETA = false
}

// Paperback has a beta server that sometimes has changes specific
// to the beta/alpha version of the app
const PAPERBACK_API = `https://${IS_BETA ? 'md-cacher.herokuapp.com' : 'api.paperback.moe'}`
const MANGADEX_DOMAIN = 'https://mangadex.org'
const MANGADEX_API_V2 = 'https://api.mangadex.org/v2'

const MANGA_ENDPOINT = PAPERBACK_API + '/manga'
const CHAPTER_LIST_ENDPOINT = MANGADEX_API_V2 + '/manga'
const CHAPTER_DETAILS_ENDPOINT = MANGADEX_API_V2 + '/chapter'
const SEARCH_ENDPOINT = PAPERBACK_API + '/search'

export const MangaDexInfo: SourceInfo = {
  author: 'Neko',
  description: 'Overwrites SafeDex,unlocks all mangas MangaDex has to offer and loads slightly faster. supports notifications',
  icon: 'icon.png',
  name: 'MangaDex Unlocked',
  version: '2.0.9',
  authorWebsite: 'https://github.com/Pogogo007/extensions-main-promises',
  websiteBaseURL: MANGADEX_DOMAIN,
  hentaiSource: false,
  language: LanguageCode.ENGLISH,
  sourceTags: [
    {
      text: 'Recommended',
      type: TagType.BLUE,
    },
  ],
}

export class MangaDex extends Source {
  parser = new Parser()

  requestManager = createRequestManager({
    requestsPerSecond: 1,
    requestTimeout: 15000,
  })

  getMangaShareUrl(mangaId: string): string {
    return `${MANGADEX_DOMAIN}/manga/${mangaId}`
  }

  async getMangaDetails(mangaId: string): Promise<Manga> {
    const request = createRequestObject({
      url: MANGA_ENDPOINT,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      data: JSON.stringify({
        id: [parseInt(mangaId)],
        bypassFilter: true,
      }),
    })

    const response = await this.requestManager.schedule(request, 1)
    const json = JSON.parse(response.data) as any

    return this.parser.parseMangaDetails(json)[0]
  }

  async getBatchMangaDetails(mangaIds: string[]): Promise<Manga[]> {
    let batchedIds: string[]

    const fetchedDetails: Manga[] = []

    // Get manga in 50 manga batches
    const chunk = 50
    for (let i = 0; i < mangaIds.length; i += chunk) {
      batchedIds = mangaIds.slice(i, i + chunk)

      const request = createRequestObject({
        url: MANGA_ENDPOINT,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        data: JSON.stringify({
          id: batchedIds.map(x => parseInt(x)),
          bypassFilter: true,
        }),
      })

      // eslint-disable-next-line no-await-in-loop
      const response = await this.requestManager.schedule(request, 1)
      const json = JSON.parse(response.data) as any

      for (const manga of this.parser.parseMangaDetails(json)) {
        fetchedDetails.push(manga)
      }
    }

    console.log(fetchedDetails)
    return fetchedDetails ?? []
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    const request = createRequestObject({
      url: `${CHAPTER_LIST_ENDPOINT}/${mangaId}/chapters`,
      method: 'GET',
    })

    const response = await this.requestManager.schedule(request, 1)
    const json = JSON.parse(response.data) as any

    return this.parser.parseChapterList(mangaId, json)
  }

  async getChapterDetails(_mangaId: string, chapterId: string): Promise<ChapterDetails> {
    const request = createRequestObject({
      url: `${CHAPTER_DETAILS_ENDPOINT}/${chapterId}`,
      method: 'GET',
    })

    const response = await this.requestManager.schedule(request, 1)
    const json = JSON.parse(response.data) as any

    return this.parser.parseChapterDetails(json.data)
  }

  async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
    const page = metadata?.page ?? 1
    const items = metadata?.items ?? 50

    const request = this.constructSearchRequest(query, page, items)

    const response = await this.requestManager.schedule(request, 1)
    const json = JSON.parse(response.data) as any
    const results = this.parser.parseSearchResults(json)

    return createPagedResults({
      results,
      metadata: {
        page: page,
        items: items,
      },
    })
  }

  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    const sections = [
      {
        request: this.constructSearchRequest({}, 1, 10),
        section: createHomeSection({
          id: 'recently_updated',
          title: 'RECENTLY UPDATED TITLES',
          view_more: true,
        }),
      },
      {
        request: this.constructSearchRequest({
          includeDemographic: ['1'],
        }, 1, 10),
        section: createHomeSection({
          id: 'shounen',
          title: 'UPDATED SHOUNEN TITLES',
          view_more: true,
        }),
      },
      {
        request: this.constructSearchRequest({
          includeGenre: ['2'],
        }, 1, 10),
        section: createHomeSection({
          id: 'action',
          title: 'UPDATED ACTION TITLES',
          view_more: true,
        }),
      }
    ]
    const promises: Promise<void>[] = []

    for (const section of sections) {
      // Let the app load empty sections
      sectionCallback(section.section)

      // Get the section data
      promises.push(
        this.requestManager.schedule(section.request, 1).then(response => {
          const json = JSON.parse(response.data) as any
          const tiles = this.parser.parseMangaTiles(json)

          section.section.items = tiles
          sectionCallback(section.section)
        }),
      )
    }

    // Make sure the function completes
    await Promise.all(promises)
  }

  async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
    const allManga = new Set(ids)
    let hasManga = true
    let page = 1

    while (hasManga) {
      const request = createRequestObject({
        url: 'https://mangadex.org/titles/0/' + (page++).toString(),
        method: 'GET',
        incognito: true,
        cookies: [
          createCookie({
            name: 'mangadex_title_mode',
            value: '2',
            domain: MANGADEX_DOMAIN,
          }),
        ],
      })

      // eslint-disable-next-line no-await-in-loop
      const response = await this.requestManager.schedule(request, 1)
      const selector = this.cheerio.load(response.data)

      const updatedManga = this.parser.filterUpdatedManga(selector, time, allManga)
      hasManga = updatedManga.hasMore

      if (updatedManga.updates.length > 0) {
        // If we found updates on this page, notify the app
        // This is needed so that the app can save the updates
        // in case the background job is killed by iOS
        mangaUpdatesFoundCallback(createMangaUpdates({ ids: updatedManga.updates }))
      }
    }
  }

  constructSearchRequest(query: SearchRequest, page: number, items = 50) {
    return createRequestObject({
      url: SEARCH_ENDPOINT + `?page=${page}&items=${items}`,
      method: 'POST',
      // We cant just JSON.stringify the `SearchRequest` object
      // so this is necessary
      data: JSON.stringify({
        title: query.title,
        includeDemographic: query.includeDemographic?.map(x => parseInt(x)),
        includeTheme: query.includeTheme?.map(x => parseInt(x)),
        includeFormat: query.includeFormat?.map(x => parseInt(x)),
        includeContent: query.includeContent?.map(x => parseInt(x)),
        includeGenre: query.includeGenre?.map(x => parseInt(x)),
        excludeDemographic: query.excludeDemographic?.map(x => parseInt(x)),
        excludeTheme: query.excludeTheme?.map(x => parseInt(x)),
        excludeFormat: query.excludeFormat?.map(x => parseInt(x)),
        excludeContent: query.excludeContent?.map(x => parseInt(x)),
        excludeGenre: query.excludeGenre?.map(x => parseInt(x)),
        includeOperator: query.includeOperator,
        excludeOperator: query.excludeOperator,
        author: query.author,
        artist: query.artist,
        status: query.status,
        hStatus: query.hStatus,
        bypassFilter: true,
      }),
      headers: {
        'content-type': 'application/json',
      },
    })
  }

  async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
    const requests: {[x: string]: Request} = {
      shounen: this.constructSearchRequest({
        includeDemographic: ['1'],
      }, metadata?.page ?? 1, 50),
      action: this.constructSearchRequest({
        includeGenre: ['2'],
      }, metadata?.page ?? 1, 50),
      recently_updated: this.constructSearchRequest({}, metadata?.page ?? 1, 50),
    }

    const request = requests[homepageSectionId]

    const response = await this.requestManager.schedule(request, 1)
    const json = JSON.parse(response.data) as any
    const tiles = this.parser.parseMangaTiles(json)

    return createPagedResults({
      results: tiles,
      metadata: {
        page: (metadata?.page ?? 1) + 1,
      },
    })
  }
}