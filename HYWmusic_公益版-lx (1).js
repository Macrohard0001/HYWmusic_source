/**
 * @name HYWmusic_公益版
 * @version v1.2.0
 * @author Ryn
 * @description qq群：1094095648；965503129
 * @homepage https://github.com/Macrohard0001/HYWmusic_source
 * @license MIT
 * @updateUrl https://103.79.184.97/api/releases?script=HYWmusic_%E5%85%AC%E7%9B%8A%E7%89%88&scriptType=free&releaseType=lx&version=v1.2.0
 *
 * 支持平台: kw、tx、wy、mg、qs、bili、ytb、xm、kg
 * 支持音质: 128k、320k、flac、flac24bit
 * 生成时间: 2026-10-08T11:39:01.047Z
 *
 * 协议参考：ikun-music-source.js + lxmusic.toside.cn/desktop/custom-source
 *   - MUSIC_QUALITY 每平台独立音质（收敛到规范标准集，高音质可直接请求由服务端解析）
 *   - actions 固定 ['musicUrl']（官方桌面/移动规范：非 local 源仅支持 musicUrl）
 *   - on handler 纯 Promise 风格：({action, source, info}) => Promise
 *   - inited 发送 status:true + sources
 *   - API_BASE 必须注入，禁止回退 localhost
 */

'use strict'

const DEV_ENABLE = false
const UPDATE_ENABLE = true

const { EVENT_NAMES, request, on, send, env, version: LX_VERSION } = globalThis.lx

// ====== 每平台独立音质（参考 ikun） ======
const MUSIC_QUALITY = JSON.parse('{"kw":["128k","320k","flac","flac24bit"],"tx":["128k","320k","flac","flac24bit"],"wy":["128k","320k","flac","flac24bit"],"mg":["128k","320k"],"qs":["128k","320k"],"bili":["128k","320k"],"ytb":["128k"],"xm":["128k","320k"],"kg":["128k","320k","flac","flac24bit"]}')
const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY)

// ====== 运行参数 ======
const API_BASE = 'https://103.79.184.97'
const CARD_KEY = '6C1F-53W0-GRKI-EVFG'

// ====== 日志 ======
const log = {
  info: (...args) => { try { console.log('[HYWmusic]', ...args) } catch(e) {} },
  error: (...args) => { try { console.error('[HYWmusic ERROR]', ...args) } catch(e) {} },
  warn: (...args) => { try { console.warn('[HYWmusic WARN]', ...args) } catch(e) {} },
}

// ====== API_BASE 检查：禁止回退 localhost ======
if (!API_BASE || !/^https?:\/\//.test(API_BASE)) {
  log.error('API_BASE 未配置或格式非法: "' + API_BASE + '"，所有请求都将失败')
  log.error('请联系发行版管理员在创建发行版时设置 metadata.apiUrl')
}

// ====== HTTP 请求（严格对齐 ikun：仅 callback 风格 request） ======
const httpFetch = (url, options = { method: 'GET' }) => {
  return new Promise((resolve, reject) => {
    if (!API_BASE || !/^https?:\/\//.test(API_BASE)) {
      return reject(new Error('API_BASE 未配置或格式非法'))
    }
    const headers = {
      ...(options.headers || {}),
      'User-Agent': env ? `lx-music-${env}/${LX_VERSION}` : `lx-music-request/${LX_VERSION || '1.0.0'}`,
    }
    // Node http 拒绝非 Latin1 header 值：中文卡密会 ERR_INVALID_CHAR（请求未发出即失败，
    // LX 客户端表现 Invalid character in header content ["x-card-key"]）。
    // 服务端优先读 query key（本脚本已在 query 携带 key=卡密），header 仅在 ASCII 安全时附带。
    if (CARD_KEY && /^[\x20-\x7E]*$/.test(CARD_KEY)) headers['X-Card-Key'] = CARD_KEY
    const reqOptions = { ...options, headers }
    if (!reqOptions.method) reqOptions.method = 'GET'
    // 兼容 LX 沙箱 request 的两种 callback 签名：
    //   2 参数: (err, resp)       — resp.body 包含响应体
    //   3 参数: (err, resp, body) — body 是独立解析的响应体（needle 风格）
    // 部分版本 resp.body 为 undefined，body 在第三个参数；两者都取以兜底
    request(url, reqOptions, (err, resp, body) => {
      if (err) return reject(err)
      const respBody = (resp && resp.body !== undefined && resp.body !== null)
        ? resp.body
        : body
      resolve({
        statusCode: resp ? resp.statusCode : undefined,
        headers: resp ? resp.headers : undefined,
        body: respBody,
      })
    })
  })
}

