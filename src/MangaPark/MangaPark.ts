import { Source, Manga, MangaStatus, Chapter, ChapterDetails, HomeSection, MangaTile, SearchRequest, LanguageCode, TagSection, Request, MangaUpdates, PagedResults } from "paperback-extensions-common"

export class MangaPark extends Source {

	readonly MP_DOMAIN = 'https://mangapark.net'

	constructor(cheerio: CheerioAPI) {
		super(cheerio)
	}

	get version(): string { return '1.0.7' }
	get name(): string { return 'MangaPark' }
	get icon(): string { return 'icon.png' }
	get author(): string { return 'Daniel Kovalevich' }
	get authorWebsite(): string { return 'https://github.com/DanielKovalevich' }
	get description(): string { return 'Archived MangaPark source. MangaPark requires a cloudflare client for connections.' }
	get hentaiSource(): boolean { return false }
	getMangaShareUrl(mangaId: string): string | null { return `${this.MP_DOMAIN}/manga/${mangaId}` }
	get websiteBaseURL(): string { return this.MP_DOMAIN }

	async getMangaDetails(mangaId: string): Promise<Manga> {

		const detailsRequest = createRequestObject({
			url: `${this.MP_DOMAIN}/manga/${mangaId}`,
			cookies: [createCookie({ name: 'set', value: 'h=1', domain: this.MP_DOMAIN })],
			method: 'GET'
		})

		const data = await this.requestManager.schedule(detailsRequest, 1)

		let $ = this.cheerio.load(data.data)

		let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
		createTagSection({ id: '1', label: 'format', tags: [] })]

		// let id: string = (($('head').html() ?? "").match((/(_manga_name\s*=\s)'([\S]+)'/)) ?? [])[2]
		let image: string = $('img', '.manga').attr('src') ?? ""
		let rating: string = $('i', '#rating').text()
		let tableBody = $('tbody', '.manga')
		let titles: string[] = []
		let title = $('.manga').find('a').first().text()
		titles.push(title.substring(0, title.lastIndexOf(' ')))

