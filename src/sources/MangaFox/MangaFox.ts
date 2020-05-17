import {Source} from '../Source'
import {Manga, MangaStatus} from '../../models/Manga/Manga'
import {Chapter} from '../../models/Chapter/Chapter'
import {MangaTile} from '../../models/MangaTile/MangaTile'
import {SearchRequest} from '../../models/SearchRequest/SearchRequest'
import {Request} from '../../models/RequestObject/RequestObject'
import {ChapterDetails} from '../../models/ChapterDetails/ChapterDetails'
import {LanguageCode} from '../../models/Languages/Languages'
import {TagSection} from "../../models/TagSection/TagSection";
import {HomeSection, HomeSectionRequest} from "../../models/HomeSection/HomeSection";

const MF_DOMAIN = 'https://fanfox.net'
const MF_DOMAIN_MOBILE = 'https://m.fanfox.net'

export class MangaFox extends Source {

    constructor(cheerio: CheerioAPI) {
        super(cheerio)
    }

    get version(): string { return '1.0.0' }

    get name(): string { return 'MangaFox' }

    get icon(): string { return 'icon.png' }

    get author(): string { return 'Sirus' }

    get authorWebsite(): string { return 'https://github.com/Sirush' }

    get description(): string { return 'Extension that pulls manga from MangaFox, includes Advanced Search and Updated manga fetching' }

    get hentaiSource(): boolean {
        return false
    }

    getMangaDetailsRequest(ids: string[]): Request[] {
        let requests: Request[] = []
        for (let id of ids) {
            let metadata = {'id': id};
            requests.push(createRequestObject({
                url: `${MF_DOMAIN}/manga/${id}`,
                method: 'GET',
                cookies: [createCookie({name: 'isAdult', value: '1', domain: MF_DOMAIN})],
                metadata: metadata
            }));
        }

        return requests
    }

    getMangaDetails(data: any, metadata: any): Manga[] {
        let mangas: Manga[] = [];

        let tagRegexp = new RegExp('\\/directory\\/(.*)\\/');

        let $ = this.cheerio.load(data);

        let tagSections: TagSection[] = [createTagSection({id: '0', label: 'genres', tags: []}),
            createTagSection({id: '1', label: 'format', tags: []})]

        let details = $('.detail-info-right');
        let cover = $('img.detail-bg-img').first().attr('src');
        let title = $('span.detail-info-right-title-font', details).text().trim();
        let rawStatus = $('span.detail-info-right-title-tip', details).text().trim();
        let rating = $('span.item-score', details).text().trim().replace(',', '.');
        let author = $('p.detail-info-right-say a', details).text().trim();
        let isAdult = false;
        let tags = $('a', '.detail-info-right-tag-list').each((i, tag) => {
            let id = $(tag).attr('href')?.match(tagRegexp)![1];
            let label = $(tag).text().trim();
            if (label?.includes('Adult') || label?.includes('Mature'))
                isAdult = true;
            tagSections[0].tags.push(createTag({id: id, label: label!}));
        })

        for (let tag in tags) {

        }

        let description = $('p.fullcontent').text().trim();

        let status = MangaStatus.ONGOING;
        switch (rawStatus) {
            case 'Ongoing':
                status = MangaStatus.ONGOING;
                break;
            case 'Completed':
                status = MangaStatus.COMPLETED;
                break;
            default:
                status = MangaStatus.ONGOING;
                break;
        }
        let titles = [];
        titles.push(title!);

        mangas.push(createManga({
            id: metadata.id,
            titles: titles,
            image: cover!,
            rating: Number(rating),
            status: status,
            author: author!,
            tags: tagSections,
            desc: description!,
            hentai: isAdult
        }))


        return mangas;
    }

    getChaptersRequest(mangaId: string): Request {
        let metadata = {mangaId}
        return createRequestObject({
            url: `${MF_DOMAIN}/manga/${mangaId}`,
            method: "GET",
            metadata: metadata,
            cookies: [createCookie({name: 'isAdult', value: '1', domain: MF_DOMAIN})]
        })
    }

