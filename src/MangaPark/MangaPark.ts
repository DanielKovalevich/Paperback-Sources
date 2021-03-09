import { 
	Source, 
	Manga, 
	Chapter, 
	ChapterDetails, 
	HomeSection, 
	SearchRequest, 
	TagSection, 
	MangaUpdates, 
	PagedResults, 
	SourceInfo, 
	TagType } 
from "paperback-extensions-common"
import { generateSearch, parseChapterDetails, parseChapters, parseHomeSections, parseMangaDetails, parseSearch, parseTags, parseUpdatedManga,  parseViewMore,  UpdatedManga } from "./MangaParkParser"

const MP_DOMAIN = 'https://mangapark.net'
const method = 'GET'

export const MangaParkInfo: SourceInfo = {
	version: '2.0.0',
	name: 'MangaPark',
	icon: 'icon.png',
	author: 'Daniel Kovalevich',
	authorWebsite: 'https://github.com/DanielKovalevich',
	description: 'Extension that pulls manga from MangaPark, includes Advanced Search and Updated manga fetching',
	hentaiSource: false,
	websiteBaseURL: MP_DOMAIN,
	sourceTags: [
		{
			text: "Notifications",
			type: TagType.GREEN
		}
	]
}

export class MangaPark extends Source {
	readonly cookies = [createCookie({ name: 'set', value: 'h=1', domain: MP_DOMAIN })]
	cloudflareBypassRequest() {
		return createRequestObject({
		  url: `${MP_DOMAIN}`,
		  method,
		})
	  }

	async getMangaDetails(mangaId: string): Promise<Manga> {
		const detailsRequest = createRequestObject({
			url: `${MP_DOMAIN}/manga/${mangaId}`,
			cookies: this.cookies,
			method,
		})

		const response = await this.requestManager.schedule(detailsRequest, 1)
		const $ = this.cheerio.load(response.data)
		return parseMangaDetails($, mangaId)
	}

	async getChapters(mangaId: string): Promise<Chapter[]> {
		const request = createRequestObject({
			url: `${MP_DOMAIN}/manga/${mangaId}`,
			method,
		})

		const response = await this.requestManager.schedule(request, 1)
		const $ = this.cheerio.load(response.data)
		return parseChapters($, mangaId)
	}

	async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
		const request = createRequestObject({
			url: `${MP_DOMAIN}/manga/${mangaId}/${chapterId}`,
			method,
			cookies: this.cookies
		})

		const response = await this.requestManager.schedule(request, 1)
		return parseChapterDetails(response.data, mangaId, chapterId)
	}


	async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void>{
		let page = 1
		let updatedManga: UpdatedManga = {
			ids: [],
			loadMore: true
		}

		while (updatedManga.loadMore) {
			const request = createRequestObject({
				url: `${MP_DOMAIN}/latest/${page++}`,
				method,
				cookies: this.cookies
			})

			const response = await this.requestManager.schedule(request, 1)
			const $ = this.cheerio.load(response.data)

			updatedManga = parseUpdatedManga($, time, ids)
			if (updatedManga.ids.length > 0) {
				mangaUpdatesFoundCallback({
					ids: updatedManga.ids
				})
			}
		}

	}

	async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
		const section1 = createHomeSection({ id: 'popular_titles', title: 'POPULAR MANGA'})
		const section2 = createHomeSection({ id: 'popular_new_titles', title: 'POPULAR MANGA UPDATES'})
		const section3 = createHomeSection({ id: 'recently_updated', title: 'RECENTLY UPDATED TITLES'})
		const sections = [section1, section2, section3]

		const request = createRequestObject({url: `${MP_DOMAIN}`, method})
		const response = await this.requestManager.schedule(request, 1)
		const $ = this.cheerio.load(response.data)
		parseHomeSections($, sections, sectionCallback)
	}

	async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
		let page : number = metadata?.page ?? 1
		let param = ''
		if (homepageSectionId === 'popular_titles')
			param = `/genre/${page}`
		else if (homepageSectionId === 'popular_new_titles')
			param = `/search?orderby=views&page=${page}`
		else if (homepageSectionId === 'recently_updated')
			param = `/latest/${page}`
		else return Promise.resolve(null)

		const request = createRequestObject({
			url: `${MP_DOMAIN}`,
			method,
			param,
		})

		const response = await this.requestManager.schedule(request, 1)
		const $ = this.cheerio.load(response.data)
		const manga = parseViewMore($, homepageSectionId)
		metadata = manga.length > 0 ? { page: page + 1 } : undefined
		return createPagedResults({
			results: manga,
			metadata,
		})
	}

	async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
		let page : number = metadata?.page ?? 1
		const search = generateSearch(query)
		const request = createRequestObject({
			url: `${MP_DOMAIN}/search?${search}&page=${page}`,
			method,
			cookies: this.cookies,
		})

		const response = await this.requestManager.schedule(request, 1)
		const $ = this.cheerio.load(response.data)
		const manga = parseSearch($)
		metadata = manga.length > 0 ? { page: page + 1 } : undefined

		return createPagedResults({
			results: manga,
			metadata,
		})
	}

	async getTags(): Promise<TagSection[] | null> {
		const request = createRequestObject({
			url: `${MP_DOMAIN}/search?`,
			method,
			cookies: this.cookies,
		})

		const response = await this.requestManager.schedule(request, 1)
		const $ = this.cheerio.load(response.data)
		return parseTags($)
	}
}
