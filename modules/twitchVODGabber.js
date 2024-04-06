const moduleName = "Twitch VOD Grabber";

const {EmbedBuilder} = require('discord.js');
const {Client} = require('ssh2');
const child = require("child_process");
const axios = require("axios");
const fs = require("fs");
const config = require("../config.json");

var debug = function(data) {console.log(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};
var vodCheckIntervals = {};
var vodCheckCounts = {};

module.exports = {
    info: {name: moduleName},
    startModule: async (bot) => {},
    startVodChecks: async (streamer) => {

        vodCheckCounts[streamer.id] = 0;
        vodCheckIntervals[streamer.id] = setInterval(async () => {
            
            // Cancel the checks after a day of checking
            vodCheckCounts[streamer.id] += 1;
            if (vodCheckCounts[streamer.id] > 1440) {
                clearInterval(vodCheckIntervals[streamer.id]);
                if (streamer.userID) {
                    bot.users.fetch(streamer.userId).then(user => {
                        user.send(":x: It's been over a day since you were live. Twitch has still not yet processed your VOD or it was never saved. Cancelling automated VOD archival");
                    });
                }
            }

            // Grab the latest VOD from twitch
            var latestvod = await getLatestVod(streamer.id);
            if (latestvod) {
                if (!(latestvod.thumbnail_url.indexOf("404_processing") > -1)) {
                
                    clearInterval(vodCheckIntervals[streamer.id]);
                    
                    var cleanedFilename = latestvod.title.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '');
                    var cleanedDate = latestvod.created_at.substring(0, 10);
                    var vodDLCommand = `youtube-dl -o "${config.twitch.vodPath}/${streamer.name}/${cleanedDate} - ${cleanedFilename}.mp4" ${latestvod.url}`;
                
                    log(`Twitch has completed processing the VOD from ${streamer.name} downloading to '${config.twitch.vodPath}/${streamer.name}/${cleanedDate} - ${cleanedFilename}.mp4'`);

                    if (streamer.userID) {
                        bot.users.fetch(streamer.userId).then(user => {
                            user.send(":floppy_disk: Twitch has finished processing your most recent livestream. Archival process started");
                        });
                    }

                    if (!fs.existsSync(`${config.twitch.vodPath}/${streamer.name}`)) {
                        fs.mkdirSync(`${config.twitch.vodPath}/${streamer.name}/`);
                    }

                    child.exec(vodDLCommand, (error, stdout, stderr) => {

                        if (error) {
                            log(`Error downloading Twitch VOD: ${error.message}`);
                            if (streamer.userID) {
                                bot.users.fetch(streamer.userId).then(user => {
                                    user.send(":x: There was an error automatically archiving your Twitch VOD");
                                });
                            }
                            return;
                        }
                        
                        if (stderr) {
                            log(`youtube-dl encountered an error: ${stderr}`);
                            if (streamer.userID) {
                                bot.users.fetch(streamer.userId).then(user => {
                                    user.send(":x: There was an error automatically archiving your Twitch VOD");
                                });
                            }
                            return;
                        }

                        log(`Twitch VOD downloaded successfully: ${stdout}`);
                        
                        const scanCommand = "docker exec e0b3eb6caa25 sudo -u abc php /config/www/owncloud/console.php files:scan --all";
                        const ssh = new Client();

                        ssh.on('ready', () => {
                            ssh.exec(scanCommand, (err, stream) => {
                                if (err) log(err)
                                else {
                                    stream.on('close', (code, signal) => {
                                        log(code);
                                        log("ownCloud file scan completed");
                                        if (streamer.userID) {
                                            bot.users.fetch(streamer.userId).then(user => {
                                                user.send(":white_check_mark: Your recent livestream has been archived successfully!\nAccess it here: https://cloud.bricemoyer.co/").then(result => {
                                                    log(result)
                                                }).catch(err => {
                                                    log(err)
                                                });
                                            }).catch(err => {
                                                log(err)
                                            });
                                        }
                                        ssh.end();
                                    });
                                    // }).on('data', (data) => {
                                    //     log('ownCloud: ' + data);
                                    // }).stderr.on('data', (data) => {
                                    //     log('ownCloud ERR: '+ data);
                                    // });
                                } 
                            });
                        }).connect({
                            host: '10.0.0.10',
                            port: 22,
                            username: 'root',
                            password: 'zUbzex-ruxmor-suzhu2'
                        });
                        
                    });
                } else {
                    log("VOD for "+streamer.name+" is not yet processed");
                }
            }
        }, 60000); //Check every minute
    }
}

async function getLatestVod(channelId) {
    try {
        const vodList = await axios.get(`https://api.twitch.tv/helix/videos?user_id=${channelId}&type=archive&sort=time`, {
            headers: {
                'Client-ID': config.twitch.credentials.clientID,
                'Authorization': `Bearer ${process.env.twitchToken}`
            }
        });
        
        return vodList.data.data[0];

    } catch (error) {
        console.error('Error getting VODs:', error);
        throw error;
    }
}