    getChapters(data: any, metadata: any): Chapter[] {
        let $ = this.cheerio.load(data);
        let chapters: Chapter[] = []
        let rawChapters = $('div#chapterlist ul li').children('a').toArray().reverse();
        let chapterNumber = 1;
        let chapterIdRegex = new RegExp('\\/manga\\/.*\\/(.*)\\/');
        let volumeRegex = new RegExp('Vol.(\\d+)');

        for (let element of rawChapters) {
            let title = $('p.title3', element).html() ?? '';
            let date = new Date(Date.parse($('p.title2', element).html() ?? ''));
            let chapterId = element.attribs['href'].match(chapterIdRegex)![1];
            let volMatch = title.match(volumeRegex)
            let volume = volMatch != null && volMatch.length > 0 ? Number(volMatch[1]) : undefined;

            chapters.push(createChapter({
                id: chapterId,
                mangaId: metadata.mangaId,
                time: date,
                name: title,
                langCode: LanguageCode.ENGLISH,
                chapNum: chapterNumber,
                volume: volume
            }))
            chapterNumber++;
        }
        return chapters;
    }

    getChapterDetailsRequest(mangaId: string, chapId: string): Request {
        let metadata = {'mangaId': mangaId, 'chapterId': chapId, 'nextPage': false, 'page': 1}
        return createRequestObject({
            url: `${MF_DOMAIN_MOBILE}/roll_manga/${mangaId}/${chapId}`,
            method: "GET",
            metadata: metadata,
            cookies: [createCookie({name: 'isAdult', value: '1', domain: MF_DOMAIN})]
        });
    }

    getChapterDetails(data: any, metadata: any): ChapterDetails {
        let $ = this.cheerio.load(data);
        let pages: string[] = [];
        var rawPages = $('div#viewer').children('img').toArray();
        for (let page of rawPages) {
            pages.push(page.attribs['data-original']);
        }

        let chapterDetails = createChapterDetails({
            id: metadata.chapterId,
            mangaId: metadata.mangaId,
            pages: pages,
            longStrip: false
        });

        return chapterDetails;
    }

    getHomePageSectionRequest(): HomeSectionRequest[] {
        let request = createRequestObject({url: `${MF_DOMAIN}`, method: 'GET'})
        let section1 = createHomeSection({id: 'hot_manga', title: 'Hot Manga Releases'})
        let section2 = createHomeSection({id: 'being_read', title: 'Being Read Right Now'})
        let section3 = createHomeSection({id: 'new_manga', title: 'New Manga Release'})
        let section4 = createHomeSection({id: 'latest_updates', title: 'Latest Updates'})

        return [createHomeSectionRequest({request: request, sections: [section1, section2, section3, section4]})]
    }

