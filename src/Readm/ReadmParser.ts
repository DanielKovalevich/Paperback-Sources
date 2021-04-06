import { Chapter, ChapterDetails, Tag, HomeSection, LanguageCode, Manga, MangaStatus, MangaTile, MangaUpdates, PagedResults, SearchRequest, TagSection } from "paperback-extensions-common";

export const parseMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
  const titles = [];
  const title = $("h1.page-title").text().trim() ?? "";
  titles.push(title);
  const altTitle = $("div.sub-title.pt-sm").text().replace(" ", "").split(",");
  titles.push(altTitle);

  const image = "https://readm.org" + $("img.series-profile-thumb")?.attr("src") ?? "";
  const author = $("small", "span#first_episode").text().trim() ?? "";
  const artist = $("small", "span#last_episode").text().trim() ?? "";
  const description = $("p", "div.series-summary-wrapper").text().trim() ?? "";
  const rating = $("div.color-imdb").text().trim() ?? "";
  const rawStatus = $("div.series-genres").text().trim();

  let hentai = false;
  let arrayTags: Tag[] = [];
  $("a", $("div.ui.list", "div.item")).each((i, tag) => {
    const label = $(tag).text().trim();
    const id = $(tag).attr('href')?.split("category/")[1] ?? "";
    if (["Adult", "Smut", "Mature"].includes(label)) hentai = true;
    arrayTags.push({ id: id, label: label });
  });

  const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => createTag(x)) })];

  let status = MangaStatus.ONGOING;
  switch (rawStatus.toLocaleUpperCase()) {
    case 'ONGOING':
      status = MangaStatus.ONGOING;
      break;
    case 'COMPLETED':
      status = MangaStatus.COMPLETED;
      break;
    default:
      status = MangaStatus.ONGOING;
      break;
  }

  return createManga({
    id: mangaId,
    titles: [title],
    image,
    rating: Number(rating),
    status: status,
    author: author,
    artist: artist,
    tags: tagSections,
    desc: description,
    // hentai: hentai,
    hentai: false
  });
}

export const parseChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
  const chapters: Chapter[] = [];

  for (const elem of $("div.season_start").toArray()) {
    const title = $("h6.truncate", elem).first().text().trim() ?? "";
    const chapterId = $('a', elem).attr('href')?.split(mangaId + "/").pop() ?? '';
    const chapterNumber = title.split("Chapter ")[1].split("-")[0] ?? 0;
    const date = parseDate($("td.episode-date", elem)?.text() ?? "");

    chapters.push(createChapter({
      id: chapterId,
      mangaId,
      name: title,
      langCode: LanguageCode.ENGLISH,
      chapNum: Number(chapterNumber),
      time: date,
    }))
  }

  return chapters;
}

export const parseChapterDetails = ($: CheerioStatic, mangaId: string, chapterId: string): ChapterDetails => {
  const pages: string[] = [];

  for (const p of $("div.ch-images img").toArray()) {
    let rawPage = $(p).attr("src");
    rawPage = "https://readm.org" + rawPage;
    pages.push(rawPage);
  }

  let chapterDetails = createChapterDetails({
    id: chapterId,
    mangaId: mangaId,
    pages: pages,
    longStrip: false
  });
  return chapterDetails;
}

export const parseTags = ($: CheerioStatic): TagSection[] | null => {
  let arrayTags: Tag[] = [];
  for (const tag of $("li", "ul.trending-thisweek.categories").toArray()) {
    const label = $("a", tag).text().trim();
    const id = $("a", tag).attr('href')?.split("category/")[1] ?? "";
    arrayTags.push({ id: id, label: label });
  }
  const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => createTag(x)) })];
  return tagSections;
}

export interface UpdatedManga {
  ids: string[],
  loadMore: boolean;
}

export const parseUpdatedManga = ($: CheerioStatic, time: Date, ids: string[]): UpdatedManga => {
  const updatedManga: string[] = [];
  let loadMore = true;

  for (let p of $("div.poster.poster-xs", $("ul.clearfix.latest-updates").first()).toArray()) {
    const id = $('a', p).attr('href')?.split('manga/').pop() ?? '';
    const mangaDate = parseDate($("span.date", p).text().trim() ?? "");
    if (mangaDate > time) {
      if (ids.includes(id)) {
        updatedManga.push(id);
      }
    } else {
      loadMore = false;
    }
  }
  return {
    ids: updatedManga,
    loadMore
  }
}

