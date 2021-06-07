# Blog do código
> Uma API de blog em Node.js
> Alura Cursos

# Refreash Tokens e confirmação de cadastro

## Criando refreash tokens

- Criamos a função criaTokenOpaco para gerar o refreash token e depois definimos sua data de expiração utilizando o módulo moment.

~~~javascript
function criaTokenOpaco(usuario) {
    const tokenOpaco = crypto.randomBytes(24).toString('hex')
    const dataExpiracao = moment().add(5, 'd').unix()
    return tokenOpaco
}
~~~

- Na função de login, foi criada a cont refreashToken que armazenará o token criado para o usuário da requisição e o retornaremos na resposta para o cliente

~~~javascript
async login(req, res) {
    try {
        const accessToken = criaTokenJWT(req.user);
        const refreashToken = criaTokenOpaco(req.user)
        res.set('Authorization', accessToken);
        res.status(200).json({refreashToken});
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
