
// Import the global wrapper for all the models
import './models/impl_export'

import cheerio from 'cheerio'
import { Source } from './sources/Source'

// Sources
import { MangaDex } from './sources/MangaDex/MangaDex'
// import { MangaPark } from './sources/Mangapark'
// import { Manganelo } from './sources/Manganelo'
// import { Mangasee } from './sources/Mangasee'

import { Manga } from './models/Manga/Manga'
import { Chapter } from './models/Chapter/Chapter'
import { ChapterDetails } from './models/ChapterDetails/ChapterDetails'
import { SearchRequest } from './models/SearchRequest/SearchRequest'
import { Request } from './models/RequestObject/RequestObject'
import { MangaTile } from './models/MangaTile/MangaTile'
import { Mangasee } from './sources/Mangasee/Mangasee'
import { MangaPark } from './sources/MangaPark/MangaPark'
import { Manganelo } from './sources/Manganelo/Manganelo'

// import axios from 'axios'  <- use this when you've fixed the typings
const axios = require('axios')

export class APIWrapper {
	/**
	 * Retrieves all relevant metadata from a source about particular manga
	 * 
	 * @param source 
	 * @param ids 
	 */
	async getMangaDetails(source: Source, ids: string[]): Promise<Manga[]> {
		let requests = source.getMangaDetailsRequest(ids)
		let manga: Manga[] = []
		let responses: any[] = []
		for (let request of requests) {
			let headers: any = request.headers == undefined ? {} : request.headers
			headers['Cookie'] = this.formatCookie(request)

			try {
				responses.push(await axios.request({
					url: `${request.url}${request.param ?? ''}`,
					method: request.method,
					headers: headers,
					data: request.data,
					timeout: request.timeout || 0
				}))
			}
			catch (e) {
				return []
			}
		}

		manga.push(...source.getMangaDetails(responses.map(a => a.data), requests.map(a => a.metadata)))

		return manga
	}

	/**
	 * Retrieves all the chapters for a particular manga
	 * 
	 * @param source 
	 * @param mangaId 
	 */
	async getChapters(source: Source, mangaId: string): Promise<Chapter[]> {
		let request = source.getChaptersRequest(mangaId)
		let headers: any = request.headers == undefined ? {} : request.headers
		headers['Cookie'] = this.formatCookie(request)

		try {
			var data = await axios.request({
				url: `${request.url}${request.param ?? ''}`,
				method: request.method,
				headers: headers,
				data: request.data,
				timeout: request.timeout || 0
			})

			let chapters: Chapter[] = source.getChapters(data.data, request.metadata)
			return chapters
		}
		catch (e) {
			return []
		}
	}

	/**
	 * Retrieves the images for a particular chapter of a manga
	 * 
	 * @param source 
	 * @param mangaId 
	 * @param chId 
	 */
	async getChapterDetails(source: Source, mangaId: string, chId: string): Promise<ChapterDetails> {
		let request = source.getChapterDetailsRequest(mangaId, chId)
		let metadata = request.metadata
		let headers: any = request.headers == undefined ? {} : request.headers
		headers['Cookie'] = this.formatCookie(request)

		try {
			var data = await axios.request({
				url: `${request.url}${request.param ?? ''}`,
				method: request.method,
				headers: headers,
				data: request.data,
				timeout: request.timeout || 0
			})
		}
		catch (e) {
			throw "error";
		}

		let response = source.getChapterDetails(data.data, metadata)
		let details: ChapterDetails = response.details

		// there needs to be a way to handle sites that only show one page per link
		while (response.nextPage && metadata.page) {
			metadata.page++
			try {
				data = await axios.request({
					url: `${request.url}${metadata.page}`,
					method: request.method,
					headers: headers,
					data: request.data,
					timeout: request.timeout || 0
				})
			}
			catch (e) {
				return details
			}

			response = source.getChapterDetails(data.data, metadata)
			details.pages.push(response.details.pages[0])
		}

		return details
	}

