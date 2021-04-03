import {Chapter, LanguageCode, Manga, MangaStatus, MangaTile, Tag, TagSection} from "paperback-extensions-common";

interface Section {
    name: string
    items: MangaTile[]
}

export class NovelCoolParser {

    private readonly chapterRegex = /(Vol(ume|)(\.| |\. |)(\d+)|)( |)(Ch(apter|)(\.| |\. |)([\d.]+))((:| |: )([\S ]+)|)$/i

    private readonly monthMap = new Map(Object.entries({
        "jan": 0,
        "feb": 1,
        "mar": 2,
        "apr": 3,
        "may": 4,
        "jun": 5,
        "jul": 6,
        "aug": 7,
        "sep": 8,
        "oct": 9,
        "nov": 10,
        "dec": 11
    }))

    getHomepageTile($: CheerioStatic, element: CheerioElement, base: string): MangaTile | null{
        const link = $("a", element).first();
        let linkId = link.attr("href")
        if (linkId) {
            linkId = linkId.replace(`${base}/novel/`, "").replace(".html", "");
            return createMangaTile({
                id: linkId,
                image: $("img", link).attr("src") || "",
                title: createIconText({
                    text: $("div.book-name", element).first().text()
                })
            })
        }
        return null;
    }

    parseCarousel($: CheerioStatic, base: string){
        const tiles: MangaTile[] = [];
        $("div.index-carousel div.book-item").map((index, element) => {
            const tile = this.getHomepageTile($, element, base);
            if (tile){
            tiles.push(tile);
            }
        })
        return tiles;
    }

    parseHomepage($: CheerioStatic, base: string): Section[]{
        const sections: Section[] = [];
        $("div.index-book-list").map((index, element) => {
            const name = $("div.index-book-list-title", element).first().children().remove().end().text().trim()
            const tiles: MangaTile[] = [];
            $("div.book-item", element).map((index1, element1) => {
                const tile = this.getHomepageTile($, element1, base);
                if (tile){
                    tiles.push(tile);
                }
            });
            sections.push({
                name: name,
                items: tiles
            });
        })
        return sections
    }

    parseGlobalTagList($: CheerioStatic){
        const tagList: TagSection[] = [];
        $("div.search-group").map((index, element) => {
            if (index > 1){
                const name = $("div.category-list-title.style-trigger.pointer", element).first().text().replace(":", "");
                const tags: Tag[] = [];
                $("div.search-list-item", element).map((index1, element1) => {
                    const label = $(element1).text()
                    tags.push(createTag({
                        id: label,
                        label: label
                    }));
                });
                tagList.push(createTagSection({
                    id: name,
                    label: name,
                    tags: tags
                }));
            }
        })
        return tagList;
    }

    parseMangaListingPage($: CheerioStatic, base: string){
        const tiles: MangaTile[] = [];
        $("div.book-list div.book-item").map((index, element) => {
            const tile = this.getHomepageTile($, element, base);
            if (tile){
                tiles.push(tile);
            }
        })
        return tiles;
    }

    parseChapterList($: CheerioStatic, mangaId: string, base: string, convertTime: ((input: string) => Date)) {
        const chapters: Chapter[] = [];
        $("div.chapter-item-list a").map((index, element) => {
            const title: string = element.attribs["title"];
            const match = title.match(this.chapterRegex);
            let volume = null;
            let chapTitle = null;
            let chapterObj: Chapter;
            if (match && match[9]){
                if (match[4]){
                    volume = Number(match[4]);
                }
                const chapter = Number(match[9]);
                if ((match[12] || "").trim()){
                    chapTitle = match[12].trim();
                }
                const timeText = $("span.chapter-item-time", element).text();
                let time = null;
                if (timeText.toLowerCase().includes("ago")){
                    time = convertTime(timeText);
                } else {
                    const parts = timeText.split(" ");
                    if (parts.length === 3){
                        const month = this.monthMap.get(parts[0].toLowerCase());
                        if (month){
                        const day = Number(parts[1].replace(",", ""));
                        const year = Number(parts[2]);
                        time = new Date(year, month, day)
                        }
                    }
                }
                chapterObj = {
                    chapNum: chapter,
                    id: element.attribs["href"].replace(`${base}/chapter/`, "").slice(0, -1),
                    langCode: LanguageCode.ENGLISH,
                    mangaId: mangaId
                }
                if (volume){
                    chapterObj.volume = volume;
                }
                if (chapTitle){
                    chapterObj.name = chapTitle;
                }
                if (time){
                    chapterObj.time = time;
                }
            } else {
                chapterObj = {
                    chapNum: 0,
                    id: element.attribs["href"].replace(`${base}/chapter/`, ""),
                    langCode: LanguageCode.ENGLISH,
                    mangaId: mangaId,
                    name: title
                };
            }
            chapters.push(createChapter(chapterObj));
        })
        return chapters
    }

    parseManga($: CheerioStatic, mangaId: string, base: string, convertTime: ((input: string) => Date)) {
        const tagList: Tag[] = [];
        let summary: string = $("span[itemprop=\"description\"]").text();
        summary = summary.trim();
        $("span[itemprop=\"keywords\"] a").map(((index, element) => {
            if ("attribs" in element) {
                tagList.push(createTag({
                    id: element.attribs["href"].replace("/category/", "").replace(".html", ""),
                    label: ($(element).text())
                }))
            }
        }))
        const chapterList = this.parseChapterList($, mangaId, base, convertTime)
        const statusPart = $("a", $("div.bookinfo-category-list").toArray()[1]).first().text().toLowerCase()
        let status: MangaStatus;
        if (statusPart === "ongoing"){
            status = MangaStatus.ONGOING;
        } else {
            status = MangaStatus.COMPLETED;
        }
        const rating = Number($("span.bookinfo-rate-val").first().text())
        const statObj = $("div.bookinfo-refer-count-item");
        const mangaObj: Manga = {
            author: $("span[itemprop=\"creator\"]").first().text(),
            desc: summary,
            id: mangaId,
            image: $("img.bookinfo-pic-img").attr("src") || "",
            rating: rating,
            avgRating: rating,
            status: status,
            titles: [$("h1.bookinfo-title").first().text()],
            tags: [createTagSection({
                id: "1",
                label: "1",
                tags: tagList
            })],
            views: Number(statObj.first().text()),
            follows: Number($(statObj.toArray()[1]).text()),
            langName: $("span[itemprop=\"inLanguage\"]").first().text(),
        }
        if (chapterList) {
            const chapterObj = chapterList[chapterList.length - 1]
            if (chapterObj.time) {
                mangaObj.lastUpdate = chapterObj.time.toString();
            }
        }
        return createManga(mangaObj);
    }

    parsePages($: CheerioStatic){
        if ($("div.chapter-reading-section").length !== 0){
            return ["https://cdn.discordapp.com/attachments/480523985151459329/827922569234612264/Error-1.png"];
        } else {
            const pages: string[] = [];
            $("img.manga_pic").map((index, element) => {
                pages.push(element.attribs["src"]);
            })
            return pages;
        }
    }
}