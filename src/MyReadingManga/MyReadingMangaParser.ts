import { Chapter, ChapterDetails, LanguageCode, Manga, MangaStatus, MangaTile, TagSection, Tag } from "paperback-extensions-common";
import { parseLanguage } from "./Languages";

export const parseMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
    // Titles
    const title: string = decodeHTMLEntity($(".entry-title", ".post").text()).replace(/(\[.+?\])/g, "").replace(/(\(.+?\))/g, "").trim() ?? "";
    let titles: string[] = [title];
    const altTitleArray: string[] = decodeHTMLEntity($(".entry-title", ".post").text()).replace(/(\[.+?\])/g, "").match(/(\(.+?\))/g) ?? [];
    if (altTitleArray.length > 0) {
        for (const altTitle of altTitleArray) {
            titles.push(altTitle.replace(/(\(|\))/g, "").trim());
        }
    }
    const altTitleInContent: string[] = decodeHTMLEntity($(".alt-title-class").next().text()).split("\n") ?? "";
    if (altTitleInContent.length > 0) {
        for (const altTitle of altTitleInContent) {
            titles.push(altTitle.trim());
        }
    }
    // Author
    let author = "";
    const authorFound: string[] = decodeHTMLEntity($(".entry-title", ".post").text()).match(/(\[.+?\])/g) ?? [];
    if (authorFound.length > 0) {
        author = authorFound[0].toString().replace(/(\[|\])/g, "").trim();
    }
    // Metadata
    let category: string = "";
    let langFlag: LanguageCode = LanguageCode.UNKNOWN;
    let langName: string = "Unknown";
    let scanlatedBy: string = "";
    let rawStatus: string = "";
    let pairing: string = "";
    let genres: string[] = [];
    let tags: string[] = [];
    for (const element of $(".entry-meta > span").toArray()) {
        const metadata = $(element).text().split(":");
        switch (metadata[0].trim()) {
            case "Filed Under":
                category = metadata[1].trim();
                break;
            case "Language":
                langFlag = parseLanguage(metadata[1].trim());
                langName = metadata[1].trim();
                break;
            case "Scanlation Group":
                scanlatedBy = metadata[1].trim();
                break;
            case "Pairing":
                pairing = metadata[1].trim();
                break;
            case "Status":
                rawStatus = metadata[1].trim();
                break;
            case "Genres":
                let genresNotTrimmed: string[] = metadata[1].trim().split(",");
                genres = genresNotTrimmed.map((genre) => genre.trim());
                break;
            case "Tagged With":
                let tagsNotTrimmed: string[] = metadata[1].trim().split(",");
                tags = tagsNotTrimmed.map((tag) => tag.trim());
                break;
        }
    }
    // Artist
    const artist = author ?? "";
    // Thumbnail
    const image = encodeURI(getImageSrc($(".img-myreadingmanga").first()));
    // Status
    let status: MangaStatus = MangaStatus.ONGOING;
    switch (rawStatus) {
        case "Completed":
            status = MangaStatus.COMPLETED;
            break;
        case "Ongoing":
            status = MangaStatus.ONGOING;
            break;
        case "Licensed": // Not supported by the app at the moment so falling back to MangaStatus.ONGOING
            status = MangaStatus.ONGOING;
            break;
        case "Dropped": // Not supported by the app at the moment so falling back to MangaStatus.ONGOING
            status = MangaStatus.ONGOING;
            break;
        case "Discontinued": // Not supported by the app at the moment so falling back to MangaStatus.ONGOING
            status = MangaStatus.ONGOING;
            break;
        case "Hiatus": // Not supported by the app at the moment so falling back to MangaStatus.ONGOING
            status = MangaStatus.ONGOING;
            break;
    }
    // Last update
    const lastUpdate = timeSince(new Date(Date.parse($(".entry-time").attr("datetime") ?? "0")));
    // NSFW type
    const hentai = false; // ! Temporary until Mangadex is back up / Paperback login is in place
    // Description
    let description: string = titles.join("\n") + "\n";
    let summary: string = "";
    if (scanlatedBy !== "") {
        description = description + "Scanlation Group: " + scanlatedBy + "\n\n";
    }
    if (pairing !== "") {
        description = description + "Pairing: " + pairing + "\n\n";
    }
    if ($(".info-class").length > 0) {
        for (const element of $(".info-class").nextUntil("div").toArray()) {
            summary = summary + decodeHTMLEntity($(element).text()).replace(/\n/g, "");
        }
    } else {
        summary = "No description provided";
    }
    description = description + summary;
    // Tags
    const genresTags: Tag[] = [];
    for (const genre of genres) {
        genresTags.push(createTag({ id: genre.toLowerCase(),label: genre }));
    }
    const tagsTags: Tag[] = [];
    for (const tag of tags) {
        tagsTags.push(createTag({ id: tag.toLowerCase(),label: tag }));
    }
    const tagSections: TagSection[] = [
        createTagSection({
            id: "category",
            label: "Category",
            tags: [createTag({ id: category.toLowerCase(), label: category })],
        }),
        createTagSection({
            id: "genres",
            label: "Genres",
            tags: genresTags,
        }),
        createTagSection({
            id: "tags",
            label: "Tags",
            tags: tagsTags,
        }),
    ];
    // Related IDs
    let relatedIds: string[] = [];
    for (const element of $("div > .jp-relatedposts-post-a").toArray()) {
        const mangaLink = $(element).attr("href") ?? "";
        if (mangaLink.length > 0) {
            relatedIds.push(mangaLink.split("/").reverse()[1] ?? "");
        }
    }
    if (!titles) throw new Error("An error occurred while parsing the requested manga");

    return createManga({
        id: mangaId,
        titles,
        image,
        status,
        artist,
        author,
        langFlag,
        langName,
        tags: tagSections,
        lastUpdate,
        desc: description,
        hentai,
        relatedIds,
        rating: 0, // Because rating is required in the Manga interface
    });
};