	/**
	 * This would take in all the ids that the user is reading
	 * then determines whether an update has come out since
	 * 
	 * @param ids 
	 * @param referenceTime will only get manga up to this time
	 * @returns List of the ids of the manga that were recently updated
	 */
	async filterUpdatedManga(source: Source, ids: string[], referenceTime: Date): Promise<string[]> {
		let currentPage = 1
		let hasResults = true
		let request = source.filterUpdatedMangaRequest(ids, referenceTime, currentPage)
		if (request == null) return Promise.resolve([])
		let url = request.url
		let headers: any = request.headers == undefined ? {} : request.headers
		headers['Cookie'] = this.formatCookie(request)

		let retries = 0
		do {
			var data = await this.makeFilterRequest(url, request, headers, currentPage)
			if (data.code || data.code == 'ECONNABORTED') retries++
			else if (!data.data) {
				return []
			}
		} while (data.code && retries < 5)

		let manga: string[] = []
		while (hasResults && data.data) {
			let results: any = source.filterUpdatedManga(data.data, request.metadata)
			manga = manga.concat(results.updatedMangaIds)
			if (results.nextPage) {
				currentPage++
				let retries = 0
				do {
					data = await this.makeFilterRequest(url, request, headers, currentPage)
					if (data.code || data.code == 'ECONNABORTED') retries++
					else if (!data.data) {
						return manga
					}
				} while (data.code && retries < 5)
			}
			else {
				hasResults = false
			}
		}

		return manga
	}

	// In the case that a source takes too long (LOOKING AT YOU MANGASEE)
	// we will retry after a 4 second timeout. During testings, some requests would take up to 30 s for no reason
	// this brings that edge case way down while still getting data
	private async makeFilterRequest(baseUrl: string, request: Request, headers: Record<string, string>, currentPage: number): Promise<any> {
		let post: boolean = request.method.toLowerCase() == 'post' ? true : false
		try {
			if (!post) {
				request.url = baseUrl + currentPage
			}
			else {
				// axios has a hard time with properly encoding the payload
				// this took me too long to find
				request.data = request.data.replace(/(.*page=)(\d*)(.*)/g, `$1${currentPage}$3`)
			}

			var data = await axios.request({
				url: `${request.url}`,
				method: request.method,
				headers: headers,
				data: request.data,
				timeout: request.timeout || 0
			})
		}
		catch (e) {
			return e
		}
		return data
	}

	/**
	 * Home page of the application consists of a few discover sections. 
	 * This will contain featured, newly updated, new manga, etc.
	 * 
	 * @param none
	 * @returns {Sections[]} List of sections
	 */
	async getHomePageSections(source: Source) {
		let request = source.getHomePageSectionRequest()
		if (request == null) return Promise.resolve([])

		let keys: any = Object.keys(request)
		let configs = []
		let sections: any = []
		for (let key of keys) {
			for (let section of request[key].sections)
				sections.push(section)
			configs.push(request[key].request)
		}

		try {
			var data: any = await Promise.all(configs.map(axios.request))

			// Promise.all retains order
			for (let i = 0; i < data.length; i++) {
				sections = source.getHomePageSections(data[i].data, sections)
			}

			return sections
		}
		catch (e) {
			return []
		}
	}

	/**
	 * Creates a search query for the source
	 * 
	 * @param query 
	 * @param page
	 */
	async search(source: Source, query: SearchRequest, page: number): Promise<MangaTile[]> {
		let request = source.searchRequest(query, page)
		if (request == null) return Promise.resolve([])

		let headers: any = request.headers == undefined ? {} : request.headers
		headers['Cookie'] = this.formatCookie(request)

		try {
			var data = await axios.request({
				url: `${request.url}${request.param ?? ''}`,
				method: request.method,
				headers: headers,
				data: request.data,
				timeout: request.timeout || 0
			})

			return source.search(data.data) ?? []
		}
		catch (e) {
			return []
		}
	}

	async getTags(source: Source) {
		let request = source.getTagsRequest()
		if (request == null) return Promise.resolve([])
		let headers: any = request.headers == undefined ? {} : request.headers
		headers['Cookie'] = this.formatCookie(request)

		try {
			var data = await axios.request({
				url: `${request.url}${request.param ?? ''}`,
				method: request.method,
				headers: headers,
				data: request.data,
				timeout: request.timeout || 0
			})

			return source.getTags(data.data) ?? []
		}
		catch (e) {
			console.log(e)
			return []
		}
	}

	async getViewMoreItems(source: Source, key: string, page: number) {
		let request = source.getViewMoreRequest(key, page)
		if (request == null) return Promise.resolve([])
		let headers: any = request.headers == undefined ? {} : request.headers
		headers['Cookie'] = this.formatCookie(request)

		try {
			var data = await axios.request({
				url: `${request.url}${request.param ?? ''}`,
				method: request.method,
				headers: headers,
				data: request.data,
				timeout: request.timeout || 0
			})

			return source.getViewMoreItems(data.data, key)
		}
		catch (e) {
			console.log(e)
			return []
		}
	}

