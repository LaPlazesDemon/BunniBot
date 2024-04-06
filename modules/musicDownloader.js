const moduleName = "Music Downloader";

const { downloadTrack } = require("@nechlophomeriaa/spotifydl");
const { exec } = require('child_process');
const config = require("../config.json");
const sql = require("../bot").sql;
const axios = require('axios');
const path = require('path')
const fs = require("fs");
const { EmbedBuilder, Events } = require("discord.js");

var youtubeVideoRegex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/; // YouTube Video ID
var youtubeRegex = /https?:\/\/music\.youtube\.com\/(?:watch\?v=|embed\/|v\/|)([a-zA-Z0-9_-]{11})/g; // YouTube Music
var spotifyRegex = /https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+/g // Spotify
var appleRegex = /^https?:\/\/music\.apple\.com\//i // Apple Music

const illegalFilenameCharacters = /[<>:"/\\|?*\x00-\x1F]/g;

var debug = function(data) {console.log(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    startModule: (bot) => {

        bot.on(Events.MessageCreate, message => {
            if (message.channel.id == config.discord.channels.testChannel) {

                var spotifyMatches = message.content.match(spotifyRegex);
                var youtubeMatches = message.content.match(youtubeRegex);

                if (spotifyMatches) {
                    spotifyMatches.forEach(match => {

                        log("Starting Spotify Song Matching");
                        try {
                            downloadTrack(match)
                            .then(songData => {
                                var filename = songData.title.replace(illegalFilenameCharacters, "");
                                trimAudioBuffer(songData.audioBuffer, filename)
                                .then(() => {       
                                    mp3toWav(filename)
                                    .then(buffer => matchSong(buffer, songData, bot, message));
                                });
                            });

                        } catch (err) {
                            log(err);
                            message.channel.send(":x: Song matching has failed");
                        } 
                    });
                }
                
                if (youtubeMatches) {
                    
                    log("Starting YouTube Music Song Matching");
                    try {
                        
                        youtubeMatches.forEach(match => {

                            // Cut out Video ID from supplied link
                            var videoID = match.match(youtubeVideoRegex)[1];
                            
                            // Download song
                            downloadYoutubeSong(match, videoID).then(audioBuffer => {
                                
                                // Trim Audio to 450kb
                                trimAudioBuffer(audioBuffer, `${videoID}`).then(() => {       

                                    // Convert Trimmed Audio to WAV for upload to Shazam
                                    mp3toWav(videoID).then(async buffer => {
                                     
                                        // Process and recieve song data
                                        var shazamData = await matchSong(buffer);
                                        var youtubeData = searchYoutubeMusicSongData(videoID);

                                        var sTitle = youtubeData.title;
                                        var sArtist = youtubeData.channelTitle;
                                        var sAlbum = shazamData.album;

                                        var spotifyData = searchSpotifySong(sTitle, sArtist, sAlbum);
                                        var spotifyUrl = spotifyData.external_urls.spotify;
                                        var spotifySongId = spotifyData.id

                                        var addedToSpotify = await isSongInSpotifyPlaylist(spotifySongId) ? true : (await addTrackToSpotifyPlaylist(spotifySongId) ? true : false);    

                                    });
                                });
                            }).catch(err => {
                                debug(err);
                            });
                        })
                    } catch (err) {
                        log(err);
                        message.channel.send(":x: Song matching has failed");
                    }

                }
            }
        });

        function sendDiscordEmbed(songData) {

            // songData = {
            //     title,
            //     artist,
            //     album,
            //     duration,
            //     appleOpenLink,
            //     spotifyOpenLink,
            //     ytMusicVideoUrl,
            //     playlists: {
            //         spotify: true | false
            //     }
            // }

            var embed = new EmbedBuilder()
            .setTitle(`${songData.title} by ${songData.artist}`)
            .setDescription(`**__Track Information__**\n**Album**: ${songData.album}\n**Duration**: ${songData.duration}`)
            .setColor(0xf69ee3)
            .setThumbnail(songData.thumbnail)
            .addFields({ name: "Listen Now", value: `[${message.guild.emojis.resolve(config.discord.emotes.AppleMusic)} Apple Music](${songData.appleOpenLink})\n[${message.guild.emojis.resolve(config.discord.emotes.Spotify)} Spotify](${songData.spotifyOpenLink})` })
            .setFooter({ text: "Results provided by Shazam, exact match is not guaranteed", iconURL: bot.user.avatarURL()})

            var playlistText = "";
            if (songData.playlists.spotify) playlistText += `[${message.guild.emojis.resolve(config.discord.emotes.Spotify)} Spotify Mega Playlist](${config.spotify.megaPlaylistUri})`;
            
            // Will add youtube playlist later

            if (songData.ytMusicVideoUrl) {embed.addFields({ name: "Watch Now", value: `[${message.guild.emojis.resolve(config.discord.emotes.Youtube)} YouTube](${songData.ytMusicVideoUrl})` });} 
            if (playlistText) {embed.addFields({ name: "Added to Playlists", value: playlistText})}

            bot.guilds.cache.get(config.discord.guildID).channels.cache.get(config.discord.channels.testChannel).send({embeds: [embed]});
            message.delete().then().catch(err => {})
        
        }

        function runDjMMQuery(sqlData) {
            
            // sqlData = {
            //     spotifySongId,
            //     appleMusicSongId,
            //     spotifyOpenLink,
            //     appleOpenLink,
            //     youtubeMusicVideoUrl,
            //     title,
            //     artist,
            //     album,
            //     duration,
            //     thumbnail
            // }

            sql.query(`INSERT IGNORE INTO djMusicMan (submitter, username, spotifySongId, appleSongId, spotifyUrl, AppleMusicUrl, youtubeMusicVideoUrl, songTitle, songArtist, songAlbum, songDuration, songArtUrl) VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [message.author.id, message.author.username, sqlData.spotifySongId, sqlData.appleMusicSongId, sqlData.spotifyOpenLink, sqlData.appleOpenLink, sqlData.youtubeMusicVideoUrl, sqlData.title, sqlData.artist, sqlData.album, sqlData.songDuration, sqlData.imageUrl]);

        }

        async function processShazamMatch(data) {
            var trackData = data.data.track;

            var spotifyOpenLink = trackData.hub.providers.find(o => o.type == "SPOTIFY").actions[0].uri;

            var appleData = trackData.hub.options.find(option => option.providername === 'applemusic');
            var appleMusicSongId = trackData.hub.actions.find(a => a.type === 'applemusicplay').id;
            var appleOpenLink = appleData.actions.find(obj => obj.type === "applemusicopen").uri;
            
            var youtubeMusicVideoUrl = trackData.sections.find(o => o.type === "VIDEO") ? trackData.sections.find(o => o.type === "VIDEO").youtubeurl.actions[0].uri : "";
            var songDuration = songData.duration.split(":").map((part, index) => (index === 1 ? parseInt(part, 10).toString().replace(/^0+/, '') : part)).join(":").replace(/^00:/, '');

            var returnData = {
                spotifyLink: spotifyOpenLink,
                appleMusicSongId: appleMusicSongId,
                appleMusicOpenLink: appleOpenLink,
                ytMusicVideoUrl: youtubeMusicVideoUrl,
                duration: songDuration,
                title: trackData.title,
                artist: trackData.subtitle,
                album: trackData.sections[0].metadata[0].find(s => s.title === 'Album').text
            }

            debug(returnData)
            return returnData;
        }
    }
} 






///////////////////////
// Spotify Functions //
///////////////////////


async function addTrackToSpotifyPlaylist(trackId) {
    const url = `https://api.spotify.com/v1/playlists/${config.spotify.megaPlaylistId}/tracks`;
    const data = { uris: [`spotify:track:${trackId}`] };

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${process.env.spotifyToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error adding track to playlist:', error.response.data);
        throw error;
    }
}

async function getSpotifyPlaylistTracks() {
    try {
        const response = await axios.get(`https://api.spotify.com/v1/playlists/${config.spotify.megaPlaylistId}/tracks`, {
            headers: {
                'Authorization': `Bearer ${process.env.spotifyToken}`
            }
        });
        const tracks = response.data.items.map(item => item.track.id);
        return tracks;
    } catch (error) {
        console.error('Error getting playlist tracks:', error.message);
        throw error;
    }
}

async function isSongInSpotifyPlaylist(songId) {
    var tracks = await getSpotifyPlaylistTracks();
    return tracks.includes(songId);
}

async function searchSpotifySong(title, artist, album) {
    try {
        var response = await axios.get('https://api.spotify.com/v1/search', {
            params: {
                q: `track:${title} artist:${artist} album:${album}`,
                type: 'track'
            }, headers: {
                'Authorization': `Bearer ${process.env.spotifyToken}`
            }
        });

        return response.data.tracks.items[0]
    } catch (err) {
        debug(err);
    }
}

///////////////////////
// YouTube Functions //
///////////////////////


function downloadYoutubeSong(url, vid) {
    return new Promise((resolve, reject) => {
        const command = `youtube-dl -x --audio-format mp3 -o "data/songs/%(id)s.%(ext)s" --no-playlist "${url}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                reject(error);
            } else if (stderr) {
                console.error(`Error: ${stderr}`);
                reject(new Error(stderr));
            } else {
                
                resolve(fs.readFileSync(`${process.cwd()}\\data\\songs\\${vid}.mp3`));
            }
        });
    });
}

async function searchYoutubeMusicSongData(videoId) {
    try {

        var response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                q: videoId,
                key: config.youtube.key,
                type: 'video',
                videoCategoryId: '10',
                maxResults: 1
            }
        });

        var videoInfo = response.data.items[0].snippet;
        
        var songData = {
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnails.high.url,
            duration: getYoutubeSongDuration(videoId)
        }

        return songData
    } catch (err) {
        debug(err);
    }
}

async function getYoutubeSongDuration(videoId) {
    try {

        var response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                part: 'contentDetails', 
                id: videoId,
                key: config.youtube.key
            }
        });

        return convertISOTimestamp(response.data.items[0].contentDetails.duration);

    } catch (err) {
        debug(err);
    }
}


//////////////////////
// Global Functions //
//////////////////////


function convertISOTimestamp(isoTimestamp) {

    const match = isoTimestamp.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

    var hours = parseInt(match[1]) || 0;
    var minutes = parseInt(match[2]) || 0;
    var seconds = parseInt(match[3]) || 0;

    var cleanMinutes = hours ? minutes.toString().padStart(2, '0') : minutes.toString();
    var cleanSeconds = minutes ? seconds.toString().padStart(2, '0') : seconds.toString();

    var output = hours ? `${hours}:${cleanMinutes}:${cleanSeconds}` : `${cleanMinutes}:${cleanSeconds}`;

    debug(output);
}

function trimAudioBuffer(buffer, filename) {
    return new Promise((resolve, reject) => {

        var tempFilePath = process.cwd()+`\\data\\songs\\${filename}.mp3`;
        
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
        if (fs.existsSync(`${process.cwd()}\\data\\samples\\${filename}.mp3`)) fs.unlinkSync(`${process.cwd()}\\data\\samples\\${filename}.mp3`);
        fs.writeFileSync(tempFilePath, buffer);
        
        var command = `ffmpeg -i "${tempFilePath}" -ss 15 -t 5 -af "aresample=44100,pan=mono|c0=c0" -y "${process.cwd()}\\data\\samples\\${filename}.mp3`; // Trim first 15 seconds
        exec(command, (error, stdout, stderr) => {
            if (error) {
                debug("Error trimming audio:", error);
                reject(error);
                return;
            } else {
                var trimmedBuffer = fs.readFileSync(`${process.cwd()}\\data\\samples\\${filename}.mp3`);
                resolve(trimmedBuffer);
            }
        });
    });
}

function mp3toWav(filename) {
    return new Promise((resolve, reject) => {
        const wavFilePath = `${process.cwd()}\\data\\samples\\${filename}.wav`;

        if (fs.existsSync(wavFilePath)) fs.unlinkSync(wavFilePath)

        // Convert MP3 to WAV using ffmpeg
        const command = `ffmpeg -i "${process.cwd()}\\data\\samples\\${filename}.mp3" -f wav "${wavFilePath}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error converting MP3 to WAV:', error);
                reject(error);
                return;
            }
            // Read WAV file into buffer
            const wavBuffer = fs.readFileSync(wavFilePath);
            resolve(wavBuffer);
        });
    });
}

async function matchSong(songBufferData) {
    var response = axios.request({
        method: "POST",
        url: "https://shazam.p.rapidapi.com/songs/v2/detect",
        params: {
            timezone: 'America/Chicago',
            locale: 'en-US'
        },
        headers: {
            'content-type': 'text/plain',
            'X-RapidAPI-Key': config.shazam.key,
            'X-RapidAPI-Host': 'shazam.p.rapidapi.com'
        },
        data: Buffer.from(songBufferData, 'binary').toString('base64')
    });

    return response
    
}
// `https://open.spotify.com/track/${await search(`${songData.title} by ${songData.artists}`).items[0].id}`;
