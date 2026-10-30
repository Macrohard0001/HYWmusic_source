/**
 * @name HYWmusic_公益版
 * @version v1.2.0
 * @author Ryn
 * @description qq群：1094095648；965503129
 * @homepage https://github.com/Macrohard0001/HYWmusic_source
 *
 * 支持平台: 酷我音乐、QQ音乐、网易云音乐、咪咕音乐、汽水音乐、哔哩哔哩、YouTube、喜马拉雅、酷狗音乐
 * 支持音质: 128k,320k,flac,flac24bit,hires,720P,480P,360P,32k,24k,64k
 * 生成时间: 2026-10-08T11:39:01.047Z
 *
 * 兼容性: 兼容 MusicFree 安卓/iOS/桌面端 —— 移动端沙箱（Hermes）无 URLSearchParams，
 * 本插件手动拼接 query 参数，网络层 fetch 优先、axios 兜底，全部做特性探测。
 */

var API_BASE = 'https://103.79.184.97' // 必须由服务端注入 apiUrl，空值会让所有请求失败
var CARD_KEY = '6C1F-53W0-GRKI-EVFG'
var PLUGIN_SRC_URL = API_BASE + '/api/music/card-key/download?key=' + CARD_KEY + '&format=mf'

// 插件平台标识（发行版名称 FNV-1a 稳定哈希，同名跨版本稳定）
var PLATFORM_ID = 'hyw_mf_2019831267'

// ====== 每平台可用音质（生成时注入；声明外音质服务端会拒绝）======
var PLATFORM_QUALITIES = JSON.parse('{"kw":["128k","320k","flac","flac24bit","hires"],"tx":["128k","320k","flac","flac24bit","hires"],"wy":["128k","320k","flac","flac24bit","hires"],"mg":["128k","320k"],"qs":["128k","320k"],"bili":["128k","320k"],"ytb":["128k"],"xm":["32k","24k","64k"],"kg":["128k","320k","flac","flac24bit","hires"]}')

// ====== MusicFree 音质 -> HYWmusic API 音质 ======
// v1.5.21: super 升级指向 flac24bit（服务端对 flac24bit<->hires 双向映射）
var MF_TO_API = { low: '128k', standard: '320k', high: 'flac', super: 'flac24bit' }
var API_QUALITY_RANK = { '128k': 1, '320k': 2, 'flac': 3, 'flac24bit': 4, 'hires': 4 }

function clampQuality(platform, quality) {
  var want = MF_TO_API[quality] || '320k'
  try {
    var avail = (PLATFORM_QUALITIES[platform] || []).slice()
    if (!avail.length) return want
    if (avail.indexOf(want) >= 0) return want
    avail.sort(function (a, b) { return (API_QUALITY_RANK[a] || 2) - (API_QUALITY_RANK[b] || 2) })
    var best = null
    for (var i = 0; i < avail.length; i++) {
      if ((API_QUALITY_RANK[avail[i]] || 2) <= (API_QUALITY_RANK[want] || 2)) best = avail[i]
    }
    return best || avail[0]
  } catch (e) { return want }
}

// ====== Hermes 兼容工具：手动拼参 + fetch/axios 双通道 ======
// MusicFree 移动端沙箱（RN + Hermes）没有 URLSearchParams —— 严禁使用。
function buildQuery(params) {
  var parts = []
  for (var k in params) {
    if (!Object.prototype.hasOwnProperty.call(params, k)) continue
    var v = params[k]
    if (v === undefined || v === null || v === '') continue
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
  }
  return parts.length ? parts.join('&') : ''
}

// GET JSON：fetch 优先（RN/Electron 内置），异常回退沙箱注入的 require('axios')
function httpGetJSON(url, timeoutMs) {
  var t = timeoutMs || 15000
  return new Promise(function (resolve) {
    var settled = false
    var done = function (v) { if (!settled) { settled = true; resolve(v) } }
    var tryAxios = function () {
      try {
        if (typeof require === 'function') {
          var axios = require('axios')
          if (axios && typeof axios.get === 'function') {
            axios.get(url, { timeout: t }).then(function (r) {
              done(r && r.data !== undefined ? r.data : null)
            }).catch(function () { done(null) })
            return
          }
        }
      } catch (e2) {}
      done(null)
    }
    try {
      if (typeof fetch === 'function') {
        var ctl = typeof AbortController === 'function' ? new AbortController() : null
        var timer = ctl ? setTimeout(function () { try { ctl.abort() } catch (e) {} }, t) : null
        fetch(url, { method: 'GET', signal: ctl ? ctl.signal : undefined })
          .then(function (resp) {
            if (timer) clearTimeout(timer)
            return resp.json()
          })
          .then(function (data) { done(data) })
          .catch(function (e1) {
            if (timer) clearTimeout(timer)
            tryAxios()
          })
        return
      }
    } catch (e0) {}
    tryAxios()
  })
}

