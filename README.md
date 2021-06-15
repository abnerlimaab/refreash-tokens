# Blog do código
> Uma API de blog em Node.js
> Alura Cursos

# Refresh Tokens e confirmação de cadastro

## Criando Refresh tokens

- Criamos a função criaTokenOpaco para gerar o Refresh token e depois definimos sua data de expiração utilizando o módulo moment.

~~~javascript
function criaTokenOpaco(usuario) {
    const tokenOpaco = crypto.randomBytes(24).toString('hex')
    const dataExpiracao = moment().add(5, 'd').unix()
    return tokenOpaco
}
~~~

- Na função de login, foi criada a cont RefreshToken que armazenará o token criado para o usuário da requisição e o retornaremos na resposta para o cliente

~~~javascript
async login(req, res) {
    try {
        const accessToken = criaTokenJWT(req.user);
        const RefreshToken = criaTokenOpaco(req.user)
        res.set('Authorization', accessToken);
        res.status(200).json({RefreshToken});
    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
},
~~~

## Manipulando uma lista genérica

- Na pasta do Redis, criamos o arquivo manipula-lista

- Utilizaremos promisses nas funções que se comunicarão com o banco de dados. Para isso, vamos importá-la.

~~~javascript
const { promisify } = require('util')
~~~

- Então, encapsulamos os métodos set, exists, get e del em promisses e com o método bind() inserimos a lista (como this) no escopo da função redis

~~~javascript
    const setAsync = promisify(lista.set).bind(lista)
    const existAsync = promisify(lista.exists).bind(lista)
    const getAsync = promisify(lista.get).bind(lista)
    const delAsync = promisify(lista.del).bind(lista)
~~~

- E retornamos um objeto com as funções "promissificadas"

~~~javascript
    return {
        async adiciona(chave, valor, dataExpiracao) {
            await setAsync(chave, valor)
            lista.expireat(chave, dataExpiracao)
        },
        async buscaValor(chave) {
            return getAsync(chave)
        },
        async vontemChave(chave) {
            const resultado = await existAsync(chave)
            return resultado === 1
        },
        async deflateRaw(chave) {
            await delAsync(chave)
        }
~~~

## Armazenando refresh tokens

- Criamos a allowlist-refresh-token dentro da pasta redis. O arquivo utilizará o módulo do redis e manipula lista (genérica) implementada anteriormente.

~~~javascript
const redis = require('redis')
const manipulaLista = require('./manipula-lista')
~~~

- Utilizamos o método createClient do redis para inserimos o prefixo desejado.

~~~javascript
const allowlist = redis.createClient({prefix: 'allowlist-refresh-token:'})
~~~

- Então, exportamos o retorno de manipulaLista tendo como argumento a allowList criada.

~~~javascript
module.exports = manipulaLista(allowlist)
~~~

- Na função criaTokenOpaco do controller de usuário, chamamos a função adiciona da nossa allowList criada através do manipulador de lista genérico e a transformamos em uma função assíncrona (procedimento que deve ser realizado nas demais chamadas da função)

~~~javascript
async function criaTokenOpaco(usuario) {
  const tokenOpaco = crypto.randomBytes(24).toString('hex')
  const dataExpiracao = moment().add(5, 'd').unix()
  await allowlistRefreshToken.adiciona(tokenOpaco, usuario.id, dataExpiracao)
  return tokenOpaco
}
~~~

- Por fim, incluimos a allowlist no server para que esteja disponível em toda a aplicação

~~~javascript
require('./redis/allowlist-refresh-token')
~~~

## Refatorando a blocklist

- Atualizamos os importes da blocklist importando o módulo redis e nosso arquivo que manipula-lista

~~~javascript
const redis = require('redis')
const manipulaLista = require('./manipula-lista')
~~~

- Criamos uma nova lista com redis com o prefixo blocklist-access-token e a passamos para manipula-lista

~~~javascript
const blocklist = redis.createClient({prefix: 'blocklist-access-token:'})
const manipulaBlockList = manipulaLista(blocklist)
~~~

- Refatoramos os métodos implementados anteriormente para usar manipulaBlockList

~~~javascript
module.exports = {
  async adiciona(token) {
    //...
    await manipulaBlockList.adiciona(tokenHash, '', dataExpiracao)
  },
  async contemToken(token) {
    //...
    return manipulaBlockList.contemChave(tokenHash)
  },
};
~~~

Obs: Como alteramos o nome do arquivo para blocklist-access-token, ajustamos sua chamada nos arquivos que o utilizam.

## Verificando refresh tokens

- Implementamos a função verificaRefreshToken que tem por responsabilidade checar o token na allow-list e retornar o id do usuário. Será retornado erro caso não tenha sido encaminhado um token pelo cliente ou o mesmo seja inválido.

~~~javascript
async function verificaRefreshToken(refreshToken) {
  if (!refreshToken) {
    throw new InvalidArgumentError('Refresh Token não enviado!')
  }
  const id = await allowListRefreshToken.buscaValor(refreshToken)
  if (!id) {
    throw new InvalidArgumentError('Refresh token inválido!')
  }
  return id
}
~~~

- Implementamos a função invalidaRefreshToken que tem por responsabilidade retirar o token da allow-list o tornando inválido.

~~~javascript
async function invalidaRefreshToken(refreshToken) {
  await allowListRefreshToken.deflateRaw(refreshToken)
}
~~~

- Então, implementamos o middleware refresh que tem por responsabilidade recolher o token do corpo da requisição, verificar se o token enviado é válido e torná-lo inválido. Por fim, uma instãncia de Usuário será inclusa na requisição pelo método buscaPorId que terá por parâmetro o id retornado da verificação do token.

~~~javascript
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body
      const id = await verificaRefreshToken(refreshToken)
      await invalidaRefreshToken(refreshToken)
      req.user = await Usuario.buscaPorId(id)
      return next()
    } catch (erro) {
      if (erro.name === 'InvalidArgumentError') return res.status(401).json({erro: erro.message})
      return res.status(500).json({erro: erro.message})
    }
  }
