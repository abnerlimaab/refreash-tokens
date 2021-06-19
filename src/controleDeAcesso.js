const AccessControl = require('accesscontrol')
const controle = new AccessControl()

controle.grant('assinante').read('post', ['id', 'titulo', 'conteudo', 'autor'])

module.exports = controle