import {Chapter, LanguageCode, Manga, MangaStatus, MangaTile, Tag} from "paperback-extensions-common";

export class MangaOwlParser {

    private readonly chapterTitleRegex = /Chapter ([\d.]+)/i
    private readonly apiURLRegex = /window\[["']api_url["']]\s*=\s*["']([^\s'"]+)["']/i

    parseMangaTile($: CheerioStatic, element: CheerioElement, tileTimeAsPrimaryText: boolean = false) {
        const id = $(element).attr("data-id")
        const title = $(element).attr("data-title")
        const image = $("div[data-background-image]", element).attr("data-background-image");
        if (id) {
            const tileObj: MangaTile = {
                id: id,
                image: image || "",
                title: createIconText({
                    text: title || ""
                })
            }
            if (tileTimeAsPrimaryText){
                tileObj.primaryText = createIconText({
                    text: $(element).attr("data-chapter-time") || ""
                })
            }
            return createMangaTile(tileObj);
        }
    }

    parseTileSection($: CheerioStatic, className: string, itemNum: number = 0, tileTimeAsPrimaryText: boolean = false) {
        const tiles: MangaTile[] = [];
        $("div.comicView", $(`div.${className}`).toArray()[itemNum]).map((index, element) => {
            const tile = this.parseMangaTile($, element, tileTimeAsPrimaryText);
            if (tile) {
                tiles.push(tile)
            }
        })
        return tiles;
    }
    
    parseAPIUrl(response: string){
        return response.match(this.apiURLRegex)?.[1];
    }

    parsePages($: CheerioStatic) {
        const pages: string[] = [];
        $("img[data-src]").not(".comic_thumbnail").map((index, element) => {
            if ("attribs" in element && element.attribs["data-src"]) {
                pages.push(element.attribs["data-src"])
            }
        });
        return pages;
    }

    parseChapterList($: CheerioStatic, mangaId: string) {
        const chapters: Chapter[] = [];
        let lastNumber: number | null = null;
        $("ul#simpleList li").toArray().reverse().map((element) => {
            const link = $("a", element).first();
            const linkId = link.attr("href");
            const title = $("label.chapter-title", element).text().trim();
            if (linkId) {
                const match = title.match(this.chapterTitleRegex);
                let chapNum;
                if (match){
                    chapNum = Number(match[1])
                } else {
                    if (lastNumber === null){
                        chapNum = 0;
                    } else {
                        chapNum = Number((lastNumber + 0.001).toFixed(3))
                    }
                }
                lastNumber = chapNum
                const dateParts = $("small", element).first().text().split("/")
                const chapterObj: Chapter = {
                    chapNum: chapNum,
                    id: linkId,
                    langCode: LanguageCode.ENGLISH,
                    mangaId: mangaId,
                }
                if (dateParts.length === 3){

                    chapterObj.time = new Date(Date.UTC(Number(dateParts[2]), Number(dateParts[0])-1, Number(dateParts[1])));
                }
                chapters.push(createChapter(chapterObj));
            }
        })
        return chapters
    }

    getPart($: CheerioStatic, element: CheerioElement, partsArr: (string | null)[], index: number){
        partsArr[index] = $("span", element).remove().end().text().replace(/\s{2,}/, " ").trim();
    }

    parseManga($: CheerioStatic, mangaId: string) {
        const items = $("div.row.owl-tags");
        const tagList: Tag[] = [];
        const genreList: Tag[] = [];
        const summary: string = $("div.description div").first().children().remove().end().text().replace(/\s{2,}/, " ").trim();
        $("a.label-owl-tag", items).map(((index, element) => {
            if ("attribs" in element) {
                tagList.push(createTag({
                    id: element.attribs["href"].replace("/view_tag/", ""),
                    label: $(element).text()
                }))
            }
        }))
        $("p > a.label", items).map(((index, element) => {
            if ("attribs" in element) {
                genreList.push(createTag({
                    id: element.attribs["href"].replace("/genres/", ""),
                    label: $(element).text()
                }))
            }
        }))
        const chapterList = this.parseChapterList($, mangaId)
        const parts: (string|null)[] = [
            null, // synonyms
            null, // author
            null, // artist
            null, // views
            "ongoing" // statusPart
        ];
        const tagSections = [createTagSection({
            id: "view_tag",
            label: "Tags",
            tags: tagList
        })]
        if (genreList){
            tagSections.splice(0, 0, createTagSection({
                id: "genres",
                label: "Genres",
                tags: genreList
            }))
        }
        const rating = Number($("font.rating_scored").text().trim() || "0");
        $("p.fexi_header_para").map((index, element) => {
            const label = $("span", element).first().children().remove().end().text().replace(/\s{2,}/, " ").trim().toLowerCase();
            switch (label) {
                case "synonyms": this.getPart($, element, parts, 0); break;
                case "author": case "authors": case "author(s)": this.getPart($, element, parts, 1); break;
                case "artist": case "artists": case "artist(s)": this.getPart($, element, parts, 2); break;
                case "views": this.getPart($, element, parts, 3); break;
                case "status": this.getPart($, element, parts, 4); break;
            }
        })
        const statusPart = parts[4]
        let status: MangaStatus;
        if (statusPart === "ongoing"){
            status = MangaStatus.ONGOING;
        } else {
            status = MangaStatus.COMPLETED;
        }
        let titles: string[] = [$("h2").first().text().trim()];
        if (parts[0] && parts[0]?.toLowerCase() !== "none"){
            titles = titles.concat(parts[0].split("; "))
        }
        const mangaObj: Manga = {
            desc: summary || undefined,
            id: mangaId,
            image: $("div.single_detail img[data-src]").first().attr("data-src") || "",
            rating: rating,
            avgRating: rating,
            status: status,
            titles: titles,
            tags: tagSections,
        }
        if (parts[1]){
            mangaObj.author = parts[1];
        }
        if (parts[2]){
            mangaObj.artist = parts[2];
        }
        if (parts[3]){
            mangaObj.views = Number((parts[3] || "0").replace(",", ""));
        }
        if (chapterList) {
            const chapterObj = chapterList[chapterList.length - 1]
            if (chapterObj.time) {
                mangaObj.lastUpdate = chapterObj.time.toString();
            }
        }
        return createManga(mangaObj);
    }

    parseTags($: CheerioStatic){
        const tags: Tag[] = [];
        $("ul.dropdown-menu.multi-column a").map((index, element) => {
            const id = (element.attribs["href"] || "").replace("/genres/", "");
            tags.push(createTag({
                id: id,
                label: $(element).text().trim()
            }));
        });
        return tags;
    }

    parseTimesFromTiles($: CheerioStatic, dateTime: Date){
        const tiles = this.parseTileSection($, "flexslider", 0, true)
        const ids: string[] = [];
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            if (tile.primaryText){
                const parts = tile.primaryText.text.split(" ");
                if (parts.length === 2){
                    const dayPart = parts[0]
                    const daySubparts = dayPart.split("-")
                    if (daySubparts.length === 3){
                        const year = Number(daySubparts[0])
                        const month = Number(daySubparts[1])-1
                        const day = Number(daySubparts[2])
                        const timePart = parts[1];
                        const timeSubparts = timePart.split(":")
                        if (timeSubparts.length === 2){
                            const hour = Number(timeSubparts[0])
                            const minute = Number(timeSubparts[1])
                            const dateObj = new Date(Date.UTC(year, month, day, hour, minute));
                            if (dateObj > dateTime){
                                ids.push(tile.id);
                            } else {
                                if (ids.length !== 0){
                                    return  ids;
                                } else {
                                    return null;
                                }
                            }
                        }
                    }
                }
            }
        }
        return ids;
    }
}