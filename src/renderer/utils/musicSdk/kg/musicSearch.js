import { httpFetch } from '../../request'
import { decodeName, formatPlayTime, sizeFormate } from '../../index'
import { signatureParams } from './util'
// import { debug } from '../../utils/env'

// const searchParams = (params, keyword) => {
//   let signature = signatureParams(params.replace('{keyword}', keyword))
//   return `${params.replace('{keyword}', encodeURIComponent(keyword))}&signature=${signature}`
// }

export default {
  limit: 30,
  total: 0,
  page: 0,
  allPage: 1,
  musicSearch(str, page, limit) {
    const sign = signatureParams(`userid=0&area_code=1&appid=1005&dopicfull=1&page=${page}&token=0&privilegefilter=0&requestid=0&pagesize=${limit}&user_labels=&clienttime=0&sec_aggre=1&iscorrection=1&uuid=0&mid=0&keyword=${str}&dfid=-&clientver=11409&platform=AndroidFilter&tag=`, 3)
    const searchRequest = httpFetch(`https://gateway.kugou.com/complexsearch/v3/search/song?userid=0&area_code=1&appid=1005&dopicfull=1&page=${page}&token=0&privilegefilter=0&requestid=0&pagesize=${limit}&user_labels=&clienttime=0&sec_aggre=1&iscorrection=1&uuid=0&mid=0&dfid=-&clientver=11409&platform=AndroidFilter&tag=&keyword=${encodeURIComponent(str)}&signature=${sign}`)
    return searchRequest.promise.then(({ body }) => body)
  },
  filterSongData(rawData) {
    let ids = new Set()
    const list = []

    const filterList = (raw) => {
      if (ids.has(raw.Audioid)) return
      ids.add(raw.Audioid)
      const types = []
      const _types = {}
      if (raw.FileSize !== 0) {
        let size = sizeFormate(raw.FileSize)
        types.push({ type: '128k', size, hash: raw.FileHash })
        _types['128k'] = {
          size,
          hash: raw.FileHash,
        }
      }
      if (raw.HQ) {
        let size = sizeFormate(raw.HQ.FileSize)
        types.push({ type: '320k', size, hash: raw.HQ.Hash })
        _types['320k'] = {
          size,
          hash: raw.HQ.Hash,
        }
      }
      if (raw.SQ) {
        let size = sizeFormate(raw.SQ.FileSize)
        types.push({ type: 'flac', size, hash: raw.SQ.Hash })
        _types.flac = {
          size,
          hash: raw.SQ.Hash,
        }
      }
      if (raw.Res) {
        let size = sizeFormate(raw.Res.FileSize)
        types.push({ type: 'flac24bit', size, hash: raw.Res.Hash })
        _types.flac24bit = {
          size,
          hash: raw.Res.Hash,
        }
      }
      list.push({
        singer: decodeName(raw.SingerName),
        name: decodeName(raw.OriSongName),
        albumName: decodeName(raw.AlbumName),
        albumId: raw.AlbumID,
        songmid: raw.Audioid,
        source: 'kg',
        interval: formatPlayTime(raw.Duration),
        _interval: raw.Duration,
        img: null,
        lrc: null,
        otherSource: null,
        hash: raw.FileHash,
        types,
        _types,
        typeUrl: {},
      })
    }

    rawData.forEach(item => {
      filterList(item)
      if (item.Grp) item.Grp.forEach(e => filterList(e))
    })

    return list
  },
  search(str, page = 1, limit, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    if (limit == null) limit = this.limit
    // http://newlyric.kuwo.cn/newlyric.lrc?62355680
    return this.musicSearch(str, page, limit).then(result => {
      if (!result || result.error_code !== 0) return this.search(str, page, limit, retryNum)
      // console.log(result)
      let list = this.filterSongData(result.data.lists)

      if (list == null) return this.search(str, page, limit, retryNum)

      this.total = result.data.total
      this.page = page
      this.allPage = Math.ceil(this.total / limit)

      return Promise.resolve({
        list,
        allPage: this.allPage,
        limit,
        total: this.total,
        source: 'kg',
      })
    })
  },
}
