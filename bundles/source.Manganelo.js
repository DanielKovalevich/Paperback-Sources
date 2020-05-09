(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Sources = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Source_1 = require("../Source");
const MN_DOMAIN = 'https://manganelo.com';
class Manganelo extends Source_1.Source {
    constructor(cheerio) {
        super(cheerio);
    }
    get version() { return '1.0'; }
    get name() { return 'Manganelo'; }
    get icon() { return 'https://manganelo.com/themes/hm/images/logo.png'; }
    get author() { return 'Daniel Kovalevich'; }
    get authorWebsite() { return 'https://github.com/DanielKovalevich'; }
    get description() { return 'Extension that pulls manga from Manganelo, includes Advanced Search and Updated manga fetching'; }
    getMangaDetailsRequest(ids) {
        let requests = [];
        for (let id of ids) {
            let metadata = { 'id': id };
            requests.push(createRequestObject({
                url: `${MN_DOMAIN}/manga/`,
                metadata: metadata,
                method: 'GET',
                param: id
            }));
        }
        return requests;
    }
    getMangaDetails(data, metadata) {
        var _a, _b;
        let manga = [];
        for (let [i, response] of data.entries()) {
            let $ = this.cheerio.load(response);
            let panel = $('.panel-story-info');
            let title = (_a = $('.img-loading', panel).attr('title')) !== null && _a !== void 0 ? _a : '';
            let image = (_b = $('.img-loading', panel).attr('src')) !== null && _b !== void 0 ? _b : '';
            let table = $('.variations-tableInfo', panel);
            let author = '';
            let artist = '';
            let rating = 0;
            let status = 0;
            let titles = [title];
            let follows = 0;
            let views = 0;
            let lastUpdate = '';
            let hentai = false;
            let tagSections = [createTagSection({ id: '0', label: 'genres', tags: [] }),
                createTagSection({ id: '1', label: 'format', tags: [] })];
            for (let row of $('tr', table).toArray()) {
                if ($(row).find('.info-alternative').length > 0) {
                    let alts = $('h2', table).text().split(/,|;/);
                    for (let alt of alts) {
                        titles.push(alt.trim());
                    }
                }
                else if ($(row).find('.info-author').length > 0) {
                    let autart = $('.table-value', row).find('a').toArray();
                    author = $(autart[0]).text();
                    if (autart.length > 1) {
                        artist = $(autart[1]).text();
                    }
                }
                else if ($(row).find('.info-status').length > 0) {
                    status = $('.table-value', row).text() == 'Ongoing' ? 1 : 0;
                }
                else if ($(row).find('.info-genres').length > 0) {
                    let elems = $('.table-value', row).find('a').toArray();
                    for (let elem of elems) {
                        let text = $(elem).text();
                        if (text.toLowerCase().includes('smut')) {
                            hentai = true;
                        }
                        tagSections[0].tags.push(createTag({ id: text, label: text }));
                    }
                }
            }
            table = $('.story-info-right-extent', panel);
            for (let row of $('p', table).toArray()) {
                if ($(row).find('.info-time').length > 0) {
                    let time = new Date($('.stre-value', row).text().replace(/(-*(AM)*(PM)*)/g, ''));
                    lastUpdate = time.toDateString();
                }
                else if ($(row).find('.info-view').length > 0) {
                    views = Number($('.stre-value', row).text().replace(/,/g, ''));
                }
            }
            rating = Number($('[property=v\\:average]', table).text());
            follows = Number($('[property=v\\:votes]', table).text());
            let summary = $('.panel-story-info-description', panel).text();
            manga.push({
                id: metadata[i].id,
                titles: titles,
                image: image,
                rating: Number(rating),
                status: status,
                artist: artist,
                author: author,
                tags: tagSections,
                views: views,
                follows: follows,
                lastUpdate: lastUpdate,
                description: summary,
                hentai: hentai
            });
        }
        return manga;
    }
    getChaptersRequest(mangaId) {
        let metadata = { 'id': mangaId };
        return createRequestObject({
            url: `${MN_DOMAIN}/manga/`,
            metadata: metadata,
            method: 'GET',
            param: mangaId
        });
    }
    getChapters(data, metadata) {
        var _a, _b, _c, _d, _e, _f;
        let $ = this.cheerio.load(data);
        let allChapters = $('.row-content-chapter', '.body-site');
        let chapters = [];
        for (let chapter of $('li', allChapters).toArray()) {
            let id = (_b = (_a = $('a', chapter).attr('href')) === null || _a === void 0 ? void 0 : _a.split('/').pop()) !== null && _b !== void 0 ? _b : '';
            let name = (_c = $('a', chapter).text()) !== null && _c !== void 0 ? _c : '';
            let chNum = Number((_e = ((_d = /Chapter (\d*)/g.exec(name)) !== null && _d !== void 0 ? _d : [])[1]) !== null && _e !== void 0 ? _e : '');
            let time = new Date((_f = $('.chapter-time', chapter).attr('title')) !== null && _f !== void 0 ? _f : '');
            chapters.push(createChapter({
                id: id,
                mangaId: metadata.id,
                name: name,
                langCode: 'en',
                chapNum: chNum,
                time: time
            }));
        }
        return chapters;
    }
    getChapterDetailsRequest(mangaId, chId) {
        let metadata = { 'mangaId': mangaId, 'chapterId': chId, 'nextPage': false, 'page': 1 };
        return createRequestObject({
            url: `${MN_DOMAIN}/chapter/`,
            method: "GET",
            metadata: metadata,
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                Cookie: 'content_lazyload=off'
            },
            param: `${mangaId}/${chId}`
        });
    }
    getChapterDetails(data, metadata) {
        var _a;
        let $ = this.cheerio.load(data);
        let pages = [];
        for (let item of $('img', '.container-chapter-reader').toArray()) {
            pages.push((_a = $(item).attr('src')) !== null && _a !== void 0 ? _a : '');
        }
        let chapterDetails = createChapterDetails({
            id: metadata.chapterId,
            mangaId: metadata.mangaId,
            pages: pages,
            longStrip: false
        });
        let returnObject = {
            'details': chapterDetails,
            'nextPage': metadata.nextPage,
            'param': null
        };
        return returnObject;
    }
    filterUpdatedMangaRequest(ids, time, page) {
        let metadata = { 'ids': ids, 'referenceTime': time };
        return createRequestObject({
            url: `${MN_DOMAIN}/genre-all/`,
            method: 'GET',
            metadata: metadata,
            headers: {
                "content-type": "application/x-www-form-urlencoded"
            },
            param: `${page}`
        });
    }
    filterUpdatedManga(data, metadata) {
        var _a, _b;
        let $ = this.cheerio.load(data);
        let returnObject = {
            'updatedMangaIds': [],
            'nextPage': true
        };
        let panel = $('.panel-content-genres');
        for (let item of $('.content-genres-item', panel).toArray()) {
            let id = (_b = ((_a = $('a', item).first().attr('href')) !== null && _a !== void 0 ? _a : '').split('/').pop()) !== null && _b !== void 0 ? _b : '';
            let time = new Date($('.genres-item-time').first().text());
            // site has a quirk where if the manga what updated in the last hour
            // it will put the update time as tomorrow
            if (time > new Date(Date.now())) {
                time = new Date(Date.now() - 60000);
            }
            if (time > metadata.referenceTime) {
                if (metadata.ids.includes(id)) {
                    returnObject.updatedMangaIds.push(id);
                }
            }
            else {
                returnObject.nextPage = false;
                return returnObject;
            }
        }
        return returnObject;
    }
    getHomePageSectionRequest() {
        let request = createRequestObject({ url: `${MN_DOMAIN}`, method: 'GET', });
        let section1 = createHomeSection({ id: 'top_week', title: 'TOP OF THE WEEK' });
        let section2 = createHomeSection({ id: 'latest_updates', title: 'LATEST UPDATES' });
        let section3 = createHomeSection({ id: 'new_manga', title: 'NEW MANGA' });
        return [createHomeSectionRequest({ request: request, sections: [section1, section2, section3] })];
    }
    getHomePageSections(data, sections) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        let $ = cheerio.load(data);
        let topManga = [];
        let updateManga = [];
        let newManga = [];
        for (let item of $('.item', '.owl-carousel').toArray()) {
            let id = (_b = (_a = $('a', item).first().attr('href')) === null || _a === void 0 ? void 0 : _a.split('/').pop()) !== null && _b !== void 0 ? _b : '';
            let image = (_c = $('img', item).attr('src')) !== null && _c !== void 0 ? _c : '';
            topManga.push(createMangaTile({
                id: id,
                image: image,
                title: createIconText({ text: $('a', item).first().text() }),
                subtitleText: createIconText({ text: $('[rel=nofollow]', item).text() })
            }));
        }
        for (let item of $('.content-homepage-item', '.panel-content-homepage').toArray()) {
            let id = (_e = (_d = $('a', item).first().attr('href')) === null || _d === void 0 ? void 0 : _d.split('/').pop()) !== null && _e !== void 0 ? _e : '';
            let image = (_f = $('img', item).attr('src')) !== null && _f !== void 0 ? _f : '';
            let itemRight = $('.content-homepage-item-right', item);
            let latestUpdate = $('.item-chapter', itemRight).first();
            updateManga.push(createMangaTile({
                id: id,
                image: image,
                title: createIconText({ text: $('a', itemRight).first().text() }),
                subtitleText: createIconText({ text: $('.item-author', itemRight).text() }),
                primaryText: createIconText({ text: $('.genres-item-rate', item).text(), icon: 'star.fill' }),
                secondaryText: createIconText({ text: $('i', latestUpdate).text(), icon: 'clock.fill' })
            }));
        }
        for (let item of $('a', '.panel-newest-content').toArray()) {
            let id = (_h = (_g = $(item).attr('href')) === null || _g === void 0 ? void 0 : _g.split('/').pop()) !== null && _h !== void 0 ? _h : '';
            let image = (_j = $('img', item).attr('src')) !== null && _j !== void 0 ? _j : '';
            let title = (_k = $('img', item).attr('alt')) !== null && _k !== void 0 ? _k : '';
            newManga.push(createMangaTile({
                id: id,
                image: image,
                title: createIconText({ text: title })
            }));
        }
        sections[0].items = topManga;
        sections[1].items = updateManga;
        sections[2].items = newManga;
        return sections;
    }
    searchRequest(query, page) {
        var _a, _b, _c, _d, _e, _f;
        let genres = ((_a = query.includeGenre) !== null && _a !== void 0 ? _a : []).concat((_b = query.includeDemographic) !== null && _b !== void 0 ? _b : []).join('_');
        let excluded = ((_c = query.excludeGenre) !== null && _c !== void 0 ? _c : []).concat((_d = query.excludeDemographic) !== null && _d !== void 0 ? _d : []).join('_');
        let status = "";
        switch (query.status) {
            case 0:
                status = 'completed';
                break;
            case 1:
                status = 'ongoing';
                break;
            default: status = '';
        }
        let keyword = ((_e = query.title) !== null && _e !== void 0 ? _e : '').replace(' ', '_');
        if (query.author)
            keyword += ((_f = query.author) !== null && _f !== void 0 ? _f : '').replace(' ', '_');
        let search = `s=all&keyw=${keyword}`;
        search += `&g_i=${genres}&g_e=${excluded}&page=${page}`;
        if (status) {
            search += `&sts=${status}`;
        }
        let metadata = { 'search': search };
        return createRequestObject({
            url: `${MN_DOMAIN}/advanced_search?`,
            method: 'GET',
            metadata: metadata,
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            param: `${search}`
        });
    }
    search(data) {
        var _a, _b, _c;
        let $ = this.cheerio.load(data);
        let panel = $('.panel-content-genres');
        let manga = [];
        for (let item of $('.content-genres-item', panel).toArray()) {
            let id = (_b = (_a = $('.genres-item-name', item).attr('href')) === null || _a === void 0 ? void 0 : _a.split('/').pop()) !== null && _b !== void 0 ? _b : '';
            let title = $('.genres-item-name', item).text();
            let subTitle = $('.genres-item-chap', item).text();
            let image = (_c = $('.img-loading', item).attr('src')) !== null && _c !== void 0 ? _c : '';
            let rating = $('.genres-item-rate', item).text();
            let updated = $('.genres-item-time', item).text();
            manga.push(createMangaTile({
                id: id,
                image: image,
                title: createIconText({ text: title }),
                subtitleText: createIconText({ text: subTitle }),
                primaryText: createIconText({ text: rating, icon: 'star.fill' }),
                secondaryText: createIconText({ text: updated, icon: 'clock.fill' })
            }));
        }
        return manga;
    }
    getTagsRequest() {
        return createRequestObject({
            url: `${MN_DOMAIN}/advanced_search?`,
            method: 'GET',
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            }
        });
    }
    getTags(data) {
        var _a;
        let $ = this.cheerio.load(data);
        let panel = $('.advanced-search-tool-genres-list');
        let genres = createTagSection({
            id: 'genre',
            label: 'Genre',
            tags: []
        });
        for (let item of $('span', panel).toArray()) {
            let id = (_a = $(item).attr('data-i')) !== null && _a !== void 0 ? _a : '';
            let label = $(item).text();
            genres.tags.push(createTag({ id: id, label: label }));
        }
        return [genres];
    }
    getViewMoreRequest(key, page) {
        let param = '';
        switch (key) {
            case 'latest_updates': {
                param = `/genre-all/${page}`;
                break;
            }
            case 'new_manga': {
                param = `/genre-all/${page}?type=newest`;
                break;
            }
            default: return null;
        }
        return createRequestObject({
            url: `${MN_DOMAIN}`,
            method: 'GET',
            param: param
        });
    }
    getViewMoreItems(data, key) {
        var _a, _b, _c;
        let $ = this.cheerio.load(data);
        let manga = [];
        if (key == 'latest_updates' || key == 'new_manga') {
            let panel = $('.panel-content-genres');
            for (let item of $('.content-genres-item', panel).toArray()) {
                let id = (_b = ((_a = $('a', item).first().attr('href')) !== null && _a !== void 0 ? _a : '').split('/').pop()) !== null && _b !== void 0 ? _b : '';
                let image = (_c = $('img', item).attr('src')) !== null && _c !== void 0 ? _c : '';
                let title = $('.genres-item-name', item).text();
                let subtitle = $('.genres-item-chap', item).text();
                let time = new Date($('.genres-item-time').first().text());
                if (time > new Date(Date.now())) {
                    time = new Date(Date.now() - 60000);
                }
                let rating = $('.genres-item-rate', item).text();
                manga.push(createMangaTile({
                    id: id,
                    image: image,
                    title: createIconText({ text: title }),
                    subtitleText: createIconText({ text: subtitle }),
                    primaryText: createIconText({ text: rating, icon: 'star.fill' }),
                    secondaryText: createIconText({ text: time.toDateString(), icon: 'clock.fill' })
                }));
            }
        }
        else
            return null;
        return manga;
    }
}
exports.Manganelo = Manganelo;

},{"../Source":2}],2:[function(require,module,exports){
"use strict";
/**
 * Request objects hold information for a particular source (see sources for example)
 * This allows us to to use a generic api to make the calls against any source
 */
Object.defineProperty(exports, "__esModule", { value: true });
class Source {
    constructor(cheerio) {
        this.cheerio = cheerio;
    }
    get authorWebsite() { return null; }
    // <-----------        OPTIONAL METHODS        -----------> //
    // Retrieves all the tags for the source to help with advanced searching
    getTagsRequest() { return null; }
    getTags(data) { return null; }
    // Determines if, and how many times, the passed in ids have been updated since reference time 
    filterUpdatedMangaRequest(ids, time, page) { return null; }
    filterUpdatedManga(data, metadata) { return null; }
    // For the apps home page, there are multiple sections that contain manga of interest
    // Function returns formatted sections and any number of such
    getHomePageSectionRequest() { return null; }
    getHomePageSections(data, section) { return null; }
    // For many of the home page sections, there is an ability to view more of that selection
    // Calling these functions will retrieve more MangaTiles for the particular section
    getViewMoreRequest(key, page) { return null; }
    getViewMoreItems(data, key) { return null; }
    // Returns the number of calls that can be done per second from the application
    // This is to avoid IP bans from many of the sources
    // Can be adjusted per source since different sites have different limits
    getRateLimit() { return 2; }
    // <-----------        PROTECTED METHODS        -----------> //
    // Many sites use '[x] time ago' - Figured it would be good to handle these cases in general
    convertTime(timeAgo) {
        var _a;
        let time;
        let trimmed = Number(((_a = /\d*/.exec(timeAgo)) !== null && _a !== void 0 ? _a : [])[0]);
        trimmed = (trimmed == 0 && timeAgo.includes('a')) ? 1 : trimmed;
        if (timeAgo.includes('minutes')) {
            time = new Date(Date.now() - trimmed * 60000);
        }
        else if (timeAgo.includes('hours')) {
            time = new Date(Date.now() - trimmed * 3600000);
        }
        else if (timeAgo.includes('days')) {
            time = new Date(Date.now() - trimmed * 86400000);
        }
        else if (timeAgo.includes('year') || timeAgo.includes('years')) {
            time = new Date(Date.now() - trimmed * 31556952000);
        }
        else {
            time = new Date(Date.now());
        }
        return time;
    }
}
exports.Source = Source;

},{}]},{},[1])(1)
});
