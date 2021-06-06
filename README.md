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