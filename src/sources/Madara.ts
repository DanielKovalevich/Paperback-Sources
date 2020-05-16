import { Source } from './Source'
import { Manga, MangaStatus } from '../models/Manga/Manga'
import { Chapter } from '../models/Chapter/Chapter'
import { MangaTile } from '../models/MangaTile/MangaTile'
import { SearchRequest } from '../models/SearchRequest/SearchRequest'
import { Request } from '../models/RequestObject/RequestObject'
import { ChapterDetails } from '../models/ChapterDetails/ChapterDetails'
import { TagSection } from '../models/TagSection/TagSection'
import { HomeSectionRequest, HomeSection } from '../models/HomeSection/HomeSection'
import { LanguageCode } from '../models/Languages/Languages'

export abstract class Madara extends Source {

    constructor(cheerio: CheerioAPI) {
        super(cheerio)
    }

    //To be overridden by Madara sources
    abstract get MadaraDomain(): string
    abstract get langFlag(): string
    abstract get langCode(): LanguageCode

    //This is to let Madara sources override selectors without needing to override whole methods
    get titleSelector(): string { return 'div.post-title h1' }
    get authorSelector(): string { return 'div.author-content' }
    get genresSelector(): string { return 'div.genres-content a' }
    get artistSelector(): string { return 'div.artist-content' }
    get ratingSelector(): string { return 'span#averagerate' }
    get thumbnailSelector(): string { return 'div.summary_image img' }
    get thumbnailAttr(): string { return 'src' }
    get chapterListSelector(): string { return 'li.wp-manga-chapter' }
    get pageListSelector(): string { return 'div.page-break' }
    get pageImageAttr(): string { return 'src' }
    get searchMangaSelector(): string { return 'div.c-tabs-item__content' }
    get searchCoverAttr(): string { return 'src' }

    getMangaDetailsRequest(ids: string[]): Request[] {
        let requests: Request[] = []

        for (let id of ids) {
            let metadata = { 'id': id }
            requests.push(createRequestObject({
                url: this.MadaraDomain + "/manga/" + id,
                metadata: metadata,
                method: 'GET'
            }))
        }

        return requests
    }

