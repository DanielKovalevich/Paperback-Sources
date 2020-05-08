(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Sources = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Source_1 = require("../Source");
const Constants_1 = require("../../models/Constants/Constants");
const MD_DOMAIN = 'https://mangadex.org';
const MD_CHAPTERS_API = `${MD_DOMAIN}/api/manga`; // /:mangaId
const MD_CHAPTER_DETAILS_API = `${MD_DOMAIN}/api/chapter`; // /:chapterId
class MangaDex extends Source_1.Source {
    constructor(cheerio) {
        super(cheerio);
        this.hMode = 0;
    }
    get version() { return '1.0'; }
    get name() { return 'MangaDex'; }
    get description() { return 'Extension that pulls manga from MangaDex, includes Advanced Search and Updated manga fetching'; }
    getMangaDetailsRequest(ids) {
        return [createRequestObject({
                metadata: { ids },
                url: `${Constants_1.CACHE_MANGA_DETAILS}`,
                method: 'POST',
                headers: {
                    "content-type": "application/json"
                },
                data: JSON.stringify({
                    ids: ids
                })
            })];
    }
    getMangaDetails(data, metadata) {
        throw new Error("Method not implemented.");
    }
    getChaptersRequest(mangaId) {
        let metadata = { mangaId };
        return createRequestObject({
            metadata,
            url: MD_CHAPTERS_API,
            param: mangaId,
            method: "GET"
        });
    }
    getChapters(data, metadata) {
        data = data.chapter;
        return Object.keys(data).map(id => {
            const chapter = data[id];
            return createChapter({
                id: id,
                chapNum: parseFloat(chapter.chapter),
                langCode: chapter.lang_code,
                volume: parseFloat(chapter.volume),
                mangaId: metadata.mangaId,
                group: chapter.group_name,
                name: chapter.title,
                time: new Date(chapter.timestamp)
            });
        });
    }
    getChapterDetailsRequest(mangaId, chapId) {
        throw new Error("Method not implemented.");
    }
    getChapterDetails(data, metadata) {
        throw new Error("Method not implemented.");
    }
    filterUpdatedMangaRequest(ids, time, page) {
        return null;
        // let metadata = { 'ids': ids, 'referenceTime': time }
        // let cookies = [
        //   createCookie({
        //     name: 'mangadex_title_mode',
        //     value: '2'
        //   })
        // ]
        // return createRequestObject(metadata, 'https://mangadex.org/titles/0/', cookies, page.toString(), undefined, undefined, undefined, undefined, true)
    }
    filterUpdatedManga(data, metadata) {
        var _a, _b;
        let $ = this.cheerio.load(data);
        let returnObject = {
            'updatedMangaIds': [],
            'nextPage': true
        };
        for (let elem of $('.manga-entry').toArray()) {
            let id = elem.attribs['data-id'];
            if (new Date((_b = (_a = $(elem).find('time').attr('datetime')) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "") > metadata.referenceTime) {
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
        let request1 = createRequestObject({
            url: 'https://mangadex.org',
            method: "GET"
        });
        let request2 = createRequestObject({
            url: 'https://mangadex.org/updates',
            method: 'GET'
        });
        let section1 = createHomeSection({ id: 'featured_titles', title: 'FEATURED TITLES' });
        let section2 = createHomeSection({ id: 'new_titles', title: 'NEW TITLES' });
        let section3 = createHomeSection({ id: 'recently_updated', title: 'RECENTLY UPDATED TITLES' });
        return [
            createHomeSectionRequest({
                request: request1,
                sections: [section1, section2]
            }),
            createHomeSectionRequest({
                request: request2,
                sections: [section3]
            })
        ];
    }
    getHomePageSections(data, sections) {
        let $ = this.cheerio.load(data);
        return sections.map(section => {
            switch (section.id) {
                case 'featured_titles':
                    section.items = this.parseFeaturedMangaTiles($);
                    break;
                case 'new_titles':
                    section.items = this.parseNewMangaSectionTiles($);
                    break;
                case 'recently_updated':
                    section.items = this.parseRecentlyUpdatedMangaSectionTiles($);
                    break;
            }
            return section;
        });
    }
    parseFeaturedMangaTiles($) {
        let featuredManga = [];
        $("#hled_titles_owl_carousel .large_logo").each(function (i, elem) {
            var _a, _b, _c;
            let title = $(elem);
            let img = title.find("img").first();
            let links = title.find("a");
            let idStr = links.first().attr("href");
            let id = (_a = idStr.match(/(\d+)(?=\/)/)) !== null && _a !== void 0 ? _a : "-1";
            let caption = title.find(".car-caption p:nth-child(2)");
            let bookmarks = caption.find("span[title=Follows]").text();
            let rating = caption.find("span[title=Rating]").text();
            featuredManga.push(createMangaTile({
                id: id[0],
                image: (_b = img.attr("data-src")) !== null && _b !== void 0 ? _b : " ",
                title: createIconText({ text: (_c = img.attr("title")) !== null && _c !== void 0 ? _c : " " }),
                primaryText: createIconText({ text: bookmarks, icon: 'bookmark.fill' }),
                secondaryText: createIconText({ text: rating, icon: 'star.fill' })
            }));
        });
        return featuredManga;
    }
    parseNewMangaSectionTiles($) {
        let newManga = [];
        $("#new_titles_owl_carousel .large_logo").each(function (i, elem) {
            var _a, _b, _c, _d;
            let title = $(elem);
            let img = title.find("img").first();
            let links = title.find("a");
            let idStr = links.first().attr("href");
            let id = idStr.match(/(\d+)(?=\/)/);
            let caption = title.find(".car-caption p:nth-child(2)");
            let obj = { name: caption.find("a").text(), group: "", time: Date.parse((_a = caption.find("span").attr("title")) !== null && _a !== void 0 ? _a : " "), langCode: "" };
            let updateTime = (Date.parse((_b = caption.find("span").attr("title")) !== null && _b !== void 0 ? _b : " ")).toString();
            newManga.push(createMangaTile({
                id: id[0],
                image: (_c = img.attr("data-src")) !== null && _c !== void 0 ? _c : " ",
                title: createIconText({ text: (_d = img.attr("title")) !== null && _d !== void 0 ? _d : " " }),
                subtitleText: createIconText({ text: caption.find("a").text() }),
                secondaryText: createIconText({ text: updateTime, icon: 'clock.fill' })
            }));
        });
        return newManga;
    }
    parseRecentlyUpdatedMangaSectionTiles($) {
        var _a, _b, _c, _d, _e;
        let updates = [];
        let elem = $('tr', 'tbody').toArray();
        let i = 0;
        while (i < elem.length) {
            let hasImg = false;
            let idStr = (_a = $('a.manga_title', elem[i]).attr('href')) !== null && _a !== void 0 ? _a : '';
            let id = (_c = ((_b = idStr.match(/(\d+)(?=\/)/)) !== null && _b !== void 0 ? _b : '')[0]) !== null && _c !== void 0 ? _c : '';
            let title = (_d = $('a.manga_title', elem[i]).text()) !== null && _d !== void 0 ? _d : '';
            let image = (_e = $('img', elem[i]).attr('src')) !== null && _e !== void 0 ? _e : '';
            // in this case: badge will be number of updates
            // that the manga has received within last week
            let badge = 0;
            let pIcon = 'eye.fill';
            let sIcon = 'clock.fill';
            let subTitle = '';
            let pText = '';
            let sText = '';
            let first = true;
            i++;
            while (!hasImg && i < elem.length) {
                // for the manga tile, we only care about the first/latest entry
                if (first && !hasImg) {
                    subTitle = $('a', elem[i]).first().text();
                    pText = $('.text-center.text-info', elem[i]).text();
                    sText = $('time', elem[i]).text().replace('ago', '').trim();
                    first = false;
                }
                badge++;
                i++;
                hasImg = $(elem[i]).find('img').length > 0;
            }
            updates.push(createMangaTile({
                id,
                image,
                title: createIconText({ text: title }),
                subtitleText: createIconText({ text: subTitle }),
                primaryText: createIconText({ text: pText, icon: pIcon }),
                secondaryText: createIconText({ text: sText, icon: sIcon }),
                badge
            }));
        }
        return updates;
    }
    searchRequest(query, page) {
        return null;
    }
    search(data) {
        return null;
    }
}
exports.MangaDex = MangaDex;

},{"../../models/Constants/Constants":1,"../Source":3}],3:[function(require,module,exports){
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

},{}]},{},[2])(2)
});