export const parseChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
    let chapters: Chapter[] = [];
    let language: string = "English";
    for (const element of $(".entry-meta > span").toArray()) {
        let metadata = $(element).text().split(":");
        if (metadata[0] === "Language") {
            language = metadata[1].trim();
        }
    }
    const langCode: LanguageCode = parseLanguage(language);
    const isMultipleChapter = $(".entry-pagination").length;
    if (isMultipleChapter > 0) {
        chapters.push(
            createChapter({
                mangaId,
                id: "1",
                chapNum: 1,
                name: "Chapter 1",
                langCode,
                time: new Date(Date.parse($(".entry-time").attr("datetime") ?? "0")), // Every chapter will have the same date because of the website structure
            })
        );
        let chapterId = 1;
        for (const element of $(".entry-pagination > a").slice(0, -1).toArray()) {
            chapterId = chapterId + 1;
            const id: string = chapterId.toString();
            const chapNum: number = chapterId;
            const name: string = "Chapter " + chapterId;
            chapters.push(
                createChapter({
                    mangaId,
                    id,
                    chapNum,
                    name,
                    langCode,
                    time: new Date(Date.parse($(".entry-time").attr("datetime") ?? "0")),
                })
            );
        }
    } else {
        let chapterId = 1;
        const id: string = chapterId.toString();
        const chapNum: number = chapterId;
        const name: string = "Oneshot";
        chapters.push(
            createChapter({
                mangaId,
                id,
                chapNum,
                name,
                langCode,
                time: new Date(Date.parse($(".entry-time").attr("datetime") ?? "0")),
            })
        );
    }

    return chapters;
};

export const parseChapterDetails = ($: CheerioStatic, mangaId: string, chapterId: string): ChapterDetails => {
    const pages: string[] = [];
    const container: Cheerio = $("div.entry-content");
    for (const img of $("img", container).toArray()) {
        pages.push(encodeURI(getImageSrc($(img))));
    }
    if (!pages ) throw new Error("An error occurred while parsing pages for this chapter");
    return createChapterDetails({
        id: chapterId,
        mangaId: mangaId,
        pages,
        longStrip: false,
    });
};

