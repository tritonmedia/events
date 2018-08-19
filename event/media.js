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

/**
 * Parse Trello events / whatever into stack events.
 *
 * @param  {Event.EventEmitter} emitter event emitter
 * @param  {Object} queue               Kue queue
 * @param  {Object} config              config
 * @return {undefined}                  stop
 */
module.exports = (emitter, queue, config) => {
  const trello = new Trello(config.keys.trello.key, config.keys.trello.token)

  // Process new media.
  emitter.on('updateCard', async event => {
    if (!event.data.listAfter) return logger.debug('skiping card that wasn\'t moved')

    const listNow = event.data.listAfter.id
    const listBefore = event.data.listBefore.id
    const cardId = event.data.card.id
    const cardName = event.data.card.name

    const child = logger.child({
      listAfter,
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
      debug('newMedia', download, source, mal)
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
      media: {
        source: source.url,
        mal: mal.url,
        download: download,
        type: 'unknown'
      }
    }).removeOnComplete(true).save(err => {
      if (err) return child.error('failed to save job')
    })
  })
}
