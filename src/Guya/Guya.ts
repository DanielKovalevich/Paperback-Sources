import {
  Source,
  Manga,
  Chapter,
  ChapterDetails,
  HomeSection,
  SearchRequest,
  LanguageCode,
  MangaStatus,
  MangaUpdates,
  PagedResults,
  SourceInfo
} from "paperback-extensions-common"

const GUYA_API_BASE = "https://guya.moe"
const GUYA_SERIES_API_BASE = `${GUYA_API_BASE}/api/series`
const GUYA_ALL_SERIES_API = `${GUYA_API_BASE}/api/get_all_series/`
const GUYA_LANG = "en"
const SPLIT_VAR = "|"

export const GuyaInfo: SourceInfo = {
  version: "1.1.1",
  name: "Guya",
  icon: "icon.png",
  author: "funkyhippo",
  authorWebsite: "https://github.com/funkyhippo",
  description: "Extension that pulls manga from guya.moe",
  language: GUYA_LANG,
  hentaiSource: false,
  websiteBaseURL: GUYA_API_BASE
}

export class Guya extends Source {
  async getMangaDetails(mangaId: string): Promise<Manga> {

    let request = createRequestObject({
      metadata: { mangaId },
      url: GUYA_ALL_SERIES_API,
      method: "GET",
    })

    let response = await this.requestManager.schedule(request, 1)

    let result = typeof response.data === "string" ? JSON.parse(response.data) : response.data

    let mangas = []
    for (let series in result) {
      let seriesDetails = result[series]
      if (mangaId.includes(seriesDetails["slug"])) {
        mangas.push(
          createManga({
            id: seriesDetails["slug"],
            titles: [series],
            image: `${GUYA_API_BASE}/${seriesDetails["cover"]}`,
            rating: 5,
            status: MangaStatus.ONGOING,
            artist: seriesDetails["artist"],
            author: seriesDetails["author"],
            desc: seriesDetails["description"],
          })
        )
      }
    }

    return mangas[0]
  }


  async getChapters(mangaId: string): Promise<Chapter[]> {
    let request = createRequestObject({
      metadata: { mangaId },
      url: `${GUYA_SERIES_API_BASE}/${mangaId}/`,
      method: "GET",
    })

    let response = await this.requestManager.schedule(request, 1)

    let result = typeof response.data === "string" ? JSON.parse(response.data) : response.data
    let rawChapters = result["chapters"]
    let groupMap = result["groups"]

    let chapters = []
    for (let chapter in rawChapters) {
      let chapterMetadata = rawChapters[chapter]
      for (let group in chapterMetadata["groups"]) {
        chapters.push(
          createChapter({
            id: `${chapter}${SPLIT_VAR}${group}`,
            mangaId: mangaId,
            chapNum: Number(chapter),
            langCode: LanguageCode.ENGLISH,
            name: chapterMetadata["title"],
            volume: chapterMetadata["volume"],
            group: groupMap[group],
            time: new Date(
              Number(chapterMetadata["release_date"][group]) * 1000
            ),
          })
        )
      }
    }
    return chapters
  }

  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {

    const request = createRequestObject({
      url: `${GUYA_SERIES_API_BASE}/${mangaId}/`,
      method: "GET",
    })

    const data = await this.requestManager.schedule(request, 1)

    let result = typeof data.data === "string" ? JSON.parse(data.data) : data.data
    let rawChapters = result["chapters"]
    let [chapter, group] = chapterId.split(SPLIT_VAR)
    return createChapterDetails({
      id: chapterId,
      longStrip: false,
      mangaId: mangaId,
      pages: rawChapters[chapter]["groups"][group].map(
        (page: string) =>
          `${GUYA_API_BASE}/media/manga/${mangaId}/chapters/${rawChapters[chapter]["folder"]}/${group}/${page}`
      ),
    })
  }

  async searchRequest(searchQuery: SearchRequest, metadata: any): Promise<PagedResults> {

    const request = createRequestObject({
      url: GUYA_ALL_SERIES_API,
      method: "GET",
    })

    const data = await this.requestManager.schedule(request, 1)

    let result = typeof data.data === "string" ? JSON.parse(data.data) : data.data
    let query = searchQuery.title ?? ''

    let filteredResults = Object.keys(result).filter((e) =>
      e.toLowerCase().includes(query.toLowerCase())
    )

    let tiles = filteredResults.map((series) => {
      let seriesMetadata = result[series]
      return createMangaTile({
        id: seriesMetadata["slug"],
        image: `${GUYA_API_BASE}/${seriesMetadata["cover"]}`,
        title: createIconText({ text: series }),
      })
    })

    return createPagedResults({
      results: tiles
    })
  }

  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {

    // Send the empty homesection back so the app can preload the section
    var homeSection = createHomeSection({ id: "all_guya", title: "ALL GUYA" })
    sectionCallback(homeSection)

    const request = createRequestObject({
      url: GUYA_ALL_SERIES_API,
      method: "GET"
    })

    const data = await this.requestManager.schedule(request, 1)

    let result = typeof data.data === "string" ? JSON.parse(data.data) : data.data

    let mangas = []
    for (let series in result) {
      let seriesDetails = result[series]
      mangas.push(
        createMangaTile({
          id: seriesDetails["slug"],
          image: `${GUYA_API_BASE}/${seriesDetails["cover"]}`,
          title: createIconText({ text: series }),
        })
      )
    }
    homeSection.items = mangas

    sectionCallback(homeSection)
  }

  async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {

    const request = createRequestObject({
      url: GUYA_ALL_SERIES_API,
      method: "GET"
    })

    const data = await this.requestManager.schedule(request, 1)

    let result = typeof data.data === "string" ? JSON.parse(data.data) : data.data

    let foundIds: string[] = []

    for (let series in result) {
      const seriesDetails = result[series]
      const seriesUpdated = new Date(seriesDetails["last_updated"] * 1000)
      const id = seriesDetails["slug"];
        if (seriesUpdated >= time && ids.includes(id)) {
            foundIds.push(id);
        }
    }
    mangaUpdatesFoundCallback(createMangaUpdates({ ids: foundIds }))
  }

  getMangaShareUrl(mangaId: string) {
    return `${GUYA_API_BASE}/read/manga/${mangaId}/`
  }
}
