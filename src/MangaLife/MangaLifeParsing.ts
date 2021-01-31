import { Chapter, ChapterDetails, HomeSection, LanguageCode, Manga, MangaStatus, MangaTile, MangaUpdates, PagedResults, SearchRequest, TagSection } from "paperback-extensions-common"

let ML_IMAGE_DOMAIN = 'https://cover.mangabeast01.com/cover'

export type RegexIdMatch = {
    [id: string]: RegExp
}
export const regex: RegexIdMatch = {
    'hot_update': /vm.HotUpdateJSON = (.*);/, 
    'latest': /vm.LatestJSON = (.*);/, 
    'recommended': /vm.RecommendationJSON = (.*);/, 
    'new_titles': /vm.NewSeriesJSON = (.*);/,
    'chapters': /vm.Chapters = (.*);/,
    'directory': /vm.Directory = (.*);/,
}

export const parseMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
    let json = $('[type=application\\/ld\\+json]').html()?.replace(/\t*\n*/g, '') ?? ''

    // this is only because they added some really jank alternate titles and didn't propely string escape
    let jsonWithoutAlternateName = json.replace(/"alternateName".*?],/g, '')
    let alternateNames = /"alternateName": \[(.*?)\]/.exec(json)?.[1]
      .replace(/\"/g, '')
      .split(',')
    let parsedJson = JSON.parse(jsonWithoutAlternateName)
    let entity = parsedJson.mainEntity
    let info = $('.row')
    let imgSource = $('.ImgHolder').html()?.match(/src="(.*)\//)?.[1] ?? ML_IMAGE_DOMAIN
    if (imgSource !== ML_IMAGE_DOMAIN)
      ML_IMAGE_DOMAIN = imgSource
    let image = `${ML_IMAGE_DOMAIN}/${mangaId}.jpg`
    let title = $('h1', info).first().text() ?? ''
    let titles = [title]
    let author = entity.author[0]
    titles = titles.concat(alternateNames ?? '')
    let follows = Number($.root().html()?.match(/vm.NumSubs = (.*);/)?.[1])

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

export const parseChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
    let chapterJS: any[] = JSON.parse($.root().html()?.match(regex['chapters'])?.[1] ?? '').reverse()
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

    return chapters;
}

export const parseChapterDetails = ({ data }: any, mangaId: string, chapterId: string): ChapterDetails => {
    let pages: string[] = []
    let pathName = JSON.parse(data.match(/vm.CurPathName = (.*);/)?.[1])
    let chapterInfo = JSON.parse(data.match(/vm.CurChapter = (.*);/)?.[1])
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

export const parseUpdatedManga = ({ data }: any, time: Date, ids: string[]): MangaUpdates => {
    const returnObject: MangaUpdates = {
        'ids': []
    }
    const updateManga = JSON.parse(data.match(regex['latest'])?.[1])
    for (const elem of updateManga) {
        if (ids.includes(elem.IndexName) && time < new Date(elem.Date)) returnObject.ids.push(elem.IndexName)
    }
    return returnObject;
}

export const searchMetadata = (query: SearchRequest) => {
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

    return {
      'keyword': query.title,
      'author': query.author || query.artist || '',
      'status': status,
      'type': query.includeFormat,
      'genre': genre,
      'genreNo': genreNo
    }
}

export const parseSearch = ($: CheerioStatic, { data }: any, metadata: any): PagedResults => {
    let mangaTiles: MangaTile[] = []
    let directory = JSON.parse(data.match(regex['directory'])?.[1])

    let imgSource = $('.img-fluid').first().attr('src')?.match(/(.*cover)/)?.[1] ?? ML_IMAGE_DOMAIN
    if (imgSource !== ML_IMAGE_DOMAIN)
      ML_IMAGE_DOMAIN = imgSource

    for (const elem of directory)  {
      let mKeyword: boolean = typeof metadata.keyword !== 'undefined' ? false : true
      let mAuthor: boolean = metadata.author !== '' ? false : true
      let mStatus: boolean = metadata.status !== '' ? false : true
      let mType: boolean = typeof metadata.type !== 'undefined' && metadata.type.length > 0 ? false : true
      let mGenre: boolean = typeof metadata.genre !== 'undefined' && metadata.genre.length > 0 ? false : true
      let mGenreNo: boolean = typeof metadata.genreNo !== 'undefined' ? true : false
      if (!mKeyword) {
        let allWords: string[] = [elem.s.toLowerCase()].concat(elem.al.map((e: string) => e.toLowerCase()))
        mKeyword = allWords.filter(key => key.includes(metadata.keyword.toLowerCase())).length > 0
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
    }

    // This source parses JSON and never requires additional pages
    return createPagedResults({
      results: mangaTiles
    })
}

export const parseTags = ({ data }: any): TagSection[] => {
    let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
    createTagSection({ id: '1', label: 'format', tags: [] })]
    let genres = JSON.parse(data.match(/"Genre"\s*: (.*)/)?.[1].replace(/'/g, "\""))
    let typesHTML = data.match(/"Type"\s*: (.*),/g)?.[1]
    let types = JSON.parse(typesHTML.match(/(\[.*\])/)?.[1].replace(/'/g, "\""))
    tagSections[0].tags = genres.map((e: any) => createTag({ id: e, label: e }))
    tagSections[1].tags = types.map((e: any) => createTag({ id: e, label: e }))
    return tagSections
}



export const parseHomeSections = ($: CheerioStatic, { data }: any, sectionCallback: (section: HomeSection) => void): void => {
    const hotSection = createHomeSection({ id: 'hot_update', title: 'HOT UPDATES', view_more: true })
    const latestSection = createHomeSection({ id: 'latest', title: 'LATEST UPDATES', view_more: true })
    const newTitlesSection = createHomeSection({ id: 'new_titles', title: 'NEW TITLES', view_more: true })
    const recommendedSection = createHomeSection({ id: 'recommended', title: 'RECOMMENDATIONS', view_more: true })

    const hot = JSON.parse((data.match(regex[hotSection.id])?.[1])).slice(0, 15)
    const latest = JSON.parse((data.match(regex[latestSection.id])?.[1])).slice(0, 15)
    const newTitles = JSON.parse((data.match(regex[newTitlesSection.id]))?.[1]).slice(0, 15)
    const recommended = JSON.parse((data.match(regex[recommendedSection.id])?.[1]))

    const sections = [hotSection, latestSection, newTitlesSection, recommendedSection]
    const sectionData = [hot, latest, newTitles, recommended]

    let imgSource = $('.ImageHolder').html()?.match(/ng-src="(.*)\//)?.[1] ?? ML_IMAGE_DOMAIN
    if (imgSource !== ML_IMAGE_DOMAIN)
      ML_IMAGE_DOMAIN = imgSource

    for (const [i, section] of sections.entries()) {
        sectionCallback(section)
        const manga: MangaTile[] = []
        for (const elem of sectionData[i]) {
          const id = elem.IndexName
          const title = elem.SeriesName
          const image = `${ML_IMAGE_DOMAIN}/${id}.jpg`
          let time = (new Date(elem.Date)).toDateString()
          time = time.slice(0, time.length - 5)
          time = time.slice(4, time.length)
          manga.push(createMangaTile({
              id,
              image,
              title: createIconText({ text: title }),
              secondaryText: createIconText({ text: time, icon: 'clock.fill' })
          }))
        }
        section.items = manga
        sectionCallback(section)
    }
}

export const parseViewMore = ({ data }: any, homepageSectionId: string): PagedResults | null => {
    const manga: MangaTile[] = []
    const mangaIds: Set<string> = new Set<string>()

    if (!regex[homepageSectionId]) return null
    const items = JSON.parse((data.match(regex[homepageSectionId]))?.[1])
    for (const item of items) {
        const id = item.IndexName
        if (!mangaIds.has(id)) {
            const title = item.SeriesName
            const image = `${ML_IMAGE_DOMAIN}/${id}.jpg`
            let time = (new Date(item.Date)).toDateString()
            time = time.slice(0, time.length - 5)
            time = time.slice(4, time.length)

            manga.push(createMangaTile({
                id,
                image,
                title: createIconText({ text: title }),
                secondaryText: homepageSectionId !== 'new_titles' ? createIconText({ text: time, icon: 'clock.fill' }) : undefined
            }))
            mangaIds.add(id)
        }
    }

    // This source parses JSON and never requires additional pages
    return createPagedResults({
      results: Array.from(manga)
    })
}