export const parseHomeSections = ($: CheerioStatic, sections: HomeSection[], sectionCallback: (section: HomeSection) => void): void => {
  for (const section of sections) sectionCallback(section)

  //Hot Mango Update
  const hotMangaUpdate: MangaTile[] = [];
  for (let manga of $("div.item", "div#manga-hot-updates").toArray()) {
    const title: string = $("strong", manga).text().trim();
    const id = $('a', manga).attr('href')?.match("\\/manga\\/(.*?)\\/")![1] ?? '';
    const image = "https://readm.org" + $("img", manga)?.attr("src") ?? "";
    if (!id || !title) continue;
    hotMangaUpdate.push(createMangaTile({
      id: id,
      image: image,
      title: createIconText({ text: title }),
    }));
  }
  sections[0].items = hotMangaUpdate;
  sectionCallback(sections[0]);

  //Hot Mango
  const hotManga: MangaTile[] = [];
  for (let manga of $("ul#latest_trailers li").toArray()) {
    const title: string = $("h6", manga).text().trim();
    const id = $('a', manga).attr('href')?.split('manga/').pop() ?? "";
    const image = "https://readm.org" + $("img", manga)?.attr("data-src") ?? "";
    const subtitle: string = $("small", manga).first().text().trim() ?? "";
    if (!id || !title) continue;
    hotManga.push(createMangaTile({
      id: id,
      image: image,
      title: createIconText({ text: title }),
      subtitleText: createIconText({ text: subtitle }),
    }));
  }
  sections[1].items = hotManga;
  sectionCallback(sections[1]);

  //Latest Mango
  const latestManga: MangaTile[] = [];
  for (let manga of $("div.poster.poster-xs", $("ul.clearfix.latest-updates").first()).toArray()) {
    const title: string = $("h2", manga).first().text().trim();
    const id = $('a', manga).attr('href')?.split('manga/').pop() ?? "";
    const image = "https://readm.org" + $("img", manga)?.attr("data-src") ?? "";
    if (!id || !title) continue;
    latestManga.push(createMangaTile({
      id: id,
      image: image,
      title: createIconText({ text: title }),
    }));
  }
  sections[2].items = latestManga;
  sectionCallback(sections[2]);

  //New Mango
  const newManga: MangaTile[] = [];
  for (let manga of $("li", "ul.clearfix.mb-0").toArray()) {
    const title: string = $("h2", manga).first().text().trim();
    const id = $('a', manga).attr('href')?.split('manga/').pop() ?? "";
    const image = "https://readm.org" + $("img", manga)?.attr("data-src");
    if (!id || !title) continue;
    newManga.push(createMangaTile({
      id: id,
      image: image,
      title: createIconText({ text: title }),
    }));
  }
  sections[3].items = newManga;
  sectionCallback(sections[3]);

  for (const section of sections) sectionCallback(section);
}

export const generateSearch = (query: SearchRequest): string => {
  let search: string = query.title ?? "";
  search = search.replace(/im/i, "I'm");
  return search;
}

export const parseViewMore = ($: CheerioStatic, homepageSectionId: string): MangaTile[] => {
  const manga: MangaTile[] = [];

  if (homepageSectionId === "hot_manga") {
    for (let p of $("li.mb-lg", "ul.filter-results").toArray()) {
      const title: string = $("h2", p).first().text().trim();
      const id = $('a', p).attr('href')?.split('manga/').pop() ?? "";
      const image = "https://readm.org" + $("img", p)?.attr("src") ?? "";
      if (!id || !title) continue;
      manga.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: title }),
      }));
    }
  } else {
    for (let p of $("div.poster.poster-xs", $("ul.clearfix.latest-updates").first()).toArray()) {
      const title: string = $("h2", p).first().text().trim();
      const id = $('a', p).attr('href')?.split('manga/').pop() ?? "";
      const image = "https://readm.org" + $("img", p)?.attr("data-src") ?? "";
      if (!id || !title) continue;
      manga.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: title }),
      }));
    }
  }
  return manga;
}

const parseDate = (date: string): Date => {
  date = date.toUpperCase();
  let time: Date;
  let number: number = Number((/\d*/.exec(date) ?? [])[0]);
  if (date.includes("LESS THAN AN HOUR") || date.includes("JUST NOW")) {
    time = new Date(Date.now());
  } else if (date.includes("YEAR") || date.includes("YEARS")) {
    time = new Date(Date.now() - (number * 31556952000));
  } else if (date.includes("MONTH") || date.includes("MONTHS")) {
    time = new Date(Date.now() - (number * 2592000000));
  } else if (date.includes("WEEK") || date.includes("WEEKS")) {
    time = new Date(Date.now() - (number * 604800000));
  } else if (date.includes("YESERDAY")) {
    time = new Date(Date.now() - 86400000);
  } else if (date.includes("DAY") || date.includes("DAYS")) {
    time = new Date(Date.now() - (number * 86400000));
  } else if (date.includes("HOUR") || date.includes("HOURS")) {
    time = new Date(Date.now() - (number * 3600000));
  } else if (date.includes("MINUTE") || date.includes("MINUTES")) {
    time = new Date(Date.now() - (number * 60000));
  } else if (date.includes("SECOND") || date.includes("SECONDS")) {
    time = new Date(Date.now() - (number * 1000));
  } else {
    let split = date.split("-");
    time = new Date(Number(split[2]), Number(split[0]) - 1, Number(split[1]));
  }
  return time;
}

export const isLastPage = ($: CheerioStatic): boolean => {
  let isLast = true;
  let hasNext = Boolean($("a:contains(»)", "div.ui.pagination.menu")[0]);
  if (hasNext) isLast = false;
  return isLast;
}