import { Source } from '../Source'
import { Manga, MangaStatus } from '../../models/Manga/Manga'
import { Chapter } from '../../models/Chapter/Chapter'
import { MangaTile } from '../../models/MangaTile/MangaTile'
import { SearchRequest } from '../../models/SearchRequest/SearchRequest'
import { Request } from '../../models/RequestObject/RequestObject'
import { ChapterDetails } from '../../models/ChapterDetails/ChapterDetails'
import { Tag, TagSection } from '../../models/TagSection/TagSection'
import { HomeSection, HomeSectionRequest } from '../../models/HomeSection/HomeSection'
import { LanguageCode } from '../../models/Languages/Languages'

const ML_DOMAIN = 'https://manga4life.com'

export class MangaLife extends Source {
  constructor(cheerio: CheerioAPI) {
    super(cheerio)
  }

  get version(): string { return '0.5.4' }
  get name(): string { return 'Manga4Life' }
  get icon(): string { return 'icon.png' }
  get author(): string { return 'Daniel Kovalevich' }
  get authorWebsite(): string { return 'https://github.com/DanielKovalevich' }
  get description(): string { return 'Extension that pulls manga from MangaLife, includes Advanced Search and Updated manga fetching' }
  get hentaiSource(): boolean { return false }

  getMangaDetailsRequest(ids: string[]): Request[] {
    let requests: Request[] = []
    for (let id of ids) {
      let metadata = { 'id': id }
      requests.push(createRequestObject({
        url: `${ML_DOMAIN}/manga/`,
        metadata: metadata,
        method: 'GET',
        param: id
      }))
    }
    return requests
  }

  getMangaDetails(data: any, metadata: any): Manga[] {
    let manga: Manga[] = []
    let $ = this.cheerio.load(data)
    let json = JSON.parse($('[type=application\\/ld\\+json]').html()?.replace(/\t*\n*/g, '') ?? '')
    let entity = json.mainEntity
    let info = $('.row')
    let image = `https://static.mangaboss.net/cover/${metadata.id}.jpg`
    let title = $('h1', info).first().text() ?? ''
    let titles = [title]
    let author = entity.author[0]
    titles = titles.concat(entity.alternateName)
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

    manga.push(createManga({
      id: metadata.id,
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
    }))
    return manga
  }

  getChaptersRequest(mangaId: string): Request {
    let metadata = { 'id': mangaId }
    return createRequestObject({
      url: `${ML_DOMAIN}/manga/`,
      method: "GET",
      metadata: metadata,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      param: mangaId
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    let $ = this.cheerio.load(data)
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
      let id = metadata.id + '-chapter-' + n + m + index + '.html'
      let chNum = n + a * .1
      let name = elem.ChapterName ? elem.ChapterName : '' // can be null
      let time = new Date(elem.Date)

      chapters.push(createChapter({
        id: id,
        mangaId: metadata.id,
        name: name,
        chapNum: chNum,
        volume: vol,
        langCode: LanguageCode.ENGLISH,
        time: time
      }))
    })

    return chapters
  }

  getChapterDetailsRequest(mangaId: string, chapId: string): Request {
    let metadata = { 'mangaId': mangaId, 'chapterId': chapId, 'nextPage': false, 'page': 1 }
    return createRequestObject({
      url: `${ML_DOMAIN}/read-online/`,
      metadata: metadata,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      method: 'GET',
      param: chapId
    })
  }