/**
 * 搜索（MusicFree: search(keyword, page, type)）
 */
async function search(query, page, type) {
  if (type !== 'music') return { isEnd: true, data: [] }

  try {
    // v1.5.21 修复沿用：搜索接口参数名为 keyword；响应 data 为歌曲数组
    var qs = buildQuery({ keyword: query, limit: 30, key: CARD_KEY })
    if (!qs) return { isEnd: true, data: [] }
    var data = await httpGetJSON(API_BASE + '/api/music/search?' + qs)

    if (data && data.code === 200 && Array.isArray(data.data)) {
      return {
        isEnd: true,
        data: data.data.map(function (song) {
          return {
            platform: PLATFORM_ID,
            id: song.id || song.songId || song.songmid || '',
            artist: song.artist || song.singer || '',
            title: song.name || song.songName || '',
            duration: song.duration || 0,
            album: song.album || '',
            artwork: song.picUrl || song.pic || song.artwork || '',
            source: song.platform || 'kw'
          }
        })
      }
    }
  } catch (e) {
    console.error('[HYWmusic] 搜索失败: ' + (e && e.message))
  }
  return { isEnd: true, data: [] }
}

/**
 * 获取播放 URL（MusicFree: getMediaSource(musicItem, quality)）
 */
async function getMediaSource(musicItem, quality) {
  try {
    // 从 musicItem 中提取平台信息，默认使用 kw
    var platform = musicItem.source || 'kw'
    // v1.7.2: 音质本地钳制（声明外音质直接收敛到该平台最近可用档，避免服务端 403）
    // 附带 duration/name/singer：服务端按名解析与真实音质核验依赖这些参数
    var qs = buildQuery({
      source: platform,
      songId: musicItem.id,
      quality: clampQuality(platform, quality),
      name: musicItem.title,
      singer: musicItem.artist,
      duration: musicItem.duration,
      key: CARD_KEY
    })

    var data = await httpGetJSON(API_BASE + '/api/music/url?' + qs)

    if (data && data.code === 200 && data.url) {
      return { url: data.url }
    }
  } catch (e) {
    console.error('[HYWmusic] 获取播放URL失败: ' + (e && e.message))
  }
  return null
}

/**
 * 获取歌词（MusicFree: getLyric(musicItem)）
 */
async function getLyric(musicItem) {
  try {
    var platform = musicItem.source || 'kw'
    var qs = buildQuery({ action: 'lyric', source: platform, songId: musicItem.id, key: CARD_KEY })

    var data = await httpGetJSON(API_BASE + '/api/music/info?' + qs)

    if (data && data.code === 200 && data.data) {
      return { lrc: data.data.lyric || '', rawLrc: data.data.lyric || '' }
    }
  } catch (e) {
    console.error('[HYWmusic] 获取歌词失败: ' + (e && e.message))
  }
  return null
}

/**
 * 获取歌曲详情/封面（MusicFree: getMusicInfo(musicBase)）
 */
async function getMusicInfo(musicBase) {
  try {
    var platform = musicBase.source || 'kw'
    var qs = buildQuery({ action: 'pic', source: platform, songId: musicBase.id, key: CARD_KEY })

    var data = await httpGetJSON(API_BASE + '/api/music/info?' + qs)

    if (data && data.code === 200 && data.data) {
      return {
        platform: musicBase.platform,
        id: musicBase.id,
        artwork: data.data.pic || ''
      }
    }
  } catch (e) {
    console.error('[HYWmusic] 获取歌曲详情失败: ' + (e && e.message))
  }
  return null
}

module.exports = {
  platform: PLATFORM_ID,
  version: 'v1.2.0',
  srcUrl: PLUGIN_SRC_URL,
  supportedSearchType: ['music'],
  search: search,
  getMediaSource: getMediaSource,
  getLyric: getLyric,
  getMusicInfo: getMusicInfo
}
