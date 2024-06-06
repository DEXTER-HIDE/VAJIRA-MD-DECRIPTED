const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  getDevice,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  getContentType
} = require('@adiwajshing/baileys')
const fs = require('fs')
const P = require('pino')
var os = require('os')
const config = require('./config')
const qrcode = require('qrcode-terminal')
const NodeCache = require('node-cache')
const util = require('util')
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson, fetchBuffer, getFile } = require('./lib/functions')
const { sms, downloadMediaMessage } = require('./lib/msg')
const axios = require('axios')
const { File } = require('megajs')
const path = require('path')
const msgRetryCounterCache = new NodeCache()
const prefix = '.'
const ownerNumber = ['94766943622']
const l = console.log
var { updateCMDStore,isbtnID,getCMDStore,getCmdForCmdId,connectdb,input,get,updb,updfb } = require("./lib/database")

//===================SESSION============================
if (!fs.existsSync(__dirname + '/session/creds.json')) {
  if (config.SESSION_ID) {
    const sessdata = config.SESSION_ID.replace("IZUMI=", "")
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`)
    filer.download((err, data) => {
      if (err) throw err
      fs.writeFile(__dirname + '/session/creds.json', data, () => {
        console.log("Session download completed !!")
      })
    })
  }
}

// <<==========PORTS===========>>
const express = require("express");
const app = express();
const port = process.env.PORT || 8000;
//====================================
async function connectToWA() {
  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/session/')
  const conn = makeWASocket({
    logger: P({ level: "fatal" }).child({ level: "fatal" }),
    printQRInTerminal: true,
    generateHighQualityLinkPreview: true,
    auth: state,
    defaultQueryTimeoutMs: undefined,
    msgRetryCounterCache 
  })
  
  conn.ev.on('connection.update', async(update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      if (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) {
        connectToWA()
      }
    } else if (connection === 'open') {
      console.log('Installing plugins 🔌... ')
      const path = require('path');
      fs.readdirSync("./plugins/").forEach((plugin) => {
        if (path.extname(plugin).toLowerCase() == ".js") {
          require("./plugins/" + plugin);
        }
      });
      console.log('Plugins installed ✅')
      await connectdb()
      await updb()
      console.log('QUEEN-IZUMI-MD connected ✅')
    }
  })

  conn.ev.on('creds.update', saveCreds)
  conn.ev.on('messages.upsert', async (mek) => {
    try {
      mek = mek.messages[0]
      if (!mek.message) return
      var id_db = require('./lib/database/id_db')      
      mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
      if (mek.key && mek.key.remoteJid === 'status@broadcast') return
      const m = sms(conn, mek)
      var smg = m
      const type = getContentType(mek.message)
      const content = JSON.stringify(mek.message)
      const from = mek.key.remoteJid
      const quoted = type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : []
      const body = (type === 'conversation') ? mek.message.conversation : mek.message?.extendedTextMessage?.contextInfo?.hasOwnProperty('quotedMessage') &&
        await isbtnID(mek.message?.extendedTextMessage?.contextInfo?.stanzaId) &&
        getCmdForCmdId(await getCMDStore(mek.message?.extendedTextMessage?.contextInfo?.stanzaId), mek?.message?.extendedTextMessage?.text)
        ? getCmdForCmdId(await getCMDStore(mek.message?.extendedTextMessage?.contextInfo?.stanzaId), mek?.message?.extendedTextMessage?.text)  : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type == 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : (type == 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : ''
      var isCmd = body.startsWith(prefix)
      var command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : ''
      var args = body.trim().split(/ +/).slice(1)
      var q = args.join(' ')
      if(smg.quoted && smg.quoted.fromMe && await id_db.check(smg.quoted.id)  ){
        if (body.startsWith(prefix)) body = body.replace( prefix , '')
        var id_body = await id_db.get_data( smg.quoted.id , body)  
        if (id_body.cmd) {
          isCmd = true
          command = id_body.cmd.startsWith(prefix)?  id_body.cmd.slice(prefix.length).trim().split(' ').shift().toLowerCase() : ''
          args = id_body.cmd.trim().split(/ +/).slice(1)
          q = args.join(' ')  
        }
      }
      console.log(command)
      const isGroup = from.endsWith('@g.us')
      const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid)
      const senderNumber = sender.split('@')[0]
      const botNumber = conn.user.id.split(':')[0]
      const pushname = mek.pushName || 'Sin Nombre'
      const developers = '94766943622'
      const isbot = botNumber.includes(senderNumber)
      const isdev = developers.includes(senderNumber)
      const isMe = isbot ? isbot : isdev 
      const isOwner = ownerNumber.includes(senderNumber) || isMe
      const botNumber2 = await jidNormalizedUser(conn.user.id);
      const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => { }) : ''
      const groupName = isGroup ? groupMetadata.subject : ''
      const participants = isGroup ? await groupMetadata.participants : ''
      const groupAdmins = isGroup ? await getGroupAdmins(participants) : ''
      const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false
      const isAdmins = isGroup ? groupAdmins.includes(sender) : false

      const isAnti = (teks) => {
        let getdata = teks
        for (let i=0;i<getdata.length;i++) {
          if(getdata[i] === from) return true
        }
        return false
      }

      const reply = async(teks) => {
        return await conn.sendMessage(from, { text: teks }, { quoted: mek })
      }

      conn.replyad = async (teks) => {
        return await conn.sendMessage(from, { text: teks ,
          contextInfo: {
            mentionedJid: [ '' ],
            groupMentions: [],
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: '120363182681793169@newsletter',
              serverMessageId: 127
            },
            externalAdReply: { 
              title: '🧚 ＱＵＥＥＮ -ＩＺＵＭＩ - ＭＤ 🧚',
              body: 'ᴀ ꜱɪᴍᴘʟᴇ ᴡʜᴀᴛꜱᴀᴘᴘ ʙᴏᴛ',
              mediaType: 1,
              sourceUrl: "https://wa.me/94766943622" ,
              thumbnailUrl: 'https://telegra.ph/file/ba8ea739e63bf28c30b37.jpg' ,
              renderLargerThumbnail: false,
              showAdAttribution: true
            }
          }
        }, { quoted: mek })
      }

      const NON_BUTTON = true // Implement a switch to on/off this feature...
      conn.buttonMessage2 = async (jid, msgData,quotemek) => {
        if (!NON_BUTTON) {
          await conn.sendMessage(jid, msgData)
        } else if (NON_BUTTON) {
          let result = "";
          const CMD_ID_MAP = []
         
