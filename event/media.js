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
  const downloadProto = await proto.load('api.Download')

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

    if (!download || !source || !mal) {
      return child.error('card was invalid, source / download / mal was not found.')
    }

    child.info('adding labels to certify this card is OK')
    await trello.makeRequest('post', `/1/cards/${cardId}/idLabels`, {
      value: metadataLabel
    })

    let cardType = 0 // MOVIE
    if (!_.find(card.labels, { name: 'Movie' })) {
      cardType = 1 // TV
    }

    child.info('creating job')

    try {
      const payload = {
        createdAt: new Date().toISOString(),
        media: {
          id: uuid(),
          name: card.name,
          creator: 0, // TRELLO
          creatorId: cardId,
          type: cardType,

          // TODO: move download code into here to determine this
          source: 0, // HTTP
          // TODO: extract this here
          sourceURI: card.desc,
          MAL: mal.url
        }
      }
      const encoded = proto.encode(downloadProto, payload)
      
      await amqp.publish('v1.download', encoded)
    } catch (err) {
      child.error('failed to create job')
      console.log(err)
    }

    child.info('created job')
    span.finish()
  })
}
