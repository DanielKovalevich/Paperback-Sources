import { Chapter, ChapterDetails, HomeSection, LanguageCode, Manga, MangaStatus, MangaTile, MangaUpdates, PagedResults, SearchRequest, TagSection } from "paperback-extensions-common"

let MS_IMAGE_DOMAIN = 'https://cover.mangabeast01.com/cover'

export type RegexIdMatch = {
    [id: string]: RegExp
}
export const regex: RegexIdMatch = {
    'hot_update': /vm.HotUpdateJSON = (.*);/,
    'latest': /vm.LatestJSON = (.*);/,
    'recommended': /vm.RecommendationJSON = (.*);/,
    'new_titles': /vm.NewSeriesJSON = (.*);/,
    'chapters': /vm.Chapters = (.*);/,
    'directory': /vm.FullDirectory = (.*);/,
    'directory_image_host': /<img ng-src=\"(.*)\//
}

export const parseMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
    const json = $('[type=application\\/ld\\+json]').html()?.replace(/\t*\n*/g, '') ?? ''

    // this is only because they added some really jank alternate titles and didn't propely string escape
    const jsonWithoutAlternateName = json.replace(/"alternateName".*?],/g, '')
    const alternateNames = /"alternateName": \[(.*?)\]/.exec(json)?.[1]
      .replace(/\"/g, '')
      .split(',')
    const parsedJson = JSON.parse(jsonWithoutAlternateName)
    const entity = parsedJson.mainEntity
    const info = $('.row')
    const imgSource = $('.ImgHolder').html()?.match(/src="(.*)\//)?.[1] ?? MS_IMAGE_DOMAIN
    if (imgSource !== MS_IMAGE_DOMAIN)
      MS_IMAGE_DOMAIN = imgSource
    const image = `${MS_IMAGE_DOMAIN}/${mangaId}.jpg`
    const title = $('h1', info).first().text() ?? ''
    let titles = [title]
    const author = entity.author[0]
    titles = titles.concat(alternateNames ?? '')
    const follows = Number($.root().html()?.match(/vm.NumSubs = (.*);/)?.[1])

    const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
    createTagSection({ id: '1', label: 'format', tags: [] })]
    tagSections[0].tags = entity.genre.map((elem: string) => createTag({ id: elem, label: elem }))
    const lastUpdate = entity.dateModified

    let status = MangaStatus.ONGOING
    let desc = ''
    const hentai = entity.genre.includes('Hentai') || entity.genre.includes('Adult')

    const details = $('.list-group', info)
    for (const row of $('li', details).toArray()) {
        const text = $('.mlabel', row).text()
        switch (text) {
            case 'Type:': {
                const type = $('a', row).text()
                tagSections[1].tags.push(createTag({ id: type.trim(), label: type.trim() }))
                break
            }
            case 'Status:': {
                status = $(row).text().includes('Ongoing') ? MangaStatus.ONGOING : MangaStatus.COMPLETED
                break
            }
            case 'Description:': {
                desc = $('div', row).text().trim()
                break
            }
        }
    }

    return createManga({
        id: mangaId,
        titles,
        image,
        rating: 0,
        status,
        author,
        tags: tagSections,
        desc,
        //hentai,
        hentai: false,
        follows,
        lastUpdate
    })
}

export const parseChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
    const chapterJS: any[] = JSON.parse($.root().html()?.match(regex['chapters'])?.[1] ?? '').reverse()
    const chapters: Chapter[] = []
    // following the url encoding that the website uses, same variables too
    for (const elem of chapterJS) {
      const chapterCode: string = elem.Chapter
      const volume = Number(chapterCode.substring(0, 1))
      const index = volume != 1 ? '-index-' + volume : ''
      const n = parseInt(chapterCode.slice(1, -1))
      const a = Number(chapterCode[chapterCode.length - 1])
      const m = a != 0 ? '.' + a : ''
      const id = mangaId + '-chapter-' + n + m + index + '.html'
      const chapNum = n + a * .1
      const name = elem.ChapterName ? elem.ChapterName : '' // can be null

      const timeStr = elem.Date.replace(/-/g, "/")
      const time = new Date(timeStr)

      chapters.push(createChapter({
        id,
        mangaId,
        name,
        chapNum,
        volume,
        langCode: LanguageCode.ENGLISH,
        time
      }))
    }

    return chapters;
}