  getChapterDetails(data: any, metadata: any): ChapterDetails {
    let pages: string[] = []
    let pathName = JSON.parse((data.match(/vm.CurPathName = (.*);/) ?? [])[1])
    let chapterInfo = JSON.parse((data.match(/vm.CurChapter = (.*);/) ?? [])[1])
    let pageNum = Number(chapterInfo.Page)

    let chapter = chapterInfo.Chapter.slice(1, -1)
    let odd = chapterInfo.Chapter[chapterInfo.Chapter.length - 1]
    let chapterImage = odd == 0 ? chapter : chapter + '.' + odd

    for (let i = 0; i < pageNum; i++) {
      let s = '000' + (i + 1)
      let page = s.substr(s.length - 3)
      pages.push(`https://${pathName}/manga/${metadata.mangaId}/${chapterInfo.Directory == '' ? '' : chapterInfo.Directory + '/'}${chapterImage}-${page}.png`)
    }

    let chapterDetails = createChapterDetails({
      id: metadata.chapterId,
      mangaId: metadata.mangaId,
      pages, longStrip: false
    })

    return chapterDetails
  }

  filterUpdatedMangaRequest(ids: any, time: Date, page: number): Request {
    let metadata = { 'ids': ids, 'referenceTime': time }
    return createRequestObject({
      url: `${ML_DOMAIN}/`,
      metadata: metadata,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      method: "GET"
    })
  }

  filterUpdatedManga(data: any, metadata: any): { 'updatedMangaIds': string[], 'nextPage': boolean } {
    let $ = this.cheerio.load(data)
    let returnObject: { 'updatedMangaIds': string[], 'nextPage': boolean } = {
      'updatedMangaIds': [],
      'nextPage': false
    }
    let updateManga = JSON.parse((data.match(/vm.LatestJSON = (.*);/) ?? [])[1])
    updateManga.forEach((elem: any) => {
      if (metadata.ids.includes(elem.IndexName) && metadata.referenceTime < new Date(elem.Date)) returnObject.updatedMangaIds.push(elem.IndexName)
    })

    return returnObject
  }

  searchRequest(query: SearchRequest, page: number): Request | null {
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

    return createRequestObject({
      url: `${ML_DOMAIN}/search/`,
      metadata: metadata,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      method: "GET"
    })
  }

