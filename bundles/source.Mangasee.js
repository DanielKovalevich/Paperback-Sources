(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Sources = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Source_1 = require("../Source");
const MS_DOMAIN = 'https://mangaseeonline.us';
class Mangasee extends Source_1.Source {
    constructor(cheerio) {
        super(cheerio);
    }
    get version() { return '1.0'; }
    get name() { return 'Mangasee'; }
    get description() { return 'Extension that pulls manga from Mangasee, includes Advanced Search and Updated manga fetching'; }
    getMangaDetailsRequest(ids) {
        let requests = [];
        for (let id of ids) {
            let metadata = { 'id': id };
            requests.push(createRequestObject({
                url: `${MS_DOMAIN}/manga/`,
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
            let info = $('.row');
            let image = (_a = $('img', '.row').attr('src')) !== null && _a !== void 0 ? _a : '';
            let title = (_b = $('.SeriesName', info).text()) !== null && _b !== void 0 ? _b : '';
            let titles = [title];
            let details = $('.details', info);
            let author = '';
            let tagSections = [createTagSection({ id: '0', label: 'genres', tags: [] }),
                createTagSection({ id: '1', label: 'format', tags: [] })];
            let status = 1;
            let summary = '';
            let hentai = false;
            for (let row of $('.row', details).toArray()) {
                let text = $('b', row).text();
                switch (text) {
                    case 'Alternate Name(s): ': {
                        titles.push($(row).text().replace(/(Alternate Name\(s\):)*(\t*\n*)/g, '').trim());
                        break;
                    }
                    case 'Author(s): ': {
                        author = $(row).text().replace(/(Author\(s\):)*(\t*\n*)/g, '').trim();
                        break;
                    }
                    case 'Genre(s): ': {
                        let items = $(row).text().replace(/(Genre\(s\):)*(\t*\n*)/g, '').split(',');
                        for (let item of items) {
                            if (item.toLowerCase().includes('hentai')) {
                                hentai = true;
                            }
                            else {
                                tagSections[0].tags.push(createTag({ id: item.trim(), label: item.trim() }));
                            }
                        }
                        break;
                    }
                    case 'Type:': {
                        let type = $(row).text().replace(/(Type:)*(\t*\n*)/g, '').trim();
                        tagSections[1].tags.push(createTag({ id: type.trim(), label: type.trim() }));
                        break;
                    }
                    case 'Status: ': {
                        status = $(row).text().includes('Ongoing') ? 1 : 0;
                        break;
                    }
                }
                summary = $('.description', row).text();
            }
            manga.push(createManga({
                id: metadata[i].id,
                titles: titles,
                image: image,
                rating: 0,
                status: status,
                author: author,
                tags: tagSections,
                description: summary,
                hentai: hentai
            }));
        }
        return manga;
    }
    getChaptersRequest(mangaId) {
        let metadata = { 'id': mangaId };
        return createRequestObject({
            url: `${MS_DOMAIN}/manga/`,
            method: "GET",
            metadata: metadata,
            headers: {
                "content-type": "application/x-www-form-urlencoded"
            },
            param: mangaId
        });
    }
    getChapters(data, metadata) {
        var _a, _b, _c, _d, _e;
        let $ = this.cheerio.load(data);
        let chapters = [];
        for (let item of $('.list-group-item', '.list.chapter-list').toArray()) {
            let id = ((_b = (_a = $(item).attr('href')) === null || _a === void 0 ? void 0 : _a.split('/').pop()) !== null && _b !== void 0 ? _b : '').replace('.html', '');
            let chNum = Number((_c = $(item).attr('chapter')) !== null && _c !== void 0 ? _c : 0);
            let title = (_d = $('.chapterLabel', item).text()) !== null && _d !== void 0 ? _d : '';
            let time = new Date((_e = $('time', item).attr('datetime')) !== null && _e !== void 0 ? _e : '');
            chapters.push(createChapter({
                id: id,
                mangaId: metadata.id,
                name: title,
                chapNum: chNum,
                time: time,
                langCode: "en",
            }));
        }
        return chapters;
    }
    getChapterDetailsRequest(mangaId, chapId) {
        let metadata = { 'mangaId': mangaId, 'chapterId': chapId, 'nextPage': false, 'page': 1 };
        return createRequestObject({
            url: `${MS_DOMAIN}/read-online/`,
            metadata: metadata,
            headers: {
                "content-type": "application/x-www-form-urlencoded"
            },
            method: 'GET',
            param: chapId
        });
    }
    getChapterDetails(data, metadata) {
        var _a;
        let script = JSON.parse(((_a = /PageArr=(.*);/g.exec(data)) !== null && _a !== void 0 ? _a : [])[1]);
        let pages = [];
        let images = Object.values(script);
        for (let [i, image] of images.entries()) {
            if (i != images.length - 1) {
                pages.push(image);
            }
        }
        let chapterDetails = createChapterDetails({
            id: metadata.chapterId,
            mangaId: metadata.mangaId,
            pages, longStrip: false
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
        let data = { 'page': page };
        data = Object.keys(data).map(function (key) { return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]); }).join('&');
        return createRequestObject({
            url: `${MS_DOMAIN}/home/latest.request.php`,
            metadata: metadata,
            headers: {
                "content-type": "application/x-www-form-urlencoded"
            },
            timeout: 4000,
            method: "POST",
            data: data
        });
    }
    filterUpdatedManga(data, metadata) {
        var _a, _b, _c, _d, _e;
        let $ = this.cheerio.load(data);
        let returnObject = {
            'updatedMangaIds': [],
            'nextPage': true
        };
        for (let item of $('a').toArray()) {
            if (new Date((_a = $('time', item).attr('datetime')) !== null && _a !== void 0 ? _a : '') > metadata.referenceTime) {
                let id = (_e = ((_d = (_c = (_b = $(item).attr('href')) === null || _b === void 0 ? void 0 : _b.split('/').pop()) === null || _c === void 0 ? void 0 : _c.match(/(.*)-chapter/)) !== null && _d !== void 0 ? _d : [])[1]) !== null && _e !== void 0 ? _e : '';
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
    searchRequest(query, page) {
        var _a, _b, _c, _d, _e;
        let genres = ((_a = query.includeGenre) !== null && _a !== void 0 ? _a : []).concat((_b = query.includeDemographic) !== null && _b !== void 0 ? _b : []).join(',');
        let excluded = ((_c = query.excludeGenre) !== null && _c !== void 0 ? _c : ['Any']).concat((_d = query.excludeDemographic) !== null && _d !== void 0 ? _d : []).join(',');
        let iFormat = ((_e = query.includeFormat) !== null && _e !== void 0 ? _e : []).join(',');
        let status = "";
        switch (query.status) {
            case 0:
                status = 'Completed';
                break;
            case 1:
                status = 'Ongoing';
                break;
            default: status = '';
        }
        let data = {
            'page': page,
            'keyword': query.title,
            'author': query.author || query.artist || '',
            'sortBy': 'popularity',
            'sortOrder': 'descending',
            'status': status,
            'type': iFormat,
            'genre': genres,
            'genreNo': excluded
        };
        let metadata = data;
        data = Object.keys(data).map(function (key) {
            if (data[key] != '')
                return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
        }).join('&').replace(/&&/g, '&');
        return createRequestObject({
            url: `${MS_DOMAIN}/search/request.php`,
            metadata: metadata,
            headers: {
                "content-type": "application/x-www-form-urlencoded"
            },
            timeout: 4000,
            method: "POST",
            data: data
        });
    }
    search(data) {
        var _a, _b, _c;
        let $ = this.cheerio.load(data);
        let mangaTiles = [];
        for (let item of $('.requested').toArray()) {
            let img = (_a = $('img', item).attr('src')) !== null && _a !== void 0 ? _a : '';
            let id = (_c = (_b = $('.resultLink', item).attr('href')) === null || _b === void 0 ? void 0 : _b.split('/').pop()) !== null && _c !== void 0 ? _c : '';
            let title = $('.resultLink', item).text();
            let author = $('p', item).first().find('a').text();
            mangaTiles.push({
                id: id,
                title: createIconText({
                    text: title
                }),
                image: img,
                subtitleText: createIconText({
                    text: author
                })
            });
        }
        return mangaTiles;
    }
    getTagsRequest() {
        return createRequestObject({
            url: `${MS_DOMAIN}/search/`,
            method: 'GET',
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            }
        });
    }
    getTags(data) {
        var _a, _b;
        let tagSections = [createTagSection({ id: '0', label: 'genres', tags: [] }),
            createTagSection({ id: '1', label: 'format', tags: [] })];
        let $ = this.cheerio.load(data);
        let types = $('#typeCollapse');
        for (let type of $('.list-group-item', types).toArray()) {
            let value = (_a = $(type).attr('value')) !== null && _a !== void 0 ? _a : '';
            if (value != '') {
                tagSections[1].tags.push(createTag({ id: value, label: $(type).text() }));
            }
        }
        let genres = $('#genreCollapse');
        for (let genre of $('.list-group-item', genres).toArray()) {
            tagSections[0].tags.push(createTag({ id: (_b = $(genre).attr('value')) !== null && _b !== void 0 ? _b : '', label: $(genre).text() }));
        }
        return tagSections;
    }
    getHomePageSectionRequest() { return null; }
    getHomePageSections(data, section) { return null; }
    getViewMoreRequest(key, page) { return null; }
    getViewMoreItems(data, key) { return null; }
}
exports.Mangasee = Mangasee;

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
