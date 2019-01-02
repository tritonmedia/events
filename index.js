/**
 * Event Processor for the stack.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

'use strict'

const dyn = require('triton-core/dynamics')
const Config = require('triton-core/config')
const Tracer = require('triton-core/tracer').initTracer
const Event = require('events').EventEmitter

const kue = require('kue')
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})
const tracer = Tracer('events', logger)
const event = new Event()

const init = async () => {
  const config = await Config('events')
  const trello = require('./lib/trello')
  const queue = kue.createQueue({
    redis: dyn('redis')
  })

  logger.debug('starting trello init')

  // start the trello listener
  await trello(config.keys.trello, {
    callbackUrl: config.instance.webhook,
    board: config.instance.board,
    event,
    tracer
  })

  logger.debug('finished trello init')

  // media events
  await require('./event/media')(event, queue, config, tracer)
  await require('./event/status')(event, queue, config, tracer)
}

init()
