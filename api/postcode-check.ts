import { NowApiHandler, NowResponse } from '@vercel/node'
import axios from 'axios'
import AdmZip from 'adm-zip'

const GEONAMES_ATTRIBUTION =
  'Data courtesy of GeoNames (https://www.geonames.org), used under a Creative Commons Attribution 3.0 license (https://creativecommons.org/licenses/by/3.0/)'

const sendJSON = <T extends {}>(res: NowResponse, json: T) => {
  res.send({ ...json, message: GEONAMES_ATTRIBUTION })
}

const getCodes = async (): Promise<string[]> => {
  const response = await axios.get(
    'http://download.geonames.org/export/zip/AU.zip',
    {
      responseType: 'arraybuffer',
    }
  )
  const buffer = response.data as Buffer
  const zip = new AdmZip(buffer)
  const text = zip.readAsText('AU.txt')
  const codes = text.split('\n').map(line => line.split('\t')[1])
  return codes
}

const cache: {
  codes?: string[]
  codeSet?: Set<string>
  promise?: Promise<string[]>
} = {}

const handler: NowApiHandler = async (req, res) => {
  try {
    if (req.method === 'GET') {
      let codes: string[]
      if (cache.codes) {
        codes = cache.codes
      } else if (cache.promise) {
        codes = await cache.promise
      } else {
        cache.promise = getCodes()
        codes = await cache.promise
      }

      res.setHeader('Cache-Control', 'max-age=86400')
      sendJSON(res, { codes })
    }

    if (req.method === 'POST') {
      if (cache.codeSet) {
        // Do nothing
      } else if (cache.codes) {
        cache.codeSet = new Set(cache.codes)
      } else if (cache.promise) {
        cache.codes = await cache.promise
        cache.codeSet = new Set(cache.codes)
      } else {
        cache.promise = getCodes()
        cache.codes = await cache.promise
        cache.codeSet = new Set(cache.codes)
      }

      res.setHeader('Cache-Control', 'max-age=86400')
      sendJSON(res, { exists: cache.codeSet.has(req.body.code.toString()) })
    }

    res.end()
  } catch (err) {
    res.status(500)
    sendJSON(res, {
      error:
        'An error occurred. Email me (soorria.ss@gmail.com) if you want me to try fix it, or look at the source here: https://github.com/mo0th/serverless-postcode-check.',
    })
  }
}

export default handler
