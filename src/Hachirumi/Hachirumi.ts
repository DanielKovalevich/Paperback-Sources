import {
  Source,
  Manga,
  Chapter,
  ChapterDetails,
  SearchRequest,
  LanguageCode,
  MangaStatus,
  PagedResults,
  SourceInfo,
  HomeSection,
} from 'paperback-extensions-common'

import {
  chapId,
  chapNum,
  chapName,
  chapVol,
  chapGroup,
  unixToDate,
} from './Functions'

const HACHIRUMI_DOMAIN = 'https://hachirumi.com'
const HACHIRUMI_API = `${HACHIRUMI_DOMAIN}/api`
const HACHIRUMI_IMAGES = (
  slug: string,
  folder: string,
  group: string,
  ext: string
) =>
  `https://hachirumi.com/media/manga/${slug}/chapters/${folder}/${group}/${ext}`

/*
 * # Error Methods
 * {Message}. @{Method} on {traceback-able method/function/constants/variables}
 * eg: Failed to parse the response. @getResult on result.
 * ```
 * getResult(){
 * const fetch = //
 * }
 * ```
 */

export const HachirumiInfo: SourceInfo = {
  version: '1.0.0',
  name: 'Hachirumi',
  icon: 'icon.png',
  author: 'Curstantine',
  authorWebsite: 'https://github.com/Curstantine',
  description: 'Extension that pulls manga from Hachirumi.',
  language: LanguageCode.ENGLISH,
  hentaiSource: false,
  websiteBaseURL: HACHIRUMI_DOMAIN,
}

export class Hachirumi extends Source {
  /* 
  Though "mangaId" is mentioned here Hachirumi uses slugs. 
  eg: the-story-about-living
  */
  async getMangaDetails(mangaId: string): Promise<Manga> {
    const methodName = this.getMangaDetails.name

    const request = createRequestObject({
      url: HACHIRUMI_API + '/series/' + mangaId,
      method: 'GET',
      headers: {
        'accept-encoding': 'application/json',
      },
    })

    const response = await this.requestManager.schedule(request, 1)
    if (response.status > 400) {
      throw new Error(
        `Failed to fetch data on ${methodName} with status code: ` +
          response.status
      )
    }

    const result =
      typeof response.data === 'string' || typeof response.data !== 'object'
        ? JSON.parse(response.data)
        : response.data

    if (!result || result === undefined)
      throw new Error(`Failed to parse the response on ${methodName}.`)

    return createManga({
      id: result.slug,
      titles: [result.title],
      image: HACHIRUMI_DOMAIN + result.cover,
      rating: 0, // Rating is not supported by Hachirumi.
      status: MangaStatus.ONGOING,
      artist: result.artist,
      author: result.author,
      desc: result.description,
    })
  }

  /*
  Follows the same format as `getMangaDetails`.
  Hachirumi serves both chapters and manga in single request.
  */
  async getChapters(mangaId: string): Promise<Chapter[]> {
    const methodName: string = this.getChapters.name

    const request = createRequestObject({
      url: HACHIRUMI_API + '/series/' + mangaId,
      method: 'GET',
      headers: {
        'accept-encoding': 'application/json',
      },
    })

    const response = await this.requestManager.schedule(request, 1)
    if (response.status > 400) {
      throw new Error(
        `Failed to fetch data on ${methodName} with status code: ` +
          response.status
      )
    }

    const result =
      typeof response.data === 'string' || typeof response.data !== 'object'
        ? JSON.parse(response.data)
        : response.data

    if (!result || result === undefined)
      throw new Error(`Failed to parse the response on ${methodName}.`)

    const chapterObject = result['chapters']
    const groupObject = result['groups']

    if (!chapterObject || !groupObject)
      throw new Error(`Failed to read chapter/group data on ${methodName}.`)

    let chapters = []
    for (const key in chapterObject) {
      const metadata = chapterObject[key]

      if (!metadata || metadata === undefined)
        throw new Error(`Failed to read metadata on ${methodName}.`)

      for (const groupKey in metadata.groups) {
        const id = chapId(key, groupKey, metadata.folder, result.slug)

        chapters.push(
          createChapter({
            id: id,
            mangaId: result.slug,
            chapNum: chapNum(key, result.slug, id),
            langCode: LanguageCode.ENGLISH,
            name: chapName(metadata.title),
            volume: chapVol(metadata.volume, result.slug, id),
            group: chapGroup(groupObject[groupKey]),
            time: unixToDate(metadata.release_date[groupKey]),
          })
        )
      }
    }
    return chapters
  }