// ====== 超时保护（保留但默认不使用，脚本内部调用） ======
// const withTimeout = (promise, ms) => Promise.race([
//   promise,
//   new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时(' + ms + 'ms)')), ms))
// ])

// ====== v1.7.38 内置直连接口（脚本内直连取链，成功后向服务端回报统计） ======
// 与服务端内置接口同构：{name, platform, url(含{id}/{quality}占位), mode, field, weight, enabled}
// 权重加权随机排序；全部直连失败自动回退服务端聚合链路（原流程语义不变）
const EMBED_APIS = JSON.parse('[]')
const SCRIPT_TAG = 'HYWmusic_公益版@v1.2.0'

const pickEmbedApis = (source) => {
  if (!Array.isArray(EMBED_APIS) || EMBED_APIS.length === 0) return []
  const pool = EMBED_APIS.filter((a) => a && a.enabled !== false && a.platform === source
    && typeof a.url === 'string' && a.url.indexOf('http') === 0)
  const wOf = (a) => { const n = Math.round(Number(a.weight)); return Number.isFinite(n) ? Math.min(999, Math.max(0, n)) : 100 }
  const pos = pool.filter((a) => wOf(a) > 0).map((a) => ({ a, w: wOf(a) }))
  const zero = pool.filter((a) => wOf(a) <= 0)
  const out = []
  while (pos.length > 0) {
    const total = pos.reduce((s, x) => s + x.w, 0)
    let r = Math.random() * total
    let idx = pos.length - 1
    for (let i = 0; i < pos.length; i++) { r -= pos[i].w; if (r <= 0) { idx = i; break } }
    out.push(pos[idx].a)
    pos.splice(idx, 1)
  }
  return out.concat(zero)
}

const getEmbedField = (obj, path) => {
  try {
    return String(path || 'data.url').split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
  } catch (e) { return null }
}

