import {Chapter, LanguageCode, Manga, MangaStatus, MangaTile, Tag} from "paperback-extensions-common";

export class DynastyScansParser {

    private readonly chapterRegex = /^Chapter ([\d.]+)(:|)( |)([\S ]+|)$/
    private readonly scriptItemRegex = /{"image" *: *"([^"\s]+\.[\d\w]{3,})"/gm
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

    parseSectionList($: CheerioStatic, base: string) {
        const mangaTiles: MangaTile[] = [];
        $("li.span2").map(((index, element) => {
            const link = $("a", element).first();
            const linkId = link.attr("href");
            let imgSrc = $("a img", element).first().attr("src");
            if (linkId && imgSrc) {
                if (imgSrc === "/assets/cover_missing_medium.png") {
                    imgSrc = "";
                }
                mangaTiles.push(createMangaTile({
                    id: linkId.replace(`/`, ""),
                    image: `${base}${imgSrc}`,
                    title: createIconText({
                        text: $("b", element).text()
                    })
                }))
            }
        }))
        return mangaTiles;
    }

    parsePages($: CheerioStatic, base: string) {
        const pageScript = $("body script").first().html() || "";
        const data = [...pageScript.matchAll(this.scriptItemRegex)];
        const finalData: string[] = [];
        for (let i = 0; i < data.length; i++) {
            finalData[i] = base + data[i][1];
        }
        return finalData;
    }

    parseChapterList($: CheerioStatic, mangaId: string) {
        const chapters: Chapter[] = [];
        let volume: number | null = null;
        let prevChapNum: number | null = null;
        $("dl.chapter-list").children().map((index, element) => {
            if ("tagName" in element && element.tagName  === "dt"){
                const volText = $(element).text().replace("Volume ", "");
                if (volText) {
                    volume = Number(volText);
                }
            } else {
            const link = $("a.name", element).first();
            const linkId = link.attr("href");
            const chapterNameMatch = link.text().match(this.chapterRegex);
            let toContinue: boolean = true;
            let chapterName: string = "";
            let chapterNum: number;
            if (prevChapNum === null){
                chapterNum = 0;
            } else {
                chapterNum = prevChapNum + 0.001;
            }
            if (linkId && chapterNameMatch) {
                chapterNum = Math.max(Number(chapterNameMatch[1]), chapterNum);
                chapterName = chapterNameMatch[4];
            } else if (linkId){
                chapterName = link.text();
            } else {
                toContinue = false;
            }
            if (toContinue){
                if (chapterName.toLowerCase().includes("second half")){
                    chapterNum += 0.5
                }
                if (!Number.isInteger(chapterNum)){
                    chapterNum = Number(chapterNum.toFixed(3));
                }
                const dateString = $("small", element).first().text().replace("released ", "");
                const parts = dateString.replaceAll(/\s{2,}/g, " ").split(" ");
                const chapterObj: Chapter = {
                    chapNum: chapterNum,
                    // This is ignored because the previous chain of if-statements makes sure that linkId is valid.
                    // @ts-ignore
                    id: linkId.replace("/chapters/", ""),
                    langCode: LanguageCode.ENGLISH,
                    mangaId: mangaId,
                }
                if (chapterName){
                    chapterObj.name = chapterName
                }
                if (volume){
                    chapterObj.volume = volume;
                }
                if (parts.length == 3){
                    const month = Number(this.monthMap.get(parts[0].toLowerCase().substring(0, 3)));
                    const day = Number(parts[1]);
                    const year = Number("20" + parts[2].replace("'", ""));
                    chapterObj.time = new Date(year, month, day)
                }
                chapters.push(createChapter(chapterObj));
                prevChapNum = chapterNum;
            }
        }})
        return chapters
    }

    static titleCaseString(str: string): string {
        return str.toLowerCase().split(' ').map(function (word) {
            return (word.charAt(0).toUpperCase() + word.slice(1));
        }).join(' ');
    }

    parseManga($: CheerioStatic, mangaId: string, base: string) {
        const tagList: Tag[] = [];
        let summary: string = $("div.description").text();
        summary = summary.trim();
        $("div.tag-tags a.label").map(((index, element) => {
            if ("attribs" in element) {
                tagList.push(createTag({
                    id: element.attribs["href"].replace(`/tags/`, ""),
                    label: DynastyScansParser.titleCaseString($(element).text())
                }))
            }
        }))
        const chapterList = this.parseChapterList($, mangaId)
        const titlePart = $("h2.tag-title");
        const statusPart = $("small", titlePart).text().replace("— ", "").toLowerCase()
        let status: MangaStatus;
        if (statusPart === "ongoing"){
            status = MangaStatus.ONGOING;
        } else {
            status = MangaStatus.COMPLETED;
        }
        const mangaObj: Manga = {
            author: $("a", titlePart).first().text(),
            desc: summary,
            id: mangaId,
            image: base + ($("div.span2.cover img.thumbnail").first().attr("src") || ""),
            rating: 0,
            status: status,
            titles: [$("b", titlePart).first().text()],
            tags: [createTagSection({
                id: "1",
                label: "1",
                tags: tagList
            })]
        }
        if (chapterList) {
            const chapterObj = chapterList[chapterList.length - 1]
            if (chapterObj.time) {
                mangaObj.lastUpdate = chapterObj.time.toString();
            }
        }
        return createManga(mangaObj);
    }
}