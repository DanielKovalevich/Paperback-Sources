import { Source } from '../Source'
import { Manga, MangaStatus } from '../../models/Manga/Manga'
import { Chapter } from '../../models/Chapter/Chapter'
import { MangaTile } from '../../models/MangaTile/MangaTile'
import { SearchRequest } from '../../models/SearchRequest/SearchRequest'
import { Request } from '../../models/RequestObject/RequestObject'
import { ChapterDetails } from '../../models/ChapterDetails/ChapterDetails'
import { TagSection } from '../../models/TagSection/TagSection'
import { HomeSectionRequest, HomeSection } from '../../models/HomeSection/HomeSection'
import { LanguageCode } from '../../models/Languages/Languages'
import { APIWrapper } from '../../API'

export class MangaToons extends Source {
	readonly MT_DOMAIN = 'https://mangatoon.mobi'

	constructor(cheerio: CheerioAPI) {
		super(cheerio)
	}

	get version(): string { return '0.1.0' }	//BUG: There are novel types of stories which aren't images, which are not accounted for
	get name(): string { return 'MangaToons (BETA)' }
	get icon(): string { return 'icon.jpg' }
	get author(): string { return 'Conrad Weiser' }
	get authorWebsite(): string { return 'https://github.com/ConradWeiser' }
	get description(): string { return 'Extension that pulls manga from MangaToons' }
	get hentaiSource(): boolean { return false }

	getMangaDetailsRequest(ids: string[]): Request[] {
		let requests: Request[] = []
		for (let id of ids) {
			let metadata = { 'id': id }
			requests.push(createRequestObject({
				url: `${this.MT_DOMAIN}/en/detail/${id}`,
				metadata: metadata,
				method: 'GET'
			}))
		}
		return requests
	}