const tryEmbedApi = async (api, songId, quality) => {
  // v1.7.38: 音质 token 映射（{q} 占位 + qualityMap；无映射时退回原音质值）
  const qToken = (api.qualityMap && api.qualityMap[String(quality || '').toLowerCase()]) || String(quality || '')
  const url = api.url
    .replace('{id}', encodeURIComponent(String(songId || '')))
    .replace('{quality}', encodeURIComponent(String(quality || '')))
    .replace(/{q}/g, encodeURIComponent(qToken))
  if (!/^https?:\/\//.test(url)) throw new Error('直连接口URL非法')
  const resp = await httpFetch(url, { method: 'GET' })
  if (api.mode === 'direct') {
    // 响应即音频流/302：取最终跳转 URL（客户端未跟随 302 时回退请求 URL 本身）
    const st = resp ? Number(resp.statusCode) : 0
    if (st === 403 || st === 404 || st === 410 || st === 451) throw new Error('直连接口拒绝(' + st + ')')
    const finalUrl = (resp && resp.url)
      || (resp && resp.headers && (resp.headers.location || resp.headers.Location))
      || url
    if (!/^https?:\/\//.test(String(finalUrl))) throw new Error('直连接口未取得直链')
    return String(finalUrl)
  }
  let body = resp && resp.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch (e) { throw new Error('直连接口返回非 JSON') }
  }
  const out = getEmbedField(body, api.field)
  if (!out || !/^https?:\/\//.test(String(out))) throw new Error('直连接口无直链')
  return String(out)
}

const reportEmbedStats = (source, apiName, quality, songId, ok, errMsg) => {
  // v1.7.42 直连请求明细回报（用户指令：id,platform,quality,是否success 等）——
  // 成功与失败均回报；异步信标不等待不阻塞，任何异常静默（统计通道不影响播放）
  try {
    const q = 'v=' + encodeURIComponent(SCRIPT_TAG)
      + '&platform=' + encodeURIComponent(source)
      + '&s=' + encodeURIComponent(String(apiName || '').slice(0, 60))
      + '&q=' + encodeURIComponent(String(quality || '').slice(0, 20))
      + '&id=' + encodeURIComponent(String(songId || '').slice(0, 80))
      + '&ok=' + (ok === false ? '0' : '1')
      + (errMsg ? '&err=' + encodeURIComponent(String(errMsg).slice(0, 120)) : '')
    request(API_BASE + '/api/music/script-stats?' + q, { method: 'GET', timeout: 4000 }, () => {})
  } catch (e) {}
}

const tryEmbedApis = async (source, songId, quality) => {
  const apis = pickEmbedApis(source)
  for (const api of apis) {
    try {
      const out = await tryEmbedApi(api, songId, quality)
      log.info('内置直连命中[' + (api.name || api.platform) + '] ' + source + ' ' + quality)
      reportEmbedStats(source, api.name || api.platform, quality, songId, true)
      return out
    } catch (e) {
      // v1.7.42 失败同样回报明细（ok=0 + 错误摘要），服务端标记「直连请求」计入日志
      reportEmbedStats(source, api.name || api.platform, quality, songId, false, (e && e.message) || String(e || ''))
    }
  }
  return null
}

// ====== musicInfo 字段收集：透传完整字段 ======
const collectMusicInfoParams = (musicInfo, platform) => {
  if (!musicInfo) return {}
  const params = {}
  const songId = musicInfo.songmid || musicInfo.songId || musicInfo.id || musicInfo.hash
    || musicInfo.rid || musicInfo.musicId || musicInfo.copyrightId || musicInfo.songid || ''
  if (songId) params.songId = songId
  if (musicInfo.songmid) params.songmid = musicInfo.songmid
  if (musicInfo.hash) params.hash = musicInfo.hash

  const fields = ['albumAudioId', 'strMediaMid', 'mediaMid', 'copyrightId', 'rid', 'musicId',
    'albumId', 'albumName', 'albumMid', 'songname', 'songName', 'name', 'singer', 'singers', 'artist',
    'interval', 'duration'] // v1.7.2: 时长透传 —— 服务端真实音质核验（码率估算）依赖 interval/duration
  for (const f of fields) {
    if (musicInfo[f] !== undefined && musicInfo[f] !== null && musicInfo[f] !== '') params[f] = musicInfo[f]
    if (musicInfo.meta && musicInfo.meta[f] !== undefined && musicInfo.meta[f] !== null && musicInfo.meta[f] !== '') params[f] = musicInfo.meta[f]
  }
  params.platform = platform
  params.source = platform  // 兼容 /api/music/info（仅读 source，不读 platform）
  return params
}

// ====== 获取音乐 URL（GET + query 参数，服务端仅支持 GET） ======
const handleGetMusicUrl = async (source, musicInfo, quality) => {
  // v1.7.38: 内置直连接口优先 —— 用户设备直连取链（区域锁类接口仅用户侧可达、
  // 同时减轻服务端转发/等待压力），全部失败再走服务端聚合链路
  const embedSongId = musicInfo
    ? (musicInfo.songmid || musicInfo.songId || musicInfo.id || musicInfo.hash
      || musicInfo.rid || musicInfo.copyrightId || musicInfo.songid || '')
    : ''
  if (embedSongId && EMBED_APIS.length > 0) {
    const embedUrl = await tryEmbedApis(source, embedSongId, quality)
    if (embedUrl) return embedUrl
  }
  const params = collectMusicInfoParams(musicInfo, source)
  if (quality) params.quality = quality
  if (CARD_KEY) params.key = CARD_KEY

  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => k + '=' + encodeURIComponent(String(v)))
    .join('&')
  const url = API_BASE + '/api/music/url' + (query ? '?' + query : '')

  const resp = await httpFetch(url, { method: 'GET' })
  let respBody = resp && resp.body
  if (typeof respBody === 'string') {
    try { respBody = JSON.parse(respBody) } catch (e) {
      throw new Error('服务端返回非 JSON 数据')
    }
  }
  if (!respBody || typeof respBody !== 'object') {
    throw new Error('空响应')
  }
  switch (respBody.code) {
    case 200:
      return respBody.url || respBody.data || respBody
    case 401:
    case 403:
      throw new Error(respBody.message || '鉴权失败')
    case 429:
      throw new Error('请求过速')
    case 500:
      throw new Error(respBody.message || '服务器错误')
    default:
      throw new Error(respBody.message || ('未知错误 code=' + respBody.code))
  }
}

// ====== 获取歌词 ======
const handleGetLyric = async (source, musicInfo) => {
  const params = collectMusicInfoParams(musicInfo, source)
  params.action = 'lyric'
  if (CARD_KEY) params.key = CARD_KEY
  try {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => k + '=' + encodeURIComponent(String(v)))
      .join('&')
    const url = API_BASE + '/api/music/info' + (query ? '?' + query : '')
    const resp = await httpFetch(url, { method: 'GET' })
    let respBody = resp && resp.body
    if (typeof respBody === 'string') {
      try { respBody = JSON.parse(respBody) } catch (e) { respBody = null }
    }
    if (!respBody || respBody.code !== 200) return { lyric: '', tlyric: null, rlyric: null, lxlyric: null }
    const data = respBody.data || respBody
    return {
      lyric: data.lyric || '',
      tlyric: data.tlyric || null,
      rlyric: data.rlyric || null,
      lxlyric: data.lxlyric || null,
    }
  } catch (e) {
    return { lyric: '', tlyric: null, rlyric: null, lxlyric: null }
  }
}