export const parseChapterDetails = (data: any, mangaId: string, chapterId: string): ChapterDetails => {
    const pages: string[] = []

    const variableName = data.match(/ng-src="https:\/\/{{([a-zA-Z0-9.]+)}}\/manga\/.+\.png/)?.[1];
    const matchedPath = data.match(new RegExp(`${variableName} = "(.*)";`))?.[1];

    const chapterInfo = JSON.parse(data.match(/vm.CurChapter = (.*);/)?.[1])
    const pageNum = Number(chapterInfo.Page)

    const chapter = chapterInfo.Chapter.slice(1, -1)
    const odd = chapterInfo.Chapter[chapterInfo.Chapter.length - 1]
    const chapterImage = odd == 0 ? chapter : chapter + '.' + odd

    for (let i = 0; i < pageNum; i++) {
      const s = '000' + (i + 1)
      const page = s.substr(s.length - 3)
      pages.push(`https://${matchedPath}/manga/${mangaId}/${chapterInfo.Directory == '' ? '' : chapterInfo.Directory + '/'}${chapterImage}-${page}.png`)
    }

    return createChapterDetails({
      id: chapterId,
      mangaId: mangaId,
      pages, longStrip: false
    })
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

    const genre: string[] | undefined = query.includeGenre ?
        (query.includeDemographic ? query.includeGenre.concat(query.includeDemographic) : query.includeGenre) :
        query.includeDemographic
    const genreNo: string[] | undefined = query.excludeGenre ?
        (query.excludeDemographic ? query.excludeGenre.concat(query.excludeDemographic) : query.excludeGenre) :
        query.excludeDemographic

    return {
        'keyword': query.title?.toLowerCase(),
        'author': query.author?.toLowerCase() || query.artist?.toLowerCase() || '',
        'status': status?.toLowerCase() ?? '',
        'type': query.includeFormat?.map((x) => x?.toLowerCase() ?? ''),
        'genre': genre?.map((x) => x?.toLowerCase() ?? ''),
        'genreNo': genreNo?.map((x) => x?.toLowerCase() ?? '')
    }
}

export const parseSearch = (data: any, metadata: any): PagedResults => {
    const mangaTiles: MangaTile[] = []
    const directory: any[] = JSON.parse(data?.match(regex['directory'])?.[1] ?? '')['Directory']
    const imgSource = data?.match(regex['directory_image_host'])?.[1] ?? MS_IMAGE_DOMAIN
    if (imgSource !== MS_IMAGE_DOMAIN) MS_IMAGE_DOMAIN = imgSource

    for (const elem of directory) {
        let mKeyword: boolean = typeof metadata.keyword !== 'undefined' ? false : true
        let mAuthor: boolean = metadata.author !== '' ? false : true
        let mStatus: boolean = metadata.status !== '' ? false : true
        let mType: boolean = typeof metadata.type !== 'undefined' && metadata.type.length > 0 ? false : true
        let mGenre: boolean = typeof metadata.genre !== 'undefined' && metadata.genre.length > 0 ? false : true
        let mGenreNo: boolean = typeof metadata.genreNo !== 'undefined' ? true : false
        if (!mKeyword) {
            const allWords: string = [...(elem.al ?? []), elem.s ?? ''].join('||').toLowerCase()
            mKeyword = allWords.includes(metadata.keyword)
        }

        if (!mAuthor) {
            const authors: string = elem.a?.join('||').toLowerCase() ?? ''
            if (authors.includes(metadata.author)) mAuthor = true
        }

        if (!mStatus) {
            if ((elem.st == 'ongoing' && metadata.status == 'ongoing') || (elem.st != 'ongoing' && metadata.ss != 'ongoing')) mStatus = true
        }

        const flatG = elem.g?.join('||') ?? ''
        if (!mType) mType = metadata.type.includes(elem.t)
        if (!mGenre) mGenre = metadata.genre.every((i: string) => flatG.includes(i))
        if (mGenreNo) mGenreNo = metadata.genreNo.every((i: string) => flatG.includes(i))

        if (mKeyword && mAuthor && mStatus && mType && mGenre && !mGenreNo) {
            mangaTiles.push(createMangaTile({
                id: elem.i,
                title: createIconText({ text: elem.s }),
                image: `${MS_IMAGE_DOMAIN}/${elem.i}.jpg`,
                subtitleText: createIconText({ text: elem.st })
            }))
        }
    }

    // This source parses JSON and never requires additional pages
    return createPagedResults({
        results: mangaTiles
    })
}

export const parseTags = (data: any): TagSection[] => {
    const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
        createTagSection({ id: '1', label: 'format', tags: [] })]
    const genres = JSON.parse(data.match(/"Genre"\s*: (.*)/)?.[1].replace(/'/g, "\""))
    const typesHTML = data.match(/"Type"\s*: (.*),/g)?.[1]
    const types = JSON.parse(typesHTML.match(/(\[.*\])/)?.[1].replace(/'/g, "\""))
    tagSections[0].tags = genres.map((e: any) => createTag({ id: e, label: e }))
    tagSections[1].tags = types.map((e: any) => createTag({ id: e, label: e }))
    return tagSections
}

export const parseHomeSections = ($: CheerioStatic, data: any, sectionCallback: (section: HomeSection) => void): void => {
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

    let imgSource = $('.ImageHolder').html()?.match(/ng-src="(.*)\//)?.[1] ?? MS_IMAGE_DOMAIN
    if (imgSource !== MS_IMAGE_DOMAIN)
        MS_IMAGE_DOMAIN = imgSource

    for (const [i, section] of sections.entries()) {
        sectionCallback(section)
        const manga: MangaTile[] = []
        for (const elem of sectionData[i]) {
            const id = elem.IndexName
            const title = elem.SeriesName
            const image = `${MS_IMAGE_DOMAIN}/${id}.jpg`
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

export const parseViewMore = (data: any, homepageSectionId: string): PagedResults | null => {
    const manga: MangaTile[] = []
    const mangaIds: Set<string> = new Set<string>()

    if (!regex[homepageSectionId]) return null
    const items = JSON.parse((data.match(regex[homepageSectionId]))?.[1])
    for (const item of items) {
        const id = item.IndexName
        if (!mangaIds.has(id)) {
            const title = item.SeriesName
            const image = `${MS_IMAGE_DOMAIN}/${id}.jpg`
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
        results: manga
    })
}