import {
  Source,
  Manga,
  MangaStatus,
  Chapter,
  ChapterDetails,
  HomeSection,
  MangaTile,
  SearchRequest,
  LanguageCode,
  TagSection,
  PagedResults,
  SourceInfo,
  MangaUpdates,
  TagType
} from "paperback-extensions-common"

const ML_DOMAIN = 'https://manga4life.com'
let ML_IMAGE_DOMAIN = 'https://cover.mangabeast01.com/cover'

export const MangaLifeInfo: SourceInfo = {
  version: '1.1.4',
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
      method: 'GET',
      param: mangaId
    })

    const data = await this.requestManager.schedule(request, 1)

    let $ = this.cheerio.load(data.data)
    let json = $('[type=application\\/ld\\+json]').html()?.replace(/\t*\n*/g, '') ?? ''

    // this is only because they added some really jank alternate titles and didn't propely string escape
    let jsonWithoutAlternateName = json.replace(/"alternateName".*?],/g, '')
    let alternateNames = (/"alternateName": \[(.*?)\]/.exec(json) ?? [])[1]
      .replace(/\"/g, '')
      .split(',')
    let parsedJson = JSON.parse(jsonWithoutAlternateName)
    let entity = parsedJson.mainEntity
    let info = $('.row')
    let imgSource = ($('.ImgHolder').html()?.match(/src="(.*)\//) ?? [])[1]
    if (imgSource !== ML_IMAGE_DOMAIN)
      ML_IMAGE_DOMAIN = imgSource
    let image = `${ML_IMAGE_DOMAIN}/${mangaId}.jpg`
    let title = $('h1', info).first().text() ?? ''
    let titles = [title]
    let author = entity.author[0]
    titles = titles.concat(alternateNames)
    let follows = Number(($.root().html()?.match(/vm.NumSubs = (.*);/) ?? [])[1])

    let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
    createTagSection({ id: '1', label: 'format', tags: [] })]
    tagSections[0].tags = entity.genre.map((elem: string) => createTag({ id: elem, label: elem }))
    let update = entity.dateModified

    let status = MangaStatus.ONGOING
    let summary = ''
    let hentai = entity.genre.includes('Hentai') || entity.genre.includes('Adult')

    let details = $('.list-group', info)
    for (let row of $('li', details).toArray()) {
      let text = $('.mlabel', row).text()
      switch (text) {
        case 'Type:': {
          let type = $('a', row).text()
          tagSections[1].tags.push(createTag({ id: type.trim(), label: type.trim() }))
          break
        }
        case 'Status:': {
          status = $(row).text().includes('Ongoing') ? MangaStatus.ONGOING : MangaStatus.COMPLETED
          break
        }
        case 'Description:': {
          summary = $('div', row).text().trim()
          break
        }
      }
    }

    return createManga({
      id: mangaId,
      titles: titles,
      image: image,
      rating: 0,
      status: status,
      author: author,
      tags: tagSections,
      desc: summary,
      hentai: hentai,
      follows: follows,
      lastUpdate: update
    })
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    const request = createRequestObject({
      url: `${ML_DOMAIN}/manga/`,
      method: "GET",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      param: mangaId
    })

    const data = await this.requestManager.schedule(request, 1)

    const $ = this.cheerio.load(data.data)
    let chapterJS: any[] = JSON.parse(($.root().html()?.match(/vm.Chapters = (.*);/) ?? [])[1]).reverse()
    let chapters: Chapter[] = []
    // following the url encoding that the website uses, same variables too
    chapterJS.forEach((elem: any) => {
      let chapterCode: string = elem.Chapter
      let vol = Number(chapterCode.substring(0, 1))
      let index = vol != 1 ? '-index-' + vol : ''
      let n = parseInt(chapterCode.slice(1, -1))
      let a = Number(chapterCode[chapterCode.length - 1])
      let m = a != 0 ? '.' + a : ''
      let id = mangaId + '-chapter-' + n + m + index + '.html'
      let chNum = n + a * .1
      let name = elem.ChapterName ? elem.ChapterName : '' // can be null

      let timeStr = elem.Date.replace(/-/g, "/")
      let time = new Date(timeStr)

      chapters.push(createChapter({
        id: id,
        mangaId: mangaId,
        name: name,
        chapNum: chNum,
        volume: vol,
        langCode: LanguageCode.ENGLISH,
        time: time
      }))
    })

    return chapters
  }

  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    const request = createRequestObject({
      url: `${ML_DOMAIN}/read-online/`,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      method: 'GET',
      param: chapterId
    })

    const data = await this.requestManager.schedule(request, 1)

    let pages: string[] = []
    let pathName = JSON.parse((data.data.match(/vm.CurPathName = (.*);/) ?? [])[1])
    let chapterInfo = JSON.parse((data.data.match(/vm.CurChapter = (.*);/) ?? [])[1])
    let pageNum = Number(chapterInfo.Page)

    let chapter = chapterInfo.Chapter.slice(1, -1)
    let odd = chapterInfo.Chapter[chapterInfo.Chapter.length - 1]
    let chapterImage = odd == 0 ? chapter : chapter + '.' + odd

    for (let i = 0; i < pageNum; i++) {
      let s = '000' + (i + 1)
      let page = s.substr(s.length - 3)
      pages.push(`https://${pathName}/manga/${mangaId}/${chapterInfo.Directory == '' ? '' : chapterInfo.Directory + '/'}${chapterImage}-${page}.png`)
    }

    let chapterDetails = createChapterDetails({
      id: chapterId,
      mangaId: mangaId,
      pages, longStrip: false
    })

    return chapterDetails
  }

  async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
    const request = createRequestObject({
      url: `${ML_DOMAIN}/`,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      method: "GET"
    })

    const data = await this.requestManager.schedule(request, 1)

    const returnObject: MangaUpdates = {
      'ids': []
    }
    const updateManga = JSON.parse((data.data.match(/vm.LatestJSON = (.*);/) ?? [])[1])
    updateManga.forEach((elem: any) => {
      if (ids.includes(elem.IndexName) && time < new Date(elem.Date)) returnObject.ids.push(elem.IndexName)
    })

    mangaUpdatesFoundCallback(createMangaUpdates(returnObject))
  }

  async searchRequest(query: SearchRequest, _metadata: any): Promise<PagedResults> {
    let status = ""
    switch (query.status) {
      case 0: status = 'Completed'; break
      case 1: status = 'Ongoing'; break
      default: status = ''
    }

    let genre: string[] | undefined = query.includeGenre ?
      (query.includeDemographic ? query.includeGenre.concat(query.includeDemographic) : query.includeGenre) :
      query.includeDemographic
    let genreNo: string[] | undefined = query.excludeGenre ?
      (query.excludeDemographic ? query.excludeGenre.concat(query.excludeDemographic) : query.excludeGenre) :
      query.excludeDemographic

    let metadata: any = {
      'keyword': query.title,
      'author': query.author || query.artist || '',
      'status': status,
      'type': query.includeFormat,
      'genre': genre,
      'genreNo': genreNo
    }

    const request = createRequestObject({
      url: `${ML_DOMAIN}/search/`,
      metadata: metadata,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      method: "GET"
    })

    const data = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(data.data)
    let mangaTiles: MangaTile[] = []
    let directory = JSON.parse((data.data.match(/vm.Directory = (.*);/) ?? [])[1])

    let imgSource = ($('.img-fluid').first().attr('src')?.match(/(.*cover)/) ?? [])[1]
    if (imgSource !== ML_IMAGE_DOMAIN)
      ML_IMAGE_DOMAIN = imgSource

    directory.forEach((elem: any) => {
      let mKeyword: boolean = typeof metadata.keyword !== 'undefined' ? false : true
      let mAuthor: boolean = metadata.author !== '' ? false : true
      let mStatus: boolean = metadata.status !== '' ? false : true
      let mType: boolean = typeof metadata.type !== 'undefined' && metadata.type.length > 0 ? false : true
      let mGenre: boolean = typeof metadata.genre !== 'undefined' && metadata.genre.length > 0 ? false : true
      let mGenreNo: boolean = typeof metadata.genreNo !== 'undefined' ? true : false

      if (!mKeyword) {
        let allWords: string[] = [elem.s.toLowerCase()].concat(elem.al.map((e: string) => e.toLowerCase()))
        allWords.forEach((key: string) => {
          if (key.includes(metadata.keyword.toLowerCase())) mKeyword = true
        })
      }

      if (!mAuthor) {
        let authors: string[] = elem.a.map((e: string) => e.toLowerCase())
        if (authors.includes(metadata.author.toLowerCase())) mAuthor = true
      }

      if (!mStatus) {
        if ((elem.ss == 'Ongoing' && metadata.status == 'Ongoing') || (elem.ss != 'Ongoing' && metadata.ss != 'Ongoing')) mStatus = true
      }

      if (!mType) mType = metadata.type.includes(elem.t)
      if (!mGenre) mGenre = metadata.genre.every((i: string) => elem.g.includes(i))
      if (mGenreNo) mGenreNo = metadata.genreNo.every((i: string) => elem.g.includes(i))

      if (mKeyword && mAuthor && mStatus && mType && mGenre && !mGenreNo) {
        mangaTiles.push(createMangaTile({
          id: elem.i,
          title: createIconText({ text: elem.s }),
          image: `${ML_IMAGE_DOMAIN}/${elem.i}.jpg`,
          subtitleText: createIconText({ text: elem.ss })
        }))
      }
    })

    // This source parses JSON and never requires additional pages
    return createPagedResults({
      results: mangaTiles
    })
  }

  async getTags(): Promise<TagSection[] | null> {
    const request = createRequestObject({
      url: `${ML_DOMAIN}/search/`,
      method: 'GET',
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      }
    })

    const data = await this.requestManager.schedule(request, 1)
    let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
    createTagSection({ id: '1', label: 'format', tags: [] })]
    let genres = JSON.parse((data.data.match(/"Genre"\s*: (.*)/) ?? [])[1].replace(/'/g, "\""))
    let typesHTML = (data.data.match(/"Type"\s*: (.*),/g) ?? [])[1]
    let types = JSON.parse((typesHTML.match(/(\[.*\])/) ?? [])[1].replace(/'/g, "\""))
    tagSections[0].tags = genres.map((e: any) => createTag({ id: e, label: e }))
    tagSections[1].tags = types.map((e: any) => createTag({ id: e, label: e }))
    return tagSections
  }

  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    const request = createRequestObject({
      url: `${ML_DOMAIN}`,
      method: 'GET'
    })

    const data = await this.requestManager.schedule(request, 1)

    const hotSection = createHomeSection({ id: 'hot_update', title: 'HOT UPDATES', view_more: true })
    const latestSection = createHomeSection({ id: 'latest', title: 'LATEST UPDATES', view_more: true })
    const newTitlesSection = createHomeSection({ id: 'new_titles', title: 'NEW TITLES', view_more: true })
    const recommendedSection = createHomeSection({ id: 'recommended', title: 'RECOMMENDATIONS', view_more: true })
    sectionCallback(hotSection)
    sectionCallback(latestSection)
    sectionCallback(newTitlesSection)
    sectionCallback(recommendedSection)

    const $ = this.cheerio.load(data.data)
    const hot = (JSON.parse((data.data.match(/vm.HotUpdateJSON = (.*);/) ?? [])[1])).slice(0, 15)
    const latest = (JSON.parse((data.data.match(/vm.LatestJSON = (.*);/) ?? [])[1])).slice(0, 15)
    const newTitles = (JSON.parse((data.data.match(/vm.NewSeriesJSON = (.*);/) ?? [])[1])).slice(0, 15)
    const recommended = JSON.parse((data.data.match(/vm.RecommendationJSON = (.*);/) ?? [])[1])

    let imgSource = ($('.ImageHolder').html()?.match(/ng-src="(.*)\//) ?? [])[1]
    if (imgSource !== ML_IMAGE_DOMAIN)
      ML_IMAGE_DOMAIN = imgSource

    let hotManga: MangaTile[] = []
    hot.forEach((elem: any) => {
      let id = elem.IndexName
      let title = elem.SeriesName
      let image = `${ML_IMAGE_DOMAIN}/${id}.jpg`
      let time = (new Date(elem.Date)).toDateString()
      time = time.slice(0, time.length - 5)
      time = time.slice(4, time.length)

      hotManga.push(createMangaTile({
        id: id,
        image: image,
        title: createIconText({ text: title }),
        secondaryText: createIconText({ text: time, icon: 'clock.fill' })
      }))
    })
    hotSection.items = hotManga
    sectionCallback(hotSection)

    let latestManga: MangaTile[] = []
    latest.forEach((elem: any) => {
      let id = elem.IndexName
      let title = elem.SeriesName
      let image = `${ML_IMAGE_DOMAIN}/${id}.jpg`
      let time = (new Date(elem.Date)).toDateString()
      time = time.slice(0, time.length - 5)
      time = time.slice(4, time.length)

      latestManga.push(createMangaTile({
        id: id,
        image: image,
        title: createIconText({ text: title }),
        secondaryText: createIconText({ text: time, icon: 'clock.fill' })
      }))
    })
    latestSection.items = latestManga
    sectionCallback(latestSection)

    let newManga: MangaTile[] = []
    newTitles.forEach((elem: any) => {
      let id = elem.IndexName
      let title = elem.SeriesName
      let image = `${ML_IMAGE_DOMAIN}/${id}.jpg`

      newManga.push(createMangaTile({
        id: id,
        image: image,
        title: createIconText({ text: title })
      }))
    })
    newTitlesSection.items = newManga
    sectionCallback(newTitlesSection)

    let recManga: MangaTile[] = []
    recommended.forEach((elem: any) => {
      let id = elem.IndexName
      let title = elem.SeriesName
      let image = `${ML_IMAGE_DOMAIN}/${id}.jpg`
      let time = (new Date(elem.Date)).toDateString()

      recManga.push(createMangaTile({
        id: id,
        image: image,
        title: createIconText({ text: title })
      }))
    })

    recommendedSection.items = recManga
    sectionCallback(recommendedSection)
  }

  async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
    const request = createRequestObject({
      url: ML_DOMAIN,
      method: 'GET'
    })

    const data = await this.requestManager.schedule(request, 1)
    //let manga: MangaTile[] = []
    let manga: Set<MangaTile> = new Set<MangaTile>()
    if (homepageSectionId == 'hot_update') {
      let hot = JSON.parse((data.data.match(/vm.HotUpdateJSON = (.*);/) ?? [])[1]).slice(15)
      hot.forEach((elem: any) => {
        let id = elem.IndexName
        let title = elem.SeriesName
        let image = `${ML_IMAGE_DOMAIN}/${id}.jpg`
        let time = (new Date(elem.Date)).toDateString()
        time = time.slice(0, time.length - 5)
        time = time.slice(4, time.length)

        manga.add(createMangaTile({
          id: id,
          image: image,
          title: createIconText({ text: title }),
          secondaryText: createIconText({ text: time, icon: 'clock.fill' })
        }))
      })
    }
    else if (homepageSectionId == 'latest') {
      let latest = JSON.parse((data.data.match(/vm.LatestJSON = (.*);/) ?? [])[1]).slice(15)
      latest.forEach((elem: any) => {
        let id = elem.IndexName
        let title = elem.SeriesName
        let image = `${ML_IMAGE_DOMAIN}/${id}.jpg`
        let time = (new Date(elem.Date)).toDateString()
        time = time.slice(0, time.length - 5)
        time = time.slice(4, time.length)

        manga.add(createMangaTile({
          id: id,
          image: image,
          title: createIconText({ text: title }),
          secondaryText: createIconText({ text: time, icon: 'clock.fill' })
        }))
      })
    }
    else if (homepageSectionId == 'recommended') {
      let latest = JSON.parse((data.data.match(/vm.RecommendationJSON = (.*);/) ?? [])[1])
      latest.forEach((elem: any) => {
        let id = elem.IndexName
        let title = elem.SeriesName
        let image = `${ML_IMAGE_DOMAIN}/${id}.jpg`
        let time = (new Date(elem.Date)).toDateString()
        time = time.slice(0, time.length - 5)
        time = time.slice(4, time.length)

        manga.add(createMangaTile({
          id: id,
          image: image,
          title: createIconText({ text: title }),
          secondaryText: createIconText({ text: time, icon: 'clock.fill' })
        }))
      })
    }
    else if (homepageSectionId == 'new_titles') {
      let newTitles = JSON.parse((data.data.match(/vm.NewSeriesJSON = (.*);/) ?? [])[1]).slice(15)
      newTitles.forEach((elem: any) => {
        let id = elem.IndexName
        let title = elem.SeriesName
        let image = `${ML_IMAGE_DOMAIN}/${id}.jpg`
        let time = (new Date(elem.Date)).toDateString()
        time = time.slice(0, time.length - 5)
        time = time.slice(4, time.length)

        manga.add(createMangaTile({
          id: id,
          image: image,
          title: createIconText({ text: title })
        }))
      })
    }
    else return null

    // This source parses JSON and never requires additional pages
    return createPagedResults({
      results: Array.from(manga)
    })
  }
}