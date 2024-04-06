const moduleName = "Twitch Notifier";

const {EmbedBuilder} = require('discord.js');
const twitchVodGrabber = require('./twitchVODGabber');
const config = require("../config.json");
const axios = require("axios");


Object.prototype.prepare = function(json) {return sql.escape(JSON.stringify(json) || "{}");};
String.prototype.prepare = function(string) {return sql.escape(string || "");};

var debug = function(data) {console.log(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    startModule: async (bot) => {

        const streamers = config.twitch.streamers;
        const streamerStates = {};

        log(`Registered ${streamers.length} Streamer for notifications`);

        setInterval(function() {
            streamers.forEach(streamer => {
                isStreamerLive(streamer.id).then((async isLive => {
                    
                    if (isLive) {
                        if (!streamerStates[streamer.id]) {

                            log (`${streamer.name} is now live!`);
                            streamerStates[streamer.id] = true;

                            var streamerData = await getChannelInfo([streamer.id]);
                            var streamerImageUrl = await getChannelAvatar(streamer.id);

                            const embed = new EmbedBuilder()
                            .setColor(0x9146FF)
                            .setTitle(`${streamer.name} is Now Live!`)
                            .setURL(`https://twitch.tv/${streamer.name}`)
                            .setAuthor({ iconURL: 'https://cdn.icon-icons.com/icons2/3041/PNG/512/twitch_logo_icon_189242.png', name: "BunniBot Twitch Notifier"})
                            .setThumbnail(streamerImageUrl)
                            .setDescription(`**${streamerData.data[0].title}**`)
                            .addFields(
                                { name: "Playing", value: `${config.discord.emotes[streamerData.data[0].game_name] || ''} ${streamerData.data[0].game_name}` },
                                { name: "Watch Now", value: `https://twitch.tv/${streamer.name}`}
                            )
                            .setTimestamp()
                            .setFooter({ text: "BunniBot", iconURL: bot.user.avatarURL()});

                            bot.guilds.cache.get(config.discord.guildID).channels.fetch(config.discord.channels.twitchNotificationChannel).then(channel => {
                                channel.send(`<@${config.discord.roles.livestreamViewer}>`);
                                channel.send({embeds: [embed]});
                            });
                        }
                    } else if (streamerStates[streamer.id]) {
                        log(streamer.name+" is no longer live. Starting VOD checks for "+streamer.name)
                        twitchVodGrabber.startVodChecks(streamer);
                        streamerStates[streamer.id] = false;
                    } else {
                        streamerStates[streamer.id] = false;
                    }
                }));
            });       
        }, 10000);
    }
} 



function restGet(url, options) {
    return new Promise((resolve, reject) => {
        axios.get(url, { headers: options.headers })
            .then((response) => {
                resolve(response.data);
            })
            .catch((error) => {
                reject(error);
            });
    });
}

async function getChannelInfo(streamerIds) {
    try {
        const queryParams = new URLSearchParams(streamerIds.map(id => ['broadcaster_id', id]));
        const url = `https://api.twitch.tv/helix/channels?${queryParams.toString()}`;
        const headers = {
            'Client-ID': config.twitch.credentials.clientID,
            'Authorization': `Bearer ${process.env.twitchToken}`
        };
        return await restGet(url, { headers });
    } catch (error) {
        throw error;
    }
}

async function getChannelAvatar(streamerId) {
    try {
        const response = await axios.get(`https://api.twitch.tv/helix/users?id=${streamerId}`, {
            headers: {
                'Client-ID': config.twitch.credentials.clientID,
                'Authorization': `Bearer ${process.env.twitchToken}`
            }
        });
        
        return response.data.data[0]?.profile_image_url || null;
    } catch (error) {
        throw error;
    }
}

async function isStreamerLive(streamerId, attempts = 0) {
    try {
        var url = `https://api.twitch.tv/helix/streams?user_id=${streamerId}`;
        var headers = {
            'Client-ID': config.twitch.credentials.clientID,
            'Authorization': `Bearer ${process.env.twitchToken}`
        };

        var response = await axios.get(url, {headers});
        var streamData = response.data.data;

        return streamData.length > 0; // If data array is not empty, then the channel is live;
    } catch (error) {
        if (attempts < 2) {
            log("Failed to check stream status, attempting again");
            return isStreamerLive(streamerId, (attempts +1));
        } else {
            log("Failed to check stream status after 3 attempts, defaulting to offline");
            return false;
        }
    }
}