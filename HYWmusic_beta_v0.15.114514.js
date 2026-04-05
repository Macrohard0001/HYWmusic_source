/**
 * @name HYWmusic_beta
 * @description 群号1094095648
 * @version 0.15.114514
 * @author Ryn
 * @homepage https://github.com/Macrohard0001/HYWmusic_source
 * @license MIT
 * 
 * 支持平台: 酷我音乐、酷狗音乐、QQ音乐、网易云音乐、咪咕音乐
 * 支持音质: 128k, 320k, flac, flac24bit, hires
 * 按平台配置: 是
 * 生成时间: 2026-04-05T10:56:54.016Z
 */

'use strict'

const { EVENT_NAMES, request, on, send } = globalThis.lx

const API_BASE = 'https://music.bxa241d4.shop'
const SUPPORTED_SOURCES = ["kw","kg","tx","wy","mg"]
const ALLOWED_QUALITIES = ["128k","320k","flac","flac24bit","hires"]
const PLATFORM_QUALITIES = {
  "kw": [
    "128k",
    "320k",
    "flac",
    "flac24bit",
    "hires"
  ],
  "kg": [
    "128k",
    "320k",
    "flac",
    "flac24bit",
    "hires"
  ],
  "tx": [
    "128k",
    "320k",
    "flac",
    "flac24bit",
    "hires"
  ],
  "wy": [
    "128k",
    "320k",
    "flac",
    "flac24bit",
    "hires"
  ],
  "mg": [
    "128k",
    "320k",
    "flac"
  ]
}
const SCRIPT_VERSION = 'HYWmusic_beta_v0.15.114514'
const SCRIPT_ID = 'cmnkd5d5x0002s98hxpthzw8r'
const CARD_KEY = 'TF-584W-L51Z-BDNM-OILB'

// ========== 卡密认证系统 ==========
// 脚本已内置卡密，请求时自动通过 X-Card-Key 头认证
// 卡密权限: 已激活

// 通用错误消息（避免泄露敏感信息）
const ERROR_MSG = {
  NETWORK: '网络请求失败',
  PARSE: '数据解析失败',
  NOT_FOUND: '资源不存在',
  NO_PERMISSION: '无访问权限',
  UNSUPPORTED: '不支持的操作',
}

// HTTP 请求封装（统一错误处理）
const httpRequest = (url) => new Promise((resolve, reject) => {
  const headers = {
    'X-Script-Version': SCRIPT_VERSION,
    'X-Script-ID': SCRIPT_ID,
  }
  if (CARD_KEY) {
    headers['X-Card-Key'] = CARD_KEY
  }
  
  request(url, { headers }, (err, resp) => {
    if (err) return reject(new Error(ERROR_MSG.NETWORK))
    resolve(resp.body)
  })
})

// 安全解析响应（隐藏敏感信息）
const safeParse = (body, defaultVal) => {
  try {
    const data = typeof body === 'string' ? JSON.parse(body) : body
    return { success: true, data }
  } catch (e) {
    return { success: false, error: ERROR_MSG.PARSE, defaultVal }
  }
}

// 统一 API 请求处理
const apiRequest = async (endpoint, params = {}) => {
  const query = Object.entries(params)
    .map(([k, v]) => k + '=' + encodeURIComponent(v))
    .join('&')
  const url = API_BASE + endpoint + (query ? '?' + query : '')
  
  const body = await httpRequest(url)
  const result = safeParse(body)
  
  if (!result.success) {
    throw new Error(result.error)
  }
  
  const { data } = result
  // 统一错误码处理（不暴露原始消息）
  if (data.code === 401 || data.code === 403) {
    throw new Error(ERROR_MSG.NO_PERMISSION)
  }
  if (data.code === 404) {
    throw new Error(ERROR_MSG.NOT_FOUND)
  }
  if (data.code !== 200) {
    throw new Error(ERROR_MSG.NETWORK)
  }
  
  return data
}

// 获取歌曲ID（兼容多种格式）
const getSongId = (musicInfo) => 
  musicInfo.songmid || musicInfo.songId || musicInfo.id || musicInfo.hash

// 获取平台支持的音质
const getPlatformQuality = (source, quality) => {
  const platformAllowed = PLATFORM_QUALITIES[source] || ALLOWED_QUALITIES
  return platformAllowed.includes(quality) ? quality : (platformAllowed[0] || '128k')
}

// ========== 核心功能 ==========

// 获取音乐URL
const getMusicUrl = async (source, musicInfo, quality) => {
  if (!SUPPORTED_SOURCES.includes(source)) {
    return Promise.reject(new Error(ERROR_MSG.UNSUPPORTED))
  }
  
  const songId = getSongId(musicInfo)
  if (!songId) {
    return Promise.reject(new Error(ERROR_MSG.NOT_FOUND))
  }
  
  // 使用平台特定音质验证
  const finalQuality = getPlatformQuality(source, quality)
  
  const data = await apiRequest('/api/music/url', {
    source,
    songId,
    quality: finalQuality
  })
  
  if (data.url) {
    return data.url
  }
  throw new Error(ERROR_MSG.NOT_FOUND)
}

// 获取歌词
const getLyric = async (source, musicInfo) => {
  const songId = getSongId(musicInfo)
  if (!songId) return { lyric: '', tlyric: '', rlyric: '', lxlyric: '' }
  
  try {
    const data = await apiRequest('/api/music/info', {
      action: 'lyric',
      source,
      songId
    })
    
    if (data.data) {
      return {
        lyric: data.data.lyric || '',
        tlyric: data.data.tlyric || '',
        rlyric: data.data.rlyric || '',
        lxlyric: data.data.lxlyric || ''
      }
    }
  } catch (e) {
    // 歌词获取失败不影响播放
  }
  return { lyric: '', tlyric: '', rlyric: '', lxlyric: '' }
}

// 获取封面
const getPic = async (source, musicInfo) => {
  const songId = getSongId(musicInfo)
  if (!songId) return ''
  
  try {
    const data = await apiRequest('/api/music/info', {
      action: 'pic',
      source,
      songId
    })
    
    return data.data?.pic || ''
  } catch (e) {
    return ''
  }
}

// ========== 事件注册 ==========

on(EVENT_NAMES.request, ({ source, action, info }) => {
  switch (action) {
    case 'musicUrl':
      return getMusicUrl(source, info.musicInfo, info.type)
    case 'lyric':
      return getLyric(source, info.musicInfo)
    case 'pic':
      return getPic(source, info.musicInfo)
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
      qualitys: ["128k","320k","flac"]
    }
  }
})
