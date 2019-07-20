/**
 * Authentication Helpers
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 */

'use strict'

const randomString = require('crypto-random-string')
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

module.exports = (db) => {
  return {
    requireAuthentication: async (req, res, next) => {
      const token = req.headers.authorization

      logger.debug('checking if token', token, 'is valid')
      const isValid = await db.tokenExists(token)
      logger.debug('token is valid:', isValid)
      if (isValid) {
        return next()
      }

      return res.error('Invalid Authentication', 401)
    },

    /**
     * Returns a valid API token and stores it
     *
     * @returns {String} api token
     */
    generateAPIToken: async () => {
      const token = randomString({
        length: 128
      })

      await db.insertToken(token)
      return token
    }
  }
}
