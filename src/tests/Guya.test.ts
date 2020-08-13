import cheerio from "cheerio";
import { Guya } from "../Guya/Guya";
import { APIWrapper, Source } from "paperback-extensions-common";

describe("Guya Tests", function () {
  var wrapper: APIWrapper = new APIWrapper();
  var source: Source = new Guya(cheerio);
  var chai = require("chai"),
    expect = chai.expect;
  var chaiAsPromised = require("chai-as-promised");
  chai.use(chaiAsPromised);

  var mangaId = "Kaguya-Wants-To-Be-Confessed-To";

  it("Retrieve Manga Details", async () => {
    let details = await wrapper.getMangaDetails(source, [mangaId]);
    expect(
      details,
      "No results found with test-defined ID [" + mangaId + "]"
    ).to.be.an("array");
    expect(details).to.not.have.lengthOf(0, "Empty response from server");

    // Validate that the fields are filled
    let data = details[0];
    expect(data.id, "Missing ID").to.be.not.empty;
    expect(data.image, "Missing Image").to.be.not.empty;
    expect(data.status, "Missing Status").to.exist;
    expect(data.author, "Missing Author").to.be.not.empty;
    expect(data.desc, "Missing Description").to.be.not.empty;
    expect(data.titles, "Missing Titles").to.be.not.empty;
    expect(data.rating, "Missing Rating").to.exist;
  });

  it("Get Chapters", async () => {
    let data = await wrapper.getChapters(source, mangaId);

    expect(data, "No chapters present for: [" + mangaId + "]").to.not.be.empty;

    let entry = data[0];
    expect(entry.id, "No ID present").to.not.be.empty;
    expect(entry.time, "No date present").to.exist;
    expect(entry.name, "No title available").to.not.be.empty;
    expect(entry.chapNum, "No chapter number present").to.exist;
    expect(entry.volume, "No volume data available").to.not.be.empty;
  });

  it("Get Chapter Details", async () => {
    let chapters = await wrapper.getChapters(source, mangaId);
    let data = await wrapper.getChapterDetails(source, mangaId, chapters[0].id);

    expect(data, "No server response").to.exist;
    expect(data, "Empty server response").to.not.be.empty;

    expect(data.id, "Missing ID").to.be.not.empty;
    expect(data.mangaId, "Missing MangaID").to.be.not.empty;
    expect(data.pages, "No pages present").to.be.not.empty;
  });

  it("Testing search", async () => {
    let testSearch = createSearchRequest({
      title: "Kaguya",
    });

    let search = await wrapper.search(source, testSearch, 1);
    let result = search[0];

    expect(result, "No response from server").to.exist;

    expect(result.id, "No ID found for search query").to.be.not.empty;
    expect(result.image, "No image found for search").to.be.not.empty;
    expect(result.title, "No title").to.be.not.null;
    expect(result.subtitleText, "No subtitle text").to.be.not.null;
  });

  it("Testing Home-Page aquisition", async () => {
    let homePages = await wrapper.getHomePageSections(source);
    expect(homePages, "No response from server").to.exist;
  });
});