	private formatCookie(info: Request): string {
		let fCookie = ''
		for (let cookie of info.cookies ?? [])
			fCookie += `${cookie.name}=${cookie.value};`
		return fCookie
	}
}

// MY TESTING FRAMEWORK - LOL
let application = new APIWrapper()

// MangaDex
//application.getMangaDetails(new MangaDex(cheerio), ['1'])
// application.filterUpdatedManga(new MangaDex(cheerio), ['1'], new Date("2020-04-25 02:33:30 UTC")).then((data) => {console.log(data)})
// application.getHomePageSections(new MangaDex(cheerio)).then((data => console.log(data)))

// MangaPark
// application.getMangaDetails(new MangaPark(cheerio), ['radiation-house', 'boku-no-hero-academia-horikoshi-kouhei']).then((data) => { console.log(data) })
// application.getChapters(new MangaPark(cheerio), "radiation-house").then((data) => { console.log(data) })
// application.getChapterDetails(new MangaPark(cheerio), 'radiation-house', 'i1510452').then((data) => console.log(data))
// application.filterUpdatedManga(new MangaPark(cheerio), ["no-longer-a-heroine-gi-meng-gi", "the-wicked-queen-shin-ji-sang", "tower-of-god"], new Date("2020-04-25 02:33:30 UTC")).then((data) => { console.log(data) })
// let test = createSearchRequest({
// 	title: 'one piece',
// 	includeDemographic: ['Shounen'],
// 	excludeGenre: ['Adventure']
// })
// application.search(new MangaPark(cheerio), test, 1).then((data) => { console.log(data) })
// application.getHomePageSections(new MangaPark(cheerio)).then((data) => console.log(data))
// application.getTags(new MangaPark(cheerio)).then((data) => console.log(data))
// application.getViewMoreItems(new MangaPark(cheerio), 'recently_updated', 1).then(data => console.log(data))

// Manganelo
// application.getMangaDetails(new Manganelo(cheerio), ['bt920017', 'read_one_piece_manga_online_free4']).then((data) => { console.log(data) })
// application.getChapters(new Manganelo(cheerio), 'radiation_house').then((data) => { console.log(data) })
// application.getChapterDetails(new Manganelo(cheerio), 'radiation_house', 'chapter_1').then((data) => { console.log(data) })
// application.filterUpdatedManga(new Manganelo(cheerio), ['tower_of_god_manga', 'read_one_piece_manga_online_free4'], new Date("2020-04-25 02:33:30 UTC")).then(data => console.log(data))
// application.getHomePageSections(new Manganelo(cheerio)).then(data => console.log(data))
// let test = createSearchRequest({
// 	title: 'world',
// 	includeGenre: ['2', '6'],
// 	excludeGenre: ['4']
// })
// application.search(new Manganelo(cheerio), test, 1).then((data) => { console.log(data) })
// application.getTags(new Manganelo(cheerio)).then((data) => { console.log(data) })
// application.getViewMoreItems(new Manganelo(cheerio), 'new_manga', 1).then(data => console.log(data))

// Mangasee
// application.getMangaDetails(new Mangasee(cheerio), ['Domestic-Na-Kanojo', 'one-piece']).then((data) => {console.log(data)})
// application.getChapters(new Mangasee(cheerio), 'Boku-no-hero-academia').then((data) => { console.log(data) })
// application.getChapterDetails(new Mangasee(cheerio), 'boku-no-hero-academia', 'Boku-No-Hero-Academia-chapter-269-page-1.html').then((data) => {console.log(data)})
// application.filterUpdatedManga(new Mangasee(cheerio), ['Be-Blues---Ao-Ni-Nare', 'Tales-Of-Demons-And-Gods', 'Amano-Megumi-Wa-Suki-Darake'], new Date("2020-04-25 02:33:30 UTC")).then((data) => {console.log(data)})
// let test = createSearchRequest({
// title: 'one piece', 
// includeDemographic: ['Shounen'], 
// excludeGenre: ['Supernatural']
// })
// application.search(new Mangasee(cheerio), test, 1).then((data) => { console.log(data) })
// application.getTags(new Mangasee(cheerio)).then((data) => { console.log(data) })