    getMangaDetails(data: any, metadata: any): Manga[] {
        let manga: Manga[] = []
        let $ = this.cheerio.load(data)

        let title = $(this.titleSelector).first().children().remove().end().text().trim()
        let titles = [title]
        titles.push.apply(titles, $('div.summary-content').eq(2).text().trim().split(", "))

        let author = $(this.authorSelector).text().trim()
            
        let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: []})]

        for (let genre of $(this.genresSelector).toArray()) {
            let id = $(genre).attr("href")?.split('/').pop() ?? ''
            let tag = $(genre).text()
            tagSections[0].tags.push(createTag({ id: id, label: tag}))
        }

        let status = ($("div.summary-content").last().text() == "Completed") ? MangaStatus.COMPLETED : MangaStatus.ONGOING
        let averageRating = $(this.ratingSelector).text().trim()
        let src = $(this.thumbnailSelector).attr(this.thumbnailAttr)

        //Not sure if that double slash happens with any Madara source, but added just in case
        src = (src?.startsWith("http")) ? src : this.MadaraDomain + src?.replace("//", "")

        let artist = $(this.artistSelector).text().trim()

        let description = ($("div.description-summary  div.summary__content").find("p").text() != "") ? $("div.description-summary  div.summary__content").find("p").text().replace(/<br>/g, '\n') : $("div.description-summary  div.summary__content").text()

        return [createManga({
            id: metadata.id,
            titles: titles,
            image: src,
            avgRating: Number(averageRating),
            rating: Number(averageRating),
            author: author,
            artist: artist,
            desc: description,
            status: status,
            tags: tagSections,
            langName: this.language,
            langFlag: this.langFlag
        })]
    }

    getChaptersRequest(mangaId: string): Request {
		let metadata = { 'id': mangaId }
		return createRequestObject({
			url: `${this.MadaraDomain}/manga/${mangaId}`,
			method: "GET",
			metadata: metadata
		})
	}

	getChapters(data: any, metadata: any): Chapter[] {
		let $ = this.cheerio.load(data)
		let chapters: Chapter[] = []

        for (let elem of $(this.chapterListSelector).toArray()) {
            let name = $(elem).find("a").first().text().trim()
            let id = /[0-9.]+/.exec(name)![0]
            let imgDate: string | undefined = $(elem).find("img").attr("alt")
            let time = (imgDate != undefined) ? this.convertTime(imgDate) : this.parseChapterDate($(elem).find("span.chapter-release-date i").first().text()!)
            chapters.push(createChapter({
                id: id ?? '',
                chapNum: Number(id),
                mangaId: metadata.id,
                name: name,
                time: time,
                langCode: this.langCode,
            }))
        }

		return chapters
    }

    parseChapterDate(date: string): Date {
        if (date.toLowerCase().includes("ago")) {
            return this.convertTime(date)
        }

        if (date.toLowerCase().startsWith("yesterday")) {
            //To start it at the beginning of yesterday, instead of exactly 24 hrs prior to now
            return new Date((Math.floor(Date.now() / 86400000) * 86400000) - 86400000)
        }

        if (date.toLowerCase().startsWith("today")) {
            return new Date(Math.floor(Date.now() / 86400000) * 8640000)
        }

        if (/\d+(st|nd|rd|th)/.test(date)) {
            let match = /\d+(st|nd|rd|th)/.exec(date)![0]
            let day = match.replace(/\D/g, "")

            return new Date(date.replace(match, day))
        }

        return new Date(date)
    }



    getChapterDetailsRequest(mangaId: string, chId: string): Request {
		let metadata = { 'mangaId': mangaId, 'chapterId': chId, 'nextPage': false, 'page': 1 }
		return createRequestObject({
			url: `${this.MadaraDomain}/manga/${mangaId}/chapter-${chId.replace('.', '-')}`,
			method: "GET",
			metadata: metadata
		})
	}


	getChapterDetails(data: any, metadata: any): ChapterDetails {
		let pages: string[] = []
        let $ = this.cheerio.load(data)
        let pageElements = $(this.pageListSelector)

        for (let page of pageElements.toArray()) {
			pages.push($(page)?.find("img")!.first()!.attr(this.pageImageAttr)!.trim())
		}

		let chapterDetails = createChapterDetails({
			id: metadata.chapterId,
			mangaId: metadata.mangaId,
			pages: pages,
			longStrip: false
		})

		return chapterDetails
	}

    searchRequest(query: SearchRequest, page: number): Request | null {
        let url = `${this.MadaraDomain}/page/${page}/?`
        let author = query.author || ''
        let artist = query.artist || ''
        let genres = (query.includeGenre ?? []).join(",")
        let paramaters = {"s": query.title!, "post_type": "wp-manga", "author": author, "artist": artist, "genres": genres}

        return createRequestObject({
            url: url + new URLSearchParams(paramaters).toString(),
            method: 'GET'
        })
    }

    search(data: any): MangaTile[] | null { 
        let $ = this.cheerio.load(data)

        let mangas: MangaTile[] = []

        for (let manga of $(this.searchMangaSelector).toArray()) {
            let id = $("div.post-title a", manga).attr("href")?.split("/")[4] ?? ''
            if (!id.endsWith("novel")) {
                let cover = $("img", manga).first().attr(this.searchCoverAttr)
                cover = (cover?.startsWith("http")) ? cover : this.MadaraDomain + cover?.replace("//", "/")
                let title = $("div.post-title a", manga).text()
                let author = $("div.summary-content > a[href*=manga-author]", manga).text().trim()
                let alternatives = $("div.summary-content", manga).first().text().trim()

                mangas.push(createMangaTile({
                    id: id,
                    image: cover!,
                    title: createIconText({text: title ?? ''}),
                    subtitleText: createIconText({text: author ?? ''})
                }))
            }
        }

        return mangas
    }
}
