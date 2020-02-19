/*
This downloads in cache:
- popular movies with its poster (for /movies/popular page)
- for each popular movie (for /movie/{id} pages):
    - movie detail
    - movie credits (cast & crew) and its profile image
    - for each cast (only first 3 ones)
        - person detail
        - movies the cast person played in
            - for each movie, its poster
*/

const request = require('request-promise');

const baseUrl = 'http://localhost:1337';

async function asyncForEach (array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array)
    }
}

async function loadCache () {
    console.log('Downloading popular movies...');
    const popularMovies = JSON.parse(await request(`${baseUrl}/movie/popular`)).results;

    return asyncForEach(
        popularMovies,
        async (popularMovie) => {
            console.log(`Downloading movie: "${popularMovie.title}"...`);
            const movie = JSON.parse(await request(`${baseUrl}/movie/${popularMovie.id}`));

            console.log(`\t downloading poster...`);
            await request(`${baseUrl}${movie.poster_path}`);

            console.log(`\t downloading credits...`);
            const {cast, crew} = JSON.parse(await request(`${baseUrl}/movie/${popularMovie.id}/credits`));

            await asyncForEach(
                [...cast, ...crew].filter(c => c.profile_path != null),
                async (c) => {
                    console.log(`\t\t downloading profile image for casting: "${c.name}"...`);
                    return request(`${baseUrl}${c.profile_path}`);
                }
            );

            await asyncForEach(
                cast.slice(0, 3),
                async (c) => {
                    console.log(`\t downloading person: "${c.name}"...`);
                    await request(`${baseUrl}/person/${c.id}`);

                    console.log(`\t downloading movies with "${c.name}"...`);
                    const moviesWithCast = JSON.parse(await request(`${baseUrl}/discover/movie?with_cast=${c.id}`)).results;
                    await asyncForEach(
                        moviesWithCast.filter(m => m.poster_path != null),
                        async (movieWithCast) => {
                            console.log(`\t\t downloading poster for movie "${movieWithCast.title}"...`);
                            return request(`${baseUrl}${movieWithCast.poster_path}`);
                        }
                    );
                }
            );

            console.log(`\t downloading search results...`);
            const movieSearches = popularMovie.title
                .toLowerCase()
                .split('')
                .map((val, i, arr) => arr.slice(0, i + 1).join(''));
            return  asyncForEach(
                movieSearches,
                async (s) => {
                    console.log(`\t for "${s}"...`);
                    const searchResults = JSON.parse(await request(`${baseUrl}/search/multi?query=${encodeURI(s)}`)).results;
                    return asyncForEach(
                        searchResults.filter(result => result.media_type === 'movie' || result.media_type === 'person'),
                        async (searchResult) => {
                            console.log(`\t\t downloading image for "${searchResult.name || searchResult.title}"...`);
                            const image = searchResult.poster_path || searchResult.profile_path;
                            if (image) {
                                return request(`${baseUrl}${image}`);
                            }
                        }
                    );
                }
            )
        }
    );
}

loadCache();