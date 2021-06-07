const redis = require('redis')
const manipulaLista = require('./manipula-lista')

const blocklist = redis.createClient({prefix: 'blocklist-access-token:'})
const manipulaBlockList = manipulaLista(blocklist)

const jwt = require('jsonwebtoken');
const { createHash } = require('crypto');

function geraTokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

module.exports = {
  async adiciona(token) {
    const dataExpiracao = jwt.decode(token).exp;
    const tokenHash = geraTokenHash(token);
    await manipulaBlockList.adiciona(tokenHash, '', dataExpiracao)
  },
  async contemToken(token) {
    const tokenHash = geraTokenHash(token);
    return manipulaBlockList.contemChave(tokenHash)
  },
};
