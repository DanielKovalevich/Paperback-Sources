import {Chapter, LanguageCode, Manga, MangaStatus, MangaTile, Tag, TagSection} from 'paperback-extensions-common'

export class Parser {


    parseMangaDetails($: CheerioSelector, mangaId: string): Manga {


        let titles = [$('.font-bold.text-lg').text().trim()]
        let image = $('.lazy').attr('data-src')
        let summary = $('p.text-sm.text-color-text-secondary').text().trim()

        let status = MangaStatus.ONGOING, released, rating: number = 0
        let tagArray0: Tag[] = []
        let tagArray1: Tag[] = []
        for (let obj of $('a[href*=genre]').toArray()) {
            let id = $(obj).attr('href')?.replace(`/search?genre=`, '').trim()
            let label = $(obj).text().trim()
            if (typeof id === 'undefined' || typeof label === 'undefined') continue
            tagArray0 = [...tagArray0, createTag({id: id, label: $(obj).text().trim()})]
        }
        let i = 0
        for (let item of $('div', $('.grid.grid-cols-1.gap-3.mb-3')).toArray()) {
            let descObj = $('div', $(item))
            if (!descObj.html()) {
                continue
            }
            switch (i) {
                case 0: {
                    // Manga Type
                    tagArray1 = [...tagArray1, createTag({
                        id: descObj.text().trim(),
                        label: descObj.text().trim().replace(/^\w/, (c) => c.toUpperCase())
                    })]
                    i++
                    continue
                }
                case 1: {
                    // Manga Status
                    if (descObj.text().trim().toLowerCase().includes("publishing")) {
                        status = MangaStatus.ONGOING
                    } else {
                        status = MangaStatus.COMPLETED
                    }
                    i++
                    continue
                }
                case 2: {
                    // Date of release
                    released = descObj.text().trim() ?? undefined
                    i++
                    continue
                }
                case 3: {
                    // Rating
                    rating = Number(descObj.text().trim().replace(' / 10', '')) ?? undefined
                    i++
                    continue
                }
            }
            i = 0
        }
        let tagSections: TagSection[] = [createTagSection({id: '0', label: 'genres', tags: tagArray0}),
            createTagSection({id: '1', label: 'format', tags: tagArray1})]
        return createManga({
            id: mangaId,
            rating: rating,
            titles: titles,
            image: image ?? '',
            status: status,
            tags: tagSections,
            desc: this.decodeHTMLEntity(summary ?? ''),
            lastUpdate: released
        })
    }


    parseChapterList($: CheerioSelector, mangaId: string): Chapter[] {

        let chapters: Chapter[] = []

        for (let obj of $('a.border.border-color-border-primary.p-1').toArray()) {
            let chapterId = $(obj).attr('href')
            if (chapterId == 'Read Chapters') {
                continue
            }
            let chapName = $(obj).text()
            let chapVol = Number(chapName?.toLowerCase()?.match(/season \D*(\d*\.?\d*)/)?.pop())
            let chapNum = Number(chapName?.toLowerCase()?.match(/chapter \D*(\d*\.?\d*)/)?.pop())

            if (typeof chapterId === 'undefined') continue
            chapters.push(createChapter({
                id: chapterId,
                mangaId: mangaId,
                chapNum: Number.isNaN(chapNum) ? 0 : chapNum,
                volume: Number.isNaN(chapVol) ? 0 : chapVol,
                langCode: LanguageCode.ENGLISH,
                name: this.decodeHTMLEntity(chapName)
            }))
        }
        return chapters
    }


    sortChapters(chapters: Chapter[]): Chapter[] {
        let sortedChapters: Chapter[] = []
        chapters.forEach((c) => {
            if (sortedChapters[sortedChapters.indexOf(c)]?.id !== c?.id) {
                sortedChapters.push(c)
            }
        })
        sortedChapters.sort((a, b) => ((a?.volume ?? 0) - (b?.volume ?? 0) ? -1 : 1 || a?.chapNum - b?.chapNum ? -1 : 1))
        return sortedChapters
    }


    parseChapterDetails($: CheerioSelector): string[] {
        let pages: string[] = []
        // Get all of the pages
        for (let obj of $('img', $('picture')).toArray()) {
            let page = $(obj).attr('data-src')
            if (typeof page === 'undefined') continue
            pages.push(page)
        }
        return pages
    }