  /*
   * Follows the chapterId format used  in `getChapter` method.
   * `chapterKey|groupKey|folderId`
   */
  async getChapterDetails(
    mangaId: string,
    chapterId: string
  ): Promise<ChapterDetails> {
    const methodName = this.getChapterDetails.name

    const request = createRequestObject({
      url: HACHIRUMI_API + '/series/' + mangaId,
      method: 'GET',
      headers: {
        'accept-encoding': 'application/json',
      },
    })

    const response = await this.requestManager.schedule(request, 1)
    if (response.status > 400) {
      throw new Error(
        `Failed to fetch data on ${methodName} with status code: ` +
          response.status
      )
    }

    const result =
      typeof response.data === 'string' || typeof response.data !== 'object'
        ? JSON.parse(response.data)
        : response.data

    if (!result || result === undefined)
      throw new Error(`Failed to parse the response on ${methodName}.`)

    const [chapterKey, groupKey, folder] = chapterId.split('|') // Splits the given generic chapter id to chapterkey and such.
    if (!chapterKey || !groupKey || !folder)
      throw new Error(`ChapterId is malformed on ${methodName}.`)

    const chapterObject = result.chapters
    if (!chapterObject || chapterObject === undefined)
      throw new Error(`Failed to read chapter data on ${methodName}.`)

    const groupObject = chapterObject[chapterKey].groups[groupKey]
    if (!groupObject || groupObject === undefined)
      throw new Error(`Failed to read chapter metadata on ${methodName}.`)

    return createChapterDetails({
      id: chapterId,
      longStrip: false, // Not implemented.
      mangaId: mangaId,
      pages: groupObject.map((ext: string) =>
        HACHIRUMI_IMAGES(mangaId, folder, groupKey, ext)
      ),
    })
  }

  /*
  This method doesn't query anything, instead finds a specific title from `get_all_series` endpoint
   */
  async searchRequest(
    query: SearchRequest,
    metadata: any
  ): Promise<PagedResults> {
    const methodName = this.searchRequest.name

    if (metadata?.limitReached)
      return createPagedResults({
        results: [],
        metadata: { limitReached: true },
      }) // Prevents title duplication.

    const request = createRequestObject({
      url: HACHIRUMI_API + '/get_all_series',
      method: 'GET',
      headers: {
        'accept-encoding': 'application/json',
      },
    })

    const response = await this.requestManager.schedule(request, 1)
    if (response.status > 400) {
      throw new Error(
        `Failed to fetch data on ${methodName} with status code: ` +
          response.status
      )
    }

    const result =
      typeof response.data === 'string' || typeof response.data !== 'object'
        ? JSON.parse(response.data)
        : response.data

    if (!result || result === undefined)
      throw new Error(`Failed to parse the response on ${methodName}.`)

    const queryTitle: string = query.title ? query.title.toLowerCase() : ''

    const filterer = (titles: object[]) =>
      Object.keys(titles).filter((title) =>
        title.replace('-', ' ').toLowerCase().includes(queryTitle)
      )

    const filteredRequest = filterer(result).map((title) => {
      const metadata = result[title]

      if (!metadata || metadata === undefined)
        throw new Error(`Failed to read chapter metadata on ${methodName}.`)

      return createMangaTile({
        id: metadata.slug,
        image: HACHIRUMI_DOMAIN + metadata.cover,
        title: createIconText({ text: title }),
      })
    })

    return createPagedResults({
      results: filteredRequest,
      metadata: {
        limitReached: true,
      },
    })
  }

  async getAllTitles() {
    const methodName = this.getAllTitles.name

    const request = createRequestObject({
      url: HACHIRUMI_API + '/get_all_series',
      method: 'GET',
      headers: {
        'accept-encoding': 'application/json',
      },
    })

    const response = await this.requestManager.schedule(request, 1)
    if (!response || response === undefined)
      throw new Error(`Failed to fetch data from the server on ${methodName}.`)

    const result =
      typeof response.data === 'string' || typeof response.data !== 'object'
        ? JSON.parse(response.data)
        : response.data

    if (!result || result === undefined)
      throw new Error(`Failed to parse the response on ${methodName}.`)

    return Object.keys(result).map((title) => {
      const metadata = result[title]

      if (!metadata || metadata === undefined)
        throw new Error(`Failed to read chapter metadata on ${methodName}.`)

      return {
        mangaId: metadata.slug,
        title: title,
        author: metadata.author,
        artist: metadata.artist,
        desc: metadata.description,
        cover: metadata.cover,
        group: Object.keys(metadata.groups).map((key) => metadata.groups[key]),
        last: metadata.last_updated,
      }
    })
  }

  async getHomePageSections(
    sectionCallback: (section: HomeSection) => void
  ): Promise<void> {
    const allTitles = await this.getAllTitles()

    // Sorts all titles in descending order using unix timestamp
    // And pops out all of the other results until there's only 3.
    const latestSort = allTitles.sort((a, b) => b.last - a.last)
    while (latestSort.length > 3) latestSort.pop()

    sectionCallback(
      createHomeSection({
        id: 'latest',
        title: 'Latest Updates',
        view_more: true,
        items: latestSort.map((title) =>
          createMangaTile({
            id: title.mangaId,
            image: HACHIRUMI_DOMAIN + title.cover,
            title: createIconText({ text: title.title }),
          })
        ),
      })
    )
  }

  getCloudflareBypassRequest() {
    return createRequestObject({
      url: HACHIRUMI_DOMAIN,
      method: 'GET',
    })
  }
}