// ====== 获取封面 ======
const handleGetPic = async (source, musicInfo) => {
  const params = collectMusicInfoParams(musicInfo, source)
  params.action = 'pic'
  if (CARD_KEY) params.key = CARD_KEY
  try {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => k + '=' + encodeURIComponent(String(v)))
      .join('&')
    const url = API_BASE + '/api/music/info' + (query ? '?' + query : '')
    const resp = await httpFetch(url, { method: 'GET' })
    let respBody = resp && resp.body
    if (typeof respBody === 'string') {
      try { respBody = JSON.parse(respBody) } catch (e) { return '' }
    }
    if (!respBody || respBody.code !== 200) return ''
    const data = respBody.data || respBody
    return data.pic || data.url || ''
  } catch (e) { return '' }
}

// ====== on request（严格对齐 ikun：纯 Promise 风格，无 withTimeout） ======
on(EVENT_NAMES.request, ({ action, source, info }) => {
  switch (action) {
    case 'musicUrl':
      return handleGetMusicUrl(source, info.musicInfo, info.type)
    case 'lyric':
      return handleGetLyric(source, info.musicInfo)
    case 'pic':
      return handleGetPic(source, info.musicInfo)
    default:
      return Promise.reject('action not support: ' + action)
  }
})

// ====== 构建 sources（每平台独立 qualitys，参考 ikun） ======
// v1.5.16：actions 固定 ['musicUrl'] —— 官方桌面/移动规范均规定非 local 源仅支持
// musicUrl；声明 lyric/pic 会被官方客户端过滤，且可能导致严格第三方客户端初始化失败。
const musicSources = {}
MUSIC_SOURCE.forEach((item) => {
  musicSources[item] = {
    name: item,
    type: 'music',
    actions: ['musicUrl'],
    qualitys: MUSIC_QUALITY[item],
  }
})

// ====== 发送 inited（参考 ikun：status: true + openDevTools） ======
send(EVENT_NAMES.inited, {
  status: true,
  openDevTools: DEV_ENABLE,
  sources: musicSources,
})

// ====== 更新检查（v1.3.5+：inited 后异步调用，发现新版本发 updateAlert） ======
const SCRIPT_VERSION = 'v1.2.0'
const UPDATE_URL = 'https://103.79.184.97/api/releases?script=HYWmusic_%E5%85%AC%E7%9B%8A%E7%89%88&scriptType=free&releaseType=lx&version=' + SCRIPT_VERSION

const parseVer = (s) => {
  const m = String(s || '').match(/\d+(?:\.\d+)+/)
  if (!m) return null
  return m[0].split('.').map((n) => parseInt(n, 10))
}

const cmpVer = (a, b) => {
  const va = parseVer(a)
  const vb = parseVer(b)
  if (!va || !vb) return 0
  const len = Math.max(va.length, vb.length)
  for (let i = 0; i < len; i++) {
    const x = va[i] || 0
    const y = vb[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

const checkUpdate = async () => {
  try {
    if (!UPDATE_ENABLE) return
    log.info('检查更新: ' + UPDATE_URL)
    // v1.4.14 修复：httpFetch resolve 的是 { statusCode, headers, body } 包装对象，
    // 旧模板误将包装对象整体 JSON.parse（等价于 parse "[object Object]"），
    // 必然抛 SyntaxError 静默 return —— 导致所有脚本更新检查永远失效、
    // 用户端永远收不到新版本提示（旧脚本用户长期滞留旧版）。
    const resp = await httpFetch(UPDATE_URL, { method: 'GET' })
    if (!resp || resp.statusCode !== 200) return
    let respBody = resp.body
    if (typeof respBody === 'string') {
      try { respBody = JSON.parse(respBody) } catch (e) { return }
    }
    if (!respBody || typeof respBody !== 'object') return
    if (respBody.code !== 200 || !respBody.data || !respBody.data.version) return
    const latestVersion = respBody.data.version
    if (cmpVer(latestVersion, SCRIPT_VERSION) > 0) {
      // 服务端返回相对路径，需补全为绝对 URL
      const absUrl = respBody.data.url && String(respBody.data.url).indexOf('http') === 0
        ? respBody.data.url
        : API_BASE + (respBody.data.url || '')
      log.info('发现新版本 ' + latestVersion + ' -> ' + absUrl)
      send(EVENT_NAMES.updateAlert, {
        log: respBody.data.updateLog || ('发现新版本 ' + latestVersion),
        updateUrl: absUrl,
      })
    } else {
      log.info('当前已是最新版本: ' + SCRIPT_VERSION)
    }
  } catch (e) {
    log.warn('更新检查失败: ' + (e && e.message))
  }
}

// 异步调用（不阻塞 inited；失败静默，不影响正常音源功能）
checkUpdate()
