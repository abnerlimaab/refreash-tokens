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