export const parseHomeSections = ($: CheerioStatic, sectionId: string): MangaTile[] => {
    let mangaTiles: MangaTile[] = [];
    const collectedIds: string[] = [];
    if (sectionId === "1_recently_updated" || sectionId == "6_randomly_selected") { // Different page structure since it's a search result
        mangaTiles = mangaTiles.concat(parseSearchResults($));
    } else {
        const container: Cheerio = $("main.content");
        for (const element of $(".post", container).toArray()) {
            const id: string = ($(".entry-title-link", element).attr("href") ?? "").split("/").reverse()[1] ?? "";
            const title: string = decodeHTMLEntity($(".entry-title-link", element).text()).replace(/(\[.+?\])/g, "").replace(/(\(.+?\))/g, "").trim() ?? "";
            const image: string = encodeURI(getImageSrc($(".post-image", element)));
            let author: string = "";
            const authorFound: string[] = decodeHTMLEntity($(".entry-title-link", element).text()).match(/(\[.+?\])/g) ?? [];
            if ( authorFound.length > 0) {
                author = authorFound[0].toString().replace(/(\[|\])/g, "").trim();
            }
            if (!id || !title) continue;
            if (!collectedIds.includes(id)) {
                mangaTiles.push(
                    createMangaTile({
                        id,
                        image,
                        title: createIconText({ text: title }),
                        subtitleText: createIconText({ text: author }),
                    })
                );
                collectedIds.push(id);
            }
        }
    }

    return mangaTiles;
};

export const parseSearchResults = ($: CheerioStatic): MangaTile[] => {
    const mangaTiles: MangaTile[] = [];
    const collectedIds: string[] = [];
    const container: Cheerio = $("div.wdm_results");
    for (const element of $(".results-by-facets > div", container).toArray()) {
        const id: string = ($("a", element).attr("href") ?? "").split("/").reverse()[1] ?? "";
        const title: string =
            $(".p_title", element).text().replace(/(\[.+?\])/g, "").replace(/(\(.+?\))/g, "").trim() ?? "";
        const image: string = encodeURI(getImageSrc($(".wdm_result_list_thumb", element))) ?? "";
        const category: string = $("span.pcat > span.pcat", element).text() ?? "";
        let author: string = "";
        const authorFound: string[] = decodeHTMLEntity($(".p_title", element).text()).match(/(\[.+?\])/g) ?? [];
        if (authorFound.length > 0) {
            author = authorFound[0].toString().replace(/(\[|\])/g, "").trim();
        }
        if (!id || !title) continue;
        if (!category.match(/in Video/)) {
            if (!collectedIds.includes(id)) {
                mangaTiles.push(
                    createMangaTile({
                        id,
                        image,
                        title: createIconText({ text: title }),
                        subtitleText: createIconText({ text: author }),
                    })
                );
                collectedIds.push(id);
            }
        }
    }

    return mangaTiles;
};

export const isLastPage = ($: CheerioSelector, isSearchPage: boolean): boolean => {
    if (isSearchPage) {
        const container: Cheerio = $("#pagination-flickr");
        const current = $(".active", container).text();
        const total = $(".paginate", container).last().text();
        if (current) {
            if (total === current) {
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
    } else {
        if ($(".pagination-next").length > 0) {
            return false;
        } else {
            return true;
        }
    }
};

// Utility functions

const decodeHTMLEntity = (str: string): string => {
    return str.replace(/&#(\d+);/g, function (match, dec) {
        return String.fromCharCode(dec);
    });
};

const getImageSrc = (imageObj: Cheerio | undefined): string => {
    const hasDataSrc = typeof imageObj?.attr("data-src") !== "undefined";
    const image = hasDataSrc ? imageObj?.attr("data-src") : imageObj?.attr("src");

    return image?.trim() ?? "";
};

const timeSince = function (date: Date) {
    const seconds: number = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval: number = Math.floor(seconds / 60 / 60 / 24 / 365);
    if (interval >= 1) return Math.floor(interval) > 1 ? Math.floor(interval) + " years ago" : Math.floor(interval) + " year ago";
    interval = seconds / 60 / 60 / 24 / 30;
    if (interval >= 1) return Math.floor(interval) > 1 ? Math.floor(interval) + " months ago" : Math.floor(interval) + " month ago";
    interval = seconds / 60 / 60 / 24;
    if (interval >= 1) return Math.floor(interval) > 1 ? Math.floor(interval) + " days ago" : Math.floor(interval) + " day ago";
    interval = seconds / 60 / 60;
    if (interval >= 1) return Math.floor(interval) > 1 ? Math.floor(interval) + " hours ago" : Math.floor(interval) + " hour ago";
    interval = seconds / 60;
    if (interval >= 1) return Math.floor(interval) > 1 ? Math.floor(interval) + " minutes ago" : Math.floor(interval) + " minute ago";
    return Math.floor(interval) > 1 ? Math.floor(interval) + " seconds ago" : Math.floor(interval) + " second ago";
};