~~~

## Implementando as rotas

- Criamos a rota /usuario/atualiza_token que aciona o refresh do middleware de autenticação que invalida o token da requisição e então concederemos um novo token através da função login do usuariosControlador com base no id de usuário retornado pelo refresh.

~~~javascript

  app
    .route('/usuario/atualiza_token')
    .post(middlewaresAutenticacao.refresh, usuariosControlador.login)
~~~

- Na rota de logout já existente, passamos agora uma lista com os middlewares refresh e bearer e en seguida é executada a função logout

~~~javascript
  app
    .route('/usuario/logout')
    .post([middlewaresAutenticacao.refresh, middlewaresAutenticacao.bearer], usuariosControlador.logout);
~~~

# Modularizando os tokens

## Modulariizando a criação

- Criamos o módulo tokens.js que terá a responsabilidade de gerenciar os tokens

- Reimplementamos a função criaTokenJWT de forma genérica

~~~javascript
function criaTokenJWT(id, [tempoQuantidade, tempoUnidade]) {
    const payload = { id };
    const token = jwt.sign(payload, process.env.CHAVE_JWT, { expiresIn: tempoQuantidade + tempoUnidade });
    return token;
}
~~~

- Reimplementamos a função criaTokenOpaco de forma genérica

~~~javascript
async function criaTokenOpaco(id, [tempoQuantidade, tempoUnidade], allowlist) {
    const tokenOpaco = crypto.randomBytes(24).toString('hex')
    const dataExpiracao = moment().add(tempoQuantidade, tempoUnidade).unix()
    await allowlist.adiciona(tokenOpaco, id, dataExpiracao)
    return tokenOpaco
}
~~~

- Exportamos os objetos access e refresh

~~~javascript
module.exports = {
    access: {
        expiracao: [15, 'm'],
        cria(id) {
            return criaTokenJWT(id, this.expiracao)
        }
    },
    refresh: {
        lista: allowlistRefreshToken,
        expiracao: [5, 'd'],
        cria(id) {
            return criaTokenOpaco(id, this.expiracao, this.lista)
        }
    }
}
~~~

- Atualizamos a chamada dos métodos de criação de tokens da função login para utilização do módulo.

