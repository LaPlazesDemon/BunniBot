const moduleName = "Recording Booth Vacancy Detector";

const {Events} = require('discord.js');
const config = require("../config.json");
const sql = require("../bot").sql;

Object.prototype.prepare = function() {return sql.escape(JSON.stringify(this) || "{}");};
String.prototype.prepare = function() {return sql.escape(this || "");};
var debug = function(data) {console.log(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    startModule: (bot) => {
        
        bot.on(Events.VoiceStateUpdate, (oldState, newState) => {

            var oldChannelId = (() => {if (oldState.channel) {return oldState.channel.id} else { return undefined}})();
            var newChannelId = (() => {if (newState.channel) {return newState.channel.id} else { return undefined}})();

            // Check if someone left the recording booth VC
            if (oldChannelId == config.discord.channels.recordingBooth && newChannelId != config.discord.channels.recordingBooth) {
                
                var user = oldState.id;

                // Grab recording booth data from the DB
                sql.query(`SELECT * FROM guildData`, async (err, results) => {

                    // Check if the rec booth is rented and if the person who left is the person who rented it
                    if (results[0].isRecordingBoothLocked && results[0].whoLockedRecordingBooth == user) {

                        // Set a 5 minute timer to let the renter return
                        setTimeout(async () => {

                            // Fetch VC Members, Role, Guild, and Channel
                            var guild = await bot.guilds.fetch(config.discord.guildID);
                            var recBoothChannel = await guild.channels.fetch(config.discord.channels.recordingBooth);
                            var everyoneRole = guild.roles.cache.find(role => role.name === '@everyone'); 
                            var currentVCMembers = await (async function () {
                                var m = await recBoothChannel.members;
                                if (m) {return m.map(member => member.user.id)}
                                else {return []}
                            })();

                            // Renter has not returned after 5 minutes
                            if (!currentVCMembers.includes(user)) {
                            
                                log("Original renter has left the booth for longer than 5 minutes, freeing up rec booth");

                                // Modify channel permissions
                                var currentPermissions = recBoothChannel.permissionOverwrites.cache;
                                currentPermissions.each(overwrite => {if (overwrite.type === 1) overwrite.delete()});
                                recBoothChannel.permissionOverwrites.edit(everyoneRole, {Connect: true});

                                // Clear recording booth data from the DB
                                sql.query(`UPDATE guildData SET
                                isRecordingBoothLocked = 0,
                                whoLockedRecordingBooth = NULL,
                                recordingBoothRentedAt = NULL,
                                recordingBoothWhitelist = "[]";`)
                            }
                            
                            
                        }, 300000);
                        
                    }
                })
            }
        });
    }
} 