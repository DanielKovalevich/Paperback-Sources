import { Chapter, ChapterDetails, HomeSection, LanguageCode, Manga, MangaStatus, MangaTile, SearchRequest, TagSection } from "paperback-extensions-common";

export const parseMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
    const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
    createTagSection({ id: '1', label: 'format', tags: [] })]

    const image: string = $('img', '.manga').attr('src') ?? ""
    const rating: string = $('i', '#rating').text()
    const tableBody = $('tbody', '.manga')
    const titles: string[] = []
    const title = $('.manga').find('a').first().text()
    titles.push(title.substring(0, title.lastIndexOf(' ')))

    let hentai = false
    let author = ""
    let artist = ""
    let views = 0
    let status = MangaStatus.ONGOING
    for (const row of $('tr', tableBody).toArray()) {
        const elem = $('th', row).html()
        switch (elem) {
            case 'Author(s)': author = $('a', row).text(); break
            case 'Artist(s)': artist = $('a', row).first().text(); break
            case 'Popularity': {
                let pop = (/has (\d*(\.?\d*\w)?)/g.exec($('td', row).text()) ?? [])[1]
                if (pop.includes('k')) {
                    pop = pop.replace('k', '')
                    views = Number(pop) * 1000
                }
                else {
                    views = Number(pop) ?? 0
                }
                break
            }
            case 'Alternative': {
                const alts = $('td', row).text().split('  ')
                for (const alt of alts) {
                    const trim = alt.trim().replace(/(;*\t*)/g, '')
                    if (trim != '')
                        titles.push(trim)
                }
                break
            }
            case 'Genre(s)': {
                for (const genre of $('a', row).toArray()) {
                    const item = $(genre).html() ?? ""
                    const id = $(genre).attr('href')?.split('/').pop() ?? ''
                    const tag = item.replace(/<[a-zA-Z\/][^>]*>/g, "")
                    if (item.includes('Hentai')) hentai = true
                    tagSections[0].tags.push(createTag({ id: id, label: tag }))
                }
                break
            }
            case 'Status': {
                const stat = $('td', row).text()
                if (stat.includes('Ongoing'))
                    status = MangaStatus.ONGOING
                else if (stat.includes('Completed'))
                    status = MangaStatus.COMPLETED
                break
            }
            case 'Type': {
                const type = $('td', row).text().split('-')[0].trim()
                let id = ''
                if (type.includes('Manga')) id = 'manga'
                else if (type.includes('Manhwa')) id = 'manhwa'
                else if (type.includes('Manhua')) id = 'manhua'
                else id = 'unknown'
                tagSections[1].tags.push(createTag({ id: id, label: type.trim() }))
            }
        }
    }

    const desc = $('.summary').html() ?? ""
    return createManga({
        id: mangaId,
        titles,
        image: image.replace(/(https:)?\/\//gi, 'https://'),
        rating: Number(rating),
        status,
        artist,
        author,
        tags: tagSections,
        views,
        desc,
        hentai
    })
}

export const parseChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
    const chapters: Chapter[] = []
    for (const elem of $('#list').children('div').toArray()) {
        // streamNum helps me navigate the weird id/class naming scheme
        const streamNum = /(\d+)/g.exec($(elem).attr('id') ?? "")?.[0]
        const group = $(`.ml-1.stream-text-${streamNum}`, elem).text()

        let volume = 1
        let chapNum = 1
        const volumes = $('.volume', elem).toArray().reverse()
        for (const vol of volumes) {
            const chapterElem = $('li', vol).toArray().reverse()
            for (const chap of chapterElem) {
                const chapId = $(chap).attr('id')?.replace('b-', 'i')
                let name: string | undefined
                const nameArr = ($('a', chap).html() ?? "").replace(/(\t*\n*)/g, '').split(':')
                name = nameArr.length > 1 ? nameArr[1].trim() : undefined

                const time = convertTime($('.time', chap).text().trim())
                chapters.push(createChapter({
                    id: chapId ?? '',
                    mangaId,
                    name,
                    chapNum,
                    volume,
                    time,
                    group,
                    langCode: LanguageCode.ENGLISH
                }))
                chapNum++
            }
            volume++
        }
    }

    return chapters
}

export const parseChapterDetails = (data: any, mangaId: string, chapterId: string): ChapterDetails => {
    const script = JSON.parse(/var _load_pages = (.*);/.exec(data)?.[1] ?? '')
    const pages: string[] = []
    for (const page of script)
        pages.push(page.u)

    return createChapterDetails({
        id: chapterId,
        mangaId: mangaId,
        pages: pages,
        longStrip: false
    })
}