  search(data: any, metadata: any): MangaTile[] | null {
    let $ = this.cheerio.load(data)
    let mangaTiles: MangaTile[] = []
    let directory = JSON.parse((data.match(/vm.Directory = (.*);/) ?? [])[1])

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
          image: `https://static.mangaboss.net/cover/${elem.i}.jpg`,
          subtitleText: createIconText({ text: elem.ss })
        }))
      }
    })

    return mangaTiles
  }

  getTagsRequest(): Request | null {
    return createRequestObject({
      url: `${ML_DOMAIN}/search/`,
      method: 'GET',
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      }
    })
  }

  getTags(data: any): TagSection[] | null {
    let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
    createTagSection({ id: '1', label: 'format', tags: [] })]
    let genres = JSON.parse((data.match(/"Genre"\s*: (.*)/) ?? [])[1].replace(/'/g, "\""))
    let typesHTML = (data.match(/"Type"\s*: (.*),/g) ?? [])[1]
    let types = JSON.parse((typesHTML.match(/(\[.*\])/) ?? [])[1].replace(/'/g, "\""))
    tagSections[0].tags = genres.map((e: any) => createTag({ id: e, label: e }))
    tagSections[1].tags = types.map((e: any) => createTag({ id: e, label: e }))
    return tagSections
  }

  getHomePageSectionRequest(): HomeSectionRequest[] | null {
    let request = createRequestObject({ url: `${ML_DOMAIN}`, method: 'GET' })
    let section1 = createHomeSection({ id: 'hot_update', title: 'HOT UPDATES' })
    let section2 = createHomeSection({ id: 'latest', title: 'LATEST UPDATES' })
    let section3 = createHomeSection({ id: 'new_titles', title: 'NEW TITLES' })
    let section4 = createHomeSection({ id: 'recommended', title: 'RECOMMENDATIONS' })

    return [createHomeSectionRequest({ request: request, sections: [section1, section2, section3, section4] })]
  }

  getHomePageSections(data: any, sections: HomeSection[]): HomeSection[] {
    let hot = (JSON.parse((data.match(/vm.HotUpdateJSON = (.*);/) ?? [])[1])).slice(0, 15)
    let latest = (JSON.parse((data.match(/vm.LatestJSON = (.*);/) ?? [])[1])).slice(0, 15)
    let newTitles = (JSON.parse((data.match(/vm.NewSeriesJSON = (.*);/) ?? [])[1])).slice(0, 15)
    let recommended = JSON.parse((data.match(/vm.RecommendationJSON = (.*);/) ?? [])[1])

    let hotManga: MangaTile[] = []
    hot.forEach((elem: any) => {
      let id = elem.IndexName
      let title = elem.SeriesName
      let image = `https://static.mangaboss.net/cover/${id}.jpg`
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

    let latestManga: MangaTile[] = []
    latest.forEach((elem: any) => {
      let id = elem.IndexName
      let title = elem.SeriesName
      let image = `https://static.mangaboss.net/cover/${id}.jpg`
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

    let newManga: MangaTile[] = []
    newTitles.forEach((elem: any) => {
      let id = elem.IndexName
      let title = elem.SeriesName
      let image = `https://static.mangaboss.net/cover/${id}.jpg`

      newManga.push(createMangaTile({
        id: id,
        image: image,
        title: createIconText({ text: title })
      }))
    })

    let recManga: MangaTile[] = []
    recommended.forEach((elem: any) => {
      let id = elem.IndexName
      let title = elem.SeriesName
      let image = `https://static.mangaboss.net/cover/${id}.jpg`
      let time = (new Date(elem.Date)).toDateString()

      recManga.push(createMangaTile({
        id: id,
        image: image,
        title: createIconText({ text: title })
      }))
    })

    sections[0].items = hotManga
    sections[1].items = latestManga
    sections[2].items = newManga
    sections[3].items = recManga
    return sections
  }


  getViewMoreRequest(key: string, page: number): Request | null {
    return createRequestObject({
      url: ML_DOMAIN,
      method: 'GET'
    })
  }

  getViewMoreItems(data: any, key: string): MangaTile[] | null {
    let manga: MangaTile[] = []
    if (key == 'hot_update') {
      let hot = JSON.parse((data.match(/vm.HotUpdateJSON = (.*);/) ?? [])[1])
      hot.forEach((elem: any) => {
        let id = elem.IndexName
        let title = elem.SeriesName
        let image = `https://static.mangaboss.net/cover/${id}.jpg`
        let time = (new Date(elem.Date)).toDateString()
        time = time.slice(0, time.length - 5)
        time = time.slice(4, time.length)

        manga.push(createMangaTile({
          id: id,
          image: image,
          title: createIconText({ text: title }),
          secondaryText: createIconText({ text: time, icon: 'clock.fill' })
        }))
      })
    }
    else if (key == 'latest') {
      let latest = JSON.parse((data.match(/vm.LatestJSON = (.*);/) ?? [])[1])
      latest.forEach((elem: any) => {
        let id = elem.IndexName
        let title = elem.SeriesName
        let image = `https://static.mangaboss.net/cover/${id}.jpg`
        let time = (new Date(elem.Date)).toDateString()
        time = time.slice(0, time.length - 5)
        time = time.slice(4, time.length)

        manga.push(createMangaTile({
          id: id,
          image: image,
          title: createIconText({ text: title }),
          secondaryText: createIconText({ text: time, icon: 'clock.fill' })
        }))
      })
    }
    else if (key == 'new_titles') {
      let newTitles = JSON.parse((data.match(/vm.NewSeriesJSON = (.*);/) ?? [])[1])
      newTitles.forEach((elem: any) => {
        let id = elem.IndexName
        let title = elem.SeriesName
        let image = `https://static.mangaboss.net/cover/${id}.jpg`
        let time = (new Date(elem.Date)).toDateString()
        time = time.slice(0, time.length - 5)
        time = time.slice(4, time.length)

        manga.push(createMangaTile({
          id: id,
          image: image,
          title: createIconText({ text: title })
        }))
      })
    }
    else return null
    return manga
  }
}