const moduleName = "Recording Booth";

const {SlashCommandBuilder, PermissionsBitField} = require('discord.js');
const config = require("../config.json");
const sql = require("../bot").sql;
const bot = require('../bot').bot;

Object.prototype.prepare = function() {return sql.escape(JSON.stringify(this) || "{}");};
String.prototype.prepare = function() {return sql.escape(this || "");};
var debug = function(data) {console.debug(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    data: new SlashCommandBuilder()
    .setName("rent_booth")
    .setDescription("Rents out the recording booth to you")
    .addStringOption(option => 
        option.setName("allowed_users")
        .setDescription("Mention all the users you want to give access to")
    ),
    async execute(interaction) {

        var requestor = interaction.user;
        var recBoothChannel = await interaction.guild.channels.fetch(config.discord.channels.recordingBooth);
        var everyoneRole = interaction.guild.roles.cache.find(role => role.name === '@everyone');

        function error(message = ":x: There was an error, try again later or contact the developer") {interaction.reply({content: message, ephemeral: true})}

        sql.query(`SELECT * FROM guildData;`, async (err, result) => {
            
            if (err) error()
            else if (!result) error()
            else {

                // There is only ever 1 row in the table
                var recordingData = result[0];

                log("Renting out the recording booth");
                
                // Filter to only allow users and not roles from user field 'users'
                var allowedUsers = [];
                var mentionedWhitelist = interaction.options.getString('allowed_users');
                if (mentionedWhitelist) allowedUsers = [...mentionedWhitelist.matchAll(/<@!?(\d+)>/g)].map(match => match[1]);
                
                // All users from VC
                var currentVCMembers = await recBoothChannel.members.map(member => member.user.id);

                // Merge the two
                var whitelist = [...new Set([...allowedUsers, ...currentVCMembers, ...[requestor.id]])]

                // Check if user is in the VC currently
                if (currentVCMembers.includes(requestor.id)) {

                    // Someone is already using it
                    if (recordingData.isRecordingBoothLocked) {
                    
                        // The requestor is trying to rerent the channel (Possibly adding users, will comply for ease of use)
                        if (recordingData.whoLockedRecordingBooth == requestor.id) {
                            sql.query(`UPDATE guildData SET recordingBoothWhitelist = ?`, [JSON.stringify(whitelist)], () => {
                                
                                // Edit channel permisions
                                whitelist.forEach(user => recBoothChannel.permissionOverwrites.edit(user, {Connect: true}))
                                recBoothChannel.permissionOverwrites.edit(everyoneRole, {Connect: false});
                                recBoothChannel.permissionOverwrites.edit(requestor.id, {MuteMembers: true, MoveMembers: true})
                            
                            });
                            interaction.reply("You already have the recording booth rented, adding new users");
                        
                        // Someone else is trying to rent it while it is already retned out
                        } else {
                            error(":x: Someone else is currently using the recording booth");
                        }
                    
                    // Recording booth is unused currently
                    } else {

                        sql.query(`UPDATE guildData SET 
                        isRecordingBoothLocked = 1,
                        whoLockedRecordingBooth = ${requestor.id},
                        recordingBoothRentedAt = "${new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' ')}",
                        recordingBoothWhitelist = ?;`, 
                        [JSON.stringify(whitelist)], (err) => {

                            // Edit channel permisions
                            whitelist.forEach(user => recBoothChannel.permissionOverwrites.edit(user, {Connect: true}))
                            recBoothChannel.permissionOverwrites.edit(everyoneRole, {Connect: false});
                            recBoothChannel.permissionOverwrites.edit(requestor.id, {MuteMembers: true, MoveMembers: true})
                            interaction.reply({content: ":clapper: You have successfully rented out the recording booth!\nPlease note that it will be unlocked once you leave\nYou are also granted mute and disconnect permissions for the remainder of the rental period", ephemeral: true});

                        });
                    }
                // Requestor is not in the VC currently
                } else {
                    error(":x: You must be in the Streaming/Recording VC to rent it out");
                }
            
            }
        });
    }
} 