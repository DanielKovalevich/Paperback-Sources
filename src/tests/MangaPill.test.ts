import cheerio from 'cheerio'
import { APIWrapper, MangaUpdates, Source } from 'paperback-extensions-common';
import { MangaPill } from '../MangaPill/MangaPill';

describe('MangaPill Tests', function () {

    var wrapper: APIWrapper = new APIWrapper();
    var source: Source = new MangaPill(cheerio);
    var chai = require('chai'), expect = chai.expect, should = chai.should();
    var chaiAsPromised = require('chai-as-promised');
    chai.use(chaiAsPromised);

    /**
     * The Manga ID which this unit test uses to base it's details off of.
     * Try to choose a manga which is updated frequently, so that the historical checking test can 
     * return proper results, as it is limited to searching 30 days back due to extremely long processing times otherwise.
     */
    var mangaId = "1/berserk";

    it("Retrieve Manga Details", async () => {
        let details = await wrapper.getMangaDetails(source, mangaId);
        expect(details, "No results found with test-defined ID [" + mangaId + "]").to.exist;

        // Validate that the fields are filled
        let data = details;
        expect(data.id, "Missing ID").to.be.not.empty;
        expect(data.image, "Missing Image").to.be.not.empty;
        expect(data.status, "Missing Status").to.exist;
        expect(data.desc, "Missing Description").to.be.not.empty;
        expect(data.titles, "Missing Titles").to.be.not.empty;
        expect(data.rating, "Missing Rating").to.exist;
    })

    it("Get Chapters", async () => {
        let data = await wrapper.getChapters(source, mangaId);

        expect(data, "No chapters present for: [" + mangaId + "]").to.not.be.empty;

        let entry = data[0]
        expect(entry.id, "No ID present").to.not.be.empty;
        expect(entry.name, "No title available").to.not.be.empty
        expect(entry.chapNum, "No chapter number present").to.not.be.null
    })

    it("Get Chapter Details", async () => {

        let chapters = await wrapper.getChapters(source, mangaId);
        let data = await wrapper.getChapterDetails(source, mangaId, chapters[4].id);
        expect(data, "No server response").to.exist;
        expect(data, "Empty server response").to.not.be.empty;

        expect(data.id, "Missing ID").to.be.not.empty;
        expect(data.mangaId, "Missing MangaID").to.be.not.empty;
        expect(data.pages, "No pages present").to.be.not.empty;
    })

     it("Testing search", async () => {
         let testSearch = createSearchRequest({
             title: 'Koe no katachi'
         });

         let search = await wrapper.searchRequest(source, testSearch, 1);
         let result = search.results[0];

         expect(result, "No response from server").to.exist;

         expect(result.id, "No ID found for search query").to.be.not.empty;
         expect(result.image, "No image found for search").to.be.not.empty;
         expect(result.title, "No title").to.be.not.null;
         expect(result.subtitleText, "No subtitle text").to.be.not.null;
    })

    it("Testing Home-Page aquisition", async() => {
        let homePages = await wrapper.getHomePageSections(source)
        expect(homePages, "No response from server").to.exist
        expect(homePages[0].items, "No items present").to.exist

        // Ensure that we can resolve each of the images for the home-page, since these images are generated and not scraped
        const promises: Promise<void>[] = []
        let axios = require('axios')
        for(let obj of homePages[0].items ?? []) {
            promises.push(axios.get(obj.image).then((imageResult: { status: any; }) => {expect(imageResult.status).to.equal(200)}))
        }
        await Promise.all(promises)
    })

    it("Testing Notifications", async () => {
        let updates = await wrapper.filterUpdatedManga(source, new Date("2021-02-01"), [mangaId])
        expect(updates, "No server response").to.exist
        expect(updates, "Empty server response").to.not.be.empty
        expect(updates[0], "No updates").to.not.be.empty;
    })

    it("Get tags", async () => {
        let tags = await wrapper.getTags(source)
        expect(tags, "No server response").to.exist
        expect(tags, "Empty server response").to.not.be.empty
    })
})