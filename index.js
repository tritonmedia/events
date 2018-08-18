/**
 * Event Processor for the stack.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

'use strict'

const _ = require('lodash')
const dyn = require('triton-core/dynamics')
const Config = require('triton-core/config')
const kue = require('kue')
const debug = require('debug')('media:events')

const Event = require('events').EventEmitter
const event = new Event()

const init = async () => {
  const config = await Config('events')
  const trello = require('./lib/trello')
  const queue = kue.createQueue({
    redis: dyn('redis')
  })

  debug('init', 'starting trello init')

  // start the trello listener
  await trello(config.keys.trello, {
    callbackUrl: config.instance.webhook,
    board: config.instance.board,
    event: event
  })

  debug('init', 'finished trello init')

  // media events
  await require('./event/media')(event, queue, config)
  await require('./event/status')(event, queue, config)
}

init()