		let hentai = false
		let author = ""
		let artist = ""
		let views = 0
		let status = MangaStatus.ONGOING
		for (let row of $('tr', tableBody).toArray()) {
			let elem = $('th', row).html()
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
					let alts = $('td', row).text().split('  ')
					for (let alt of alts) {
						let trim = alt.trim().replace(/(;*\t*)/g, '')
						if (trim != '')
							titles.push(trim)
					}
					break
				}
				case 'Genre(s)': {
					for (let genre of $('a', row).toArray()) {
						let item = $(genre).html() ?? ""
						let id = $(genre).attr('href')?.split('/').pop() ?? ''
						let tag = item.replace(/<[a-zA-Z\/][^>]*>/g, "")
						if (item.includes('Hentai')) {
							hentai = true
						}
						tagSections[0].tags.push(createTag({ id: id, label: tag }))
					}
					break
				}
				case 'Status': {
					let stat = $('td', row).text()
					if (stat.includes('Ongoing'))
						status = MangaStatus.ONGOING
					else if (stat.includes('Completed')) {
						status = MangaStatus.COMPLETED
					}
					break
				}
				case 'Type': {
					let type = $('td', row).text().split('-')[0].trim()
					let id = ''
					if (type.includes('Manga')) id = 'manga'
					else if (type.includes('Manhwa')) id = 'manhwa'
					else if (type.includes('Manhua')) id = 'manhua'
					else id = 'unknown'
					tagSections[1].tags.push(createTag({ id: id, label: type.trim() }))
				}
			}
		}

		let summary = $('.summary').html() ?? ""


		return createManga({
			id: mangaId,
			titles: titles,
			image: image.replace(/(https:)?\/\//gi, 'https://'),
			rating: Number(rating),
			status: status,
			artist: artist,
			author: author,
			tags: tagSections,
			views: views,
			desc: summary,
			hentai: hentai
		})
	}

	async getChapters(mangaId: string): Promise<Chapter[]> {

		const request = createRequestObject({
			url: `${this.MP_DOMAIN}/manga/${mangaId}`,
			method: "GET"
		})

		const data = await this.requestManager.schedule(request, 1)

		let $ = this.cheerio.load(data.data)
		let chapters: Chapter[] = []
		for (let elem of $('#list').children('div').toArray()) {
			// streamNum helps me navigate the weird id/class naming scheme
			let streamNum = (/(\d+)/g.exec($(elem).attr('id') ?? "") ?? [])[0]
			let groupName = $(`.ml-1.stream-text-${streamNum}`, elem).text()

			let volNum = 1
			let chapNum = 1
			let volumes = $('.volume', elem).toArray().reverse()
			for (let vol of volumes) {
				let chapterElem = $('li', vol).toArray().reverse()
				for (let chap of chapterElem) {
					let chapId = $(chap).attr('id')?.replace('b-', 'i')
					let name: string | undefined
					let nameArr = ($('a', chap).html() ?? "").replace(/(\t*\n*)/g, '').split(':')
					name = nameArr.length > 1 ? nameArr[1].trim() : undefined

					let time = this.convertTime($('.time', chap).text().trim())
					chapters.push(createChapter({
						id: chapId ?? '',
						mangaId: mangaId,
						name: name,
						chapNum: chapNum,
						volume: volNum,
						time: time,
						group: groupName,
						langCode: LanguageCode.ENGLISH
					}))
					chapNum++
				}
				volNum++
			}
		}

		return chapters
	}


	async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {

		const request = createRequestObject({
			url: `${this.MP_DOMAIN}/manga/${mangaId}/${chapterId}`,
			method: "GET",
			cookies: [createCookie({ name: 'set', value: 'h=1', domain: this.MP_DOMAIN })]
		})

		const data = await this.requestManager.schedule(request, 1)

		let script = JSON.parse((/var _load_pages = (.*);/.exec(data.data) ?? [])[1])
		let pages: string[] = []
		for (let page of script) {
			pages.push(page.u)
		}

		let chapterDetails = createChapterDetails({
			id: chapterId,
			mangaId: mangaId,
			pages: pages,
			longStrip: false
		})

		return chapterDetails
	}


	async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void>{

		let shouldContinueScanning = true
		let pageToScan = 1

		while(shouldContinueScanning) {

			let returnObject: MangaUpdates = {ids: []}

			let request = createRequestObject({
				url: `${this.MP_DOMAIN}/latest/${pageToScan}`,
				method: 'GET',
				cookies: [createCookie({ name: 'set', value: 'h=1', domain: this.MP_DOMAIN })]
			})

			let data = await this.requestManager.schedule(request, 1)
			pageToScan++

			let $ = this.cheerio.load(data.data)

			for (let item of $('.item', '.ls1').toArray()) {
				let id = ($('a', item).first().attr('href') ?? '').split('/').pop() ?? ''
				let mangaTime = $('.time').first().text()
				if (this.convertTime(mangaTime) > time) {
					if (ids.includes(id)) {
						returnObject.ids.push(id)
					}
				}
				else {
					mangaUpdatesFoundCallback(returnObject)
					shouldContinueScanning = false
				}
			}
			mangaUpdatesFoundCallback(returnObject)
		}

	}

	async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {

		// Skeleton create the format of the homepage sections
		//TODO: View more? Does that work with this?
		let section1 = createHomeSection({ id: 'popular_titles', title: 'POPULAR MANGA'})
		let section2 = createHomeSection({ id: 'popular_new_titles', title: 'POPULAR MANGA UPDATES'})
		let section3 = createHomeSection({ id: 'recently_updated', title: 'RECENTLY UPDATED TITLES'})

		sectionCallback(section1)
		sectionCallback(section2)
		sectionCallback(section3)

		const request = createRequestObject({url: `${this.MP_DOMAIN}`, method: 'GET'})
		let data = await this.requestManager.schedule(request, 1)

		let $ = this.cheerio.load(data.data)
		let popManga: MangaTile[] = []
		let newManga: MangaTile[] = []
		let updateManga: MangaTile[] = []

		for (let item of $('li', '.top').toArray()) {
			let id: string = ($('.cover', item).attr('href') ?? '').split('/').pop() ?? ''
			let title: string = $('.cover', item).attr('title') ?? ''
			let image: string = $('img', item).attr('src') ?? ''
			let subtitle: string = $('.visited', item).text() ?? ''

			let sIcon = 'clock.fill'
			let sText = $('i', item).text()
			popManga.push(createMangaTile({
				id: id,
				image: image.replace(/(https:)?\/\//gi, 'https://'),
				title: createIconText({ text: title }),
				subtitleText: createIconText({ text: subtitle }),
				secondaryText: createIconText({ text: sText, icon: sIcon })
			}))
		}
		section1.items = popManga
		sectionCallback(section1)

		for (let item of $('ul', '.mainer').toArray()) {
			for (let elem of $('li', item).toArray()) {
				let id: string = ($('a', elem).first().attr('href') ?? '').split('/').pop() ?? ''
				let title: string = $('img', elem).attr('alt') ?? ''
				let image: string = $('img', elem).attr('src') ?? ''
				let subtitle: string = $('.visited', elem).text() ?? ''

				newManga.push(createMangaTile({
					id: id,
					image: image.replace(/(https:)?\/\//gi, 'https://'),
					title: createIconText({ text: title }),
					subtitleText: createIconText({ text: subtitle })
				}))
			}
		}
		section2.items = newManga
		sectionCallback(section2)

		for (let item of $('.item', 'article').toArray()) {
			let id: string = ($('.cover', item).attr('href') ?? '').split('/').pop() ?? ''
			let title: string = $('.cover', item).attr('title') ?? ''
			let image: string = $('img', item).attr('src') ?? ''
			let subtitle: string = $('.visited', item).text() ?? ''

			let sIcon = 'clock.fill'
			let sText = $('li.new', item).first().find('i').last().text() ?? ''
			updateManga.push(createMangaTile({
				id: id,
				image: image.replace(/(https:)?\/\//gi, 'https://'),
				title: createIconText({ text: title }),
				subtitleText: createIconText({ text: subtitle }),
				secondaryText: createIconText({ text: sText, icon: sIcon })
			}))
		}
		section3.items = updateManga
		sectionCallback(section3)

	}

	async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {

		if(!metadata.page) {
			metadata.page = 1
		}

		let param = ''
		switch (homepageSectionId) {
			case 'popular_titles': {
				param = `/genre/${metadata.page}`
				break
			}
			case 'popular_new_titles': {
				param = `/search?orderby=views&page=${metadata.page}`
				break
			}
			case 'recently_updated': {
				param = `/latest/${metadata.page}`
				break
			}
			default: return Promise.resolve(null)
		}

		const request = createRequestObject({
			url: `${this.MP_DOMAIN}${param}`,
			method: 'GET'
		})

		let data = await this.requestManager.schedule(request, 1)

		let $ = this.cheerio.load(data.data)
		let manga: MangaTile[] = []
		if (homepageSectionId == 'popular_titles') {
			for (let item of $('.item', '.row.mt-2.ls1').toArray()) {
				let id = $('a', item).first().attr('href')?.split('/').pop() ?? ''
				let title = $('a', item).first().attr('title') ?? ''
				let image = $('img', item).attr('src') ?? ''
				let elems = $('small.ml-1', item)
				let rating = $(elems[0]).text().trim()
				let rank = $(elems[1]).text().split('-')[0].trim()
				let chapters = $('span.small', item).text().trim()

				manga.push(createMangaTile({
					id: id,
					image: image.replace(/(https:)?\/\//gi, 'https://'),
					title: createIconText({ text: title }),
					subtitleText: createIconText({ text: chapters }),
					primaryText: createIconText({ text: rating, icon: 'star.fill' }),
					secondaryText: createIconText({ text: rank, icon: 'chart.bar.fill' })
				}))
			}
		}
		else if (homepageSectionId == 'popular_new_titles') {
			for (let item of $('.item', '.manga-list').toArray()) {
				let id = $('.cover', item).attr('href')?.split('/').pop() ?? ''
				let title = $('.cover', item).attr('title') ?? ''
				let image = $('img', item).attr('src') ?? ''
				let rank = $('[title=rank]', item).text().split('·')[1].trim()
				let rating = $('.rate', item).text().trim()
				let time = $('.justify-content-between', item).first().find('i').text()
				manga.push(createMangaTile({
					id: id,
					image: image.replace(/(https:)?\/\//gi, 'https://'),
					title: createIconText({ text: title }),
					subtitleText: createIconText({ text: time }),
					primaryText: createIconText({ text: rating, icon: 'star.fill' }),
					secondaryText: createIconText({ text: rank, icon: 'chart.bar.fill' })
				}))
			}
		}
		else if (homepageSectionId == 'recently_updated') {
			for (let item of $('.item', '.ls1').toArray()) {
				let id = $('.cover', item).attr('href')?.split('/').pop() ?? ''
				let title = $('.cover', item).attr('title') ?? ''
				let image = $('img', item).attr('src') ?? ''
				let chapter = $('.visited', item).first().text()
				let time = $('.time', item).first().text()
				manga.push(createMangaTile({
					id: id,
					image: image.replace(/(https:)?\/\//gi, 'https://'),
					title: createIconText({ text: title }),
					subtitleText: createIconText({ text: chapter }),
					secondaryText: createIconText({ text: time, icon: 'clock.fill' })
				}))
			}
		}
		else return null

		metadata.page++
		return createPagedResults({
			results: manga,
			metadata: metadata
		})
	}


	async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {

		let page
		if(!metadata.page) {
			page = 1
		}
		else {
			page = metadata.page
		}

		// Put together the search query
		let genres = (query.includeGenre ?? []).join(',')
		let excluded = (query.excludeGenre ?? []).join(',')
		// will not let you search across more than one format
		let format = (query.includeFormat ?? [])[0]
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

		const request = createRequestObject({
			url: `${this.MP_DOMAIN}/search?${search}&page=${page}`,
			method: 'GET',
			metadata: metadata,
			cookies: [createCookie({ name: 'set', value: `h=${query.hStatus ? 1 : 0}`, domain: this.MP_DOMAIN })]
		})

		// Make the request
		const data = await this.requestManager.schedule(request, 1)

		let $ = this.cheerio.load(data.data)
		let mangaList = $('.manga-list')
		let manga: MangaTile[] = []
		for (let item of $('.item', mangaList).toArray()) {
			let id = $('a', item).first().attr('href')?.split('/').pop() ?? ''
			let img = $('img', item)
			let image = $(img).attr('src') ?? ''
			let title = $(img).attr('title') ?? ''
			let rate = $('.rate', item)
			let rating = Number($(rate).find('i').text())
			let author = ""

			for (let field of $('.field', item).toArray()) {
				let elem = $('b', field).first().text()
				if (elem == 'Authors/Artists:') {
					let authorCheerio = $('a', field).first()
					author = $(authorCheerio).text()
				}
			}

			let lastUpdate = $('ul', item).find('i').text()

			manga.push(createMangaTile({
				id: id,
				image: image.replace(/(https:)?\/\//gi, 'https://'),
				title: createIconText({ text: title }),
				subtitleText: createIconText({ text: author }),
				primaryText: createIconText({ text: rating.toString(), icon: 'star.fill' }),
				secondaryText: createIconText({ text: lastUpdate, icon: 'clock.fill' })
			}))
		}

		return createPagedResults({
			results: manga
		})
	}

	async getTags(): Promise<TagSection[] | null> {

		const request = createRequestObject({
			url: `${this.MP_DOMAIN}/search?`,
			method: "GET",
			cookies: [createCookie({ name: 'set', value: 'h=1', domain: this.MP_DOMAIN })],
		})

		const data = await this.requestManager.schedule(request, 1)

		let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
		createTagSection({ id: '1', label: 'format', tags: [] })]
		let $ = this.cheerio.load(data.data)
		for (let genre of $('span', '[name=genres]').toArray())
			tagSections[0].tags.push(createTag({ id: $(genre).attr('rel') ?? '', label: $(genre).text() }))
		for (let type of $('span', '[name=types]').toArray())
			tagSections[1].tags.push(createTag({ id: $(type).attr('rel') ?? '', label: $(type).text() }))
		return tagSections
	}
}
