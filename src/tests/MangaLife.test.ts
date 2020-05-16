import { Source } from "../sources/Source"
import cheerio from 'cheerio'
import { APIWrapper } from "../API"
import { MangaLife } from "../sources/MangaLife/MangaLife";

describe('MangaLife Tests', function () {

  var wrapper: APIWrapper = new APIWrapper();
  var source: Source = new MangaLife(cheerio);
  var chai = require('chai'), expect = chai.expect, should = chai.should();
  var chaiAsPromised = require('chai-as-promised');
  chai.use(chaiAsPromised);

  /**
   * The Manga ID which this unit test uses to base it's details off of.
   * Try to choose a manga which is updated frequently, so that the historical checking test can 
   * return proper results, as it is limited to searching 30 days back due to extremely long processing times otherwise.
   */
  var mangaId = "The-Mythical-Realm";

  it("Retrieve Manga Details", async () => {
    let details = await wrapper.getMangaDetails(source, [mangaId]);
    expect(details, "No results found with test-defined ID [" + mangaId + "]").to.be.an('array');
    expect(details).to.not.have.lengthOf(0, "Empty response from server");

    // Validate that the fields are filled - Note that there are no artists on Manganelo that I can tell
    let data = details[0];
    expect(data.id, "Missing ID").to.be.not.empty;
    expect(data.titles, "Missing titles").to.be.not.empty
    expect(data.image, "Missing Image").to.be.not.empty;
    expect(data.status, "Missing Status").to.exist;
    expect(data.author, "Missing Author").to.be.not.empty;
    expect(data.tags, "Missing tags").to.be.not.empty;
    expect(data.desc, "Missing Description").to.be.not.empty;
    expect(data.lastUpdate, "Missing last update information").to.be.not.empty;
    expect(data.hentai, "Missing Hentai").to.exist
  });

  it("Get Chapters", async () => {
    let data = await wrapper.getChapters(source, mangaId);
    expect(data, "No chapters present for: [" + mangaId + "]").to.not.be.empty;
  });

  it("Get Chapter Details", async () => {

    let chapters = await wrapper.getChapters(source, mangaId);
    let data = await wrapper.getChapterDetails(source, mangaId, chapters[0].id);

    expect(data, "No server response").to.exist;
    expect(data, "Empty server response").to.not.be.empty;

    expect(data.id, "Missing chapter ID").to.exist;
    expect(data.mangaId, "Missing parent manga ID").to.exist;
    expect(data.pages, "Missing page information").to.exist;
  });

  it("Searching for Manga With Valid Tags", async () => {
    let testSearch = createSearchRequest({
      title: 'Jagaaaaaan',
      includeGenre: ['Action']
    });

    let search = await wrapper.search(source, testSearch, 1);
    let result = search[0];

    expect(result, "No response from server").to.exist;

    expect(result.id, "No ID found for search query").to.be.not.empty;
    expect(result.image, "No image found for search").to.be.not.empty;
    expect(result.title, "No title").to.be.not.null;
    expect(result.subtitleText, "No subtitle text").to.be.not.null;
    expect(result.primaryText, "No primary text").to.be.not.null;
    expect(result.secondaryText, "No secondary text").to.be.not.null;

  });

  it("Searching for Manga With Invalid Tags", async () => {
    let testSearch = createSearchRequest({
      title: 'Jagaaaaaan',
      excludeGenre: ['Action']
    });

    let search = await wrapper.search(source, testSearch, 1);
    let result = search[0];
    expect(result).to.not.exist;    // There should be no entries with this tag!
  });

  //   it("Retrieve Home Page Sections", async () => {            // not implemented yet

  //     let data = await wrapper.getHomePageSections(source);
  //     expect(data, "No response from server").to.exist;
  //     expect(data, "No response from server").to.be.not.empty;

  //     // Do some MangaPark specific validation for this server response
  //     let popularTitles = data[0];
  //     expect(popularTitles.id, "Popular Titles ID does not exist").to.not.be.empty;
  //     expect(popularTitles.title, "Popular manga section does not exist").to.not.be.empty;
  //     expect(popularTitles.items, "No items available for popular titles").to.not.be.empty;

  //     let popularNewTitles = data[1];
  //     expect(popularNewTitles.id, "Popular New Titles ID does not exist").to.not.be.empty;
  //     expect(popularNewTitles.title, "Popular New manga section does not exist").to.not.be.empty;
  //     expect(popularNewTitles.items, "No items available for popular new titles").to.not.be.empty;

  //     let recentlyUpdated = data[2];
  //     expect(recentlyUpdated.id, "Recently Updated ID does not exist").to.not.be.empty;
  //     expect(recentlyUpdated.title, "Recently Updated manga section does not exist").to.not.be.empty;
  //     expect(recentlyUpdated.items, "No items available for Recently Updated").to.not.be.empty;
  //   });

  /**
   * Test to determine if update notifications are working.
   * Runs twice. Once with the current date, where it is expected that there will be no updates.
   * And then again, starting at the beginning of time. There definitely should be an update since then.
   */
  it("Filtering Updated Manga", async () => {
    let beforeDate = await wrapper.filterUpdatedManga(source, [mangaId], new Date());
    expect(beforeDate, "Empty response from server").to.be.empty;

    // Check for updates one month back
    let date = new Date();
    date.setDate(date.getDate() - 30);
    let afterDate = await wrapper.filterUpdatedManga(source, [mangaId], date);
    expect(afterDate, "No manga updated in the last month").to.not.be.empty;
  });
});