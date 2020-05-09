var tsify = require('tsify')
var browserify = require('browserify')

var source = require('vinyl-source-stream')
var streamify = require('gulp-streamify')
var uglify = require('gulp-uglify')
var rename = require('gulp-rename')
var gulp = require('gulp')

//requiring path and fs modules
const path = require('path')
const fs = require('fs')

const bundleSources = async function () {
    //joining path of directory
    const directoryPath = path.join(__dirname, 'src/sources')
    const destDir = './bundles'

    // If the bundles directory does not exist, create it here
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir)
    }

    var promises = []

    var bundleThis = function (srcArray) {
        for (let file of srcArray) {
            let filePath = file

            // If its a directory
            if (
                !fs.statSync(path.join(directoryPath, filePath)).isDirectory()
            ) {
                console.log('Not a directory, skipping ' + filePath)
                continue
            }

            let finalPath = path.join(directoryPath, filePath, `/${file}.ts`)

            if (!fs.existsSync(finalPath)) {
                console.log("The file doesn't exist, skipping. " + filePath)
                continue
            }

            promises.push(
                new Promise((res, rej) => {
                    browserify([finalPath], { standalone: 'Sources' })
                        .plugin(tsify, { noImplicitAny: true })
                        .bundle()
                        .pipe(source('source.' + file + '.js'))
                        .pipe(gulp.dest(destDir))
                        .on('end', () => {
                            res()
                        })
                })
            )
        }
    }

    const bundlesPath = path.join(__dirname, 'bundles')

    const emptyDir = function (files) {
        for (let file of files) {
            fs.unlinkSync(path.join(bundlesPath, file))
        }
    }

    emptyDir(fs.readdirSync(bundlesPath))

    bundleThis(fs.readdirSync(directoryPath))

    await Promise.all(promises) //.then(function () { done() })
}

const generateVersioningFile = async function () {
    let jsonObject = {
        buildTime: new Date(),
        sources: []
    }

    //joining path of directory
    const directoryPath = path.join(__dirname, 'bundles')
    var promises = []

    var generateSourceList = function (srcArray) {
        for (let file of srcArray) {
            let filePath = file
            let tags = filePath.match(/source.(\w*).*/)
            let sourceName = tags[1] // Pull the sourceName from the path

            // If its a directory
            if (fs.statSync(path.join(directoryPath, filePath)).isDirectory()) {
                console.log('Directory, skipping ' + filePath)
                return
            }

            let finalPath = `./bundles/${file}`

            promises.push(
                new Promise((res, rej) => {
                    let req = require(finalPath)
                    let className = file.split('.')[1]
                    let extension = req[className]

                    let classInstance = new extension(null)

                    jsonObject.sources.push({
                        id: sourceName,
                        name: classInstance.name,
                        author: classInstance.author,
                        desc: classInstance.description,
                        website: classInstance.authorWebsite,
                        version: classInstance.version
                    })

                    res()
                })
            )
        }
    }

    generateSourceList(fs.readdirSync(directoryPath))
    await Promise.all(promises)

    // Write the JSON payload to file
    fs.writeFileSync(
        path.join(directoryPath, 'versioning.json'),
        JSON.stringify(jsonObject)
    )
}

// exports.bundle = bundleSources
exports.bundle = gulp.series(bundleSources, generateVersioningFile)
