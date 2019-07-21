/**
 * Media Related Events go here.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

const _ = require('lodash')
const Trello = require('trello')
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})
const uuid = require('uuid/v4')
const url = require('url')

const Storage = require('triton-core/db')
const dyn = require('triton-core/dynamics')
const AMQP = require('triton-core/amqp')
const proto = require('triton-core/proto')
const tracer = require('triton-core/tracer')

/* eslint no-unused-vars: [0] */
const Event = require('events')
const { opentracing, Tags, serialize, unserialize, error } = require('triton-core/tracer')

const metadataTransformers = {
  IMDB: data => {
    if (data[0] === 't') { // ids look like tt21313
      return data
    } else {
      const imdbUrl = new url.URL(data)
      const pathSplit = imdbUrl.pathname.split('/', 3)
      return pathSplit[2]
    }
  },
  MAL: data => {
    let metadataId
    let id = parseInt(data, 10)
    if (isNaN(id)) {
      // attempt to parse it as a URL
      const malUrl = new url.URL(data)
      const pathSplit = malUrl.pathname.split('/', 3)
      id = parseInt(pathSplit[2], 10)
    }

    metadataId = id.toString(10)
  },
  KITSU: data => {
    let metadataId
    let id = parseInt(data, 10)
    if (isNaN(id)) {
      // attempt to parse it as a URL
      const malUrl = new url.URL(data)
      const pathSplit = malUrl.pathname.split('/', 3)
      id = parseInt(pathSplit[2], 10)
    }

    metadataId = id.toString(10)
  }
}

/**
 * Parse Trello events / whatever into stack events.
 *
 * @param  {Event.EventEmitter} emitter event emitter
 * @param  {Object} config              config
 * @param  {opentracing.Tracer} tracer  tracer object
 * @return {undefined}                  stop
 */
module.exports = async (emitter, config, tracer) => {
  const trello = new Trello(config.keys.trello.key, config.keys.trello.token)

  const amqp = new AMQP(dyn('rabbitmq'))
  await amqp.connect()

  const db = new Storage()
  await db.connect()

  const mediaProto = await proto.load('api.Media')

  // Process new media.
  emitter.on('updateCard', async (event, rootContext) => {
    const span = tracer.startSpan('updateCard', {
      childOf: unserialize(rootContext)
    })

    if (!event.data.listAfter) {
      return error(span, new Error('Card wasn\'t moved'))
    }

    const listNow = event.data.listAfter.id
    const listBefore = event.data.listBefore.id
    const cardId = event.data.card.id

    span.setTag(Tags.CARD_ID, cardId)
    span.setTag(Tags.LIST_ID, listNow)

    const child = logger.child({
      listNow,
      listBefore,
      cardId
    })

    const metadataLabel = config.instance.labels.metadata

    const requestsBoard = config.instance.flow_ids.requests
    const readyBoard = config.instance.flow_ids.ready

    if (listBefore !== requestsBoard) return child.debug('skipping card that didnt come from requests list')
    if (listNow !== readyBoard) return child.debug('skipping card that didnt go to ready')

    child.info('creating newMedia event from card')
    const card = await trello.makeRequest('get', `/1/cards/${cardId}`)
    const attachments = await trello.makeRequest('get', `/1/cards/${cardId}/attachments`)

    const download = card.desc
    const source = _.find(attachments, {
      name: 'SOURCE'
    })

    const metadataTypes = proto.enumValues(mediaProto, 'MetadataType')
    logger.info('possible metadata types:', metadataTypes.join(','))

    let metadata, metadataId

    logger.info(attachments)

    // TODO(jaredallard): move away from attachments and use custom fields or something else
    for (const metadataProvider of metadataTypes) {
      const attachment = _.find(attachments, {
        name: metadataProvider
      })

      if (!attachment) continue

      logger.info('found metadata provider', metadataProvider)

      metadata = proto.stringToEnum(mediaProto, 'MetadataType', metadataProvider)
      metadataId = attachment.url

      // transform it if we have an available transformer
      if (metadataTransformers[metadataProvider]) {
        logger.info('executing metadata transformer on value', attachment.url)
        metadataId = metadataTransformers[metadataProvider](attachment.url)
      }

      logger.info('metadata', metadataProvider, 'ID:', metadataId)

      // we only support one metadata provider
      break
    }

    console.log(metadataId)

    if (!metadataId) {
      return child.error('No metadata found.')
    }

    // no download, no source
    if (!download || !source) {
      child.warn(download, source)
      return child.error('card was invalid')
    }

    let cardType = 1 // MOVIE
    if (!_.find(card.labels, { name: 'Movie' })) {
      cardType = 2 // TV
    }

    child.info('creating job')

    try {
      const download = /\[(\w+)\]\((.+)\)/g.exec(card.desc)
      if (download === null || download.length < 2) {
        throw new Error('Failed to parse body.')
      }

      const sourceUrl = download[2]
      let sourceProtocol = download[1]

      // normalize https
      if (sourceProtocol === 'https') sourceProtocol = 'http'

      // SourceType is the source enum, we uppercase the value to match what we expect
      const source = proto.stringToEnum(mediaProto, 'SourceType', sourceProtocol.toUpperCase())

      logger.info(`source value '${sourceProtocol}' = '${source}'`)

      let encoded
      try {
        encoded = await db.new(card.name, 1, cardId, cardType, source, sourceUrl, metadata, metadataId)
      } catch (err) {
        logger.error('failed to create media', err.message || err)
        logger.error(err.stack)
        return
      }

      await amqp.publish('v1.download', encoded)
    } catch (err) {
      child.error('failed to create job')
      console.log(err)
    }

    child.info('adding labels to certify this card is OK')
    await trello.makeRequest('post', `/1/cards/${cardId}/idLabels`, {
      value: metadataLabel
    })

    child.info('created job')
    span.finish()
  })
}