export interface UpdatedManga {
    ids: string[];
    loadMore: boolean;
}

export const parseUpdatedManga = ($: CheerioStatic, time: Date, ids: string[]): UpdatedManga => {
    const manga: string[] = []
    let loadMore = true
    for (let item of $('.item', '.ls1').toArray()) {
        const id = ($('a', item).first().attr('href') ?? '').split('/').pop() ?? ''
        const mangaTime = $('.time').first().text()
        if (convertTime(mangaTime) > time)
            if (ids.includes(id))
                manga.push(id)
        else loadMore = false
    }

    return {
        ids: manga,
        loadMore,
    }
}

export const parseHomeSections = ($: CheerioStatic, sections: HomeSection[], sectionCallback: (section: HomeSection) => void): void => {
    for (const section of sections) sectionCallback(section)
    const popManga: MangaTile[] = []
    const newManga: MangaTile[] = []
    const updateManga: MangaTile[] = []

    for (const item of $('li', '.top').toArray()) {
        const id: string = ($('.cover', item).attr('href') ?? '').split('/').pop() ?? ''
        const title: string = $('.cover', item).attr('title') ?? ''
        const image: string = $('img', item).attr('src') ?? ''
        const subtitle: string = $('.visited', item).text() ?? ''
        const sIcon = 'clock.fill'
        const sText = $('i', item).text()
        popManga.push(createMangaTile({
            id,
            image: image.replace(/(https:)?\/\//gi, 'https://'),
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle }),
            secondaryText: createIconText({ text: sText, icon: sIcon })
        }))
    }

    for (const item of $('ul', '.mainer').toArray()) {
        for (const elem of $('li', item).toArray()) {
            const id: string = ($('a', elem).first().attr('href') ?? '').split('/').pop() ?? ''
            const title: string = $('img', elem).attr('alt') ?? ''
            const image: string = $('img', elem).attr('src') ?? ''
            const subtitle: string = $('.visited', elem).text() ?? ''
            newManga.push(createMangaTile({
                id,
                image: image.replace(/(https:)?\/\//gi, 'https://'),
                title: createIconText({ text: title }),
                subtitleText: createIconText({ text: subtitle })
            }))
        }
    }

    for (const item of $('.item', 'article').toArray()) {
        const id: string = ($('.cover', item).attr('href') ?? '').split('/').pop() ?? ''
        const title: string = $('.cover', item).attr('title') ?? ''
        const image: string = $('img', item).attr('src') ?? ''
        const subtitle: string = $('.visited', item).text() ?? ''
        const sIcon = 'clock.fill'
        const sText = $('li.new', item).first().find('i').last().text() ?? ''
        updateManga.push(createMangaTile({
            id,
            image: image.replace(/(https:)?\/\//gi, 'https://'),
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle }),
            secondaryText: createIconText({ text: sText, icon: sIcon })
        }))
    }

    sections[0].items = popManga
    sections[1].items = newManga
    sections[2].items = updateManga

    for (const section of sections) sectionCallback(section)
}
 
