/**
 * Route Registration
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MITw
 */

const express = require('express')
const fs = require('fs-extra')
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

const auth = require('../lib/authentication')

/**
 * Registers routes
 * @param {express.Application} app express app instance
 * @param {Object} opts options instance
 */
const registerRoutes = async (app, opts) => {
  const a = auth(opts.db)
  const entries = await fs.readdir(__dirname)

  const versions = []
  const standaloneRoutes = []

  for (const entry of entries) {
    if (entry === 'routes.js') continue // skip self

    const stat = await fs.stat(path.join(__dirname, entry))
    if (stat.isDirectory()) {
      versions.push(entry)
      continue
    }

    standaloneRoutes.push(entry)
  }

  // require authentication
  app.use(a.requireAuthentication)

  // process versioned routes
  for (const version of versions) {
    logger.info('registered version', version, 'in routes')

    const versionRouter = new express.Router()
    const versionBase = `/${version}`
    const routes = await fs.readdir(path.join(__dirname, version))

    for (const route of routes) {
      const router = new express.Router()
      const routeBase = `/${route.replace('.js', '')}`

      logger.info('registered versioned route', `${version}/${route}`, 'on', versionBase + routeBase)
      await require(path.join(__dirname, version, route))(router, opts)

      versionRouter.use(routeBase, router)
    }

    app.use(versionBase, versionRouter)
  }

  // process top level routes, should be very few of these.
  for (const route of standaloneRoutes) {
    logger.info('registered route', route)
    await require(path.join(__dirname, route))(app, opts)
  }
}

module.exports = registerRoutes
