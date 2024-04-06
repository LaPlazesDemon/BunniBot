const moduleName = "GodsEye";

const {Events} = require('discord.js');
const config = require("../config.json");
const sql = require("../bot").sql;

// Object.prototype.prepare = function() {return sql.escape(JSON.stringify(this) || "{}");};
String.prototype.prepare = function() {return sql.escape(this || "");};
var debug = function(data) {console.log(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    startModule: (bot) => {
        
        // User Joins the Server
        bot.on(Events.GuildMemberAdd, member => {
            sql.query(`INSERT INTO geMemberJoinsAndLeaves (uid, username, action) VALUES (${member.id}, ?,"Joined");`, [member.username]);
        });

        // User Leaves the Server
        bot.on(Events.GuildMemberRemove, member => {
            sql.query(`INSERT INTO geMemberJoinsAndLeaves (uid, username, action) VALUES (${member.id}, ?, "Left);`, [member.username]);
        });

        // User Sends a Message
        bot.on(Events.MessageCreate, message => {
            sql.query(`INSERT IGNORE INTO geMessagesSent (messageID, uid, username, message, channel, channelName, isCommand, numAttachments) VALUES (${message.id}, ${message.author.id}, ?, ?, ${message.channel.id}, ?, ${!!(message.applicationId)}, ${message.attachments.map(a => a.id).length})`, [message.author.username, message.cleanContent, message.channel.name])
        });

        // User Deletes a Message
        bot.on(Events.MessageDelete, message => {
            sql.query(`INSERT INTO geMessageDeletes (message, channel, channelName) VALUES (?, ${message.channel.id}, ?);`, [message.content, message.channel.name]);
        });

        // User Edits a Message
        bot.on(Events.MessageUpdate, (oldMessage, newMessage) => {
            if (!newMessage.author.bot) sql.query(`INSERT INTO geMessageEdits (uid, username, oldMessage, newMessage, channel, channelName) VALUES (${newMessage.author.id}, ?, ?, ?, ${newMessage.channel.id}, ?);`, [newMessage.author.username, oldMessage.cleanContent, newMessage.cleanContent, newMessage.channel.name])
        });

        // User Changes VC States
        bot.on(Events.VoiceStateUpdate, (oldstate, newstate) => {

            var eventString = getEventString(oldstate, newstate);
            var userid = oldstate.member.id || newstate.member.id
            var username = (function(){if (oldstate.member) {return oldstate.member.user.username} else {return newstate.member.user.username}})()
            var oldChannelId = (function(){if (oldstate.channel){return oldstate.channel.id} else {return "NULL"}})();
            var newChannelId = (function(){if (newstate.channel){return newstate.channel.id} else {return "NULL"}})();

            sql.query(`INSERT INTO geVoiceStateChanges (uid, username, oldChannel, newChannel, isMuted, isDeaf, eventString) VALUES (${userid}, ?, ${oldChannelId}, ${newChannelId}, ${newstate.mute}, ${newstate.deaf}, ?);`, [username, eventString]);
        });
    }
} 

function getEventString (oldstate, newstate) {


    var oldname = oldstate.channel || false;
    var newname = newstate.channel || false;
    var username = newstate.member.user.username || oldstate.member.user.username;

    let eventString;

    // User switched VCs
    if (oldstate.channelId !== newstate.channelId && oldname && newname) eventString = `${username} moved from ${oldname.name} to ${newname.name}`;
    
    // User Disconnects
    else if (oldname && !newname) eventString = `${username} disconnected from ${oldname.name}`
    // User Joins VC
    else if (!oldname && newname) eventString = `${username} joined ${newname.name}`;

    // User deafened themselves
    else if (!oldstate.selfDeaf && newstate.selfDeaf) eventString = `${username} has deafened themselves`;
    // User undeafened themselves
    else if (oldstate.selfDeaf && !newstate.selfDeaf) eventString = `${username} has undeafened themselves`;
    // User muted themselves
    else if (!oldstate.selfMute && newstate.selfMute) eventString = `${username} has muted themselves`;
    // User unmuted themselves
    else if (oldstate.selfMute && !newstate.selfMute) eventString = `${username} has unmuted themselves`;

    // User was server deafened
    else if (!oldstate.serverDeaf && newstate.serverDeaf) eventString = `${username} was server deafened`;
    // User was server undeafened
    else if (oldstate.serverDeaf && !newstate.serverDeaf) eventString = `${username} was server undeafened`;
    // User was server muted
    else if (!oldstate.serverMute && newstate.serverMute) eventString = `${username} was server muted`;
    // User was server unmuted
    else if (oldstate.serverMute && !newstate.serverMute) eventString = `${username} was server unmuted`;

    // User turned on their camera
    else if (!oldstate.selfCamera && newstate.selfCamera) eventString = `${username} turned on their camera`;
    // User turned off their camera
    else if (oldstate.selfCamera && !newstate.selfCamera) eventString = `${username} turned off their camera`;
    
    // User started screen sharing
    else if (!oldstate.streaming && newstate.streaming) eventString = `${username} started screen sharing`;
    // User stopped screen sharing
    else if (oldstate.streaming && !newstate.streaming) eventString = `${username} stopped screen sharing`;

    return eventString;
}