~~~javascript
  async login(req, res) {
    try {
      const accessToken = tokens.access.cria(req.user.id);
      const refreashToken = await tokens.refresh.cria(req.user.id)
      //...
  },
~~~

## Modularizando a verificação

- Reimplementamos de forma generalizada as funções verificaTokenJWT, verificaTokenNaBlocklist e verificaTokenOpaco tirando reduzindo assim as responsabilidades dos middlewares-autenticacao e das estrategias-autenticacao transferindo-as para o módulo tokens.js

- Implementamos as funções verificaTokenValido e verificaTokenEnviado que agora passarão erros personalizados conforme o token enviado

- Adicionamos os métodos verifica(token) nos objetos access e refresh que chamam a função especifica do token

## Modularizando a invalidação

- Reimplementamos as funções invalidaTokenJWT e invalidaTokenOpaco de forma genérica no módulo tokens.js

- Implementamos o método invalida nos objetos access e refresh do módulo

- Substituimos a função invalidaRefreshToken da função refresh de middlewares-autenticacao pelo método invalida do objeto refresh modularizado em tokens.js

- Substituimos a função blocklist.adiciona da função logout de usuario-controlador pelo método invalida do objeto access modularizado em tokens.js

## Enviando e-mails

- Instalamos o módulo nodemailer

- Criamos o módulo emails.js dentro da pasta usuarios e importamos o nodemailer

- Implementamos a função enviaEmail

~~~javascript
async function enviaEmail(usuario) {
    //método do nodemailer que cria uma conta de teste que será usada no parâmetro auth do transportador
    const contaTeste = await nodemailer.createTestAccount()
    //criamos um transportador com o método createTransport com o host de teste do nodemailer e o auth criado na linha anterior
    const transportador = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        auth: contaTeste
    })
    //Com o método sendEmail do transportador, enviamos um e-mail de acordo com o objeto passado no parâmetro da função e teremos como retorno a url de validação do e-mail
    const info = await transportador.sendMail({
        from: '"Blog do Código" <noreply@blogdocodigo.com.br>',
        to: usuario.email,
        subject: 'Teste de e-mail',
        text: 'Olá! Este é um e-mail de teste',
        html: '<h1>Olá!</h1> <p>Este é um e-mail de teste</p>'
    })
    console.log('URL: ' + nodemailer.getTestMessageUrl(info))
}
~~~

- Chamamos a função enviaEmail logo após a criação do usuário no arquivo usuario-controlador dentro da função adiciona.

## Configurando o e-mail e organizando o endereço

- Criamos a classe Email transformando a função enviaEmail em um método

- Implementamos a classe EmailVerificacao que herda os métodos de Email e definimos os atributos que serão utilizados na construção do e-mail {from, to, subject, text, html}

~~~javascript
  this.from = '"Blog do Código" <noreply@blogdocodigo.com.br>'
  this.to = usuario.email
  this.subject = 'Verificação de e-mail'
  this.text = `Olá! Verifique seu e-mail aqui: ${endereco}`
  this.html = `<h1>Olá!</h1> Verifique seu e-mail aqui: <a href"${endereco}">${endereco}</a>`
~~~

- Desta forma, podemos enviar this como parâmetro da função sendEmail do transportador utiliado na classe mãe Email

~~~javascript
  const info = await transportador.sendMail(this)
~~~

- O módulo passa a exportar a classe EmailVerificacao em substituição a função enviaEmail

- Atualizamos o importe do módulo email no arquivo usuario-controlador para pegarmos a nova classe implementada

- Criamos a função geraEndereco que terá a responsabilidade de criar o endereço de verificação a ser enviado.

~~~javascript
function geraEndereco(rota, id) {
  const baseURL = process.env.BASE_URL //Definimos a BASE_URL na variável de ambiente env
  return `${baseURL}${rota}${id}`
}
~~~

Obs: O atributo id ainda não era conhecido no método adiciona do controlador, então ajustamos o método no usuarios-modelo para retorno do atributo na instância

~~~javascript
async adiciona() {
  //...
  await usuariosDao.adiciona(this);
  const { id } = await usuariosDao.buscaPorEmail(this.email)
  this.id = id
}
~~~

- Chamamos a função geraEndereco no método adiciona de usuarios-controlador

- Criamos uma instãncia da classe EmailVerificacao passando o usuario e endereco já conhecidos

- Por fim, chamamos o método enviaEmail da classe EmailVerificacao

~~~javascript
  const endereco = geraEndereco('/usuario/verifica_email/', usuario.id)
  const emailVerificacao = new EmailVerificacao(usuario, endereco)
  emailVerificacao.enviaEmail().catch(console.log)
~~~