    filterUpdatedManga($: CheerioSelector, time: Date, ids: string[]): { updates: string[], loadNextPage: boolean } {
        let foundIds: string[] = []
        let passedReferenceTime = false
        for (let item of $('div.flex.bg-color-bg-secondary.p-2.rounded').toArray()) {
            let id = $('a.inilne.block', item).attr('href')?.replace('/manga/', '') ?? ''
            let mangaTime = new Date($('time-ago', item).attr('datetime') ?? '');
            passedReferenceTime = mangaTime <= time
            if (!passedReferenceTime) {
                if (ids.includes(id)) {
                    foundIds.push(id)
                }
            } else break
        }
        if (!passedReferenceTime) {
            return {updates: foundIds, loadNextPage: true}
        } else {
            return {updates: foundIds, loadNextPage: false}
        }


    }

    parseSearchResults($: CheerioSelector): MangaTile[] {
        let mangaTiles: MangaTile[] = []
        let collectedIds: string[] = []
        for (let obj of $('div', $('.grid.gap-3')).toArray()) {
            let id = $('a', $(obj)).attr('href')?.replace(`/manga/`, '')
            let titleText = this.decodeHTMLEntity($('a', $('div', $(obj))).text())

            let image = $('img', $('a', $(obj))).attr('data-src')

            if (typeof id === 'undefined' || typeof image === 'undefined') continue
            if (!collectedIds.includes(id)) {
                mangaTiles.push(createMangaTile({
                    id: id,
                    title: createIconText({text: titleText}),
                    image: image
                }))
                collectedIds.push(id)
            }
        }
        return mangaTiles
    }

    parseTags($: CheerioSelector): TagSection[] {
        let tagSections: TagSection[] = [createTagSection({id: '0', label: 'genres', tags: []}),
            createTagSection({id: '1', label: 'format', tags: []})]

        for (let obj of $('Label', $('.gap-2')).toArray()) {
            let genre = $(obj).text().trim()
            let id = $('input', $(obj)).attr('value') ?? genre
            tagSections[0].tags.push(createTag({id: id, label: genre}))
        }
        tagSections[1].tags.push(createTag({id: 'manga', label: 'Manga'}))
        return tagSections
    }

    parsePopularSection($: CheerioSelector): MangaTile[] {
        let mangaTiles: MangaTile[] = []
        let collectedIds: string[] = []
        for (let obj of $('div', $('.grid.gap-3')).toArray()) {
            let id = $('a', $(obj)).attr('href')?.replace(`/manga/`, '')
            let titleText = this.decodeHTMLEntity($('a', $('div', $(obj))).text())
            
            let image = $('img', $('a', $(obj))).attr('data-src')

            if (typeof id === 'undefined' || typeof image === 'undefined') continue
            if (!collectedIds.includes(id)) {
                mangaTiles.push(createMangaTile({
                    id: id,
                    title: createIconText({text: titleText}),
                    image: image
                }))
                collectedIds.push(id)
            }
        }
        return mangaTiles
    }

    // Add featured section back in whenever a section type for that comes around

    /*
    parseFeaturedSection($ : CheerioSelector): MangaTile[]{
      let mangaTiles: MangaTile[] = []
      for(let obj of $('div[class=relative]').toArray()) {
        let href = ($('a', $(obj)).attr('href') ?? '')
        let id = href.split('-')[0].split('/').pop() + '/' + href.split('/').pop()?.split('-chapter')[0].trim()
        let titleText = this.decodeHTMLEntity($('.text-sm', $('.text-color-text-fire-ch', $('div', $(obj)))).text())

        let image = $('img', $('div', $(obj))).attr('data-src')

        let collectedIds: string[] = []
        if (typeof id === 'undefined' || typeof image === 'undefined') continue
        if(!collectedIds.includes(id)) {
          mangaTiles.push(createMangaTile({
            id: id,
            title: createIconText({text: titleText}),
            image: image
        }))
        collectedIds.push(id)
        }
      }
      return mangaTiles
    }
    */
    parseRecentUpdatesSection($: CheerioSelector): MangaTile[] {
        let mangaTiles: MangaTile[] = []
        let collectedIds: string[] = []
        for (let obj of $('div.flex.bg-color-bg-secondary.p-2.rounded').toArray()) {
            let id = $('a.inilne.block', obj).attr('href')?.replace('/manga/', '')
            let titleText = this.decodeHTMLEntity($('a.inilne.block', obj).text())

            let image = $('img', $('a', $(obj))).attr('data-src')

            if (typeof id === 'undefined' || typeof image === 'undefined') continue
            if (!collectedIds.includes(id)) {
                mangaTiles.push(createMangaTile({
                    id: id,
                    title: createIconText({text: titleText}),
                    image: image
                }))
                collectedIds.push(id)
            }
        }
        return mangaTiles
    }

    isLastPage($: CheerioSelector): boolean {
        return $('a:contains("Next")').length < 1
    }
    
    decodeHTMLEntity(str: string): string {
        return str.replace(/&#(\d+);/g, function (match, dec) {
            return String.fromCharCode(dec);
        })
    }
}