export const parseViewMore = ($: CheerioStatic, homepageSectionId: string): MangaTile[] => {
    const manga: MangaTile[] = []
    if (homepageSectionId === 'popular_titles') {
        for (const item of $('.item', '.row.mt-2.ls1').toArray()) {
            const id = $('a', item).first().attr('href')?.split('/').pop() ?? ''
            const title = $('a', item).first().attr('title') ?? ''
            const image = $('img', item).attr('src') ?? ''
            const elems = $('small.ml-1', item)
            const rating = $(elems[0]).text().trim()
            const rank = $(elems[1]).text().split('-')[0].trim()
            const chapters = $('span.small', item).text().trim()

            manga.push(createMangaTile({
                id,
                image: image.replace(/(https:)?\/\//gi, 'https://'),
                title: createIconText({ text: title }),
                subtitleText: createIconText({ text: chapters }),
                primaryText: createIconText({ text: rating, icon: 'star.fill' }),
                secondaryText: createIconText({ text: rank, icon: 'chart.bar.fill' })
            }))
        }
    }
    else if (homepageSectionId === 'popular_new_titles') {
        for (const item of $('.item', '.manga-list').toArray()) {
            const id = $('.cover', item).attr('href')?.split('/').pop() ?? ''
            const title = $('.cover', item).attr('title') ?? ''
            const image = $('img', item).attr('src') ?? ''
            const rank = $('[title=rank]', item).text().split('·')[1].trim()
            const rating = $('.rate', item).text().trim()
            const time = $('.justify-content-between', item).first().find('i').text()
            manga.push(createMangaTile({
                id,
                image: image.replace(/(https:)?\/\//gi, 'https://'),
                title: createIconText({ text: title }),
                subtitleText: createIconText({ text: time }),
                primaryText: createIconText({ text: rating, icon: 'star.fill' }),
                secondaryText: createIconText({ text: rank, icon: 'chart.bar.fill' })
            }))
        }
    }
    else if (homepageSectionId === 'recently_updated') {
        for (const item of $('.item', '.ls1').toArray()) {
            const id = $('.cover', item).attr('href')?.split('/').pop() ?? ''
            const title = $('.cover', item).attr('title') ?? ''
            const image = $('img', item).attr('src') ?? ''
            const chapter = $('.visited', item).first().text()
            const time = $('.time', item).first().text()
            manga.push(createMangaTile({
                id,
                image: image.replace(/(https:)?\/\//gi, 'https://'),
                title: createIconText({ text: title }),
                subtitleText: createIconText({ text: chapter }),
                secondaryText: createIconText({ text: time, icon: 'clock.fill' })
            }))
        }
    }
    return manga
}

export const generateSearch = (query: SearchRequest): string => {
    const genres = query.includeGenre?.join(',')
    const excluded = query.excludeGenre?.join(',')
    // will not let you search across more than one format
    const format = query.includeFormat?.[0]
    let status = ""
    switch (query.status) {
        case 0: status = 'completed'; break
        case 1: status = 'ongoing'; break
        default: status = ''
    }
    let search: string = `q=${encodeURI(query.title ?? '')}&`
    search += `autart=${encodeURI(query.author || query.artist || '')}&`
    search += `&genres=${genres}&genres-exclude=${excluded}&page=1`
    search += `&types=${format}&status=${status}&st-ss=1`
    return search
}

export const parseSearch = ($: CheerioStatic): MangaTile[] => {
    const mangaList = $('.manga-list')
    const manga: MangaTile[] = []
    for (const item of $('.item', mangaList).toArray()) {
        const id = $('a', item).first().attr('href')?.split('/').pop() ?? ''
        const img = $('img', item)
        const image = $(img).attr('src') ?? ''
        const title = $(img).attr('title') ?? ''
        const rate = $('.rate', item)
        const rating = Number($(rate).find('i').text())
        let author = ""

        for (const field of $('.field', item).toArray()) {
            const elem = $('b', field).first().text()
            if (elem == 'Authors/Artists:') {
                const authorCheerio = $('a', field).first()
                author = $(authorCheerio).text()
            }
        }

        const lastUpdate = $('ul', item).find('i').text()
        manga.push(createMangaTile({
            id,
            image: image.replace(/(https:)?\/\//gi, 'https://'),
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: author }),
            primaryText: createIconText({ text: rating.toString(), icon: 'star.fill' }),
            secondaryText: createIconText({ text: lastUpdate, icon: 'clock.fill' })
        }))
    }

    return manga
}

export const parseTags = ($: CheerioStatic): TagSection[] | null => {
    const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
    createTagSection({ id: '1', label: 'format', tags: [] })]
    for (let genre of $('span', '[name=genres]').toArray())
        tagSections[0].tags.push(createTag({ id: $(genre).attr('rel') ?? '', label: $(genre).text() }))
    for (let type of $('span', '[name=types]').toArray())
        tagSections[1].tags.push(createTag({ id: $(type).attr('rel') ?? '', label: $(type).text() }))
    return tagSections
}

const convertTime = (timeAgo: string): Date => {
    let time: Date
    let trimmed: number = Number(/\d*/.exec(timeAgo)?.[0])
    trimmed = (trimmed == 0 && timeAgo.includes('a')) ? 1 : trimmed
    if (timeAgo.includes('minutes')) {
      time = new Date(Date.now() - trimmed * 60000)
    }
    else if (timeAgo.includes('hours')) {
      time = new Date(Date.now() - trimmed * 3600000)
    }
    else if (timeAgo.includes('days')) {
      time = new Date(Date.now() - trimmed * 86400000)
    }
    else if (timeAgo.includes('year') || timeAgo.includes('years')) {
      time = new Date(Date.now() - trimmed * 31556952000)
    }
    else {
      time = new Date(Date.now())
    }

    return time
  }