	getMangaDetails(data: any, metadata: any): Manga[] {
		let $ = this.cheerio.load(data)

		let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] })]
        let title = $('.comics-title').text()
        let image = $('img' ,$('.detail-top-right')).attr('src')
        let rating = $('.star').text()

        let res = /([\d|.]*)/.exec(rating)	//TODO: Fix rating regex

        // Get all of the tags
        let tagContext = $('.description-tag')
        for(let tag of $('.tag', tagContext).toArray()) {
            tagSections[0].tags.push(createTag({
                id: $(tag).text(),
                label: $(tag).text()
            }))
        }

        let metaContext = $('.selected-detail')
        let mdata = $('.icon-wrap', metaContext).text()
        let views = (/([\d|.|M]*) *views/g.exec(mdata) ?? '')[1]
        let numericViews
        // Are these millions?
        if(views.includes("M")) {
            numericViews = Number(views.replace("M", "")) * 100000
        }
        else {
            numericViews = Number(views)
        }

        let follows = (/([\d|.|M]*) *likes/g.exec(mdata) ?? '')[1]
        let numericFollows
        if(follows.includes("M")) {
            numericFollows = Number(follows.replace("M", "")) * 100000
        }
        else {
            numericFollows = Number(follows)
		}
		
		let mangaStatus = $('.update-data').text().includes("End") ? MangaStatus.COMPLETED : MangaStatus.ONGOING
		let author = $('.created-by').text().replace(" ", "").trim()
		let desc = $('.description').text().trim()

		let recommendedIds: string[] = []
		for(let item of $('.recommend-item').toArray()) {
			let obj = $('a', $(item)).attr('href')?.replace("/en/detail/", "")
			recommendedIds.push(obj!)
		}

        return [createManga({
			id: metadata.id,
			titles: [title],
			image: image!,
			rating: 0,	//TODO: Fix this regex
			status: mangaStatus,
			author: author,
			desc: desc,
			relatedIds: recommendedIds,
			views: numericViews,
			follows: numericFollows,
			tags: tagSections
		})]
	}


	getChaptersRequest(mangaId: string): Request {
		let metadata = { 'id': mangaId }
		return createRequestObject({
			url: `${this.MT_DOMAIN}/en/detail/${mangaId}/episodes`,
			method: "GET",
			metadata: metadata
		})
	}

	getChapters(data: any, metadata: any): Chapter[] {
		let $ = this.cheerio.load(data)
		let chapters: Chapter[] = []

		for(let item of $('.episode-item').toArray()) {
			let id = $(item).attr('href')?.replace(`/en/watch/${metadata.id}/`, '')
			let chapNum = $('.item-left', $(item)).text().replace(" ", "").trim()
			let langCode = LanguageCode.UNKNOWN
			let name = $('.episode-title', $(item)).text().replace("\n", "").trim()
			let timeContext = $('.episode-date', $(item))
			let time = $('span', timeContext).text().replace("", "")

			chapters.push(createChapter({
				id: id!,
				mangaId: metadata.id,
				chapNum: Number(chapNum),
				langCode: langCode,
				name: name,
				time: new Date(time)
			}))
		}

		return chapters
	}

	getChapterDetailsRequest(mangaId: string, chId: string): Request {
		let metadata = { 'mangaId': mangaId, 'chapterId': chId, 'nextPage': false, 'page': 1 }
		return createRequestObject({
			//https://mangatoon.mobi/en/watch/5/2921
			url: `${this.MT_DOMAIN}/en/watch/${mangaId}/${chId}`,
			method: "GET",
			metadata: metadata,
		})
	}


	getChapterDetails(data: any, metadata: any): ChapterDetails {
		let $ = cheerio.load(data)
		
		let pages: string[] = []
		let pageContext = $('.pictures')
		for(let item of $('img', pageContext).toArray()) {
			pages.push($(item).attr('src'))
		}

		return createChapterDetails({
			id: metadata.chapterId,
			mangaId: metadata.mangaId,
			pages: pages,
			longStrip: true					// This is a toons source, expect everything to be in longstrip
		})

	}

	getHomePageSectionRequest(): HomeSectionRequest[] {
		let request = createRequestObject({ url: `${this.MT_DOMAIN}`, method: 'GET' })
		let section1 = createHomeSection({ id: 'hottest_comics', title: 'HOTTEST COMICS' })
		let section2 = createHomeSection({ id: 'new_comics', title: 'NEW COMICS' })

		return [createHomeSectionRequest({ request: request, sections: [section1, section2]})]
	}

	getHomePageSections(data: any, sections: HomeSection[]): HomeSection[] {
		let $ = this.cheerio.load(data)
		let hotComic: MangaTile[] = []
		let newComic: MangaTile[] = []

		for(let listItem of $('.list-item').toArray()) {
			// We only want new and hot comics
			if($('h2', listItem).text().includes('Hottest Comics')) {
				// For each content-3 adhering item
				for(let item of $('.content-3', $(listItem)).toArray()) {
					let id = $('a', $(item)).attr('href')?.replace("/en/detail/", "")
					let title = $('.content-title', $(item)).text().trim()
					let image = $('img', $(item)).attr('src')

					hotComic.push(createMangaTile({
						id: id!,
						title: createIconText({text: title}),
						image: image!
					}))
				}
				// For each content-4 adhering item
				for(let item of $('.content-4', $(listItem)).toArray()) {
					let id = $('a', $(item)).attr('href')?.replace("/en/detail/", "")
					let title = $('.content-title', $(item)).text().trim()
					let image = $('img', $(item)).attr('src')

					hotComic.push(createMangaTile({
						id: id!,
						title: createIconText({text: title}),
						image: image!
					}))
				}
			}
			if($('h2', listItem).text().includes('New Comics')) {
				for(let item of $('.content-3', $(listItem)).toArray()) {
					let id = $('a', $(item)).attr('href')?.replace("/en/detail/", "")
					let title = $('.content-title', $(item)).text().trim()
					let image = $('img', $(item)).attr('src')

					newComic.push(createMangaTile({
						id: id!,
						title: createIconText({text: title}),
						image: image!
					}))
				}
				// For each content-4 adhering item
				for(let item of $('.content-4', $(listItem)).toArray()) {
					let id = $('a', $(item)).attr('href')?.replace("/en/detail/", "")
					let title = $('.content-title', $(item)).text().trim()
					let image = $('img', $(item)).attr('src')

					newComic.push(createMangaTile({
						id: id!,
						title: createIconText({text: title}),
						image: image!
					}))
				}
			}
		}

		sections[0].items = hotComic
		sections[1].items = newComic
		return sections
	}


	searchRequest(query: SearchRequest, page: number): Request {
		//https://mangatoon.mobi/en/search?word=Boss
		return createRequestObject({
			url: `${this.MT_DOMAIN}/en/search?word=${query.title}`,
			method: 'GET',
		})
	}

	search(data: any, metadata: any): MangaTile[] | null {
		let $ = this.cheerio.load(data)
		let tiles: MangaTile[] = []
		
		for(let obj of $('.recommend-item').toArray()) {
			let id = $('a', $(obj)).attr('href')?.replace("/en/detail/", "")
			let title = $('.recommend-comics-title', $(obj)).text().trim()
			let image = $('img', $(obj)).attr('src')
			let genreData = $('.comics-type').text().trim()

			tiles.push(createMangaTile({
				id: id!,
				title: createIconText({text: title}),
				image: image!,
				primaryText: createIconText({text: genreData!})
			}))
		}

		return tiles;
	}

	getTagsRequest(): Request | null {
		return createRequestObject({
			//https://mangatoon.mobi/en/genre/comic
			url: `${this.MT_DOMAIN}/en/genre/comic`,
			method: "GET",
		})
	}

	getTags(data: any): TagSection[] | null {
		let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] })]
		let $ = this.cheerio.load(data)

		let channelContext = $('.channels')
		for(let obj of $('a', channelContext).toArray()) {
			// There are weird tags which we want to ignore, ensure that we only get the valid tags
			let regex = /\/en\/genre\/tags\/\d+\?type=\d/.exec($(obj).attr('href')!)
			if(!regex) {
				continue
			}

			let id = $(obj).attr('href')?.replace('/en/genre/tags/', '').replace('?type=1', '')
			let name = $('.channel', $(obj)).text().trim()
			tagSections[0].tags.push(createTag({
				id: id!,
				label: name
			}))
			
		}

		return tagSections
	}
}

let cheerio = require('cheerio')
let application = new APIWrapper()

