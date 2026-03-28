/**
 * @name HYWmusic_beta
 * @description 增加了卡密系统，有事加群1094095648
 * @version 0.6
 * @author Ryn
 * @homepage https://github.com/tuneflow
 * @license MIT
 * 
 * 支持平台: 酷我音乐、酷狗音乐、QQ音乐、网易云音乐、咪咕音乐
 * 支持音质: 128k, 320k, flac, flac24bit, hires
 * 生成时间: 2026-03-28T10:38:05.115Z
 */

'use strict'

const { EVENT_NAMES, request, on, send } = globalThis.lx

const API_BASE = 'https://music.bxa241d4.shop'
const SUPPORTED_SOURCES = ["kw","kg","tx","wy","mg"]
const ALLOWED_QUALITIES = ["128k","320k","flac","flac24bit","hires"]

// HTTP 请求封装
const httpRequest = (url, options = {}) => new Promise((resolve, reject) => {
  request(url, options, (err, resp) => {
    if (err) return reject(err)
    resolve(resp.body)
  })
})

// 获取音乐URL
const getMusicUrl = (source, musicInfo, quality) => {
  if (!SUPPORTED_SOURCES.includes(source)) {
    return Promise.reject(new Error('不支持的平台: ' + source))
  }
  
  const songId = musicInfo.songmid || musicInfo.songId || musicInfo.id || musicInfo.hash
  if (!songId) {
    return Promise.reject(new Error('缺少歌曲ID'))
  }
  
  const finalQuality = ALLOWED_QUALITIES.includes(quality) ? quality : '128k'
  
  const url = API_BASE + '/api/music/url?source=' + source + 
              '&songId=' + encodeURIComponent(songId) + 
              '&quality=' + finalQuality
  
  return httpRequest(url)
    .then(body => {
      try {
        const data = typeof body === 'string' ? JSON.parse(body) : body
        if (data.code === 200 && data.url) {
          return data.url
        }
        throw new Error(data.message || '获取播放链接失败')
      } catch (e) {
        throw new Error('解析响应失败: ' + e.message)
      }
    })
}

// 获取歌词 - 返回格式: {lyric, tlyric, rlyric, lxlyric}
const getLyric = (source, musicInfo) => {
  const songId = musicInfo.songmid || musicInfo.songId || musicInfo.id || musicInfo.hash
  if (!songId) return Promise.resolve({ lyric: '', tlyric: '', rlyric: '', lxlyric: '' })
  
  const url = API_BASE + '/api/music/info?action=lyric&source=' + source + 
              '&songId=' + encodeURIComponent(songId)
  
  return httpRequest(url)
    .then(body => {
      try {
        const data = typeof body === 'string' ? JSON.parse(body) : body
        if (data.code === 200 && data.data) {
          return {
            lyric: data.data.lyric || '',
            tlyric: data.data.tlyric || '',
            rlyric: data.data.rlyric || '',
            lxlyric: data.data.lxlyric || ''
          }
        }
        return { lyric: '', tlyric: '', rlyric: '', lxlyric: '' }
      } catch (e) {
        return { lyric: '', tlyric: '', rlyric: '', lxlyric: '' }
      }
    })
    .catch(() => ({ lyric: '', tlyric: '', rlyric: '', lxlyric: '' }))
}

// 获取封面
const getPic = (source, musicInfo) => {
  const songId = musicInfo.songmid || musicInfo.songId || musicInfo.id || musicInfo.hash
  if (!songId) return Promise.resolve('')
  
  const url = API_BASE + '/api/music/info?action=pic&source=' + source + 
              '&songId=' + encodeURIComponent(songId)
  
  return httpRequest(url)
    .then(body => {
      try {
        const data = typeof body === 'string' ? JSON.parse(body) : body
        if (data.code === 200 && data.data && data.data.pic) {
          return data.data.pic
        }
        return ''
      } catch (e) {
        return ''
      }
    })
    .catch(() => '')
}

// 注册事件
on(EVENT_NAMES.request, ({ source, action, info }) => {
  switch (action) {
    case 'musicUrl':
      return getMusicUrl(source, info.musicInfo, info.type)
        .catch(err => Promise.reject(err))
    case 'lyric':
      return getLyric(source, info.musicInfo)
        .catch(err => Promise.reject(err))
    case 'pic':
      return getPic(source, info.musicInfo)
        .catch(err => Promise.reject(err))
  }
})

// 初始化
send(EVENT_NAMES.inited, {
  sources: {
    kw: {
      name: '酷我音乐',
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ["128k","320k","flac","flac24bit","hires"]
    },
    kg: {
      name: '酷狗音乐',
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ["128k","320k","flac","flac24bit","hires"]
    },
    tx: {
      name: 'QQ音乐',
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ["128k","320k","flac","flac24bit","hires"]
    },
    wy: {
      name: '网易云音乐',
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ["128k","320k","flac","flac24bit","hires"]
    },
    mg: {
      name: '咪咕音乐',
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ["128k","320k","flac","flac24bit","hires"]
    }
  }
})
