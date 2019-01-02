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

const tracer = require('triton-core/tracer')

/* eslint no-unused-vars: [0] */
const Event = require('events')
const { opentracing, Tags, serialize, unserialize } = require('triton-core/tracer')

/**
 * Parse Trello events / whatever into stack events.
 *
 * @param  {Event.EventEmitter} emitter event emitter
 * @param  {Object} queue               Kue queue
 * @param  {Object} config              config
 * @param  {opentracing.Tracer} tracer  tracer object
 * @return {undefined}                  stop
 */
module.exports = (emitter, queue, config, tracer) => {
  const trello = new Trello(config.keys.trello.key, config.keys.trello.token)

  // Process new media.
  emitter.on('updateCard', async (event, rootContext) => {
    const span = tracer.startSpan('updateCard', {
      childOf: unserialize(rootContext)
    })

    if (!event.data.listAfter) {
      return tracer.error(span, new Error('Card wasn\'t moved'))
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

    child.info('creating job')
    queue.create('newMedia', {
      id: cardId,
      card: card,
      rootContext: serialize(span),
      media: {
        source: source.url,
        mal: mal.url,
        download: download,
        type: 'unknown'
      }
    }).removeOnComplete(true).save(err => {
      if (err) {
        return tracer.error(span, new Error('Failed to save job'))
      }

      return span.finish()
    })
  })
}
