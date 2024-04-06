const moduleName = "Admin Refresh";

const {SlashCommandBuilder} = require('discord.js');
const moment = require('moment');
const fetchAll = require('discord-fetch-all');
const config = require("../config.json");
const sql = require("../bot").sql;

var debug = function(data) {console.debug(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    data: new SlashCommandBuilder()
    .setName("refreshstats")
    .setDescription("Dev Only - Reloads the Database GE tables")
    .setDefaultMemberPermissions(0),
    async execute(interaction) {

        await interaction.deferReply();

        if (interaction.user.id !== config.discord.users.ghosty) {
            interaction.editReply(":x: You are not the dev silly!");
        } else {


            log("Dev initated stats refresh...");
            interaction.editReply("Fetching all messages");

            var channels = await interaction.guild.channels.fetch();
            channels.each(channel => {
                if (channel.type == 0) {
                    fetchAll.messages(channel,{
                        reverseArray: true, 
                        userOnly: true,
                        botOnly: false,
                        pinnedOnly: false,
                    }).then(messages => {
                        messages.forEach(message => {
                            sql.query(`INSERT IGNORE INTO geMessagesSent (messageID, uid, username, message, channel, channelName, isCommand, numAttachments, time) VALUES
                            (${message.id}, ${message.author.id}, ?, ?, ${message.channel.id}, ?, ${!!(message.applicationId)}, ${message.attachments.map(a => a.id).length}, ?)`,
                            [message.author.username, message.cleanContent, message.channel.name, moment(message.createdTimestamp).format('YYYY-MM-DD HH:mm:ss')])
                        });

                        interaction.editReply("Fetching all users");
                        interaction.guild.members.fetch().then(members => {
                            members.each(user => {
                                sql.query(`INSERT IGNORE INTO geUserStats (uid, username, nicknameHistory, vcTime) VALUES
                                (?,?,?, 0);`, [user.id, user.user.username, "[]"],
                                () => {
                                    sql.query(`UPDATE geUserStats SET
                                    messagesSent = (SELECT COUNT(*) FROM geMessagesSent WHERE uid = ${user.id}),
                                    messagesDeleted = (SELECT COUNT(*) FROM geMessageDeletes WHERE uid = ${user.id}),
                                    messageEdits = (SELECT COUNT(*) FROM geMessageEdits WHERE uid = ${user.id}),
                                    attachmentsSent = (SELECT SUM(numAttachments) FROM geMessagesSent WHERE uid = ${user.id}),
                                    commandsUsed = (SELECT COUNT(*) FROM geMessagesSent WHERE uid = ${user.id} AND isCommand = 1)
                                    WHERE uid = ${user.id};`);
                                });
                            });

                            interaction.editReply(":white_check_mark: Stats refreshed");
                        });
                        
                    }).catch(err => {
                        log(err);
                    });
                }
            });


            
            
        }
    }
} 