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

const Storage = require('../lib/db.js')

const dyn = require('triton-core/dynamics')
const AMQP = require('triton-core/amqp')
const proto = require('triton-core/proto')
const tracer = require('triton-core/tracer')

/* eslint no-unused-vars: [0] */
const Event = require('events')
const { opentracing, Tags, serialize, unserialize, error } = require('triton-core/tracer')

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

    const mal = _.find(attachments, {
      name: 'MAL'
    })

    const imdb = _.find(attachments, {
      name: 'IMDB'
    })

    // no download, no source, no mal or imdb, mal and imdb
    if (!download || !source || (!mal && !imdb) || (mal && imdb)) {
      return child.error('card was invalid')
    }

    let cardType = 0 // MOVIE
    if (!_.find(card.labels, { name: 'Movie' })) {
      cardType = 1 // TV
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

      let source
      switch (sourceProtocol) {
        case 'http':
          source = 0
          break
        case 'magnet':
          source = 1
          break
        case 'file':
          source = 2
          break
      }

      let metadata
      let metadataId
      if (mal) {
        metadata = 0
        const data = mal.url
        let id = parseInt(data, 10)
        if (isNaN(id)) {
          // attempt to parse it as a URL
          const malUrl = new url.URL(data)
          const pathSplit = malUrl.pathname.split('/', 3)
          child.info(malUrl.pathname)
          id = parseInt(pathSplit[2], 10)
          if (isNaN(id)) {
            return child.error('invalid MAL url')
          }
        }

        metadataId = id.toString(10)
      } else if (imdb) {
        metadata = 1
        const data = imdb.url
        if (data[0] === 't') { // ids look like tt21313
          metadataId = data
        } else {
          const imdbUrl = new url.URL(data)
          const pathSplit = imdbUrl.pathname.split('/', 3)
          metadataId = pathSplit[2]

          if (metadataId[0] !== 't') {
            return child.error('invalid IMDB url')
          }
        }
      }

      let encoded
      try {
        encoded = await db.new(card.name, 0, cardId, cardType, source, sourceUrl, metadata, metadataId)
      } catch (err) {
        logger.error('failed to create media', err.message)
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
