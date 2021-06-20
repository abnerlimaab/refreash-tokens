const Usuario = require('./usuarios-modelo')
const { InvalidArgumentError } = require('../erros')

const tokens = require('./tokens')
const { EmailVerificacao } = require('./emails')

function geraEndereco (rota, token) {
  const baseURL = process.env.BASE_URL
  return `${baseURL}${rota}${token}`
}

module.exports = {
  async adiciona (req, res, prox) {
    const { nome, email, senha, cargo } = req.body

    try {
      const usuario = new Usuario({
        nome,
        email,
        emailVerificado: false,
        cargo
      })
      await usuario.adicionaSenha(senha)
      await usuario.adiciona()

      const token = tokens.verificacaoEmail.cria(usuario.id)
      const endereco = geraEndereco('/usuario/verifica_email/', token)
      const emailVerificacao = new EmailVerificacao(usuario, endereco)
      emailVerificacao.enviaEmail().catch(console.log)

      res.status(201).json()
    } catch (erro) {
      prox(erro)
    }
  },

  async login (req, res, prox) {
    try {
      const accessToken = tokens.access.cria(req.user.id)
      const refreshToken = await tokens.refresh.cria(req.user.id)
      res.set('Authorization', accessToken)
      res.status(200).json({ refreshToken })
    } catch (erro) {
      prox(erro)
    }
  },

  async logout (req, res, prox) {
    try {
      const token = req.token
      await tokens.access.invalida(token)
      res.status(204).json()
    } catch (erro) {
      prox(erro)
    }
  },

  async lista (req, res, prox) {
    try {
      const usuarios = await Usuario.lista()
      res.json(usuarios)
    } catch (erro) {
      prox(erro)
    }
  },

  async verificaEmail (req, res, prox) {
    try {
      const usuario = req.user
      await usuario.verificaEmail()
      res.status(200).json()
    } catch (erro) {
      prox(erro)
    }
  },

  async deleta (req, res, prox) {
    try {
      const usuario = await Usuario.buscaPorId(req.params.id)
      await usuario.deleta()
      res.status(200).json()
    } catch (erro) {
      prox(erro)
    }
  }
}