    getHomePageSections(data: any, sections: HomeSection[]): HomeSection[] {
        let $ = this.cheerio.load(data)
        let hotManga: MangaTile[] = []
        let beingReadManga: MangaTile[] = []
        let newManga: MangaTile[] = []
        let latestManga: MangaTile[] = []

        let idRegExp = new RegExp('\\/manga\\/(.*)\\/');

        let firstSection = $('div.main-large').first();
        let hotMangas = $('.manga-list-1',firstSection).first();
        let beingReadMangas = hotMangas.next();
        let newMangas = $('div.line-list');
        let latestMangas = $('ul.manga-list-4-list');

        for (let manga of $('li', hotMangas).toArray()) {
            let id = $('a', manga).first().attr('href')?.match(idRegExp)![1];
            let cover = $('img', manga).first().attr('src');
            let title: string = $('.manga-list-1-item-title', manga).text();
            let subtitle: string = $('.manga-list-1-item-subtitle', manga).text();

            hotManga.push(createMangaTile({
                id: id,
                image: cover!,
                title: createIconText({text: title}),
                subtitleText: createIconText({text: subtitle}),
            }));
        }

        for (let manga of $('li', beingReadMangas).toArray()) {
            let id = $('a', manga).first().attr('href')?.match(idRegExp)![1];
            let cover = $('img', manga).first().attr('src');
            let title: string = $('.manga-list-1-item-title', manga).text();
            let subtitle: string = $('.manga-list-1-item-subtitle', manga).text();

            beingReadManga.push(createMangaTile({
                id: id,
                image: cover!,
                title: createIconText({text: title}),
                subtitleText: createIconText({text: subtitle}),
            }));
        }

        for (let manga of $('li', newMangas).toArray()) {
            let id = $('a', manga).first().attr('href')?.match(idRegExp)![1];
            let cover = $('img', manga).first().attr('src');
            let title: string = $('.manga-list-1-item-title', manga).text();
            let subtitle: string = $('.manga-list-1-item-subtitle', manga).text();

            newManga.push(createMangaTile({
                id: id,
                image: cover!,
                title: createIconText({text: title}),
                subtitleText: createIconText({text: subtitle}),
            }));
        }

        for (let manga of $('li', latestMangas).toArray()) {
            let id = $('a', manga).first().attr('href')?.match(idRegExp)![1];
            let cover = $('img', manga).first().attr('src');
            let title: string = $('.manga-list-4-item-title', manga).text();
            let subtitle: string = $('.manga-list-4-item-subtitle', manga).text();

            latestManga.push(createMangaTile({
                id: id,
                image: cover!,
                title: createIconText({text: title}),
                subtitleText: createIconText({text: subtitle}),
            }));
        }

        // console.log(updateManga)
        sections[0].items = hotManga;
        sections[1].items = beingReadManga;
        sections[2].items = newManga;
        sections[3].items = latestManga;
        return sections
    }

    searchRequest(query: SearchRequest, page: number): Request | null {
        let genres = (query.includeGenre ?? []).join(',');
        let excluded = (query.excludeGenre ?? []).join(',,');
        let type = (query.includeFormat ?? [])[0];
        let status = ""
        switch (query.status) {
            case 0:
                status = '2';
                break;
            case 1:
                status = '1';
                break;
            default:
                status = '0'
        }
        let search: string = `name=${encodeURI(query.title ?? '')}&`;
        search += `author=${encodeURI(query.author || '')}&`;
        search += `artist=${encodeURI(query.artist || '')}&`;
        search += `type=${type}&genres=${genres}&nogenres=${excluded}&st=${status}`;

        let metadata = {'search': search};
        return createRequestObject({
            url: `${MF_DOMAIN}/search?${search}`,
            method: 'GET',
            metadata: metadata,
            cookies: [createCookie({name: 'isAdult', value: '1', domain: MF_DOMAIN})]
        });
    }

    search(data: any, metadata: any): MangaTile[] | null {
        let $ = this.cheerio.load(data);

        let mangas: MangaTile[] = [];

        let idRegExp = new RegExp('\\/manga\\/(.*)\\/');
        $('ul.manga-list-4-list').children('li').each((index, manga) => {
            let id = $('a', manga).first().attr('href')?.match(idRegExp)![1];
            let cover = $('img', manga).first().attr('src');
            let title = $('p.manga-list-4-item-title a', manga).first().text().trim();
            let tips = $('p.manga-list-4-item-tip', manga).toArray();
            let author = $('a', tips[0]).text().trim();
            let lastUpdate = $('a', tips[1]).text().trim();
            let shortDesc = $(tips[2]).text().trim();

            mangas.push(createMangaTile({
                id: id,
                image: cover!,
                title: createIconText({text: title ?? ''}),
                subtitleText: createIconText({text: author ?? ''}),
                primaryText: createIconText({text: shortDesc ?? ''}),
                secondaryText: createIconText({text: lastUpdate ?? ''}),
            }));

        });

        return mangas;
    }
}
